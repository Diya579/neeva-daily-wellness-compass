import { generateResponse } from "@lovable.dev/ai-gateway";
import { JOURNAL_ANALYSIS_SCHEMA, type JournalAnalysis } from "./journal-types";

export const CHAT_MODEL = "openai/gpt-6-astra" as const;

export async function analyzeWithAI(text: string, prompt: string): Promise<JournalAnalysis> {
  const res = await generateResponse({
    model: CHAT_MODEL,
    reasoning: { effort: "low" },
    instructions:
      "You are Neeva's reflective-journal analyst. Read the user's journal entry with warmth and clinical care. Detect emotional tone, themes and cognitive distortions using CBT concepts, and offer gentle, realistic reframes. Write in the same language as the entry. Never diagnose.",
    input: [{ role: "user", content: `Journal prompt: ${prompt}\n\nEntry:\n${text}` }],
    text: {
      format: {
        type: "json_schema",
        name: "journal_analysis",
        strict: true,
        schema: JOURNAL_ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
      },
    },
  });
  let out = "";
  for (const item of res.output ?? []) {
    if (item.type === "message") {
      for (const c of item.content) if (c.type === "output_text") out += c.text;
    }
  }
  return JSON.parse(out) as JournalAnalysis;
}
