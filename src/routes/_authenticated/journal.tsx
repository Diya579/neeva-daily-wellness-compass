import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookHeart,
  Feather,
  Lightbulb,
  Loader2,
  Quote,
  RefreshCw,
  ScanHeart,
  Sprout,
  Tags,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Panel, PanelTitle } from "@/components/neeva/Card";
import { IconBadge } from "@/components/neeva/IconBadge";
import { JOURNAL_PROMPTS } from "@/lib/neeva-data";
import { analyzeJournal } from "@/lib/journal.functions";
import type { JournalAnalysis } from "@/lib/journal-types";
import { uid, useNeeva, type JournalEntry } from "@/lib/neeva-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Reflective Journal · Neeva" },
      {
        name: "description",
        content:
          "Guided journaling prompts with gentle AI insights on emotional tone, themes and cognitive reframes.",
      },
      { property: "og:title", content: "Reflective Journal · Neeva" },
      {
        property: "og:description",
        content:
          "Write freely, then let Neeva reflect your entry back with compassion and CBT-based reframes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JournalPage,
});

const EMO_TONES = [
  "bg-sage-deep",
  "bg-terracotta",
  "bg-lilac-foreground/60",
  "bg-periwinkle",
  "bg-rose-foreground/50",
];

function AnalysisView({ a, offline }: { a: JournalAnalysis; offline?: boolean }) {
  const pct = (a.valence + 100) / 2;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-sage via-sand to-lilac p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage-foreground">
          Emotional tone
        </p>
        <p className="mt-1 font-display text-4xl">{a.primaryTone}</p>
        <p className="mt-2 text-sm leading-relaxed">{a.summary}</p>
        <div className="mt-4">
          <div className="relative h-2 rounded-full bg-gradient-to-r from-terracotta via-periwinkle to-sage-deep">
            <span
              className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-soft transition-all duration-700"
              style={{ left: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-medium text-muted-foreground">
            <span>Heavy</span>
            <span>Balanced</span>
            <span>Uplifted</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ScanHeart className="size-4 text-sage-deep" /> Emotions detected
          </p>
          <div className="space-y-2">
            {a.emotions.map((e, i) => (
              <div key={e.name} className="text-xs">
                <div className="mb-1 flex justify-between font-medium">
                  <span>{e.name}</span>
                  <span className="tabular-nums text-muted-foreground">{e.intensity}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", EMO_TONES[i % EMO_TONES.length])}
                    style={{ width: `${e.intensity}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Tags className="size-4 text-terracotta" /> Key themes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {a.themes.map((t) => (
              <span
                key={t}
                className="rounded-full bg-rose px-3 py-1 text-xs font-medium text-rose-foreground"
              >
                {t}
              </span>
            ))}
          </div>
          {a.strengths.length > 0 && (
            <>
              <p className="mb-2 mt-4 flex items-center gap-2 text-sm font-semibold">
                <Sprout className="size-4 text-sage-deep" /> Strengths you showed
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {a.strengths.map((s) => (
                  <li key={s}>• {s}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {a.distortions.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Quote className="size-4 text-lilac-foreground" /> Thinking patterns to notice
          </p>
          <div className="space-y-2">
            {a.distortions.map((d, i) => (
              <div key={i} className="rounded-2xl border border-border p-3 text-xs">
                <p className="font-semibold">{d.name}</p>
                <p className="mt-1 italic text-muted-foreground">“{d.quote}”</p>
                <p className="mt-1">{d.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <RefreshCw className="size-4 text-sage-deep" /> Cognitive reframes
        </p>
        <div className="space-y-2">
          {a.reframes.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-2xl bg-muted/60 p-3 text-xs sm:grid-cols-2">
              <p>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Original
                </span>
                {r.original}
              </p>
              <p>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-sage-foreground">
                  Balanced view
                </span>
                <b className="font-semibold">{r.reframe}</b>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 rounded-2xl bg-primary p-4 text-primary-foreground">
        <Lightbulb className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
            One small next step
          </p>
          <p className="text-sm">{a.nextStep}</p>
        </div>
      </div>
      {offline && (
        <p className="text-center text-[11px] text-muted-foreground">
          Offline reflection — Neeva's full AI analysis was unavailable, so a lighter on-device read
          was used.
        </p>
      )}
    </div>
  );
}

function JournalPage() {
  const { journal, update, addPoints, hydrated } = useNeeva();
  const [prompt, setPrompt] = useState<string>(JOURNAL_PROMPTS[0]!);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<{ entry: JournalEntry; offline: boolean } | null>(null);
  const analyze = useServerFn(analyzeJournal);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const run = async () => {
    if (text.trim().length < 10) {
      toast("Write a little more first", {
        description: "A few sentences help Neeva reflect your entry back meaningfully.",
      });
      return;
    }
    setLoading(true);
    try {
      const { analysis, source } = await analyze({ data: { text, prompt } });
      const entry: JournalEntry = {
        id: uid(),
        prompt,
        text,
        at: new Date().toISOString(),
        analysis,
      };
      update((s) => ({ journal: [entry, ...s.journal].slice(0, 30) }));
      addPoints(15);
      setOpen({ entry, offline: source === "offline" });
      setText("");
    } catch {
      toast.error("Couldn't analyse this entry right now", {
        description: "Your writing is still here — please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 @3xl:p-8">
      <div className="animate-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Reflective journal
        </p>
        <h2 className="mt-1 font-display text-4xl @3xl:text-5xl">
          Write it down. <em className="text-sage-deep">Let it breathe.</em>
        </h2>
      </div>

      <div className="grid gap-5 @4xl:grid-cols-3">
        <Panel className="@4xl:col-span-2">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Choose a prompt</p>
          <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {JOURNAL_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => setPrompt(p)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-300",
                  prompt === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-sage-deep",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="rounded-3xl bg-sand/70 p-5">
            <p className="flex items-center gap-2 font-display text-2xl">
              <Feather className="size-5 text-terracotta" /> {prompt}
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Start anywhere. No one else will read this…"
              className="mt-3 min-h-64 w-full resize-none bg-transparent text-[15px] leading-8 outline-none placeholder:text-muted-foreground/70"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 31px, var(--border) 31px, var(--border) 32px)",
                backgroundAttachment: "local",
              }}
              maxLength={8000}
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">{words} words</span>
            <button
              onClick={run}
              disabled={loading}
              className="ml-auto inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-soft transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ScanHeart className="size-4" />
              )}
              {loading ? "Reflecting on your words…" : "Analyze entry"}
            </button>
          </div>
        </Panel>

        <Panel>
          <PanelTitle eyebrow="Your entries" title="Past reflections" />
          {hydrated && journal.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <IconBadge icon={BookHeart} tone="rose" size="lg" />
              <p className="text-sm text-muted-foreground">
                Your first entry will live here, along with Neeva's reflection.
              </p>
            </div>
          )}
          <div className="space-y-2">
            {journal.map((j) => (
              <button
                key={j.id}
                onClick={() => setOpen({ entry: j, offline: false })}
                className="w-full rounded-2xl border border-border/70 p-3 text-left transition-all duration-300 hover:border-sage-deep hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    {j.analysis?.primaryTone ?? "Entry"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(j.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{j.text}</p>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl">Neeva's reflection</DialogTitle>
            <DialogDescription className="text-xs">{open?.entry.prompt}</DialogDescription>
          </DialogHeader>
          {open?.entry.analysis && <AnalysisView a={open.entry.analysis} offline={open.offline} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
