import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Languages,
  Mic,
  MicOff,
  Phone,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Wind,
} from "lucide-react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompanionAvatar } from "@/components/neeva/CompanionAvatar";
import { CompanionSetup } from "@/components/neeva/CompanionSetup";
import { useCrisis } from "@/components/neeva/CrisisDialog";
import { BreathingCircle } from "@/components/neeva/hub/BreathingCircle";
import { supabase } from "@/integrations/supabase/client";
import { sendProtectedChatMessage } from "@/lib/api";
import { welcomeFor } from "@/lib/companion";
import {
  CHAT_SUGGESTIONS,
  LANGUAGES,
  SCRIPT_STYLES,
  langInfo,
  type LangCode,
  type ScriptStyle,
} from "@/lib/neeva-data";
import { uid, useNeeva, type ChatMessage } from "@/lib/neeva-store";
import { companionPatch, useProfile } from "@/lib/profile";
import {
  getSpeechLocaleForLanguage,
  speakWithBrowserTTS,
  startBrowserSpeechRecognition,
  stopBrowserTTS,
} from "@/lib/voice";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Neeva AI · An empathetic companion, any hour" },
      {
        name: "description",
        content:
          "Talk to Neeva AI — a warm, CBT- and ACT-informed companion that listens across 8 Indian languages.",
      },
      { property: "og:title", content: "Neeva AI · Empathetic support in your language" },
      {
        property: "og:description",
        content: "A calm, private space to talk things through, with evidence-based techniques.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

type Status = "ready" | "submitted" | "streaming" | "error";

const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

function Avatar() {
  const { companion } = useProfile();
  return <CompanionAvatar avatar={companion.avatar} className="size-9" />;
}

function ChatPage() {
  const { profile, companion, saveProfile, saving } = useProfile();
  if (!profile.companion_configured) {
    return (
      <div className="mx-auto max-w-2xl p-4 @3xl:p-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Before your first chat
        </p>
        <h2 className="mt-1 text-4xl font-extrabold tracking-tight">
          Build your <em className="font-display font-normal">companion.</em>
        </h2>
        <p className="mb-6 mt-2 text-sm text-muted-foreground">
          Name them, then choose how you want to be talked to. You can change this anytime in
          Settings.
        </p>
        <CompanionSetup
          initial={companion}
          saving={saving}
          onSave={(c) => saveProfile(companionPatch(c))}
        />
      </div>
    );
  }
  return <ChatRoom />;
}

function ChatRoom() {
  const { companion } = useProfile();
  const { openCrisis } = useCrisis();
  const { chat, language, script, update } = useNeeva();
  const [status, setStatus] = useState<Status>("ready");
  const [input, setInput] = useState("");
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [tier3BannerOpen, setTier3BannerOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [lastGateMs, setLastGateMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sttStopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      sttStopRef.current?.();
      stopBrowserTTS();
    };
  }, []);

  const setMessages = useCallback(
    (fn: (m: ChatMessage[]) => ChatMessage[]) => update((s) => ({ chat: fn(s.chat) })),
    [update]
  );

  const toggleVoiceInput = useCallback(() => {
    if (listening) {
      sttStopRef.current?.();
      sttStopRef.current = null;
      setListening(false);
      return;
    }
    const handle = startBrowserSpeechRecognition(language, {
      onTranscript: (transcript) => {
        setInput(transcript);
      },
      onError: (err) => {
        setListening(false);
        toast.error(`Voice input unavailable (${err})`, {
          description: `Locale: ${getSpeechLocaleForLanguage(language)} · Try Chrome or Edge for Web Speech API.`,
        });
      },
      onEnd: () => {
        setListening(false);
      },
    });
    if (handle) {
      sttStopRef.current = handle.stop;
      setListening(true);
      toast.info(`Listening in ${handle.locale}…`);
    }
  }, [language, listening]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || status === "submitted" || status === "streaming") return;

      const userMsg: ChatMessage = { id: uid(), role: "user", content, at: Date.now() };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setStatus("submitted");

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const assistantId = uid();

      try {
        const sessionData = await supabase.auth.getSession();
        const token = sessionData.data.session?.access_token ?? "";

        const result = await sendProtectedChatMessage({
          message: content,
          language,
          script,
          companion,
          history: chat.slice(-10).map(({ role, content: c }) => ({ role, content: c })),
          token,
          abortController: ctrl,
        });

        setLastGateMs(result.gateLatencyMs);

        if (result.piiScrubbedCount > 0) {
          toast.info(`Scrubbed ${result.piiScrubbedCount} Indian PII identifier(s) on device`);
        }

        const formattedReply = result.reframeQuestion
          ? `${result.reply}\n\n**Socratic Reframe:** _${result.reframeQuestion}_`
          : result.reply;

        setStatus("streaming");
        setMessages((m) => [
          ...m,
          { id: assistantId, role: "assistant", content: formattedReply, at: Date.now() },
        ]);

        // Tier-3 Hard Circuit Breaker: Open Crisis Modal & Show 1-Tap Helplines (14416 & 9152987821)
        if (result.crisisLevel === 3) {
          setTier3BannerOpen(true);
          openCrisis("detected");
        } else if (result.crisisLevel === 2 || result.suggestedAction === "breathing") {
          // Auto-Launch 4-7-8 Breathing Pacer Widget on Tier-2 or breathing action
          setBreathingOpen(true);
        }

        if (ttsEnabled) {
          speakWithBrowserTTS(result.reply, language);
        }

        setStatus("ready");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setStatus("ready");
          return;
        }
        setStatus("error");
        toast.error((err as Error).message || "Something went wrong.", {
          description: "Your message is saved — tap a suggestion or send again.",
        });
        setTimeout(() => setStatus("ready"), 1500);
      } finally {
        abortRef.current = null;
      }
    },
    [ language, script, setMessages, status, companion, openCrisis, ttsEnabled]
  );

  const onSubmit = (msg: PromptInputMessage) => void send(msg.text ?? input);
  const busy = status === "submitted" || status === "streaming";
  const suggestions = CHAT_SUGGESTIONS[language] ?? CHAT_SUGGESTIONS.en;

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col pb-[var(--nav-space)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 @3xl:px-8">
        <Avatar />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{companion.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-sage-deep" /> online · CBT & ACT
            informed
            {lastGateMs !== null && (
              <span className="ml-1 rounded-full bg-sage px-2 py-0.5 font-mono text-[10px] font-semibold text-sage-foreground">
                Gate {lastGateMs}ms
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setBreathingOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold hover:border-sage-deep"
          title="Launch 4-7-8 Breathing Pacer"
        >
          <Wind className="size-3.5 text-sage-deep" /> 4-7-8 Breath
        </button>

        <button
          type="button"
          onClick={() => {
            const next = !ttsEnabled;
            setTtsEnabled(next);
            if (!next) stopBrowserTTS();
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold hover:border-sage-deep"
          aria-label="Toggle voice read-aloud"
          title={`Browser TTS (${getSpeechLocaleForLanguage(language)})`}
        >
          {ttsEnabled ? (
            <Volume2 className="size-3.5 text-sage-deep" />
          ) : (
            <VolumeX className="size-3.5 text-muted-foreground" />
          )}
          <span className="hidden sm:inline">{getSpeechLocaleForLanguage(language)}</span>
        </button>

        <Select value={language} onValueChange={(v) => update(() => ({ language: v as LangCode }))}>
          <SelectTrigger
            className="h-9 w-auto gap-2 rounded-full border-border bg-card text-xs font-semibold"
            aria-label="Language"
          >
            <Languages className="size-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code} className="rounded-xl">
                {l.native}{" "}
                {l.code !== "en" && <span className="text-muted-foreground">· {l.label}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {language !== "en" && (
          <Select value={script} onValueChange={(v) => update(() => ({ script: v as ScriptStyle }))}>
            <SelectTrigger
              className="h-9 w-auto gap-2 rounded-full border-border bg-card text-xs font-semibold"
              aria-label="Typing style"
            >
              <span className="font-mono text-[11px] font-bold">
                Aa/{langInfo(language).native.slice(0, 1)}
              </span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              {SCRIPT_STYLES.map((st) => (
                <SelectItem key={st.key} value={st.key} className="rounded-xl">
                  {st.key === "roman"
                    ? langInfo(language).mix
                    : st.key === "native"
                      ? `${langInfo(language).native} script`
                      : st.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Link
          to="/settings"
          aria-label="Customise companion"
          className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-muted hover:text-foreground"
        >
          <Settings2 className="size-4" />
        </Link>
        {chat.length > 0 && (
          <button
            onClick={() => setMessages(() => [])}
            className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-muted hover:text-foreground"
            aria-label="Clear conversation"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      {tier3BannerOpen && (
        <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[1.5px] border-crisis bg-crisis-soft p-3.5 @3xl:mx-8">
          <div className="text-xs">
            <p className="font-bold text-crisis">
              Tier-3 Safety Circuit Breaker Active · You are not alone
            </p>
            <p className="text-muted-foreground">
              Free, confidential 24×7 support in 20 Indian languages:
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="tel:14416"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-crisis px-4 text-xs font-bold text-crisis-foreground"
            >
              <Phone className="size-3.5" /> Tele-MANAS · 14416
            </a>
            <a
              href="tel:9152987821"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-crisis bg-background px-4 text-xs font-bold text-crisis"
            >
              <Phone className="size-3.5" /> iCall · 9152987821
            </a>
          </div>
        </div>
      )}

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-6 px-4 py-6 @3xl:px-8">
          <Message from="assistant">
            <div className="flex gap-3">
              <Avatar />
              <div className="min-w-0">
                <MessageContent className="text-[15px] leading-relaxed">
                  <MessageResponse>{welcomeFor(language, companion.name, script)}</MessageResponse>
                </MessageContent>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {companion.name} · just now
                </p>
              </div>
            </div>
          </Message>

          {chat.map((m) =>
            m.role === "user" ? (
              <Message key={m.id} from="user">
                <MessageContent className="rounded-3xl rounded-br-lg border-[1.5px] border-ink bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-foreground group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground group-[.is-user]:rounded-3xl group-[.is-user]:rounded-br-lg">
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
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {companion.name} · {timeOf(m.at)}
                      </span>
                      <button
                        type="button"
                        onClick={() => speakWithBrowserTTS(m.content, language)}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-muted"
                        title="Read aloud via Browser Web Speech API"
                      >
                        <Volume2 className="size-3" /> Listen
                      </button>
                    </div>
                  </div>
                </div>
              </Message>
            )
          )}

          {status === "submitted" && (
            <Message from="assistant">
              <div className="flex items-center gap-3">
                <Avatar />
                <Shimmer className="text-sm">{`${companion.name} is typing…`}</Shimmer>
              </div>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="space-y-3 px-4 pb-4 @3xl:px-8">
        <Suggestions>
          {suggestions.map((s) => (
            <Suggestion
              key={s}
              suggestion={s}
              onClick={(x) => void send(x)}
              disabled={busy}
              className="border-border bg-card text-xs font-medium hover:border-sage-deep hover:bg-sage/50"
            />
          ))}
        </Suggestions>
        <PromptInput
          onSubmit={onSubmit}
          className="rounded-3xl bg-card shadow-soft [&_[data-slot=input-group]]:rounded-3xl"
        >
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder={`Type or speak in ${langInfo(language).label} (${getSpeechLocaleForLanguage(language)}) — "${langInfo(language === "en" ? "hi" : language).example}"`}
            className="min-h-14 text-[15px]"
          />
          <PromptInputFooter>
            <PromptInputTools>
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all ${
                  listening
                    ? "animate-pulse bg-crisis text-crisis-foreground"
                    : "bg-muted text-foreground hover:bg-sage"
                }`}
                title={`Web Speech STT (${getSpeechLocaleForLanguage(language)})`}
              >
                {listening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                <span>{listening ? "Stop Mic" : `Voice (${getSpeechLocaleForLanguage(language)})`}</span>
              </button>
              <span className="flex items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-sage-deep" /> Client PII Scrubbed · &lt;3.2ms
                Safety Gate
              </span>
            </PromptInputTools>
            <PromptInputSubmit
              status={status}
              onStop={() => abortRef.current?.abort()}
              disabled={!busy && !input.trim()}
              className="rounded-full"
            />
          </PromptInputFooter>
        </PromptInput>
      </div>

      {/* Auto-Launched 4-7-8 Breathing Pacer Modal (Triggered on Tier-2 Distress or suggestedAction === "breathing") */}
      <Dialog open={breathingOpen} onOpenChange={setBreathingOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sage px-3 py-1 font-mono text-[10px] font-bold uppercase text-sage-foreground">
              <Sparkles className="size-3" /> Auto-launched grounding micro-tool
            </span>
            <DialogTitle className="mt-1 font-display text-3xl">4-7-8 Calming Breath</DialogTitle>
            <DialogDescription className="text-xs">
              Inhale 4s · Hold 7s · Exhale 8s. Slows down an overwhelmed nervous system in under 60
              seconds.
            </DialogDescription>
          </DialogHeader>
          <BreathingCircle />
        </DialogContent>
      </Dialog>
    </div>
  );
}
