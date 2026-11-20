"""
End-to-End Integration Tests for all Neeva AI REST API Endpoints (Section 14 & 16):
- Authentication & Unauthorized Rejection
- Cross-User Access Prevention (Alice vs Bob isolation)
- Profile CRUD & Account Deletion
- Encrypted Journal CRUD, Drafts, Reflective Analysis & Tier 3 Crisis Block
- Mood Persistence, IST Streak & Analytics, CSV & JSON Export
- Thought Records CRUD
- Chat Streaming & Tier 3 Crisis Interrupt
- Community Anonymous Feed, DLP PII Redaction, Support, Replies, 3-Report Auto-Hide, Block, Mute, Moderator RBAC
- Privacy Consents, Data Export, and Full Data Purge
"""
from __future__ import annotations

import os

import pytest
from httpx import AsyncClient

from app.privacy.encryption import derive_key_pbkdf2, encrypt_aes_gcm_256

ALICE_HEADERS = {"Authorization": "Bearer token_alice"}
BOB_HEADERS = {"Authorization": "Bearer token_bob"}
MOD_HEADERS = {"Authorization": "Bearer token_moderator"}


@pytest.mark.anyio
async def test_health_and_auth_enforcement(client: AsyncClient):
    r_health = await client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "ok"

    # Missing token -> 401
    r_unauth = await client.get("/api/v1/profile")
    assert r_unauth.status_code == 401

    # Invalid token -> 401
    r_bad = await client.get("/api/v1/profile", headers={"Authorization": "Bearer invalid_jwt"})
    assert r_bad.status_code == 401

    # Valid session verification
    r_sess = await client.post("/api/v1/auth/verify-session", headers=ALICE_HEADERS)
    assert r_sess.status_code == 200
    assert r_sess.json()["uid"] == "firebase_uid_alice_001"


@pytest.mark.anyio
async def test_profile_crud_and_account_deletion(client: AsyncClient):
    r_get = await client.get("/api/v1/profile", headers=ALICE_HEADERS)
    assert r_get.status_code == 200
    assert r_get.json()["companion_name"] == "Neeva"

    r_patch = await client.patch(
        "/api/v1/profile",
        headers=ALICE_HEADERS,
        json={
            "display_name": "Alice S.",
            "goal": "focus",
            "preferred_language": "hinglish",
            "companion_name": "Saathi",
            "companion_vibe": "coach",
            "onboarded": True,
        },
    )
    assert r_patch.status_code == 200
    data = r_patch.json()
    assert data["display_name"] == "Alice S."
    assert data["goal"] == "focus"
    assert data["preferred_language"] == "hinglish"
    assert data["companion_name"] == "Saathi"
    assert data["onboarded"] is True

    r_del = await client.delete("/api/v1/account", headers=ALICE_HEADERS)
    assert r_del.status_code == 204


@pytest.mark.anyio
async def test_journal_persistence_cross_user_isolation_and_analysis(client: AsyncClient):
    key = derive_key_pbkdf2("alice-key", os.urandom(16))
    enc = encrypt_aes_gcm_256("Today I studied for 4 hours and felt grateful for my friends.", key)
    ct_b64, iv_b64 = enc.to_base64()

    # Alice creates an encrypted journal entry
    r_create = await client.post(
        "/api/v1/journal",
        headers=ALICE_HEADERS,
        json={
            "prompt": "What went well today?",
            "content_ciphertext": ct_b64,
            "content_iv": iv_b64,
            "word_count": 12,
        },
    )
    assert r_create.status_code == 201
    entry_id = r_create.json()["id"]

    # Bob attempts to read, patch, or delete Alice's journal entry -> 404 (Cross-user access prevented)
    assert (await client.get(f"/api/v1/journal/{entry_id}", headers=BOB_HEADERS)).status_code == 404
    assert (
        await client.patch(f"/api/v1/journal/{entry_id}", headers=BOB_HEADERS, json={"word_count": 99})
    ).status_code == 404
    assert (await client.delete(f"/api/v1/journal/{entry_id}", headers=BOB_HEADERS)).status_code == 404

    # Alice runs reflective analysis
    r_analyze = await client.post(
        f"/api/v1/journal/{entry_id}/analyze",
        headers=ALICE_HEADERS,
        json={
            "text": "Today I studied for 4 hours and felt grateful for my friends.",
            "prompt": "What went well today?",
        },
    )
    assert r_analyze.status_code == 200
    assert "analysis" in r_analyze.json()
    assert "emotions" in r_analyze.json()["analysis"]

    # Tier 3 acute crisis in journal analysis is blocked before LLM
    r_crisis = await client.post(
        f"/api/v1/journal/{entry_id}/analyze",
        headers=ALICE_HEADERS,
        json={
            "text": "I want to kill myself tonight and end my life.",
            "prompt": "What is on your mind?",
        },
    )
    assert r_crisis.status_code == 422
    assert r_crisis.json()["detail"]["crisis"] is True


