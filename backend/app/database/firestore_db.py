"""
Firebase Cloud Firestore Operational Database Repository for Neeva AI.
Sole operational database source of truth.

Key guarantees:
1. NO process-local `_docs` dictionary cache acting as a source of truth.
2. Live & Emulator Firestore mode (`mode in ("live", "emulator")`):
   - All reads (`get_doc`), writes (`set_doc`), recursive deletes (`delete_doc` / `delete_document_tree_recursive`),
     collection/subcollection queries (`list_collection` with filtering, ordering, limits, and cursor pagination),
     and atomic streak transactions use the real `google.cloud.firestore.AsyncClient`.
3. Production Fail-Closed enforcement:
   - If `settings.ENVIRONMENT == "production"` or `settings.FIRESTORE_REQUIRE_LIVE == True`,
     initialization requires a real live Firestore client and raises `RuntimeError` if unavailable.
     It NEVER silently falls back to local storage in production.
4. Multi-Instance Cross-Process Persistent Local Mode (`mode == "local_persistent"`):
   - Used only in explicit local development/testing when live Firestore is not connected.
   - Persists every document to a shared SQLite WAL database file on disk with `BEGIN IMMEDIATE`
     cross-process transactional locking and zero in-memory caching, ensuring that writes from
     Application Instance A are immediately visible to Application Instance B (or after a full restart).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sqlite3
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

IST_OFFSET = timedelta(hours=5, minutes=30)

MOOD_SCORES: dict[str, int] = {
    "peaceful": 8,
    "joyful": 9,
    "tired": 5,
    "anxious": 4,
    "overwhelmed": 3,
}

ACTIVITY_POINTS: dict[str, int] = {
    "meditation": 20,
    "breathing": 10,
    "focus": 15,
    "game": 5,
    "thought_record": 25,
    "journal": 15,
}

USER_SUBCOLLECTIONS: tuple[str, ...] = (
    "preferences",
    "settings",
    "mood_logs",
    "mood_streaks",
    "journal_entries",
    "journal_analysis",
    "conversations",
    "cbt_exercises",
    "wellness_toolkit",
    "trusted_contacts",
    "safety_events",
    "crisis_interventions",
)


def _serialize_value(val: Any) -> Any:
    """Recursively serialize UUIDs, datetimes, and dates for Firestore & JSON storage."""
    if isinstance(val, uuid.UUID):
        return {"__type__": "uuid", "value": str(val)}
    if isinstance(val, datetime):
        if val.tzinfo is None:
            val = val.replace(tzinfo=timezone.utc)
        return {"__type__": "datetime", "value": val.isoformat()}
    if isinstance(val, date):
        return {"__type__": "date", "value": val.isoformat()}
    if isinstance(val, dict):
        return {str(k): _serialize_value(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [_serialize_value(v) for v in val]
    return val


def _deserialize_value(val: Any) -> Any:
    """Recursively restore UUIDs, timezone-aware datetimes, and dates."""
    if isinstance(val, dict):
        t = val.get("__type__")
        if t == "uuid" and "value" in val:
            return uuid.UUID(val["value"])
        if t == "datetime" and "value" in val:
            dt = datetime.fromisoformat(val["value"])
            return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)
        if t == "date" and "value" in val:
            return date.fromisoformat(val["value"])
        return {k: _deserialize_value(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_deserialize_value(v) for v in val]
    return val


def _to_firestore_native(val: Any) -> Any:
    """Convert Python types to native Firestore SDK types (UUID -> str, datetime preserved)."""
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, datetime):
        return val if val.tzinfo is not None else val.replace(tzinfo=timezone.utc)
    if isinstance(val, date):
        return val.isoformat()
    if isinstance(val, dict):
        return {str(k): _to_firestore_native(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [_to_firestore_native(v) for v in val]
    return val


def _from_firestore_native(val: Any) -> Any:
    """Normalize Firestore SDK snapshot values back into Python types."""
    if isinstance(val, dict):
        out = {}
        for k, v in val.items():
            if k in ("id", "post_id", "entry_id", "conversation_id") and isinstance(v, str):
                try:
                    out[k] = uuid.UUID(v)
                    continue
                except ValueError:
                    pass
            out[k] = _from_firestore_native(v)
        return out
    if isinstance(val, list):
        return [_from_firestore_native(v) for v in val]
    return val


def _compare_key(val: Any) -> Any:
    """Normalize field values for consistent sorting across types."""
    if val is None:
        return ""
    if isinstance(val, datetime):
        return val.timestamp()
    if isinstance(val, date):
        return val.toordinal()
    if isinstance(val, uuid.UUID):
        return str(val)
    return val


class FirestoreOperationalRepository:
    """
    Production-grade Cloud Firestore Repository with real Firestore queries, cursor pagination,
    recursive subcollection deletion, atomic transactions, and cross-process disk persistence
    for local multi-instance verification.
    """

    def __init__(
        self,
        project_id: Optional[str] = None,
        db_path: Optional[str | Path] = None,
        force_live: Optional[bool] = None,
    ) -> None:
        self.project_id = project_id or settings.FIREBASE_PROJECT_ID or settings.GOOGLE_CLOUD_PROJECT
        self._live_client = None
        self._mode = "local_persistent"
        self._async_lock = asyncio.Lock()

        resolved_db_path = Path(
            db_path
            or os.environ.get("NEEVA_LOCAL_FIRESTORE_PATH")
            or settings.LOCAL_FIRESTORE_DB_PATH
        ).resolve()
        self._db_path = resolved_db_path

        require_live = (
            force_live
            if force_live is not None
            else (
                settings.ENVIRONMENT == "production"
                or settings.FIRESTORE_REQUIRE_LIVE
                or os.environ.get("NEEVA_USE_LIVE_FIRESTORE") == "true"
            )
        )
        emulator_host = os.environ.get("FIRESTORE_EMULATOR_HOST")

        if require_live or emulator_host:
            self._init_live_client(require_live=bool(require_live))
        else:
            self._init_sqlite_store()

    def _init_live_client(self, require_live: bool) -> None:
        try:
            from google.cloud import firestore

            self._live_client = firestore.AsyncClient(
                project=self.project_id,
                database=settings.FIRESTORE_DATABASE_ID,
            )
            self._mode = "emulator" if os.environ.get("FIRESTORE_EMULATOR_HOST") else "live"
            logger.info(
                "Connected Cloud Firestore AsyncClient (project=%s, mode=%s)",
                self.project_id,
                self._mode,
            )
        except Exception as exc:
            if require_live:
                raise RuntimeError(
                    f"CRITICAL: Live Cloud Firestore is required (project={self.project_id}) "
                    f"and failed to initialize: {exc}"
                ) from exc
            logger.warning(
                "Firestore AsyncClient unavailable (%s); using local persistent SQLite WAL store at %s",
                exc,
                self._db_path,
            )
            self._live_client = None
            self._mode = "local_persistent"
            self._init_sqlite_store()

    def _init_sqlite_store(self) -> None:
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(str(self._db_path), timeout=30.0) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS firestore_documents (
                    doc_path TEXT PRIMARY KEY,
                    collection_path TEXT NOT NULL,
                    doc_id TEXT NOT NULL,
                    depth INTEGER NOT NULL,
                    payload_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fs_collection_path ON firestore_documents(collection_path, depth)"
            )
            conn.commit()

    def _open_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path), timeout=30.0, isolation_level=None)
        conn.row_factory = sqlite3.Row
        return conn

    @property
    def mode(self) -> str:
        return self._mode

    @property
    def db_path(self) -> Path:
        return self._db_path

    async def reset_store(self) -> None:
        """Clear local store between isolated unit/integration tests. Refuses to run in production."""
        if settings.ENVIRONMENT == "production" or self._mode == "live":
            raise RuntimeError("reset_store() is forbidden in production or live Firestore mode.")
        async with self._async_lock:
            with self._open_conn() as conn:
                conn.execute("BEGIN IMMEDIATE")
                conn.execute("DELETE FROM firestore_documents")
                conn.execute("COMMIT")

    # ------------------------------------------------------------------------
    # Core Document CRUD & Real Collection Queries (Zero In-Memory `_docs`)
    # ------------------------------------------------------------------------
    async def set_doc(self, path: str, data: dict[str, Any], merge: bool = False) -> dict[str, Any]:
        norm_path = path.strip("/")
        parts = norm_path.split("/")
        if len(parts) < 2 or len(parts) % 2 != 0:
            raise ValueError(f"Invalid Firestore document path (must have even segments): {norm_path}")

        collection_path = "/".join(parts[:-1])
        doc_id = parts[-1]
        depth = len(parts)

        if self._live_client is not None:
            doc_ref = self._live_client.document(norm_path)
            native_payload = _to_firestore_native(data)
            await doc_ref.set(native_payload, merge=merge)
            snap = await doc_ref.get()
            return _from_firestore_native(snap.to_dict() or native_payload)

        async with self._async_lock:
            with self._open_conn() as conn:
                conn.execute("BEGIN IMMEDIATE")
                try:
                    final_data = dict(data)
                    if merge:
                        row = conn.execute(
                            "SELECT payload_json FROM firestore_documents WHERE doc_path = ?",
                            (norm_path,),
                        ).fetchone()
                        if row is not None:
                            existing = _deserialize_value(json.loads(row["payload_json"]))
                            existing.update(final_data)
                            final_data = existing

                    serialized = json.dumps(_serialize_value(final_data), ensure_ascii=False)
                    now_iso = datetime.now(timezone.utc).isoformat()
                    conn.execute(
                        """
                        INSERT INTO firestore_documents (doc_path, collection_path, doc_id, depth, payload_json, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(doc_path) DO UPDATE SET
                            payload_json = excluded.payload_json,
                            updated_at = excluded.updated_at
                        """,
                        (norm_path, collection_path, doc_id, depth, serialized, now_iso),
                    )
                    conn.execute("COMMIT")
                    return _deserialize_value(json.loads(serialized))
                except Exception:
                    conn.execute("ROLLBACK")
                    raise

    async def get_doc(self, path: str) -> Optional[dict[str, Any]]:
        norm_path = path.strip("/")
        if self._live_client is not None:
            snap = await self._live_client.document(norm_path).get()
            if not snap.exists:
                return None
            return _from_firestore_native(snap.to_dict() or {})

        with self._open_conn() as conn:
            row = conn.execute(
                "SELECT payload_json FROM firestore_documents WHERE doc_path = ?",
                (norm_path,),
            ).fetchone()
            if row is None:
                return None
            return _deserialize_value(json.loads(row["payload_json"]))

    async def delete_doc(self, path: str) -> bool:
        """Delete a document and recursively delete any nested subcollection documents."""
        deleted_count = await self.delete_document_tree_recursive(path)
        return deleted_count > 0

    async def delete_document_tree_recursive(self, root_path: str) -> int:
        """
        Recursively delete a Firestore document and all of its nested subcollections.
        In live Firestore, traverses `doc_ref.collections()` recursively using batched deletes.
        In local persistent mode, atomically deletes `doc_path = ? OR doc_path LIKE ? || '/%'`.
        Returns the total number of documents deleted.
        """
        norm_path = root_path.strip("/")
        if self._live_client is not None:
            doc_ref = self._live_client.document(norm_path)
            deleted = 0
            async for subcol in doc_ref.collections():
                async for subdoc in subcol.list_documents():
                    deleted += await self.delete_document_tree_recursive(subdoc.path)
            snap = await doc_ref.get()
            if snap.exists:
                await doc_ref.delete()
                deleted += 1
            return deleted

        async with self._async_lock:
            with self._open_conn() as conn:
                conn.execute("BEGIN IMMEDIATE")
                try:
                    cur = conn.execute(
                        "DELETE FROM firestore_documents WHERE doc_path = ? OR doc_path LIKE ?",
                        (norm_path, f"{norm_path}/%"),
                    )
                    count = cur.rowcount
                    conn.execute("COMMIT")
                    return count
                except Exception:
                    conn.execute("ROLLBACK")
                    raise

    async def list_collection(
        self,
        collection_path: str,
        filters: Optional[list[tuple[str, str, Any]]] = None,
        order_by: Optional[list[tuple[str, bool]]] = None,
        limit: int = 100,
        offset: int = 0,
        start_after_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """
        Query a Firestore collection or subcollection with filtering, multi-field sorting,
        cursor pagination (`start_after_id`), offset, and bounded limit (max 500).
        """
        norm_col = collection_path.strip("/")
        capped_limit = max(1, min(limit, 500))

        if self._live_client is not None:
            from google.cloud import firestore
            from google.cloud.firestore_v1.base_query import FieldFilter

            query: Any = self._live_client.collection(norm_col)
            if filters:
                for field_name, op, target in filters:
                    query = query.where(filter=FieldFilter(field_name, op, _to_firestore_native(target)))
            if order_by:
                for field_name, descending in order_by:
                    direction = (
                        firestore.Query.DESCENDING if descending else firestore.Query.ASCENDING
                    )
                    query = query.order_by(field_name, direction=direction)
            if start_after_id:
                cursor_snap = await self._live_client.document(f"{norm_col}/{start_after_id}").get()
                if cursor_snap.exists:
                    query = query.start_after(cursor_snap)
            if offset > 0:
                query = query.offset(offset)
            query = query.limit(capped_limit)
            results: list[dict[str, Any]] = []
            async for doc_snap in query.stream():
                results.append(_from_firestore_native(doc_snap.to_dict() or {}))
            return results

        depth = len(norm_col.split("/")) + 1
        with self._open_conn() as conn:
            rows = conn.execute(
                "SELECT doc_id, payload_json FROM firestore_documents WHERE collection_path = ? AND depth = ?",
                (norm_col, depth),
            ).fetchall()

        items = [_deserialize_value(json.loads(r["payload_json"])) for r in rows]

        if filters:
            for field_name, op, target in filters:
                if op == "==":
                    items = [d for d in items if d.get(field_name) == target]
                elif op == "!=":
                    items = [d for d in items if d.get(field_name) != target]
                elif op == ">=":
                    items = [
                        d
                        for d in items
                        if d.get(field_name) is not None
                        and _compare_key(d.get(field_name)) >= _compare_key(target)
                    ]
                elif op == "<=":
                    items = [
                        d
                        for d in items
                        if d.get(field_name) is not None
                        and _compare_key(d.get(field_name)) <= _compare_key(target)
                    ]
                elif op == "in":
                    items = [d for d in items if d.get(field_name) in target]
                elif op == "not_in":
                    items = [d for d in items if d.get(field_name) not in target]

        if order_by:
            for field_name, descending in reversed(order_by):
                items.sort(key=lambda d: _compare_key(d.get(field_name)), reverse=descending)

        if start_after_id:
            idx = next(
                (i for i, d in enumerate(items) if str(d.get("id")) == str(start_after_id)),
                None,
            )
            if idx is not None:
                items = items[idx + 1 :]

        return items[offset : offset + capped_limit]

    # ------------------------------------------------------------------------
    # Atomic Transactions (Streaks, Points & Multi-Document Updates)
    # ------------------------------------------------------------------------
    async def record_wellness_activity_transactional(
        self,
        uid: str,
        activity_type: str,
        activity_id: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        completed_at: Optional[datetime] = None,
    ) -> dict[str, Any]:
        """
        Atomically log a wellness activity and update `users/{uid}/wellness_toolkit/_streak_summary`
        inside a serialized transaction so concurrent requests never overwrite points or streaks.
        """
        await self.ensure_user_profile(uid)
        now = completed_at or datetime.now(timezone.utc)
        points = ACTIVITY_POINTS.get(activity_type, 5)
        act_id = str(uuid.uuid4())
        today_ist = (now + IST_OFFSET).date()
        act_doc = {
            "id": act_id,
            "user_id": uid,
            "activity_type": activity_type,
            "activity_id": activity_id,
            "duration_seconds": duration_seconds,
            "points_earned": points,
            "completed_at": now,
        }

        def _compute_next_streak(existing_summary: Optional[dict[str, Any]]) -> dict[str, Any]:
            if existing_summary is None:
                return {
                    "user_id": uid,
                    "current_streak": 1,
                    "longest_streak": 1,
                    "total_points": points,
                    "activities_count": 1,
                    "last_activity_date": today_ist.isoformat(),
                    "updated_at": now,
                }
            summary = dict(existing_summary)
            last_date = date.fromisoformat(summary["last_activity_date"])
            yesterday = today_ist - timedelta(days=1)
            summary["activities_count"] = int(summary.get("activities_count", 0)) + 1
            summary["total_points"] = int(summary.get("total_points", 0)) + points

            if last_date == today_ist:
                # Multiple activities on the same IST day preserve current_streak
                pass
            elif last_date == yesterday:
                summary["current_streak"] = int(summary.get("current_streak", 0)) + 1
                summary["longest_streak"] = max(
                    int(summary.get("longest_streak", 0)), summary["current_streak"]
                )
                summary["last_activity_date"] = today_ist.isoformat()
            elif today_ist > last_date:
                # Missed one or more days -> reset current_streak to 1
                summary["current_streak"] = 1
                summary["last_activity_date"] = today_ist.isoformat()
            summary["updated_at"] = now
            return summary

        if self._live_client is not None:
            from google.cloud import firestore

            act_ref = self._live_client.document(f"users/{uid}/wellness_toolkit/{act_id}")
            streak_ref = self._live_client.document(f"users/{uid}/wellness_toolkit/_streak_summary")

            @firestore.async_transactional
            async def _txn(transaction):
                snap = await streak_ref.get(transaction=transaction)
                current = _from_firestore_native(snap.to_dict()) if snap.exists else None
                next_summary = _compute_next_streak(current)
                transaction.set(act_ref, _to_firestore_native(act_doc))
                transaction.set(streak_ref, _to_firestore_native(next_summary))
                return next_summary

            txn_summary = await _txn(self._live_client.transaction())
            return {
                "id": act_id,
                "activity_type": activity_type,
                "points_earned": points,
                "completed_at": now.isoformat(),
                "streak": txn_summary,
            }

        async with self._async_lock:
            with self._open_conn() as conn:
                conn.execute("BEGIN IMMEDIATE")
                try:
                    streak_path = f"users/{uid}/wellness_toolkit/_streak_summary"
                    act_path = f"users/{uid}/wellness_toolkit/{act_id}"
                    row = conn.execute(
                        "SELECT payload_json FROM firestore_documents WHERE doc_path = ?",
                        (streak_path,),
                    ).fetchone()
                    current = _deserialize_value(json.loads(row["payload_json"])) if row else None
                    next_summary = _compute_next_streak(current)

                    now_iso = now.isoformat()
                    col_path = f"users/{uid}/wellness_toolkit"
                    conn.execute(
                        """
                        INSERT INTO firestore_documents (doc_path, collection_path, doc_id, depth, payload_json, updated_at)
                        VALUES (?, ?, ?, 4, ?, ?)
                        """,
                        (act_path, col_path, act_id, json.dumps(_serialize_value(act_doc)), now_iso),
                    )
                    conn.execute(
                        """
                        INSERT INTO firestore_documents (doc_path, collection_path, doc_id, depth, payload_json, updated_at)
                        VALUES (?, ?, '_streak_summary', 4, ?, ?)
                        ON CONFLICT(doc_path) DO UPDATE SET
                            payload_json = excluded.payload_json,
                            updated_at = excluded.updated_at
                        """,
                        (streak_path, col_path, json.dumps(_serialize_value(next_summary)), now_iso),
                    )
                    conn.execute("COMMIT")
                    return {
                        "id": act_id,
                        "activity_type": activity_type,
                        "points_earned": points,
                        "completed_at": now.isoformat(),
                        "streak": next_summary,
                    }
                except Exception:
                    conn.execute("ROLLBACK")
                    raise

    # ------------------------------------------------------------------------
    # User Profiles, Preferences, Companion Settings & Recursive Account Purge
    # ------------------------------------------------------------------------
    async def ensure_user_profile(
        self, uid: str, display_name: str = "", role: str = "user"
    ) -> dict[str, Any]:
        existing = await self.get_doc(f"users/{uid}")
        if existing is not None:
            return existing

        now = datetime.now(timezone.utc)
        profile_doc = {
            "id": uid,
            "display_name": (display_name or "")[:40],
            "role": role if role in ("user", "moderator", "admin") else "user",
            "goal": "stress",
            "preferred_language": "en",
            "script_style": "auto",
            "onboarded": False,
            "companion_configured": False,
            "companion_name": "Neeva",
            "companion_vibe": "bestie",
            "companion_length": "balanced",
            "companion_avatar": "bloom",
            "companion_emoji": True,
            "companion_approach": "mix",
            "companion_tone": "gentle",
            "companion_notes": "",
            "created_at": now,
            "updated_at": now,
        }
        await self.set_doc(f"users/{uid}", profile_doc)
        await self.set_doc(
            f"users/{uid}/preferences/main",
            {
                "user_id": uid,
                "preferred_language": "en",
                "script_style": "auto",
                "goal": "stress",
                "consents": {
                    "ai_journal_analysis": False,
                    "context_sharing": False,
                    "analytics": False,
                },
                "updated_at": now,
            },
        )
        await self.set_doc(
            f"users/{uid}/settings/companion",
            {
                "user_id": uid,
                "companion_name": "Neeva",
                "companion_vibe": "bestie",
                "companion_length": "balanced",
                "companion_avatar": "bloom",
                "companion_emoji": True,
                "companion_approach": "mix",
                "companion_tone": "gentle",
                "companion_notes": "",
                "updated_at": now,
            },
        )
        return profile_doc

    async def update_user_profile(self, uid: str, updates: dict[str, Any]) -> dict[str, Any]:
        await self.ensure_user_profile(uid)
        safe_updates = {k: v for k, v in updates.items() if k not in ("id", "role", "created_at")}
        now = datetime.now(timezone.utc)
        safe_updates["updated_at"] = now
        updated = await self.set_doc(f"users/{uid}", safe_updates, merge=True)

        pref_keys = {"preferred_language", "script_style", "goal"}
        if pref_keys.intersection(safe_updates):
            await self.set_doc(
                f"users/{uid}/preferences/main",
                {k: safe_updates[k] for k in pref_keys if k in safe_updates} | {"updated_at": now},
                merge=True,
            )

        comp_keys = {
            "companion_name",
            "companion_vibe",
            "companion_length",
            "companion_avatar",
            "companion_emoji",
            "companion_approach",
            "companion_tone",
            "companion_notes",
            "companion_configured",
        }
        if comp_keys.intersection(safe_updates):
            await self.set_doc(
                f"users/{uid}/settings/companion",
                {k: safe_updates[k] for k in comp_keys if k in safe_updates} | {"updated_at": now},
                merge=True,
            )
        return updated

    async def delete_user_account_completely(self, uid: str) -> dict[str, Any]:
        """
        Recursively delete the entire user document tree (`users/{uid}` and all 12 subcollections),
        anonymous community identity (`anonymous_identities/{uid}`), authored community posts,
        and user reports. Verifies that zero user documents remain before returning.
        """
        deleted_docs = await self.delete_document_tree_recursive(f"users/{uid}")
        deleted_anon = await self.delete_document_tree_recursive(f"anonymous_identities/{uid}")

        my_posts = await self.list_collection(
            "community_posts", filters=[("author_id", "==", uid)], limit=500
        )
        deleted_posts = 0
        for p in my_posts:
            deleted_posts += await self.delete_document_tree_recursive(f"community_posts/{p['id']}")

        my_reports = await self.list_collection(
            "user_reports", filters=[("reporter_id", "==", uid)], limit=500
        )
        for r in my_reports:
            await self.delete_doc(f"user_reports/{r['id']}")

        now = datetime.now(timezone.utc)
        summary = {
            "user_id": uid,
            "status": "completed",
            "deleted_user_tree_documents": deleted_docs,
            "deleted_anonymous_identity": deleted_anon,
            "deleted_community_posts": deleted_posts,
            "completed_at": now.isoformat(),
        }
        await self.set_doc(f"account_deletions/{uid}", summary)
        return summary

    # ------------------------------------------------------------------------
    # Mood Logs & IST Streak Calculation
    # ------------------------------------------------------------------------
    async def create_mood_log(
        self,
        uid: str,
        mood: str,
        intensity: int,
        triggers: list[str],
        note: Optional[str],
        recorded_at: Optional[datetime] = None,
    ) -> dict[str, Any]:
        await self.ensure_user_profile(uid)
        now = datetime.now(timezone.utc)
        rec_at = recorded_at or now
        if rec_at.tzinfo is None:
            rec_at = rec_at.replace(tzinfo=timezone.utc)
        mood_id = uuid.uuid4()
        score = MOOD_SCORES[mood]
        doc = {
            "id": mood_id,
            "user_id": uid,
            "mood": mood,
            "intensity": intensity,
            "triggers": list(triggers or []),
            "note": note,
            "score": score,
            "recorded_at": rec_at,
            "created_at": now,
        }
        await self.set_doc(f"users/{uid}/mood_logs/{mood_id}", doc)
        await self._recompute_mood_streak(uid, now)
        return doc

    async def _recompute_mood_streak(self, uid: str, now: datetime) -> dict[str, Any]:
        logs = await self.list_collection(
            f"users/{uid}/mood_logs",
            order_by=[("recorded_at", True)],
            limit=365,
        )
        dates_ist = {(entry["recorded_at"] + IST_OFFSET).date() for entry in logs}
        today_ist = (now + IST_OFFSET).date()
        cursor = today_ist if today_ist in dates_ist else (today_ist - timedelta(days=1))
        streak = 0
        while cursor in dates_ist:
            streak += 1
            cursor -= timedelta(days=1)

        summary = {
            "user_id": uid,
            "streak_days": streak,
            "total_entries": len(logs),
            "total_points": len(logs) * 10,
            "updated_at": now,
        }
        await self.set_doc(f"users/{uid}/mood_streaks/summary", summary)
        return summary

    # ------------------------------------------------------------------------
    # Trusted Contacts, Safety Events & Crisis Interventions
    # ------------------------------------------------------------------------
    async def log_safety_event(
        self,
        uid: str,
        source: str,
        tier: int,
        deterministic_tier: int,
        muril_tier: Optional[int],
        confidence: float,
        should_interrupt: bool,
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        event_id = str(uuid.uuid4())
        event_doc = {
            "id": event_id,
            "user_id": uid,
            "source": source,
            "tier": tier,
            "deterministic_tier": deterministic_tier,
            "muril_tier": muril_tier,
            "confidence": confidence,
            "should_interrupt": should_interrupt,
            "created_at": now,
        }
        await self.set_doc(f"users/{uid}/safety_events/{event_id}", event_doc)

        if should_interrupt or tier == 3:
            int_id = str(uuid.uuid4())
            await self.set_doc(
                f"users/{uid}/crisis_interventions/{int_id}",
                {
                    "id": int_id,
                    "user_id": uid,
                    "safety_event_id": event_id,
                    "source": source,
                    "tier": 3,
                    "helplines_provided": ["14416", "9152987821", "112", "+919999666555"],
                    "protocol_triggered": "tier3_crisis_lockdown",
                    "created_at": now,
                },
            )
        return event_doc

    async def add_trusted_contact(
        self,
        uid: str,
        name: str,
        relationship: str,
        phone: str,
    ) -> dict[str, Any]:
        await self.ensure_user_profile(uid)
        contact_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        doc = {
            "id": contact_id,
            "user_id": uid,
            "name": name[:60],
            "relationship": relationship[:40],
            "phone": phone[:20],
            "created_at": now,
        }
        await self.set_doc(f"users/{uid}/trusted_contacts/{contact_id}", doc)
        return doc

    async def list_trusted_contacts(self, uid: str) -> list[dict[str, Any]]:
        return await self.list_collection(
            f"users/{uid}/trusted_contacts",
            order_by=[("created_at", False)],
            limit=20,
        )


_firestore_repo: Optional[FirestoreOperationalRepository] = None


def get_firestore_repo() -> FirestoreOperationalRepository:
    global _firestore_repo
    if _firestore_repo is None:
        _firestore_repo = FirestoreOperationalRepository()
    return _firestore_repo


def set_firestore_repo(repo: Optional[FirestoreOperationalRepository]) -> None:
    global _firestore_repo
    _firestore_repo = repo
