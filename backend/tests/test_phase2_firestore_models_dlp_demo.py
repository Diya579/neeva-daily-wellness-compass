"""
Phase 2 Comprehensive Verification Suite (Sections 1 through 9):
- Firestore Operational Database (all collections/subcollections, user isolation, concurrent writes,
  safety event & crisis intervention logging, trusted contacts, isolated payment demo state)
- Cloud SQL -> Cloud Firestore idempotent migration & reconciliation
- Firestore Security Rules & Composite Indexes validation
- MuRIL, Gemma 2 9B-IT, Gemma 2 2B-IT, and Google Cloud DLP API endpoints
- Standalone Payment Demo (`/payment-demo/`) verification (isolation, zero real gateways, all 13 states)
"""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.firestore_db import get_firestore_repo
from app.models.mood import MoodEntry
from app.models.user import UserProfile
from migrations.migrate_cloudsql_to_firestore import migrate_sqlalchemy_to_firestore

ALICE_HEADERS = {"Authorization": "Bearer token_alice"}
BOB_HEADERS = {"Authorization": "Bearer token_bob"}
MOD_HEADERS = {"Authorization": "Bearer token_moderator"}


@pytest.mark.anyio
async def test_firestore_schema_all_collections_and_concurrent_requests(client: AsyncClient):
    """Verify Firestore collections, subcollections, trusted contacts, safety events, and concurrent writes."""
    fs = get_firestore_repo()

    # 1. Trusted contacts CRUD
    r_tc = await client.post(
        "/api/v1/profile/trusted-contacts",
        headers=ALICE_HEADERS,
        json={"name": "Rohan Sharma", "relationship": "Brother", "phone": "+919811122233"},
    )
    assert r_tc.status_code == 201
    tc_id = r_tc.json()["id"]

    r_list_tc = await client.get("/api/v1/profile/trusted-contacts", headers=ALICE_HEADERS)
    assert r_list_tc.status_code == 200
    assert len(r_list_tc.json()) == 1

    # Bob cannot see or delete Alice's trusted contact
    r_bob_tc = await client.get("/api/v1/profile/trusted-contacts", headers=BOB_HEADERS)
    assert len(r_bob_tc.json()) == 0
    assert (
        await client.delete(f"/api/v1/profile/trusted-contacts/{tc_id}", headers=BOB_HEADERS)
    ).status_code == 404

    # 2. Concurrent mood writes under Firestore lock
    await asyncio.gather(
        *[
            client.post(
                "/api/v1/moods",
                headers=ALICE_HEADERS,
                json={"mood": "peaceful", "intensity": 8, "triggers": ["Sleep"]},
            )
            for _ in range(5)
        ]
    )
    r_moods = await client.get("/api/v1/moods", headers=ALICE_HEADERS)
    assert len(r_moods.json()) == 5

    # Verify mood streak subcollection document was updated in Firestore
    streak_doc = await fs.get_doc("users/firebase_uid_alice_001/mood_streaks/summary")
    assert streak_doc is not None
    assert streak_doc["total_entries"] == 5
    assert streak_doc["streak_days"] == 1

    # 3. Verify Tier 3 chat automatically writes to `safety_events` and `crisis_interventions` in Firestore
    await client.post(
        "/api/v1/chat",
        headers=ALICE_HEADERS,
        json={
            "language": "hinglish",
            "messages": [{"role": "user", "content": "mar jaana chahta hoon"}],
        },
    )
    safety_events = await fs.list_collection("users/firebase_uid_alice_001/safety_events")
    crisis_records = await fs.list_collection("users/firebase_uid_alice_001/crisis_interventions")
    assert len(safety_events) >= 1
    assert len(crisis_records) == 1
    assert crisis_records[0]["protocol_triggered"] == "tier3_crisis_lockdown"


@pytest.mark.anyio
async def test_cloudsql_to_firestore_migration_and_reconciliation(db_session: AsyncSession):
    """Verify repeatable, idempotent migration from Cloud SQL relational models to Cloud Firestore."""
    fs = get_firestore_repo()
    await fs.reset_store()

    now = datetime.now(timezone.utc)
    user = UserProfile(
        id="migrated_uid_999",
        display_name="Kabir Verma",
        role="user",
        goal="sleep",
        preferred_language="hi",
        script_style="native",
        onboarded=True,
        companion_configured=True,
        companion_name="Sukoon",
        companion_vibe="sage",
        companion_length="deep",
        companion_avatar="moon",
        companion_emoji=True,
        companion_approach="validate",
        companion_tone="gentle",
        companion_notes="Late night study schedule",
        created_at=now,
        updated_at=now,
    )
    mood = MoodEntry(
        id=uuid.uuid4(),
        user_id="migrated_uid_999",
        mood="tired",
        intensity=6,
        triggers=["Sleep", "Studies"],
        note="Migrated mood entry",
        recorded_at=now,
        created_at=now,
    )
    db_session.add(user)
    db_session.add(mood)
    await db_session.commit()

    # Run migration twice to prove idempotency
    first_run = await migrate_sqlalchemy_to_firestore(db_session, fs)
    second_run = await migrate_sqlalchemy_to_firestore(db_session, fs)

    assert first_run["reconciled"] is True
    assert second_run["reconciled"] is True
    assert first_run["migrated_counts"]["users"] == 1
    assert first_run["migrated_counts"]["mood_logs"] == 1

    fs_user = await fs.get_doc("users/migrated_uid_999")
    assert fs_user is not None
    assert fs_user["companion_name"] == "Sukoon"


