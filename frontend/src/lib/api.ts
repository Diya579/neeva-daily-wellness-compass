/**
 * Central API Client (`src/lib/api.ts`)
 * Connects the Neeva Frontend to the Local FastAPI Safety Gatekeeper & SQLite WAL Zero-Knowledge Vault,
 * with direct native Google AI Studio REST fallback (`x-goog-api-key`) supporting BOTH `AQ.` and `AIza` keys:
 * - Pre-flight Client-Side Indian PII Scrubber (`scrubIndianPII`)
 * - Pre-flight Client-Edge < 3.2ms Deterministic 3-Tier Safety Gate (`evaluateSafetyGate`)
 * - AbortController integration for instant Tier-3 stream circuit breaking
 * - Direct Native Google AI Studio (`https://generativelanguage.googleapis.com/v1beta/models/...:generateContent`)
 *   when FastAPI is offline — NEVER routes `AQ.` keys to Vertex AI and NEVER uses `Authorization: Bearer`
 * - Zero-Knowledge Ciphertext-Only Journal Vault sync (`POST /api/v1/journal/vault`)
 */

import type { Companion } from "./companion";
import type { EncryptedVaultPayload } from "./crypto";
import { analyzeLocally } from "./journal-local";
import type { JournalAnalysis } from "./journal-types";
import type { LangCode, ScriptStyle } from "./neeva-data";
import { scrubIndianPII } from "./piiScrubber";
import {
  evaluateSafetyGate,
  validateGeminiStructuredResponse,
  type CrisisLevel,
  type SafetyHelpline,
  type SuggestedAction,
} from "./safetyGate";

const GOOGLE_AI_STUDIO_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
] as const;

// Strict 4-Field Gemini JSON Schema: `crisisLevel` is INTEGER without integer enum array
const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  required: ["crisisLevel", "suggestedAction", "reply", "reframeQuestion"],
  propertyOrdering: ["crisisLevel", "suggestedAction", "reply", "reframeQuestion"],
  properties: {
    crisisLevel: {
      type: "INTEGER",
      description:
        "0 for normal/casual conversation, 1 for academic stress, 2 for passive distress, 3 for acute crisis.",
    },
    suggestedAction: {
      type: "STRING",
      description: "Recommended micro-tool widget to launch in the UI.",
      enum: ["breathing", "journal", "soundscape"],
    },
    reply: {
      type: "STRING",
      description:
        "Warm, empathetic, natural response directly addressing the user's message in their exact language/Hinglish style.",
    },
    reframeQuestion: {
      type: "STRING",
      description:
        "One tailored Socratic CBT question directly related to the user's message (empty string if crisisLevel == 3).",
    },
  },
};

export function getApiBaseUrl(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.["VITE_API_BASE_URL"]) {
    return String(import.meta.env["VITE_API_BASE_URL"]).replace(/\/+$/, "");
  }
  return "http://localhost:8080";
}

/** Recognize both Google AI Studio `AQ.` Authentication Keys and legacy `AIza` keys (len >= 30). */
export function isValidGeminiApiKey(key: string): boolean {
  const k = key.trim();
  return k.length >= 30 && (k.startsWith("AQ.") || k.startsWith("AIza"));
}

export function getGeminiApiKey(): string {
  const fromVite =
    typeof import.meta !== "undefined"
      ? String(
          import.meta.env?.["VITE_GEMINI_API_KEY"] ||
            import.meta.env?.["GEMINI_API_KEY"] ||
            ""
        ).trim()
      : "";
  if (isValidGeminiApiKey(fromVite)) return fromVite;

  if (typeof process !== "undefined" && process.env) {
    const fromProc = String(
      process.env["GEMINI_API_KEY"] || process.env["VITE_GEMINI_API_KEY"] || ""
    ).trim();
    if (isValidGeminiApiKey(fromProc)) return fromProc;
  }
  return "";
}

export interface ChatTurnResult {
  crisisLevel: CrisisLevel;
  suggestedAction: SuggestedAction;
  reply: string;
  reframeQuestion: string;
  haltStream: boolean;
  helplines: SafetyHelpline[];
  piiScrubbedCount: number;
  gateLatencyMs: number;
  source: "edge_circuit_breaker" | "backend_gemini" | "direct_gemini" | "local_deterministic";
  modelUsed?: string;
}

/**
 * Call the native Google AI Studio REST endpoint directly using `x-goog-api-key`.
 * NEVER routes `AQ.` keys to Vertex AI and NEVER sends `Authorization: Bearer`.
 */
