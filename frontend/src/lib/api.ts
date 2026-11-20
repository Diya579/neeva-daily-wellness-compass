/**
 * Central API Client (`src/lib/api.ts`)
 * Connects the Neeva Frontend to the Local FastAPI Safety Gatekeeper & SQLite WAL Zero-Knowledge Vault:
 * - Pre-flight Client-Side Indian PII Scrubber (`scrubIndianPII`)
 * - Pre-flight Client-Edge < 3.2ms Deterministic 3-Tier Safety Gate (`evaluateSafetyGate`)
 * - AbortController integration for instant Tier-3 stream circuit breaking
 * - Zero-Knowledge Ciphertext-Only Journal Vault sync (`POST /api/v1/journal/vault`)
 * - K-Anonymity (K >= 50) Campus Analytics (`GET /api/v1/campus/analytics`)
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

export function getApiBaseUrl(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.["VITE_API_BASE_URL"]) {
    return String(import.meta.env["VITE_API_BASE_URL"]).replace(/\/+$/, "");
  }
  return "http://localhost:8080";
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
  source: "edge_circuit_breaker" | "backend_gemini" | "local_deterministic";
}

/**
 * Send a chat turn through:
 * 1. Client-side Indian PII Scrubber (`scrubIndianPII`)
 * 2. Client-edge < 3.2ms 3-Tier Safety Gatekeeper (`evaluateSafetyGate`)
 * 3. If Tier 3: immediately abort any active network controller and return the Tier-3 circuit breaker payload
 * 4. Otherwise call `/api/v1/chat/structured` (or `/api/chat` stream) with graceful local fallback.
 */
export async function sendProtectedChatMessage(params: {
  message: string;
  language: LangCode;
  script: ScriptStyle;
  companion: Companion;
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
      }),
      signal: params.abortController?.signal,
    });

    if (res.ok) {
      const raw = (await res.json()) as Record<string, unknown>;
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
      };
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw err;
    }
  }

  // Offline / Local-First Deterministic Fallback so a distressed student never sees an error screen
  const fallbackReply =
    gate.crisisLevel === 2
      ? gate.reply
      : params.language === "hinglish"
        ? `Main sun raha hoon yaar. Jab dimaag pe itna load ho toh thoda rukna zaroori hai. Chalo isse ek chhote step mein todte hain.`
        : `I hear you, and it makes complete sense that this feels heavy right now. You don't have to figure everything out at once — let's focus on just the next small, kind step.`;
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

