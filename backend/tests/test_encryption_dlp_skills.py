"""
Automated tests for Privacy/Encryption (AES-GCM-256 + PBKDF2), Google Cloud DLP / Indian PII Redaction,
AI Clinical Guardrails, Google Agent Skills, and Gemma Model Pipeline Validators.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

from app.ai.companion_prompt import CompanionConfig, build_system_prompt
from app.ai.dlp_client import redact_pii, redact_pii_locally
from app.ai.gemini import validate_ai_response
from app.ai.journal_analysis import analyze_locally
from app.ai.skills import skill_cbt_tool_picker, skill_crisis_triage, skill_pii_redaction
from app.privacy.encryption import (
    decode_client_ciphertext,
    decrypt_aes_gcm_256,
    derive_key_pbkdf2,
    encrypt_aes_gcm_256,
)


def test_aes_gcm_256_pbkdf2_roundtrip():
    salt = os.urandom(16)
    key = derive_key_pbkdf2("user-secret-passphrase-neeva", salt, iterations=100_000)
    assert len(key) == 32

    plaintext = "Aaj exam ka bahut tension tha, par شام ko walk ke baad sukoon mila."
    enc = encrypt_aes_gcm_256(plaintext, key)
    ct_b64, iv_b64 = enc.to_base64()

    decoded = decode_client_ciphertext(ct_b64, iv_b64)
    recovered = decrypt_aes_gcm_256(decoded.ciphertext, decoded.iv, key)
    assert recovered == plaintext


def test_invalid_ciphertext_rejected():
    with pytest.raises(ValueError):
        decode_client_ciphertext("not-base64!!!", "also-bad!!!")


@pytest.mark.anyio
async def test_indian_pii_redaction_aadhaar_pan_phone_email():
    sample = (
        "My Aadhaar is 4567 8901 2345, PAN is ABCDE1234F, "
        "call me at +91 9876543210 or email student.name@iitb.ac.in."
    )
    redacted, found = redact_pii_locally(sample)
    assert "4567 8901 2345" not in redacted
    assert "ABCDE1234F" not in redacted
    assert "9876543210" not in redacted
    assert "student.name@iitb.ac.in" not in redacted
    assert "INDIA_AADHAAR_INDIVIDUAL" in found
    assert "INDIA_PAN_INDIVIDUAL" in found
    assert "PHONE_NUMBER" in found
    assert "EMAIL_ADDRESS" in found

    skill_out = await skill_pii_redaction(sample)
    assert skill_out["pii_found"] is True
    assert len(skill_out["detected_info_types"]) == 4


def test_ai_clinical_response_validation():
    unsafe = "Based on your symptoms, I diagnose you with clinical depression. Take 50mg of sertraline."
    safe_output = validate_ai_response(unsafe)
    assert "cannot provide a medical diagnosis or medication advice" in safe_output
    assert "14416" in safe_output

    normal = "That sounds like a really exhausting week. Want to try one round of 4-7-8 breathing?"
    assert validate_ai_response(normal) == normal


@pytest.mark.anyio
async def test_google_agent_skills_triage_and_cbt_picker():
    triage_t3 = await skill_crisis_triage("marne ka dil kar raha hai")
    assert triage_t3.tier == 3
    assert triage_t3.should_interrupt is True
    assert triage_t3.action == "crisis_interrupt"

    triage_t2 = await skill_crisis_triage("ab mujhse nahi ho raha")
    assert triage_t2.tier == 2
    assert triage_t2.should_interrupt is False
    assert triage_t2.action == "empathetic_grounding"

    tool_sleep = skill_cbt_tool_picker("Raat ko neend nahi aati")
    assert tool_sleep["validated"] is True
    assert tool_sleep["selected_tool"]["tool_id"] == "meditation_sleep"

    tool_exam = skill_cbt_tool_picker("Exam and placement stress is overwhelming")
    assert tool_exam["selected_tool"]["tool_id"] == "meditation_exam"


def test_companion_prompt_8_languages_and_3_modes():
    for lang in ("en", "hinglish", "hi", "gu", "mr", "bn", "ta", "te"):
        for mode in ("just_listen", "reframe", "guide_tool"):
            cfg = CompanionConfig(name="Mitra", approach=mode)
            prompt = build_system_prompt(cfg, lang=lang, script="auto")
            assert "Mitra" in prompt
            assert "14416" in prompt
            assert "never diagnose" in prompt


def test_journal_local_fallback_schema():
    res = analyze_locally("I always feel anxious about exams and study deadlines, everything is ruined.")
    assert "summary" in res
    assert isinstance(res["valence"], int)
    assert len(res["emotions"]) >= 1
    assert len(res["distortions"]) >= 1
    assert len(res["reframes"]) >= 1


def test_gemma_pipeline_validation():
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "models" / "gemma"))
    from gemma2_2b_moderation_tagger import get_workload_suitability_report, validate_moderation_output
    from gemma2_9b_qlora_pipeline import validate_training_record

    ok, _ = validate_training_record(
        {
            "source": "bharatgen_mhqa",
            "language": "hinglish",
            "instruction": "Yaar exam ka bahut dar lag raha hai",
            "response": "Samajh sakta hoon yaar, exam ke pehle dar lagna bilkul normal hai.",
        }
    )
    assert ok is True

    bad_ok, reason = validate_training_record(
        {
            "source": "bharatgen_mhqa",
            "language": "en",
            "instruction": "I feel sad",
            "response": "You are diagnosed with depression and I prescribe 20mg fluoxetine.",
        }
    )
    assert bad_ok is False
    assert "prohibited" in reason

    mod_out = validate_moderation_output(
        {"decision": "visible", "reason": "Safe peer support", "emotions": [{"name": "Anxiety", "intensity": 80}]}
    )
    assert mod_out["decision"] == "visible"
    assert mod_out["emotions"][0]["name"] == "Anxiety"

    report = get_workload_suitability_report()
    assert report["model_id"] == "google/gemma-2-2b-it"