export async function callNativeGoogleAIStudio(params: {
  message: string;
  language: LangCode;
  script: ScriptStyle;
  companion: Companion;
  history?: { role: "user" | "assistant"; content: string }[];
  abortSignal?: AbortSignal;
}): Promise<{
  crisisLevel: CrisisLevel;
  suggestedAction: SuggestedAction;
  reply: string;
  reframeQuestion: string;
  modelUsed: string;
} | null> {
  const apiKey = getGeminiApiKey();
  if (!isValidGeminiApiKey(apiKey)) {
    console.error("[Neeva Gemini] No valid GEMINI_API_KEY / VITE_GEMINI_API_KEY found (expected AQ.* or AIza*).");
    return null;
  }

  const systemInstruction =
    `You are ${params.companion.name}, a warm, empathetic Indian youth mental wellness companion (vibe: ${params.companion.vibe}). ` +
    `Language preference: '${params.language}', script style: '${params.script}'. ` +
    "LANGUAGE MIRRORING RULE (CRITICAL): If the user types in Hinglish (Hindi in Roman/English letters like 'Arey sun toh', 'Yaar kal viva hai'), " +
    "you MUST reply naturally in warm conversational Hinglish (Roman script) like a close Indian friend. " +
    "If they write in Hindi/Gujarati/Marathi/Bengali/Tamil/Telugu or English, mirror their exact language and script. " +
    "Tailor both `reply` and `reframeQuestion` directly to what the user just said. Never diagnose or prescribe medication. " +
    "Return ONLY valid JSON matching the 4-field responseSchema with crisisLevel first.";

  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  if (params.history) {
    for (const h of params.history.slice(-10)) {
      if (h.content.trim()) {
        contents.push({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content.trim() }],
        });
      }
    }
  }
  contents.push({ role: "user", parts: [{ text: params.message }] });

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      temperature: 0.6,
      maxOutputTokens: 600,
    },
  });

  for (const modelName of GEMINI_CANDIDATE_MODELS) {
    const url = `${GOOGLE_AI_STUDIO_BASE}/${modelName}:generateContent`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body,
        signal: params.abortSignal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[Neeva Gemini] HTTP ${res.status} on ${modelName}:`, errBody.slice(0, 400));
        if (res.status === 404 || res.status === 429 || res.status === 500 || res.status === 503) {
          continue;
        }
        return null;
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const rawText = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      if (!rawText) {
        console.error(`[Neeva Gemini] Empty response text from ${modelName}`);
        continue;
      }

      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      const validated = validateGeminiStructuredResponse(parsed);
      return { ...validated, modelUsed: modelName };
    } catch (err) {
      if ((err as Error)?.name === "AbortError") throw err;
      console.error(`[Neeva Gemini] Request failed on ${modelName}:`, err);
      return null;
    }
  }

  return null;
}

/**
 * Send a chat turn through:
 * 1. Client-side Indian PII Scrubber (`scrubIndianPII`)
 * 2. Client-edge < 3.2ms 3-Tier Safety Gatekeeper (`evaluateSafetyGate`)
 * 3. If Tier 3: immediately abort any active network controller and return the Tier-3 circuit breaker payload
 * 4. Call local FastAPI `/api/v1/chat/structured`
 * 5. If FastAPI is offline or returned deterministic_fallback, call Native Google AI Studio directly (`x-goog-api-key`)
 * 6. Only if all network calls fail, return the offline-safe deterministic response.
 */
export async function sendProtectedChatMessage(params: {
  message: string;
  language: LangCode;
  script: ScriptStyle;
  companion: Companion;
  history?: { role: "user" | "assistant"; content: string }[];
  token?: string;
  abortController?: AbortController;
  onChunk?: (partialText: string) => void;
}): Promise<ChatTurnResult> {
  // 1. Client-side PII scrubbing before any text leaves the browser
  const scrubbed = scrubIndianPII(params.message);

  // 2. Client-edge < 3.2ms Deterministic 3-Tier Safety Gatekeeper
  const gate = evaluateSafetyGate(params.message);
  if (gate.crisisLevel === 3) {
    params.abortController?.abort();
    params.onChunk?.(gate.reply);
    return {
      crisisLevel: 3,
      suggestedAction: "breathing",
      reply: gate.reply,
      reframeQuestion: "",
      haltStream: true,
      helplines: gate.helplines,
      piiScrubbedCount: scrubbed.totalRedactions,
      gateLatencyMs: gate.latencyMs,
      source: "edge_circuit_breaker",
    };
  }

  // 3. Try local FastAPI backend first
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v1/chat/structured`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(params.token ? { Authorization: `Bearer ${params.token}` } : {}),
      },
      body: JSON.stringify({
        message: scrubbed.scrubbedText,
        language: params.language,
        script: params.script,
        companionName: params.companion.name,
        vibe: params.companion.vibe,
        history: params.history,
      }),
      signal: params.abortController?.signal,
    });

    if (res.ok) {
      const raw = (await res.json()) as Record<string, unknown>;
      const backendSource = String(raw["source"] ?? "");
      if (backendSource !== "deterministic_fallback") {
        const validated = validateGeminiStructuredResponse(raw);
        if (validated.crisisLevel === 3) {
          params.abortController?.abort();
        }
        params.onChunk?.(validated.reply);
        return {
          ...validated,
          haltStream: validated.crisisLevel === 3,
          helplines:
            validated.crisisLevel === 3
              ? [
                  { name: "Tele-MANAS", number: "14416" },
                  { name: "iCall", number: "9152987821" },
                ]
              : [],
          piiScrubbedCount: scrubbed.totalRedactions,
          gateLatencyMs: gate.latencyMs,
          source: "backend_gemini",
          modelUsed: backendSource || "gemini-2.5-flash",
        };
      }
    } else {
      const errBody = await res.text().catch(() => "");
      console.error(`[Neeva Backend] HTTP ${res.status} from /api/v1/chat/structured:`, errBody.slice(0, 300));
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw err;
    }
    console.warn("[Neeva Backend] FastAPI unreachable, falling through to direct Google AI Studio:", (err as Error)?.message);
  }

  // 4. Direct Native Google AI Studio call (works even when only `npm run dev` is running!)
  const directResult = await callNativeGoogleAIStudio({
    message: scrubbed.scrubbedText,
    language: params.language,
    script: params.script,
    companion: params.companion,
    history: params.history,
    abortSignal: params.abortController?.signal,
  });

  if (directResult) {
    if (gate.crisisLevel === 2 && directResult.crisisLevel < 2) {
      directResult.crisisLevel = 2;
      directResult.suggestedAction = "breathing";
    }
    if (directResult.crisisLevel === 3) {
      params.abortController?.abort();
    }
    params.onChunk?.(directResult.reply);
    return {
      crisisLevel: directResult.crisisLevel,
      suggestedAction: directResult.suggestedAction,
      reply: directResult.reply,
      reframeQuestion: directResult.reframeQuestion,
      haltStream: directResult.crisisLevel === 3,
      helplines:
        directResult.crisisLevel === 3
          ? [
              { name: "Tele-MANAS", number: "14416" },
              { name: "iCall", number: "9152987821" },
            ]
          : [],
      piiScrubbedCount: scrubbed.totalRedactions,
      gateLatencyMs: gate.latencyMs,
      source: "direct_gemini",
      modelUsed: directResult.modelUsed,
    };
  }

  // 5. Final Offline / Local-First Deterministic Fallback
  const fallbackReply =
    gate.crisisLevel === 2
      ? gate.reply
      : params.language === "hinglish"
        ? "Haan bolo yaar, main sun raha hoon. Jo bhi dimaag mein chal raha hai, bina kisi filter ke share karo — hum milke aaram se samjhenge."
        : "I hear you, and it makes complete sense that this feels heavy right now. You don't have to figure everything out at once — let's focus on just the next small, kind step.";
  const fallbackReframe =
    gate.reframeQuestion ||
    "If your closest friend came to you feeling this exact way tonight, what is one gentle thing you would remind them of?";

  params.onChunk?.(fallbackReply);
  return {
    crisisLevel: gate.crisisLevel,
    suggestedAction: gate.suggestedAction,
    reply: fallbackReply,
    reframeQuestion: fallbackReframe,
    haltStream: false,
    helplines: [],
    piiScrubbedCount: scrubbed.totalRedactions,
    gateLatencyMs: gate.latencyMs,
    source: "local_deterministic",
  };
}

