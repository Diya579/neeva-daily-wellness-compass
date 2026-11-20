import { getApiBaseUrl, getGeminiApiKey, isValidGeminiApiKey } from "./api";
import { analyzeLocally } from "./journal-local";
import { JOURNAL_ANALYSIS_SCHEMA, type JournalAnalysis } from "./journal-types";
import { scrubIndianPII } from "./piiScrubber";

export const CHAT_MODEL = "gemini-3.1-flash-lite" as const;
const GOOGLE_AI_STUDIO_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
] as const;

export async function analyzeWithAI(text: string, prompt: string): Promise<JournalAnalysis> {
  const scrubbed = scrubIndianPII(text);

  // 1. Try local FastAPI backend first
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/journal/reframe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scrubbedText: scrubbed.scrubbedText, prompt }),
    });
    if (res.ok) {
      const data = (await res.json()) as { analysis?: JournalAnalysis };
      if (data.analysis) return data.analysis;
    }
  } catch {
    /* fall through to direct native Google AI Studio */
  }

  // 2. Direct native Google AI Studio call with `x-goog-api-key` (supports AQ.* and AIza* keys)
  const apiKey = getGeminiApiKey();
  if (isValidGeminiApiKey(apiKey)) {
    const body = JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "You are Neeva's reflective-journal analyst. Read the user's journal entry with warmth and clinical care. Mirror Hinglish if they wrote in Hinglish. Never diagnose.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `Journal prompt: ${prompt}\n\nEntry:\n${scrubbed.scrubbedText}` }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: JOURNAL_ANALYSIS_SCHEMA,
        temperature: 0.4,
      },
    });

    for (const model of CANDIDATE_MODELS) {
      try {
        const res = await fetch(`${GOOGLE_AI_STUDIO_BASE}/${model}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body,
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          console.error(`[Neeva Journal Gemini] HTTP ${res.status} on ${model}:`, errBody.slice(0, 300));
          if (res.status === 404 || res.status === 503) continue;
          break;
        }
        const data = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const rawText = (data.candidates?.[0]?.content?.parts ?? [])
          .map((p) => p.text ?? "")
          .join("")
          .trim();
        if (rawText) return JSON.parse(rawText) as JournalAnalysis;
      } catch (err) {
        console.error(`[Neeva Journal Gemini] Error on ${model}:`, err);
        break;
      }
    }
  }

  return analyzeLocally(scrubbed.scrubbedText);
}