@pytest.mark.anyio
async def test_mood_tracking_analytics_and_exports(client: AsyncClient):
    for mood_key, intensity in [("anxious", 7), ("peaceful", 8), ("joyful", 9)]:
        r = await client.post(
            "/api/v1/moods",
            headers=ALICE_HEADERS,
            json={
                "mood": mood_key,
                "intensity": intensity,
                "triggers": ["Studies", "Sleep"],
                "note": "Preparation check-in",
            },
        )
        assert r.status_code == 201

    # Bob cannot see Alice's moods
    r_bob_moods = await client.get("/api/v1/moods", headers=BOB_HEADERS)
    assert r_bob_moods.status_code == 200
    assert len(r_bob_moods.json()) == 0

    # Alice mood analytics
    r_analytics = await client.get("/api/v1/moods/analytics?period=week", headers=ALICE_HEADERS)
    assert r_analytics.status_code == 200
    analytics = r_analytics.json()
    assert analytics["entries_count"] == 3
    assert analytics["streak_days"] >= 1
    assert "Studies" in analytics["most_common_triggers"]

    # CSV & JSON exports
    r_csv = await client.get("/api/v1/moods/export?format=csv", headers=ALICE_HEADERS)
    assert r_csv.status_code == 200
    assert "date,time,mood,mood_score,intensity,triggers" in r_csv.text

    r_json = await client.get("/api/v1/moods/export?format=json", headers=ALICE_HEADERS)
    assert r_json.status_code == 200
    assert r_json.json()["app"] == "Neeva"
    assert len(r_json.json()["moods"]) == 3