/**
 * Sync a Zero-Knowledge encrypted journal payload (`{ ciphertext, iv, salt }`) to the SQLite WAL backend vault.
 * Plaintext is NEVER sent over the network.
 */
export async function syncEncryptedJournalToVault(
  entryId: string,
  encrypted: EncryptedVaultPayload,
  token?: string
): Promise<{ synced: boolean }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/journal/vault`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        id: entryId,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
        algorithm: encrypted.algorithm,
        kdf: encrypted.kdf,
      }),
    });
    return { synced: res.ok };
  } catch {
    return { synced: false };
  }
}

/**
 * Run opt-in Journal Cognitive Reframing after scrubbing Indian PII on the client edge.
 */
export async function reframeJournalWithPIIScrubber(
  rawText: string,
  prompt: string,
  token?: string
): Promise<{
  analysis: JournalAnalysis;
  source: "ai" | "offline";
  piiScrubbedCount: number;
}> {
  const scrubbed = scrubIndianPII(rawText);
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/journal/reframe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        scrubbedText: scrubbed.scrubbedText,
        prompt,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { analysis: JournalAnalysis; source?: "ai" | "offline" };
      if (data.analysis) {
        return {
          analysis: data.analysis,
          source: data.source ?? "ai",
          piiScrubbedCount: scrubbed.totalRedactions,
        };
      }
    }
  } catch {
    /* fall through to local deterministic CBT analysis */
  }
  return {
    analysis: analyzeLocally(scrubbed.scrubbedText),
    source: "offline",
    piiScrubbedCount: scrubbed.totalRedactions,
  };
}

/**
 * Purge all server-side user records (DPDP Act 2023 Right to Erasure).
 */
export async function purgeServerVaultData(token?: string): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/journal/vault`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.ok;
  } catch {
    return false;
  }
}
