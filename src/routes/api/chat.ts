import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { therapistInstructions } from "@/lib/chat-prompt";

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
  language: z.enum(["en", "hi", "gu", "ta", "mr", "bn"]),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(6000) }))
    .min(1)
    .max(40),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Only signed-in members may use the companion (protects AI credits).
        const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
        if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { createClient } = await import("@supabase/supabase-js");
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const sb = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data: claims, error: authErr } = await sb.auth.getClaims(token);
        if (authErr || !claims?.claims?.sub) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        const { messages, language, companion } = parsed.data;
        const { streamResponse, GatewayError } = await import("@lovable.dev/ai-gateway");

        let stream;
        try {
          stream = await streamResponse(
            {
              model: "openai/gpt-6-astra",
              reasoning: { effort: "low" },
              instructions: therapistInstructions(language, companion),
              input: messages.map((m) =>
                m.role === "user"
                  ? { role: "user" as const, content: m.content }
                  : {
                      role: "assistant" as const,
                      content: [{ type: "output_text" as const, text: m.content }],
                    },
              ),
            },
            { signal: request.signal },
          );
        } catch (err) {
          console.error("chat start failed", err);
          const status =
            err instanceof GatewayError && err.httpStatus === 429
              ? 429
              : err instanceof GatewayError && err.httpStatus === 402
                ? 402
                : 502;
          return Response.json({ error: "Neeva couldn't respond just now." }, { status });
        }

        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const event of stream) {
                if (event.type === "response.output_text.delta")
                  controller.enqueue(encoder.encode(event.delta));
              }
            } catch (err) {
              console.error("chat stream failed", err);
              controller.enqueue(
                encoder.encode(
                  "\n\n_(The connection dropped for a moment. Please send that again.)_",
                ),
              );
            } finally {
              controller.close();
            }
          },
        });
        return new Response(body, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
