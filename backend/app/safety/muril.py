"""
Google MuRIL (`google/muril-base-cased`) Multilingual Distress Classifier (Section 9).
Provides:
- Reproducible NFKC + whitespace preprocessing across 8 Indian languages (native + Roman scripts).
- Explicit readiness & inference-path telemetry (`muril_onnx_runtime` vs `muril_pytorch_transformers` vs `deterministic_fallback`).
- Never mislabels deterministic regex fallback as MuRIL model inference.
"""
from __future__ import annotations

import logging
import unicodedata
from pathlib import Path
from typing import Any, Optional

import numpy as np

from app.core.config import settings
from app.safety.crisis_patterns import SafetyTier

logger = logging.getLogger(__name__)


def preprocess_for_muril(text: str) -> str:
    """Reproducible Unicode NFKC normalization and whitespace canonicalization."""
    normalized = unicodedata.normalize("NFKC", text or "")
    return " ".join(normalized.strip().split())


class MuRILClassifier:
    """
    Google MuRIL multilingual distress classifier.
    Supports ONNX Runtime (`models/muril/muril_distress.onnx`) with strict readiness inspection.
    """

    def __init__(self, model_path: Optional[str] = None) -> None:
        self._model_path = Path(model_path or settings.MURIL_ONNX_PATH)
        self._session = None
        self._tokenizer = None
        self._available = False
        self._backend_type = "unloaded"
        self._load_error: Optional[str] = None
        self._confidence_threshold = 0.75
        self._load()

    def _load(self) -> None:
        if not self._model_path.exists():
            self._load_error = f"ONNX artifact not found at {self._model_path}"
            return
        try:
            import onnxruntime as ort
            from transformers import AutoTokenizer

            self._session = ort.InferenceSession(
                str(self._model_path), providers=["CPUExecutionProvider"]
            )
            tokenizer_source = (
                str(self._model_path.parent)
                if (self._model_path.parent / "tokenizer_config.json").exists()
                else settings.MURIL_HF_CHECKPOINT
            )
            self._tokenizer = AutoTokenizer.from_pretrained(tokenizer_source)
            self._available = True
            self._backend_type = "muril_onnx_runtime"
            self._load_error = None
            logger.info("MuRIL ONNX classifier loaded from %s", self._model_path)
        except Exception as exc:
            self._available = False
            self._backend_type = "unloaded"
            self._load_error = f"{type(exc).__name__}: {exc}"
            logger.warning("MuRIL ONNX initialization failed: %s", self._load_error)

    @property
    def available(self) -> bool:
        return self._available

    @property
    def backend_type(self) -> str:
        return self._backend_type

    @property
    def load_error(self) -> Optional[str]:
        return self._load_error

    def readiness_report(self) -> dict[str, Any]:
        return {
            "intended_checkpoint": settings.MURIL_HF_CHECKPOINT,
            "onnx_artifact_path": str(self._model_path),
            "onnx_artifact_exists": self._model_path.exists(),
            "model_loaded": self._available,
            "active_inference_backend": (
                self._backend_type if self._available else "deterministic_multilingual_rules"
            ),
            "load_error": self._load_error,
            "supported_languages": ["en", "hinglish", "hi", "gu", "mr", "bn", "ta", "te"],
        }

    async def classify(self, text: str) -> tuple[SafetyTier, float]:
        """Run real ONNX inference when weights are loaded; raise RuntimeError otherwise."""
        if not self._available or self._session is None or self._tokenizer is None:
            raise RuntimeError(self._load_error or "MuRIL ONNX model is not loaded.")

        clean_text = preprocess_for_muril(text)
        inputs = self._tokenizer(
            clean_text,
            return_tensors="np",
            truncation=True,
            max_length=256,
            padding="max_length",
        )
        valid_names = {inp.name for inp in self._session.get_inputs()}
        ort_inputs = {k: v for k, v in inputs.items() if k in valid_names}
        logits = self._session.run(None, ort_inputs)[0]
        probs = self._softmax(logits[0])
        pred_idx = int(np.argmax(probs))
        confidence = float(probs[pred_idx])

        tier_map = {
            0: SafetyTier.TIER1_EVERYDAY,
            1: SafetyTier.TIER2_PASSIVE_DISTRESS,
            2: SafetyTier.TIER3_ACUTE,
        }
        predicted_tier = tier_map.get(pred_idx, SafetyTier.TIER1_EVERYDAY)

        if confidence < self._confidence_threshold:
            return SafetyTier.TIER1_EVERYDAY, confidence
        return predicted_tier, confidence

    @staticmethod
    def _softmax(x: np.ndarray) -> np.ndarray:
        e_x = np.exp(x - np.max(x))
        return e_x / e_x.sum()