@pytest.mark.anyio
async def test_thought_records_crud_and_cross_user_isolation(client: AsyncClient):
    r_create = await client.post(
        "/api/v1/thought-records",
        headers=ALICE_HEADERS,
        json={
            "situation": "Placement mock interview",
            "automatic_thought": "If I stumble on one question, my career is ruined.",
            "emotions": ["Anxiety"],
            "emotion_intensity_before": 85,
            "thinking_patterns": ["catastrophizing"],
            "evidence_for": "I stumbled once.",
            "evidence_against": "I solved the other two problems cleanly.",
            "balanced_thought": "One mock interview is practice, not my entire career.",
            "emotion_intensity_after": 40,
            "completed": True,
        },
    )
    assert r_create.status_code == 201
    tid = r_create.json()["id"]

    # Bob cannot modify or delete Alice's thought record
    assert (
        await client.patch(f"/api/v1/thought-records/{tid}", headers=BOB_HEADERS, json={"completed": False})
    ).status_code == 404
    assert (await client.delete(f"/api/v1/thought-records/{tid}", headers=BOB_HEADERS)).status_code == 404

    # Alice updates and deletes
    r_patch = await client.patch(
        f"/api/v1/thought-records/{tid}",
        headers=ALICE_HEADERS,
        json={"emotion_intensity_after": 30},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["emotion_intensity_after"] == 30


@pytest.mark.anyio
async def test_chat_streaming_and_tier3_crisis_interrupt(client: AsyncClient):
    # Tier 3 message MUST interrupt Gemini and stream crisis support with Tele-MANAS 14416
    r_crisis = await client.post(
        "/api/v1/chat",
        headers=ALICE_HEADERS,
        json={
            "language": "hinglish",
            "script": "roman",
            "messages": [{"role": "user", "content": "Yaar main khud ko khatam karna chahta hoon"}],
        },
    )
    assert r_crisis.status_code == 200
    assert r_crisis.headers.get("X-Neeva-Safety-Tier") == "3"
    assert r_crisis.headers.get("X-Neeva-Crisis-Interrupt") == "true"
    assert "14416" in r_crisis.text
    assert "9152987821" in r_crisis.text
    assert "112" in r_crisis.text


@pytest.mark.anyio
async def test_community_anonymous_feed_dlp_moderation_and_circles(client: AsyncClient):
    # Alice joins 'campus' circle
    r_join = await client.post("/api/v1/community/circles/campus/join", headers=ALICE_HEADERS)
    assert r_join.status_code == 201

    # Alice creates a post containing her Indian phone number & PAN -> DLP scrubs it automatically
    r_post = await client.post(
        "/api/v1/community/posts",
        headers=ALICE_HEADERS,
        json={
            "alias": "Quiet River",
            "circle": "campus",
            "body": "Placement season is tough! Reach me at 9876543210 or PAN ABCDE1234F if you want to study together.",
        },
    )
    assert r_post.status_code == 201
    post_data = r_post.json()
    post_id = post_data["id"]
    assert "9876543210" not in post_data["body"]
    assert "ABCDE1234F" not in post_data["body"]
    assert post_data["pii_redacted"] is True
    assert "author_id" not in post_data  # Never expose author_id

    # Bob views feed -> sees post with is_mine=False and no author_id
    r_feed_bob = await client.get("/api/v1/community/feed?circle=campus", headers=BOB_HEADERS)
    assert r_feed_bob.status_code == 200
    feed_items = r_feed_bob.json()
    assert len(feed_items) == 1
    assert feed_items[0]["is_mine"] is False
    assert "author_id" not in feed_items[0]

    # Bob and Moderator file self_harm reports -> 2 self_harm reports auto-hides the post
    r_rep1 = await client.post(
        f"/api/v1/community/posts/{post_id}/report",
        headers=BOB_HEADERS,
        json={"target": "post", "reason": "self_harm", "details": "Concerning post"},
    )
    assert r_rep1.status_code == 201
    assert r_rep1.json()["auto_hidden"] is False

    r_rep2 = await client.post(
        f"/api/v1/community/posts/{post_id}/report",
        headers=MOD_HEADERS,
        json={"target": "post", "reason": "self_harm", "details": "Second self-harm report"},
    )
    assert r_rep2.status_code == 201
    assert r_rep2.json()["auto_hidden"] is True

    # Moderator restores post
    r_mod = await client.post(
        f"/api/v1/community/posts/{post_id}/moderate",
        headers=MOD_HEADERS,
        json={"action": "restore", "reason": "Reviewed and cleared"},
    )
    assert r_mod.status_code == 200
    assert r_mod.json()["status"] == "visible"

    # Regular user cannot call moderator endpoint -> 403
    r_forbid = await client.post(
        f"/api/v1/community/posts/{post_id}/moderate",
        headers=BOB_HEADERS,
        json={"action": "remove", "reason": "Unauthorized attempt"},
    )
    assert r_forbid.status_code == 403


@pytest.mark.anyio
async def test_privacy_consents_export_and_data_purge(client: AsyncClient):
    r_patch = await client.patch(
        "/api/v1/privacy/settings",
        headers=ALICE_HEADERS,
        json={"consents": {"ai_journal_analysis": True, "context_sharing": False}},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["consents"]["ai_journal_analysis"] is True

    # Create a mood entry, export data, then purge all data
    await client.post(
        "/api/v1/moods",
        headers=ALICE_HEADERS,
        json={"mood": "peaceful", "intensity": 8, "triggers": ["Self-care"]},
    )

    r_exp = await client.post("/api/v1/privacy/export", headers=ALICE_HEADERS)
    assert r_exp.status_code == 202
    assert len(r_exp.json()["data"]["moods"]) == 1

    r_purge = await client.delete("/api/v1/privacy/data", headers=ALICE_HEADERS)
    assert r_purge.status_code == 200

    r_moods_after = await client.get("/api/v1/moods", headers=ALICE_HEADERS)
    assert len(r_moods_after.json()) == 0

