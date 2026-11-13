import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analyzeLocally } from "./journal-local";
import type { JournalAnalysis } from "./journal-types";

const Input = z.object({
  text: z.string().trim().min(10).max(8000),
  prompt: z.string().max(300),
});

export const analyzeJournal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ analysis: JournalAnalysis; source: "ai" | "offline" }> => {
    try {
      const { analyzeWithAI } = await import("./ai.server");
      const analysis = await analyzeWithAI(data.text, data.prompt);
      return { analysis, source: "ai" };
    } catch (err) {
      console.error("journal analysis failed", err);
      return { analysis: analyzeLocally(data.text), source: "offline" };
    }
  });
