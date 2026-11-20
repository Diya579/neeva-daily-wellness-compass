"""
Community Backend API backed by Cloud Firestore:
- `community_posts/{post_id}`
- `community_posts/{post_id}/replies/{reply_id}`
- `community_posts/{post_id}/supports/{uid}`
- `anonymous_identities/{uid}`
- `community_moderation/{log_id}`
- `user_reports/{report_id}`
- `moderator_actions/{action_id}`
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status

from app.ai.dlp_client import redact_pii
from app.core.security import get_current_user, require_moderator
from app.database.firestore_db import FirestoreOperationalRepository, get_firestore_repo
from app.safety.crisis_patterns import SafetyTier
from app.safety.engine import get_safety_engine
from app.schemas.community import (
    ModerationActionRequest,
    PostCreate,
    PostResponse,
    ReplyCreate,
    ReplyResponse,
    ReportCreate,
)

router = APIRouter(prefix="/api/v1/community", tags=["community"])


async def _ensure_anon_identity(uid: str, fs: FirestoreOperationalRepository) -> dict:
    ident = await fs.get_doc(f"anonymous_identities/{uid}")
    if ident is None:
        ident = {
            "user_id": uid,
            "circles": ["campus"],
            "blocked_uids": [],
            "muted_uids": [],
            "updated_at": datetime.now(timezone.utc),
        }
        await fs.set_doc(f"anonymous_identities/{uid}", ident)
    return ident


async def _serialize_post(
    post: dict,
    viewer_uid: str,
    fs: FirestoreOperationalRepository,
    pii_redacted: bool = False,
) -> PostResponse:
    pid = post["id"]
    supports = await fs.list_collection(f"community_posts/{pid}/supports", limit=500)
    my_supp = await fs.get_doc(f"community_posts/{pid}/supports/{viewer_uid}")
    replies = await fs.list_collection(
        f"community_posts/{pid}/replies",
        filters=[("status", "==", "visible")],
        limit=500,
    )
    return PostResponse(
        id=pid if isinstance(pid, uuid.UUID) else uuid.UUID(str(pid)),
        alias=post["alias"],
        circle=post["circle"],
        body=post["body"],
        created_at=post["created_at"],
        is_team=bool(post.get("is_team", False)),
        is_mine=bool(post.get("author_id") and post.get("author_id") == viewer_uid),
        support_count=len(supports),
        supported_by_me=my_supp is not None,
        reply_count=len(replies),
        pii_redacted=pii_redacted or bool(post.get("pii_redacted", False)),
    )


@router.get("/feed", response_model=list[PostResponse])
async def get_community_feed(
    circle: Optional[str] = Query(default=None),
    limit: int = Query(default=60, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    ident = await _ensure_anon_identity(uid, fs)
    blocked = set(ident.get("blocked_uids") or [])
    muted = set(ident.get("muted_uids") or [])
    my_reports = await fs.list_collection(
        "user_reports",
        filters=[("reporter_id", "==", uid)],
        limit=500,
    )
    reported_post_ids = {str(r["post_id"]) for r in my_reports}

    filters = []
    if circle:
        filters.append(("circle", "==", circle))

    all_posts = await fs.list_collection(
        "community_posts",
        filters=filters if filters else None,
        order_by=[("is_team", True), ("created_at", True)],
        limit=300,
    )
    visible: list[dict] = []
    for p in all_posts:
        st = p.get("status", "visible")
        author = p.get("author_id")
        if st == "removed":
            continue
        if st == "hidden" and author != uid:
            continue
        if str(p["id"]) in reported_post_ids:
            continue
        if author and (author in blocked or author in muted):
            continue
        visible.append(p)

    paged = visible[offset : offset + limit]
    return [await _serialize_post(p, uid, fs) for p in paged]


@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_community_post(
    body: PostCreate,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    await fs.ensure_user_profile(uid, user.get("name", ""))
    await _ensure_anon_identity(uid, fs)

    # 1. Three-Tier Safety Check BEFORE publishing
    engine = get_safety_engine()
    safety = await engine.evaluate(body.body)
    await fs.log_safety_event(
        uid=uid,
        source="community",
        tier=int(safety.tier),
        deterministic_tier=int(safety.deterministic_tier),
        muril_tier=int(safety.muril_tier) if safety.muril_tier is not None else None,
        confidence=safety.confidence,
        should_interrupt=safety.should_interrupt,
    )
    if safety.tier == SafetyTier.TIER3_ACUTE:
        raise HTTPException(
            status_code=422,
            detail={
                "crisis": True,
                "tier": 3,
                "message": safety.crisis_message,
                "helplines": safety.helplines,
            },
        )

    # 2. Google Cloud DLP + Indian PII Redaction
    scrubbed_body, found_pii = await redact_pii(body.body)
    scrubbed_alias, _ = await redact_pii(body.alias)
    now = datetime.now(timezone.utc)
    post_id = uuid.uuid4()

    post_doc = {
        "id": post_id,
        "author_id": uid,
        "alias": scrubbed_alias[:40],
        "circle": body.circle,
        "body": scrubbed_body[:600],
        "status": "visible",
        "is_team": False,
        "moderation": "ai",
        "safety_tier": int(safety.tier),
        "pii_redacted": len(found_pii) > 0,
        "created_at": now,
    }
    await fs.set_doc(f"community_posts/{post_id}", post_doc)

    if found_pii:
        log_id = str(uuid.uuid4())
        await fs.set_doc(
            f"community_moderation/{log_id}",
            {
                "id": log_id,
                "target_type": "post",
                "target_id": str(post_id),
                "moderator_id": "system_dlp",
                "action": "dlp_redact",
                "reason": f"Redacted PII types: {', '.join(found_pii)}",
                "created_at": now,
            },
        )

    return await _serialize_post(post_doc, uid, fs, pii_redacted=len(found_pii) > 0)


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_community_post(
    post_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    post = await fs.get_doc(f"community_posts/{post_id}")
    if post is None or post.get("status") == "removed":
        raise HTTPException(status_code=404, detail="Post not found.")
    if post.get("status") == "hidden" and post.get("author_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Post not found.")
    return await _serialize_post(post, user["uid"], fs)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_community_post(
    post_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    post = await fs.get_doc(f"community_posts/{post_id}")
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found.")
    if post.get("author_id") != user["uid"] and user.get("role") not in ("moderator", "admin"):
        raise HTTPException(status_code=403, detail="You can only delete your own posts.")
    await fs.delete_doc(f"community_posts/{post_id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/posts/{post_id}/support")
async def toggle_post_support(
    post_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    post = await fs.get_doc(f"community_posts/{post_id}")
    if post is None or post.get("status") != "visible":
        raise HTTPException(status_code=404, detail="Post not found.")

    supp_path = f"community_posts/{post_id}/supports/{uid}"
    existing = await fs.get_doc(supp_path)
    if existing is not None:
        await fs.delete_doc(supp_path)
        return {"supported": False}

    await fs.set_doc(
        supp_path,
        {"post_id": str(post_id), "user_id": uid, "created_at": datetime.now(timezone.utc)},
    )
    return {"supported": True}


@router.post("/posts/{post_id}/replies", response_model=ReplyResponse, status_code=status.HTTP_201_CREATED)
async def create_post_reply(
    post_id: uuid.UUID,
    body: ReplyCreate,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    post = await fs.get_doc(f"community_posts/{post_id}")
    if post is None or post.get("status") != "visible":
        raise HTTPException(status_code=404, detail="Post not found.")

    engine = get_safety_engine()
    safety = await engine.evaluate(body.body)
    if safety.tier == SafetyTier.TIER3_ACUTE:
        raise HTTPException(
            status_code=422,
            detail={
                "crisis": True,
                "tier": 3,
                "message": safety.crisis_message,
                "helplines": safety.helplines,
            },
        )

    scrubbed_body, _ = await redact_pii(body.body)
    scrubbed_alias, _ = await redact_pii(body.alias)
    reply_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    reply_doc = {
        "id": reply_id,
        "post_id": post_id,
        "author_id": uid,
        "alias": scrubbed_alias[:40],
        "body": scrubbed_body[:400],
        "status": "visible",
        "safety_tier": int(safety.tier),
        "created_at": now,
    }
    await fs.set_doc(f"community_posts/{post_id}/replies/{reply_id}", reply_doc)
    return ReplyResponse(
        id=reply_id,
        post_id=post_id,
        alias=reply_doc["alias"],
        body=reply_doc["body"],
        is_mine=True,
        created_at=now,
    )


@router.get("/posts/{post_id}/replies", response_model=list[ReplyResponse])
async def list_post_replies(
    post_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    rows = await fs.list_collection(
        f"community_posts/{post_id}/replies",
        filters=[("status", "==", "visible")],
        order_by=[("created_at", False)],
        limit=200,
    )
    return [
        ReplyResponse(
            id=r["id"] if isinstance(r["id"], uuid.UUID) else uuid.UUID(str(r["id"])),
            post_id=post_id,
            alias=r["alias"],
            body=r["body"],
            is_mine=bool(r.get("author_id") and r.get("author_id") == user["uid"]),
            created_at=r["created_at"],
        )
        for r in rows
    ]


@router.post("/posts/{post_id}/report", status_code=status.HTTP_201_CREATED)
async def report_community_post(
    post_id: uuid.UUID,
    body: ReportCreate,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    post = await fs.get_doc(f"community_posts/{post_id}")
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found.")

    existing = await fs.list_collection(
        "user_reports",
        filters=[("post_id", "==", str(post_id)), ("reporter_id", "==", uid)],
        limit=1,
    )
    if existing:
        raise HTTPException(status_code=409, detail="You have already reported this post.")

    now = datetime.now(timezone.utc)
    rep_id = str(uuid.uuid4())
    await fs.set_doc(
        f"user_reports/{rep_id}",
        {
            "id": rep_id,
            "post_id": str(post_id),
            "reporter_id": uid,
            "target": body.target,
            "reason": body.reason,
            "details": body.details,
            "created_at": now,
        },
    )

    all_reports = await fs.list_collection(
        "user_reports",
        filters=[("post_id", "==", str(post_id))],
        limit=500,
    )
    total_reports = len(all_reports)
    harm_reports = sum(1 for r in all_reports if r["reason"] == "self_harm")

    auto_hidden = False
    if (total_reports >= 3 or harm_reports >= 2) and post.get("status") == "visible" and not post.get("is_team"):
        await fs.set_doc(f"community_posts/{post_id}", {"status": "hidden"}, merge=True)
        auto_hidden = True
        log_id = str(uuid.uuid4())
        await fs.set_doc(
            f"community_moderation/{log_id}",
            {
                "id": log_id,
                "target_type": "post",
                "target_id": str(post_id),
                "moderator_id": "system_threshold",
                "action": "auto_hide",
                "reason": f"Auto-hidden (reports={total_reports}, self_harm={harm_reports})",
                "created_at": now,
            },
        )

    return {"status": "reported", "auto_hidden": auto_hidden}


@router.post("/posts/{post_id}/block")
async def block_post_author(
    post_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    post = await fs.get_doc(f"community_posts/{post_id}")
    author = post.get("author_id") if post else None
    if not post or post.get("is_team") or not author or author == uid:
        return {"blocked": False}

    ident = await _ensure_anon_identity(uid, fs)
    blocked = set(ident.get("blocked_uids") or [])
    blocked.add(author)
    await fs.set_doc(f"anonymous_identities/{uid}", {"blocked_uids": list(blocked)}, merge=True)
    return {"blocked": True}


@router.post("/posts/{post_id}/mute")
async def mute_post_author(
    post_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    post = await fs.get_doc(f"community_posts/{post_id}")
    author = post.get("author_id") if post else None
    if not post or post.get("is_team") or not author or author == uid:
        return {"muted": False}

    ident = await _ensure_anon_identity(uid, fs)
    muted = set(ident.get("muted_uids") or [])
    muted.add(author)
    await fs.set_doc(f"anonymous_identities/{uid}", {"muted_uids": list(muted)}, merge=True)
    return {"muted": True}


@router.post("/posts/{post_id}/moderate")
async def moderate_post(
    post_id: uuid.UUID,
    body: ModerationActionRequest,
    moderator: dict = Depends(require_moderator),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    post = await fs.get_doc(f"community_posts/{post_id}")
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found.")

    status_map = {"hide": "hidden", "remove": "removed", "restore": "visible"}
    new_status = status_map[body.action]
    await fs.set_doc(f"community_posts/{post_id}", {"status": new_status}, merge=True)

    act_id = str(uuid.uuid4())
    await fs.set_doc(
        f"moderator_actions/{act_id}",
        {
            "id": act_id,
            "target_type": "post",
            "target_id": str(post_id),
            "moderator_id": moderator["uid"],
            "action": body.action,
            "reason": body.reason,
            "created_at": datetime.now(timezone.utc),
        },
    )
    return {"status": new_status, "post_id": str(post_id)}


@router.post("/circles/{circle_id}/join", status_code=status.HTTP_201_CREATED)
async def join_circle(
    circle_id: str = Path(..., pattern=r"^[a-z]{2,20}$"),
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    ident = await _ensure_anon_identity(uid, fs)
    circles = set(ident.get("circles") or [])
    circles.add(circle_id)
    await fs.set_doc(f"anonymous_identities/{uid}", {"circles": list(circles)}, merge=True)
    return {"circle": circle_id, "joined": True}


@router.delete("/circles/{circle_id}/join", status_code=status.HTTP_204_NO_CONTENT)
async def leave_circle(
    circle_id: str = Path(..., pattern=r"^[a-z]{2,20}$"),
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    ident = await _ensure_anon_identity(uid, fs)
    circles = set(ident.get("circles") or [])
    circles.discard(circle_id)
    await fs.set_doc(f"anonymous_identities/{uid}", {"circles": list(circles)}, merge=True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
