# Neeva AI — AI Provider Architecture & Model Limitations

## 1. Honest Three-Provider Architecture

To guarantee that Neeva works out-of-the-box at **₹0 cost** while never misrepresenting deterministic responses as generative AI inference, `backend/app/ai/providers.py` implements three distinct providers:

| Provider ID | Name | Runtime & Hardware Requirements | Response Header (`X-Neeva-AI-Provider`) | `X-Neeva-Is-Generative-LLM` | Cost |
|---|---|---|---|---|---|
| **Provider A** | Local Open-Source Model (`local_open_source`) | CPU-compatible quantized model (e.g., `gemma2:2b` Q4_K_M ~1.6 GB disk, ~2.5 GB RAM via local Ollama/llama.cpp at `LOCAL_LLM_BASE_URL`) | `local_open_source` | `true` | **₹0** |
| **Provider B** | Optional Free-Tier Gemini (`gemini_free_tier_opt_in`) | Disabled by default (`ENABLE_OPTIONAL_GEMINI_FREE_TIER=false`). Only active if user explicitly configures a free-tier Google AI Studio key. Never uses paid Vertex AI. | `gemini_free_tier_opt_in` | `true` | **₹0** (Subject to Google AI Studio free-tier rate limits) |
| **Provider C** | Deterministic CBT/ACT Engine (`deterministic_fallback`) | Always available offline on any CPU (<50 MB RAM, 0 external downloads). Supports all 8 Indian languages and 3 companion modes. | `deterministic_fallback` | `false` | **₹0** |

---

## 2. Documented Model & Safety Limitations

1. **Deterministic Fallback (`Provider C`) Limitations:**
   - Not a generative large language model; it constructs structured, empathetic CBT/ACT responses based on the user's selected language (`en`, `hinglish`, `hi`, `gu`, `mr`, `bn`, `ta`, `te`), companion personality (`bestie`, `coach`, `sage`, `hype`), interaction mode (`Just listen`, `Help me reframe`, `Guide me through a tool`), and detected emotional themes.
   - Always labels its outputs honestly (`X-Neeva-Is-Generative-LLM: false`, `source: "offline"`).
2. **Local CPU Quantized Models (`Provider A`) Limitations:**
   - 2B–3B parameter 4-bit quantized models running on consumer CPUs have smaller context windows and less nuance in low-resource Indian scripts (such as Gujarati, Telugu, or Bengali native script) than frontier cloud models.
   - Always filtered through `validate_ai_response()` (`backend/app/ai/gemini.py`) to block clinical diagnosis or medication prescriptions.
3. **Optional Free-Tier Gemini (`Provider B`) Limitations:**
   - Google AI Studio's free tier enforces strict requests-per-minute (RPM) and tokens-per-day quotas and may not be available in all regions or guaranteed permanently. If a `429` or connection error occurs, Neeva automatically falls back to Provider A / Provider C.
4. **Crisis Detection & Clinical Boundary Limitations:**
   - The Three-Tier Safety Engine (`backend/app/safety/crisis_patterns.py` + `engine.py`) covers direct self-harm, indirect self-harm, passive death wishes, negation guards, figurative slang guards, and multi-turn passive distress escalation across 8 Indian languages.
   - However, **no automated rule engine or ML classifier guarantees 100% clinical sensitivity or specificity**. Subtle, coded, or novel expressions of self-harm may not match known patterns. Therefore, Neeva keeps the **Crisis Help button** (`Tele-MANAS 14416`, `iCall 9152987821`, `Emergency 112`) permanently accessible in the UI header on every screen and never claims to replace licensed clinical care.

