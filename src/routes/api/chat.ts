import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { therapistInstructions } from "@/lib/chat-prompt";

const Body = z.object({
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
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        const { messages, language } = parsed.data;
        const { streamResponse, GatewayError } = await import("@lovable.dev/ai-gateway");

        let stream;
        try {
          stream = await streamResponse(
            {
              model: "openai/gpt-6-astra",
              reasoning: { effort: "low" },
              instructions: therapistInstructions(language),
              input: messages.map((m) =>
                m.role === "user"
                  ? { role: "user" as const, content: m.content }
                  : { role: "assistant" as const, content: [{ type: "output_text" as const, text: m.content }] },
              ),
            },
            { signal: request.signal },
          );
        } catch (err) {
          console.error("chat start failed", err);
          const status = err instanceof GatewayError && err.httpStatus === 429 ? 429 : err instanceof GatewayError && err.httpStatus === 402 ? 402 : 502;
          return Response.json({ error: "Neeva couldn't respond just now." }, { status });
        }

        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const event of stream) {
                if (event.type === "response.output_text.delta") controller.enqueue(encoder.encode(event.delta));
              }
            } catch (err) {
              console.error("chat stream failed", err);
              controller.enqueue(encoder.encode("\n\n_(The connection dropped for a moment. Please send that again.)_"));
            } finally {
              controller.close();
            }
          },
        });
        return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
      },
    },
  },
});
