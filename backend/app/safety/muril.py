"""
MuRIL (Multilingual Representations for Indian Languages) distress classifier.
Uses ONNX Runtime for CPU-efficient multilingual classification across all 8 Indian languages.
Gracefully degrades to deterministic regex routing if the ONNX artifact is not yet exported.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np

from app.core.config import settings
from app.safety.crisis_patterns import SafetyTier

logger = logging.getLogger(__name__)


class MuRILClassifier:
    """ONNX-based MuRIL distress classifier (google/muril-base-cased)."""

    def __init__(self, model_path: Optional[str] = None) -> None:
        self._model_path = Path(model_path or settings.MURIL_ONNX_PATH)
        self._session = None
        self._tokenizer = None
        self._available = False
        self._confidence_threshold = 0.75
        self._load()

    def _load(self) -> None:
        if not self._model_path.exists():
            logger.info(
                "MuRIL ONNX model not found at %s. Running deterministic rule layer.",
                self._model_path,
            )
            return
        try:
            import onnxruntime as ort
            from transformers import AutoTokenizer

            self._session = ort.InferenceSession(
                str(self._model_path), providers=["CPUExecutionProvider"]
            )
            self._tokenizer = AutoTokenizer.from_pretrained("google/muril-base-cased")
            self._available = True
            logger.info("MuRIL ONNX classifier loaded from %s", self._model_path)
        except Exception as exc:
            logger.warning("MuRIL initialization skipped (%s). Using deterministic layer.", exc)

    @property
    def available(self) -> bool:
        return self._available

    async def classify(self, text: str) -> tuple[SafetyTier, float]:
        """
        Run ONNX inference and return (SafetyTier, confidence).
        Label mapping: 0 -> TIER1_EVERYDAY, 1 -> TIER2_PASSIVE_DISTRESS, 2 -> TIER3_ACUTE.
        """
        if not self._available or self._session is None or self._tokenizer is None:
            raise RuntimeError("MuRIL ONNX model is not loaded.")

        inputs = self._tokenizer(
            text,
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

