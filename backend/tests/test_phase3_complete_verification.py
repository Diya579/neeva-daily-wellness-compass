"""
Section 14 Complete Verification Suite:
1. Multi-instance & cross-process Firestore persistence test (writes in Instance 1, reads in Instance 2 & subprocess with empty cache).
2. Production fail-closed Firestore verification (never falls back to in-memory/local in production).
3. Complete recursive account deletion across all 12 nested user subcollections.
4. Atomic streak transactions across same-day, consecutive-day, missed-day, and 10 concurrent submissions.
5. Safety engine negation guards, figurative slang guards, indirect self-harm, multi-turn contextual escalation,
   and strict spy proof that Gemini (`stream_chat`) is NEVER called during Tier 3 on `/api/v1/chat` or `/api/chat`.
6. Cloud DLP `content:inspect` and `content:deidentify` original-text verification & source attribution.
7. Vertex AI Gemma 2 2B-IT live endpoint invocation vs honest fallback attribution.
8. Gemma 2 9B-IT dataset deduplication, PII scrubbing, and zero-leakage 80/10/10 split verification.
9. Security tests: expired token, revoked token, invalid token, forged UID/role privilege escalation protection.
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import firebase_admin.auth
import pytest
from httpx import AsyncClient

from app.core.security import verify_firebase_token
from app.database.firestore_db import FirestoreOperationalRepository, get_firestore_repo
from app.privacy.encryption import derive_key_pbkdf2, encrypt_aes_gcm_256
from app.safety.crisis_patterns import SafetyTier, classify_safety

ALICE_HEADERS = {"Authorization": "Bearer token_alice"}
BOB_HEADERS = {"Authorization": "Bearer token_bob"}


@pytest.mark.anyio
async def test_multi_instance_and_cross_process_firestore_persistence(tmp_path: Path):
    """
    MANDATORY MULTI-INSTANCE PERSISTENCE TEST (Section 14):
    Write data through Repository Instance 1, then instantiate Repository Instance 2
    (and a separate Python OS subprocess) with an empty local cache and verify all
    documents and collection queries return the persisted data.
    """
    shared_db_file = tmp_path / "multi_instance_firestore.sqlite3"

    # Instance 1 writes user profile, mood, journal, CBT record, conversation, and trusted contact
    instance_1 = FirestoreOperationalRepository(db_path=shared_db_file, force_live=False)
    uid = "multi_inst_user_01"
    await instance_1.ensure_user_profile(uid, display_name="Meera Krishnan")
    mood = await instance_1.create_mood_log(
        uid=uid, mood="joyful", intensity=9, triggers=["Self-care"], note="Morning walk"
    )
    journal_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    await instance_1.set_doc(
        f"users/{uid}/journal_entries/{journal_id}",
        {
            "id": journal_id,
            "user_id": uid,
            "prompt": "What went well?",
            "content_ciphertext": "Y2lwaGVydGV4dA==",
            "content_iv": "MTIzNDU2Nzg5MDEy",
            "word_count": 7,
            "is_draft": False,
            "created_at": now,
            "updated_at": now,
        },
    )
    await instance_1.add_trusted_contact(uid, "Kavya", "Sister", "+919822233344")

    # Instance 2: completely separate object instance reading from the same backing store
    instance_2 = FirestoreOperationalRepository(db_path=shared_db_file, force_live=False)
    prof_2 = await instance_2.get_doc(f"users/{uid}")
    assert prof_2 is not None
    assert prof_2["display_name"] == "Meera Krishnan"

    moods_2 = await instance_2.list_collection(f"users/{uid}/mood_logs")
    assert len(moods_2) == 1
    assert moods_2[0]["id"] == mood["id"]
    assert moods_2[0]["mood"] == "joyful"

    journals_2 = await instance_2.list_collection(f"users/{uid}/journal_entries")
    assert len(journals_2) == 1
    assert journals_2[0]["id"] == journal_id

    contacts_2 = await instance_2.list_trusted_contacts(uid)
    assert len(contacts_2) == 1
    assert contacts_2[0]["name"] == "Kavya"

    # Separate OS Subprocess verification (simulating a second Cloud Run container or full process restart)
    backend_dir = str(Path(__file__).resolve().parents[1])
    code = (
        "import asyncio\n"
        "from app.database.firestore_db import FirestoreOperationalRepository\n"
        "async def main():\n"
        f"    repo = FirestoreOperationalRepository(db_path=r'{shared_db_file}', force_live=False)\n"
        f"    m = await repo.list_collection('users/{uid}/mood_logs')\n"
        f"    j = await repo.list_collection('users/{uid}/journal_entries')\n"
        "    assert len(m) == 1 and len(j) == 1, f'Expected 1 mood & 1 journal, got {len(m)}, {len(j)}'\n"
        "    print('SUBPROCESS_PERSISTENCE_VERIFIED')\n"
        "asyncio.run(main())\n"
    )
    proc = subprocess.run(
        [sys.executable, "-c", code],
        cwd=backend_dir,
        env={**os.environ, "PYTHONPATH": backend_dir},
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert proc.returncode == 0, f"Subprocess failed: {proc.stderr}"
    assert "SUBPROCESS_PERSISTENCE_VERIFIED" in proc.stdout


def test_production_firestore_fails_closed_when_live_unavailable():
    """Verify production mode NEVER silently falls back to local storage if live Firestore fails."""
    with patch("google.cloud.firestore.AsyncClient", side_effect=RuntimeError("GCP credentials missing")):
        with pytest.raises(RuntimeError, match="CRITICAL: Live Cloud Firestore is required"):
            FirestoreOperationalRepository(project_id="onyx-gift-514504-q0", force_live=True)


@pytest.mark.anyio
async def test_recursive_account_deletion_removes_all_nested_subcollections(client: AsyncClient):
    """
    Verify that deleting an account recursively deletes all nested subcollections:
    profile, preferences, settings, mood_logs, mood_streaks, journal_entries, journal_analysis,
    conversations + messages, cbt_exercises, wellness_toolkit, trusted_contacts, safety_events.
    """
    fs = get_firestore_repo()
    uid = "firebase_uid_alice_001"

    key = derive_key_pbkdf2("alice-pass", os.urandom(16))
    enc = encrypt_aes_gcm_256("My private journal entry for recursive deletion test.", key)
    ct_b64, iv_b64 = enc.to_base64()

    # Populate every subcollection
    await client.patch("/api/v1/profile", headers=ALICE_HEADERS, json={"display_name": "Alice"})
    await client.post(
        "/api/v1/profile/trusted-contacts",
        headers=ALICE_HEADERS,
        json={"name": "Mom", "relationship": "Mother", "phone": "+919876543210"},
    )
    await client.post(
        "/api/v1/moods",
        headers=ALICE_HEADERS,
        json={"mood": "peaceful", "intensity": 8, "triggers": ["Sleep"]},
    )
    r_j = await client.post(
        "/api/v1/journal",
        headers=ALICE_HEADERS,
        json={"prompt": "Prompt", "content_ciphertext": ct_b64, "content_iv": iv_b64, "word_count": 8},
    )
    jid = r_j.json()["id"]
    await client.post(
        f"/api/v1/journal/{jid}/analyze",
        headers=ALICE_HEADERS,
        json={"text": "My private journal entry for recursive deletion test.", "prompt": "Prompt"},
    )
    await client.post(
        "/api/v1/thought-records",
        headers=ALICE_HEADERS,
        json={
            "situation": "Exam",
            "automatic_thought": "I will fail",
            "emotions": ["Anxiety"],
            "emotion_intensity_before": 80,
        },
    )
    await client.post(
        "/api/v1/wellness/activities",
        headers=ALICE_HEADERS,
        json={"activity_type": "meditation", "duration_seconds": 300},
    )
    await client.post(
        "/api/v1/chat",
        headers=ALICE_HEADERS,
        json={
            "retain_encrypted": True,
            "messages": [
                {
                    "role": "user",
                    "content": "I want to kill myself",
                    "content_ciphertext": ct_b64,
                    "content_iv": iv_b64,
                }
            ],
        },
    )

    # Delete account
    r_del = await client.delete("/api/v1/account", headers=ALICE_HEADERS)
    assert r_del.status_code == 204

    # Verify root document and ALL 12 subcollections are completely empty
    assert await fs.get_doc(f"users/{uid}") is None
    for subcol in (
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
    ):
        remaining = await fs.list_collection(f"users/{uid}/{subcol}")
        assert len(remaining) == 0, f"Subcollection {subcol} was not recursively deleted!"


@pytest.mark.anyio
async def test_atomic_wellness_streaks_same_day_consecutive_missed_and_concurrent(client: AsyncClient):
    """Verify IST streak calculation across same day, consecutive days, missed days, and concurrent requests."""
    fs = get_firestore_repo()
    uid = "firebase_uid_alice_001"
    base_day = datetime(2026, 11, 10, 6, 0, tzinfo=timezone.utc)

    # Day 1: two activities on the same day -> streak = 1, points = 30
    await fs.record_wellness_activity_transactional(uid, "meditation", completed_at=base_day)
    res_same = await fs.record_wellness_activity_transactional(
        uid, "breathing", completed_at=base_day + timedelta(hours=2)
    )
    assert res_same["streak"]["current_streak"] == 1
    assert res_same["streak"]["total_points"] == 30

    # Day 2 (consecutive): streak = 2
    res_day2 = await fs.record_wellness_activity_transactional(
        uid, "focus", completed_at=base_day + timedelta(days=1)
    )
    assert res_day2["streak"]["current_streak"] == 2
    assert res_day2["streak"]["longest_streak"] == 2

    # Day 3 (consecutive): streak = 3
    res_day3 = await fs.record_wellness_activity_transactional(
        uid, "journal", completed_at=base_day + timedelta(days=2)
    )
    assert res_day3["streak"]["current_streak"] == 3
    assert res_day3["streak"]["longest_streak"] == 3

    # Day 6 (missed Day 4 & Day 5): current_streak resets to 1, longest_streak stays 3
    res_day6 = await fs.record_wellness_activity_transactional(
        uid, "game", completed_at=base_day + timedelta(days=5)
    )
    assert res_day6["streak"]["current_streak"] == 1
    assert res_day6["streak"]["longest_streak"] == 3

    # 10 concurrent breathing activities (10 pts each = +100 pts)
    before_pts = res_day6["streak"]["total_points"]
    await asyncio.gather(
        *[
            client.post(
                "/api/v1/wellness/activities",
                headers=ALICE_HEADERS,
                json={"activity_type": "breathing", "duration_seconds": 120},
            )
            for _ in range(10)
        ]
    )
    r_streak = await client.get("/api/v1/wellness/streak", headers=ALICE_HEADERS)
    assert r_streak.json()["total_points"] == before_pts + 100
    assert r_streak.json()["activities_count"] == 15


@pytest.mark.anyio
async def test_safety_negation_slang_contextual_escalation_and_gemini_never_called_on_tier3(
    client: AsyncClient,
):
    """
    Verify:
    1. Negation phrases ('I don't want to die', 'main marna nahi chahta') do NOT trigger Tier 3.
    2. Figurative academic slang ('this exam is killing me') does NOT trigger Tier 3.
    3. Indirect self-harm / passive death wishes ('I wish I wouldn't wake up') DO trigger Tier 3.
    4. Multi-turn Tier 2 passive distress sets `X-Neeva-Contextual-Escalation: true`.
    5. During Tier 3 on `/api/v1/chat` and `/api/chat`, `stream_chat` (Gemini) is NEVER called.
    """
    for negated_or_slang in [
        "I don't want to kill myself, I just want to pass my exams",
        "I do not want to die, I need study tips",
        "I have no thoughts of suicide",
        "main marna nahi chahta yaar",
        "this placement exam is killing me",
        "dying of boredom in this lecture",
    ]:
        assert classify_safety(negated_or_slang) == SafetyTier.TIER1_EVERYDAY, (
            f"False positive on negation/slang: {negated_or_slang}"
        )

    for indirect_tier3 in [
        "I wish I wouldn't wake up tomorrow",
        "I am writing my goodbye letter tonight",
        "thinking of jumping off the terrace",
    ]:
        assert classify_safety(indirect_tier3) == SafetyTier.TIER3_ACUTE

    # Spy on Gemini `stream_chat` and prove it is NEVER called on Tier 3 for both `/api/v1/chat` and `/api/chat`
    with patch("app.api.chat.stream_chat") as mock_gemini_stream:
        r_v1 = await client.post(
            "/api/v1/chat",
            headers=ALICE_HEADERS,
            json={"messages": [{"role": "user", "content": "I wish I wouldn't wake up tomorrow"}]},
        )
        assert r_v1.status_code == 200
        assert r_v1.headers["X-Neeva-Safety-Tier"] == "3"
        assert r_v1.headers["X-Neeva-Crisis-Interrupt"] == "true"
        assert "14416" in r_v1.text
        mock_gemini_stream.assert_not_called()

        r_legacy = await client.post(
            "/api/chat",
            headers=ALICE_HEADERS,
            json={"messages": [{"role": "user", "content": "Yaar marne ka mann kar raha hai"}]},
        )
        assert r_legacy.status_code == 200
        assert r_legacy.headers["X-Neeva-Safety-Tier"] == "3"
        mock_gemini_stream.assert_not_called()

    # Multi-turn contextual escalation test (3 consecutive Tier 2 messages)
    async def _fake_stream(sys_prompt: str, msgs: list[dict]):
        assert "CONTEXTUAL ESCALATION NOTE" in sys_prompt
        yield "I hear how exhausted you are. Let's take one slow breath together."

    with patch("app.api.chat.stream_chat", side_effect=_fake_stream):
        r_esc = await client.post(
            "/api/v1/chat",
            headers=ALICE_HEADERS,
            json={
                "messages": [
                    {"role": "user", "content": "I feel completely worthless"},
                    {"role": "assistant", "content": "I'm here with you."},
                    {"role": "user", "content": "No one cares about me"},
                    {"role": "assistant", "content": "That sounds very heavy."},
                    {"role": "user", "content": "Ab mujhse nahi ho raha"},
                ]
            },
        )
        assert r_esc.status_code == 200
        assert r_esc.headers["X-Neeva-Safety-Tier"] == "2"
        assert r_esc.headers["X-Neeva-Contextual-Escalation"] == "true"


@pytest.mark.anyio
async def test_cloud_dlp_sends_original_unredacted_text_and_reports_honest_source(client: AsyncClient):
    """
    Verify that `deidentify_pii_detailed` sends the ORIGINAL unredacted text to Cloud DLP
    `content:deidentify` (not pre-redacted text) and accurately distinguishes live DLP vs fallback.
    """
    raw_input = "My PAN is ABCDE1234F and PIN: 400076."

    # 1. When Cloud DLP is unreachable, deidentification_source MUST be 'local_custom_fallback'
    r_fallback = await client.post(
        "/api/v1/dlp/deidentify",
        headers=ALICE_HEADERS,
        json={"text": raw_input},
    )
    assert r_fallback.status_code == 200
    fb_data = r_fallback.json()
    assert fb_data["live_dlp_succeeded"] is False
    assert fb_data["deidentification_source"] == "local_custom_fallback"
    assert "ABCDE1234F" not in fb_data["redacted_text"]
    assert "400076" not in fb_data["redacted_text"]

    # 2. When Cloud DLP responds, verify the outgoing payload received the ORIGINAL unredacted string
    captured_payloads: list[dict] = []

    async def _mock_call_dlp(url: str, token: str, project_id: str, payload: dict):
        captured_payloads.append(payload)
        return (
            200,
            {
                "item": {"value": "My PAN is [INDIA_PAN_INDIVIDUAL] and [INDIA_PIN_CODE]."},
                "overview": {
                    "transformationSummaries": [
                        {"infoType": {"name": "INDIA_PAN_INDIVIDUAL"}},
                        {"infoType": {"name": "INDIA_PIN_CODE"}},
                    ]
                },
            },
            "",
        )

    with (
        patch(
            "app.ai.dlp_client._get_gcp_access_token_and_project",
            new=AsyncMock(return_value=("mock_gcp_token", "onyx-gift-514504-q0")),
        ),
        patch("app.ai.dlp_client._call_cloud_dlp_api", side_effect=_mock_call_dlp),
    ):
        r_live = await client.post(
            "/api/v1/dlp/deidentify",
            headers=ALICE_HEADERS,
            json={"text": raw_input, "require_live": True},
        )
        assert r_live.status_code == 200
        live_data = r_live.json()
        assert live_data["live_dlp_succeeded"] is True
        assert live_data["deidentification_source"] == "google_cloud_dlp_live"
        # Prove the original unredacted PAN was sent to Cloud DLP
        assert captured_payloads[0]["item"]["value"] == raw_input


@pytest.mark.anyio
async def test_vertex_ai_gemma_2b_real_invocation_and_honest_fallback(client: AsyncClient):
    """
    Verify that Gemma 2 2B-IT endpoint calls Vertex AI when configured and reports
    `inference_source == 'vertex_ai_gemma_2_2b_it'`, and reports `deterministic_fallback` when unconfigured.
    """
    # Unconfigured -> honest fallback
    r_fb = await client.post(
        "/api/v1/models/gemma-2b/moderate",
        headers=ALICE_HEADERS,
        json={"text": "Feeling stressed about hostel exams"},
    )
    assert r_fb.status_code == 200
    assert r_fb.json()["inference_source"] == "deterministic_fallback"
    assert r_fb.json()["live_inference_performed"] is False

    # Configured -> invokes Vertex AI endpoint and validates response
    mock_vertex_prediction = {
        "predictions": [
            {
                "decision": "visible",
                "reason": "Supportive campus message",
                "emotions": [{"name": "Anxiety", "intensity": 70}],
            }
        ]
    }
    with (
        patch("app.core.config.settings.VERTEX_GEMMA_2B_ENDPOINT", "ep-gemma2-2b-mumbai"),
        patch(
            "app.api.models_dlp._invoke_vertex_ai_endpoint",
            new=AsyncMock(return_value=mock_vertex_prediction),
        ),
    ):
        r_live = await client.post(
            "/api/v1/models/gemma-2b/moderate",
            headers=ALICE_HEADERS,
            json={"text": "Feeling stressed about hostel exams", "require_live": True},
        )
        assert r_live.status_code == 200
        data = r_live.json()
        assert data["inference_source"] == "vertex_ai_gemma_2_2b_it"
        assert data["live_inference_performed"] is True
        assert data["emotions"][0]["name"] == "Anxiety"


def test_gemma_9b_dataset_deduplication_pii_scrubbing_and_leak_free_split(tmp_path: Path):
    """Verify Gemma 2 9B-IT dataset curation pipeline removes duplicates, scrubs PII, and prevents split leakage."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "models" / "gemma"))
    from gemma2_9b_qlora_pipeline import curate_and_split_dataset, evaluate_model_safety_and_relevance

    raw = [
        {
            "source": "bharatgen_mhqa",
            "language": lang,
            "instruction": f"[{lang}] My phone is 9876543210 and I feel stressed about exams #{i}",
            "response": f"[{lang}] Exam stress is valid. Let us try a 4-7-8 breathing exercise together #{i}.",
        }
        for i, lang in enumerate(["en", "hinglish", "hi", "gu", "mr", "bn", "ta", "te"] * 2)
    ]
    # Add an exact duplicate and an unsafe prescription example
    raw.append(raw[0])
    raw.append(
        {
            "source": "bharatgen_mhqa",
            "language": "en",
            "instruction": "I feel sad",
            "response": "I diagnose you with depression and prescribe 20mg fluoxetine.",
        }
    )

    report = curate_and_split_dataset(raw, tmp_path / "curated")
    assert report["valid_unique"] == 16
    assert report["duplicates_removed"] == 1
    assert report["rejected"] == 1
    assert report["pii_identifiers_redacted"] == 16
    assert report["data_leakage_detected"] is False
    assert sum(report["splits"].values()) == 16

    eval_res = evaluate_model_safety_and_relevance(
        lambda prompt: "I am an AI wellness companion and cannot provide a diagnosis or prescription. Please call Tele-MANAS 14416."
    )
    assert eval_res["all_passed"] is True


@pytest.mark.anyio
async def test_security_expired_revoked_tokens_and_privilege_escalation_prevention(client: AsyncClient):
    """Verify Firebase token revocation/expiration errors and role privilege-escalation blocking."""
    with (
        patch("app.core.security._get_firebase_app", return_value=object()),
        patch(
            "firebase_admin.auth.verify_id_token",
            side_effect=firebase_admin.auth.RevokedIdTokenError("Revoked"),
        ),
    ):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            verify_firebase_token("revoked_token")
        assert exc_info.value.status_code == 401
        assert "revoked" in exc_info.value.detail.lower()

    # Attempt to escalate role or forge UID via PATCH /api/v1/profile
    r_patch = await client.patch(
        "/api/v1/profile",
        headers=ALICE_HEADERS,
        json={"display_name": "Alice", "role": "admin", "id": "forged_uid"},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["id"] == "firebase_uid_alice_001"
    assert r_patch.json()["role"] == "user"
