import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { Languages, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools, type PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHAT_SUGGESTIONS, CHAT_WELCOME, LANGUAGES, type LangCode } from "@/lib/neeva-data";
import { uid, useNeeva, type ChatMessage } from "@/lib/neeva-store";
import mark from "@/assets/neeva-mark.png";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Neeva AI · An empathetic companion, any hour" },
      { name: "description", content: "Talk to Neeva AI — a warm, CBT- and ACT-informed companion that listens in English, Hindi, Gujarati, Tamil, Marathi and Bengali." },
      { property: "og:title", content: "Neeva AI · Empathetic support in your language" },
      { property: "og:description", content: "A calm, private space to talk things through, with evidence-based techniques." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

type Status = "ready" | "submitted" | "streaming" | "error";

const timeOf = (at: number) => new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

function Avatar() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sage ring-4 ring-sage/40">
      <img src={mark} alt="" className="size-6" width={816} height={816} />
    </span>
  );
}

function ChatPage() {
  const { chat, language, update } = useNeeva();
  const [status, setStatus] = useState<Status>("ready");
  const [input, setInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const setMessages = useCallback((fn: (m: ChatMessage[]) => ChatMessage[]) => update((s) => ({ chat: fn(s.chat) })), [update]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || status === "submitted" || status === "streaming") return;
      const userMsg: ChatMessage = { id: uid(), role: "user", content, at: Date.now() };
      const history = [...chat, userMsg].slice(-30);
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setStatus("submitted");
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const assistantId = uid();
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language, messages: history.map(({ role, content }) => ({ role, content })) }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(res.status === 429 ? "Neeva is with a lot of people right now — please try again in a minute." : res.status === 402 ? "AI credits have run out for this workspace." : "Neeva couldn't respond just now.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        let started = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          if (!started) {
            started = true;
            setStatus("streaming");
            setMessages((m) => [...m, { id: assistantId, role: "assistant", content: acc, at: Date.now() }]);
          } else {
            const snapshot = acc;
            setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: snapshot } : x)));
          }
        }
        setStatus("ready");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setStatus("ready");
          return;
        }
        setStatus("error");
        toast.error((err as Error).message || "Something went wrong.", { description: "Your message is saved — tap a suggestion or send again." });
        setTimeout(() => setStatus("ready"), 1500);
      } finally {
        abortRef.current = null;
      }
    },
    [chat, language, setMessages, status],
  );

  const onSubmit = (msg: PromptInputMessage) => void send(msg.text ?? input);
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 @3xl:px-8">
        <Avatar />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Neeva AI</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-sage-deep" /> Here for you · CBT & ACT informed
          </p>
        </div>
        <Select value={language} onValueChange={(v) => update(() => ({ language: v as LangCode }))}>
          <SelectTrigger className="h-9 w-auto gap-2 rounded-full border-border bg-card text-xs font-semibold" aria-label="Language">
            <Languages className="size-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code} className="rounded-xl">
                {l.native} {l.code !== "en" && <span className="text-muted-foreground">· {l.label}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {chat.length > 0 && (
          <button onClick={() => setMessages(() => [])} className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-muted hover:text-foreground" aria-label="Clear conversation">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-6 px-4 py-6 @3xl:px-8">
          <Message from="assistant">
            <div className="flex gap-3">
              <Avatar />
              <div className="min-w-0">
                <MessageContent className="text-[15px] leading-relaxed">
                  <MessageResponse>{CHAT_WELCOME[language]}</MessageResponse>
                </MessageContent>
                <p className="mt-1.5 text-[11px] text-muted-foreground">Neeva · just now</p>
              </div>
            </div>
          </Message>

          {chat.map((m) =>
            m.role === "user" ? (
              <Message key={m.id} from="user">
                <MessageContent className="rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-foreground group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground group-[.is-user]:rounded-3xl group-[.is-user]:rounded-br-lg">
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </MessageContent>
                <p className="text-right text-[11px] text-muted-foreground">You · {timeOf(m.at)}</p>
              </Message>
            ) : (
              <Message key={m.id} from="assistant">
                <div className="flex gap-3">
                  <Avatar />
                  <div className="min-w-0">
                    <MessageContent className="text-[15px] leading-relaxed">
                      <MessageResponse>{m.content}</MessageResponse>
                    </MessageContent>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">Neeva · {timeOf(m.at)}</p>
                  </div>
                </div>
              </Message>
            ),
          )}

          {status === "submitted" && (
            <Message from="assistant">
              <div className="flex items-center gap-3">
                <Avatar />
                <Shimmer className="text-sm">Neeva is listening and reflecting…</Shimmer>
              </div>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="space-y-3 px-4 pb-4 @3xl:px-8">
        <Suggestions>
          {CHAT_SUGGESTIONS.map((s) => (
            <Suggestion key={s} suggestion={s} onClick={(x) => void send(x)} disabled={busy} className="border-border bg-card text-xs font-medium hover:border-sage-deep hover:bg-sage/50" />
          ))}
        </Suggestions>
        <PromptInput onSubmit={onSubmit} className="rounded-3xl bg-card shadow-soft [&_[data-slot=input-group]]:rounded-3xl">
          <PromptInputTextarea value={input} onChange={(e) => setInput(e.currentTarget.value)} placeholder="Share what's on your mind… there's no wrong thing to say." className="min-h-14 text-[15px]" />
          <PromptInputFooter>
            <PromptInputTools>
              <span className="flex items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-sage-deep" /> Private · Not a substitute for emergency care
              </span>
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={() => abortRef.current?.abort()} disabled={!busy && !input.trim()} className="rounded-full" />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
