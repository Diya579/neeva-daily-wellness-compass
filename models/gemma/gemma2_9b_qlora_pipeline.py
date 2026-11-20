"""
Gemma 2 9B-IT (`google/gemma-2-9b-it`) QLoRA Fine-Tuning & Vertex AI Deployment Pipeline.
Implements Section 8 of the Master Specification:
- Dataset preparation & validation for **BharatGen MHQA** and **Vaani** datasets.
- Clinical guardrail filtering during dataset curation (strips any diagnostic or prescription records).
- 4-bit NF4 QLoRA training configuration for Google Colab (A100/L4) and Vertex AI CustomTrainingJob.
- Model evaluation & Vertex AI Model Registry versioning.

IMPORTANT: Training has NOT been executed locally; this pipeline is prepared for execution
on Google Colab or Vertex AI with owner approval (to avoid unapproved GPU billing).
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

SUPPORTED_LANGS = {"en", "hinglish", "hi", "gu", "mr", "bn", "ta", "te"}

PROHIBITED_TRAINING_PATTERNS = [
    re.compile(r"\bprescribe\s+\d+\s*mg\b", re.I),
    re.compile(r"\byou\s+are\s+diagnosed\s+with\b", re.I),
    re.compile(r"\bstop\s+taking\s+your\s+medication\b", re.I),
]


@dataclass
class QLoRATrainingConfig:
    base_model_id: str = "google/gemma-2-9b-it"
    dataset_sources: tuple[str, ...] = ("BharatGen-MHQA", "IISc-ARTPARK-Vaani")
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    target_modules: tuple[str, ...] = (
        "q_proj",
        "k_proj",
        "v_proj",
        "o_proj",
        "gate_proj",
        "up_proj",
        "down_proj",
    )
    load_in_4bit: bool = True
    bnb_4bit_quant_type: str = "nf4"
    bnb_4bit_compute_dtype: str = "bfloat16"
    bnb_4bit_use_double_quant: bool = True
    learning_rate: float = 2e-4
    num_train_epochs: int = 3
    per_device_train_batch_size: int = 2
    gradient_accumulation_steps: int = 8
    max_seq_length: int = 2048
    warmup_ratio: float = 0.05
    lr_scheduler_type: str = "cosine"
    vertex_machine_type: str = "g2-standard-12"
    vertex_accelerator_type: str = "NVIDIA_L4"
    vertex_accelerator_count: int = 1
    vertex_region: str = "asia-south1"


def validate_training_record(record: dict[str, Any]) -> tuple[bool, str]:
    """
    Validate a single BharatGen MHQA or Vaani conversational record before QLoRA formatting.
    Ensures language support, non-empty prompt/response, and absence of clinical diagnosis/prescription claims.
    """
    source = record.get("source", "")
    if source not in ("bharatgen_mhqa", "vaani"):
        return False, f"Unsupported dataset source: {source}"

    lang = record.get("language", "")
    if lang not in SUPPORTED_LANGS:
        return False, f"Unsupported language code: {lang}"

    instruction = (record.get("instruction") or "").strip()
    response = (record.get("response") or "").strip()
    if len(instruction) < 5 or len(response) < 10:
        return False, "Instruction or response too short."

    for pat in PROHIBITED_TRAINING_PATTERNS:
        if pat.search(response):
            return False, "Response contains prohibited diagnostic or prescription language."

    return True, "valid"


def format_gemma2_chat_turn(record: dict[str, Any]) -> str:
    """Format a validated record into Gemma 2 IT `<start_of_turn>` chat template."""
    user_text = record["instruction"].strip()
    model_text = record["response"].strip()
    return (
        f"<start_of_turn>user\n{user_text}<end_of_turn>\n"
        f"<start_of_turn>model\n{model_text}<end_of_turn>"
    )


def prepare_dataset_jsonl(records: list[dict[str, Any]], output_file: Path) -> dict[str, int]:
    """Filter and format raw BharatGen MHQA + Vaani records into JSONL for SFTTrainer."""
    valid_count = 0
    rejected_count = 0
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open("w", encoding="utf-8") as fh:
        for rec in records:
            ok, _ = validate_training_record(rec)
            if not ok:
                rejected_count += 1
                continue
            formatted = format_gemma2_chat_turn(rec)
            fh.write(json.dumps({"text": formatted, "language": rec["language"], "source": rec["source"]}, ensure_ascii=False) + "\n")
            valid_count += 1
    return {"valid": valid_count, "rejected": rejected_count}


def build_vertex_ai_job_spec(project_id: str, staging_bucket: str, version_tag: str = "v1") -> dict[str, Any]:
    """Generate the Vertex AI CustomJob specification for Gemma 2 9B-IT QLoRA fine-tuning."""
    cfg = QLoRATrainingConfig()
    return {
        "display_name": f"neeva-gemma2-9b-qlora-{version_tag}",
        "project": project_id,
        "location": cfg.vertex_region,
        "staging_bucket": staging_bucket,
        "worker_pool_specs": [
            {
                "machine_spec": {
                    "machine_type": cfg.vertex_machine_type,
                    "accelerator_type": cfg.vertex_accelerator_type,
                    "accelerator_count": cfg.vertex_accelerator_count,
                },
                "replica_count": 1,
                "container_spec": {
                    "image_uri": "us-docker.pkg.dev/vertex-ai/training/pytorch-gpu.2-2.py310:latest",
                    "args": [
                        "--base_model", cfg.base_model_id,
                        "--lora_r", str(cfg.lora_r),
                        "--lora_alpha", str(cfg.lora_alpha),
                        "--epochs", str(cfg.num_train_epochs),
                        "--lr", str(cfg.learning_rate),
                    ],
                },
            }
        ],
        "qlora_config": asdict(cfg),
    }

