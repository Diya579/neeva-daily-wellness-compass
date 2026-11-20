import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getApiBaseUrl } from "@/lib/api";
import { LANG_CODES } from "@/lib/neeva-data";
import { scrubIndianPII } from "@/lib/piiScrubber";
import { evaluateSafetyGate } from "@/lib/safetyGate";

const Body = z.object({
  companion: z.object({
    name: z.string().min(1).max(40),
    vibe: z.enum(["bestie", "coach", "sage", "hype"]),
    length: z.enum(["short", "balanced", "deep"]),
    avatar: z.enum(["bloom", "moon", "wave", "spark"]),
    emoji: z.boolean(),
    approach: z.enum(["validate", "advise", "mix", "explore"]).default("mix"),
    tone: z.enum(["gentle", "honest", "playful"]).default("gentle"),
    notes: z.string().max(400).default(""),
  }),
  language: z.enum(LANG_CODES),
  script: z.enum(["auto", "roman", "native"]).default("auto"),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(6000) }))
    .min(1)
    .max(40),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

        const { messages, language, companion, script } = parsed.data;
        const latestUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

        // 1. Pre-flight < 3.2ms Deterministic 3-Tier Safety Gatekeeper
        const gate = evaluateSafetyGate(latestUserMsg);
        if (gate.crisisLevel === 3) {
          return new Response(gate.reply, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Neeva-Crisis-Level": "3",
              "X-Neeva-Suggested-Action": "breathing",
            },
          });
        }

        // 2. Scrub Indian PII before forwarding to the local FastAPI backend
        const scrubbed = scrubIndianPII(latestUserMsg);
        try {
          const backendRes = await fetch(`${getApiBaseUrl()}/api/v1/chat/structured`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: scrubbed.scrubbedText,
              language,
              script,
              companionName: companion.name,
              vibe: companion.vibe,
            }),
            signal: request.signal,
          });
          if (backendRes.ok) {
            const data = (await backendRes.json()) as {
              crisisLevel: number;
              suggestedAction: string;
              reply: string;
              reframeQuestion: string;
            };
            const fullText = data.reframeQuestion
              ? `${data.reply}\n\n_${data.reframeQuestion}_`
              : data.reply;
            return new Response(fullText, {
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-store",
                "X-Neeva-Crisis-Level": String(data.crisisLevel),
                "X-Neeva-Suggested-Action": data.suggestedAction,
              },
            });
          }
        } catch {
          /* fall back to local deterministic response */
        }

        const fallbackText =
          gate.reply ||
          "I hear you, and it makes complete sense that this feels heavy right now. Let's take one slow breath and focus on just the next small step within your control.";
        return new Response(fallbackText, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Neeva-Crisis-Level": String(gate.crisisLevel),
            "X-Neeva-Suggested-Action": gate.suggestedAction,
          },
        });
      },
    },
  },
});