@pytest.mark.anyio
async def test_models_and_dlp_endpoints(client: AsyncClient):
    """Verify MuRIL, Gemma 2 9B, Gemma 2 2B, and Cloud DLP API endpoints."""
    r_status = await client.get("/api/v1/models/status", headers=ALICE_HEADERS)
    assert r_status.status_code == 200
    st = r_status.json()
    assert st["muril"]["intended_checkpoint"] == "google/muril-base-cased"
    assert st["gemma_2_9b_it"]["intended_model"] == "google/gemma-2-9b-it"
    assert st["gemma_2_2b_it"]["intended_model"] == "google/gemma-2-2b-it"

    # MuRIL inference across languages
    for lang, text, expected_tier in [
        ("en", "Exam stress is high today", 1),
        ("hinglish", "Ab mujhse nahi ho raha yaar", 2),
        ("te", "Naaku chanipovali ani undi", 3),
    ]:
        r_muril = await client.post(
            "/api/v1/models/muril/infer",
            headers=ALICE_HEADERS,
            json={"text": text, "language": lang},
        )
        assert r_muril.status_code == 200
        assert r_muril.json()["tier"] == expected_tier

    # Gemma 2 9B safety override test: Tier 3 MUST interrupt Gemma 2 9B before Vertex endpoint call
    r_g9_crisis = await client.post(
        "/api/v1/models/gemma-9b/infer",
        headers=ALICE_HEADERS,
        json={"text": "I want to end my life tonight"},
    )
    assert r_g9_crisis.status_code == 200
    assert r_g9_crisis.json()["interrupted_by_safety_engine"] is True
    assert r_g9_crisis.json()["tier"] == 3

    # Gemma 2 9B non-crisis when Vertex endpoint is not provisioned -> explicit 503 (never fakes live weights)
    r_g9_normal = await client.post(
        "/api/v1/models/gemma-9b/infer",
        headers=ALICE_HEADERS,
        json={"text": "How do I manage placement anxiety?"},
    )
    assert r_g9_normal.status_code == 503
    assert r_g9_normal.json()["detail"]["status"] == "VERTEX_ENDPOINT_NOT_PROVISIONED"

    # Gemma 2 2B moderation & emotion tagging
    r_g2 = await client.post(
        "/api/v1/models/gemma-2b/moderate",
        headers=ALICE_HEADERS,
        json={"text": "Feeling anxious about exams, call me at 9876543210"},
    )
    assert r_g2.status_code == 200
    assert "PHONE_NUMBER" in r_g2.json()["pii_detected"]
    assert "9876543210" not in r_g2.json()["redacted_text"]

    # Cloud DLP inspect & deidentify endpoints
    sample_pii = "Aadhaar 4567 8901 2345, PAN ABCDE1234F, phone +91 9876543210, email test@iitd.ac.in"
    r_ins = await client.post("/api/v1/dlp/inspect", headers=ALICE_HEADERS, json={"text": sample_pii})
    assert r_ins.status_code == 200
    assert r_ins.json()["pii_found"] is True
    assert len(r_ins.json()["detected_info_types"]) >= 4

    r_deid = await client.post("/api/v1/dlp/deidentify", headers=ALICE_HEADERS, json={"text": sample_pii})
    assert r_deid.status_code == 200
    assert "ABCDE1234F" not in r_deid.json()["redacted_text"]


def test_firestore_rules_indexes_and_standalone_payment_demo_integrity():
    """Verify Firestore rules, composite indexes, and standalone `/payment-demo/` isolation."""
    root = Path(__file__).resolve().parents[2]

    # 1. Firestore rules & indexes
    rules_text = (root / "firestore.rules").read_text(encoding="utf-8")
    assert "service cloud.firestore" in rules_text
    assert "isOwner(uid)" in rules_text
    assert "isModeratorOrAdmin()" in rules_text

    indexes_data = json.loads((root / "firestore.indexes.json").read_text(encoding="utf-8"))
    assert len(indexes_data["indexes"]) >= 6

    # 2. Standalone payment demo files & strict isolation
    demo_dir = root / "payment-demo"
    html_text = (demo_dir / "index.html").read_text(encoding="utf-8")
    js_text = (demo_dir / "app.js").read_text(encoding="utf-8")
    css_text = (demo_dir / "styles.css").read_text(encoding="utf-8")

    # Verify all 13 required features exist in the demo
    assert "Neeva Student" in html_text
    assert "Neeva Plus" in html_text
    assert "Neeva Duo Pass" in html_text
    assert "NEEVA50" in js_text
    assert "CAMPUS20" in js_text
    assert "CHAI10" in js_text
    assert "view-processing" in html_text
    assert "view-success" in html_text
    assert "view-failed" in html_text
    assert "btn-retry-payment" in html_text
    assert "--zest" in css_text
    assert "Plus Jakarta Sans" in css_text
    assert "Instrument Serif" in css_text

    # Verify zero connection to real payment gateways or `/frontend/`
    for forbidden in ("checkout.razorpay.com", "js.stripe.com", "paypal.com/sdk", "../frontend"):
        assert forbidden not in html_text
        assert forbidden not in js_text
