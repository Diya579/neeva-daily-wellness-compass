import { getApiBaseUrl } from "./api";
import { analyzeLocally } from "./journal-local";
import type { JournalAnalysis } from "./journal-types";
import { scrubIndianPII } from "./piiScrubber";

export const CHAT_MODEL = "gemini-2.5-flash" as const;

export async function analyzeWithAI(text: string, prompt: string): Promise<JournalAnalysis> {
  const scrubbed = scrubIndianPII(text);
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
    /* fall back to deterministic local CBT reflection */
  }
  return analyzeLocally(scrubbed.scrubbedText);
}
