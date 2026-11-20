"""
[PHASE 2 ROADMAP — ISOLATED SCAFFOLD]
Gemma 2 9B-IT QLoRA (4-bit NormalFloat NF4) Fine-Tuning Pipeline
Never imported by the live v1 runtime so it cannot block or incur GPU costs.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Gemma2QLoRAConfig:
    base_model_id: str = "google/gemma-2-9b-it"
    quantization_type: str = "nf4"
    double_quant: bool = True
    compute_dtype: str = "bfloat16"
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    target_modules: list[str] = field(
        default_factory=lambda: [
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ]
    )
    learning_rate: float = 2e-4
    num_train_epochs: int = 3


def describe_phase2_qlora_pipeline() -> dict[str, object]:
    cfg = Gemma2QLoRAConfig()
    return {
        "phase": "phase_2_roadmap",
        "live_in_v1": False,
        "base_model": cfg.base_model_id,
        "quantization": cfg.quantization_type,
        "lora_r": cfg.lora_r,
        "lora_alpha": cfg.lora_alpha,
        "target_modules": cfg.target_modules,
    }
