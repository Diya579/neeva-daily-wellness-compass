import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudRain,
  MessageSquareQuote,
  Scale,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { DISTORTIONS } from "@/lib/neeva-data";
import { uid, useNeeva } from "@/lib/neeva-store";
import { cn } from "@/lib/utils";
import { IconBadge, type Tone } from "../IconBadge";

const STEPS: { title: string; icon: typeof Sun; tone: Tone; help: string }[] = [
  {
    title: "Situation",
    icon: CloudRain,
    tone: "periwinkle",
    help: "What happened? Just the facts — where, when, who.",
  },
  {
    title: "Automatic thought",
    icon: MessageSquareQuote,
    tone: "rose",
    help: "What went through your mind? How did it make you feel?",
  },
  {
    title: "Challenge",
    icon: Scale,
    tone: "lilac",
    help: "Look for evidence and thinking traps, like a kind detective.",
  },
  {
    title: "Realistic thought",
    icon: Sun,
    tone: "sage",
    help: "What's a more balanced way to see this?",
  },
];

const EMOTIONS = ["Anxious", "Sad", "Angry", "Ashamed", "Guilty", "Hopeless", "Frustrated"];

const field =
  "w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none transition-all duration-300 focus:border-sage-deep focus:ring-4 focus:ring-sage/50";

export function ThoughtRecord() {
  const { thoughts, update, addPoints } = useNeeva();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    situation: "",
    thought: "",
    emotion: "Anxious",
    before: 70,
    distortions: [] as string[],
    evidenceFor: "",
    evidenceAgainst: "",
    realistic: "",
    after: 40,
  });
  const [done, setDone] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const canNext = [
    f.situation.trim(),
    f.thought.trim(),
    f.evidenceAgainst.trim() || f.distortions.length,
    f.realistic.trim(),
  ][step];

  const save = () => {
    update((s) => ({
      thoughts: [
        {
          id: uid(),
          situation: f.situation,
          thought: f.thought,
          emotion: f.emotion,
          before: f.before,
          distortions: f.distortions,
          challenge: `${f.evidenceFor}\n${f.evidenceAgainst}`.trim(),
          realistic: f.realistic,
          after: f.after,
          at: new Date().toISOString(),
        },
        ...s.thoughts,
      ].slice(0, 20),
    }));
    addPoints(15);
    toast.success("Thought record saved", {
      description: "+15 wellness points. That took courage.",
    });
    setDone(true);
  };

  const restart = () => {
    setF({
      situation: "",
      thought: "",
      emotion: "Anxious",
      before: 70,
      distortions: [],
      evidenceFor: "",
      evidenceAgainst: "",
      realistic: "",
      after: 40,
    });
    setStep(0);
    setDone(false);
  };

  if (done) {
    const drop = f.before - f.after;
    return (
      <div className="animate-rise space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-12 text-sage-deep" />
        <p className="font-display text-3xl">You reframed it.</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Your “{f.emotion.toLowerCase()}” feeling went from{" "}
          <b className="text-foreground">{f.before}%</b> to{" "}
          <b className="text-foreground">{f.after}%</b>
          {drop > 0 ? ` — a ${drop}% shift.` : "."} Thoughts aren't facts, and you just proved it.
        </p>
        <div className="mx-auto grid max-w-lg gap-2 text-left text-sm @xl:grid-cols-2">
          <div className="rounded-2xl bg-rose/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-foreground">
              Before
            </p>
            {f.thought}
          </div>
          <div className="rounded-2xl bg-sage/70 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sage-foreground">
              After
            </p>
            {f.realistic}
          </div>
        </div>
        <button
          onClick={restart}
          className="rounded-full border border-border px-5 py-2 text-sm font-semibold transition-all duration-300 hover:bg-muted"
        >
          New thought record
        </button>
        {thoughts.length > 1 && (
          <p className="text-xs text-muted-foreground">
            You've completed {thoughts.length} thought records.
          </p>
        )}
      </div>
    );
  }

  const S = STEPS[step]!;
  return (
    <div>
      <div className="mb-5 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <button key={s.title} onClick={() => i < step && setStep(i)} className="text-left">
            <span
              className={cn(
                "block h-1.5 rounded-full transition-all duration-500",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "mt-1.5 block truncate text-[11px] font-semibold",
                i === step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.title}
            </span>
          </button>
        ))}
      </div>

      <div key={step} className="animate-rise space-y-4">
        <div className="flex items-center gap-3">
          <IconBadge icon={S.icon} tone={S.tone} />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Step {step + 1} of 4</p>
            <p className="font-semibold">{S.help}</p>
          </div>
        </div>

        {step === 0 && (
          <textarea
            className={cn(field, "min-h-28")}
            value={f.situation}
            onChange={(e) => set("situation", e.target.value)}
            placeholder="e.g. My team lead reviewed my report in the meeting and pointed out three errors."
          />
        )}

        {step === 1 && (
          <>
            <textarea
              className={cn(field, "min-h-24")}
              value={f.thought}
              onChange={(e) => set("thought", e.target.value)}
              placeholder="e.g. Everyone now thinks I'm incompetent. I'll never get promoted."
            />
            <div className="flex flex-wrap gap-1.5">
              {EMOTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => set("emotion", e)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all duration-300",
                    f.emotion === e
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-sage-deep",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-muted-foreground">
                  How intense is “{f.emotion.toLowerCase()}”?
                </span>
                <b className="tabular-nums">{f.before}%</b>
              </div>
              <Slider
                value={[f.before]}
                max={100}
                step={5}
                onValueChange={([v]) => set("before", v ?? 70)}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Any thinking traps here?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DISTORTIONS.map((d) => {
                  const on = f.distortions.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      title={d.hint}
                      onClick={() =>
                        set(
                          "distortions",
                          on ? f.distortions.filter((x) => x !== d.key) : [...f.distortions, d.key],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-all duration-300",
                        on
                          ? "border-lilac-foreground/40 bg-lilac text-lilac-foreground"
                          : "border-border hover:border-sage-deep",
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 @xl:grid-cols-2">
              <textarea
                className={cn(field, "min-h-24")}
                value={f.evidenceFor}
                onChange={(e) => set("evidenceFor", e.target.value)}
                placeholder="Evidence that supports the thought…"
              />
              <textarea
                className={cn(field, "min-h-24")}
                value={f.evidenceAgainst}
                onChange={(e) => set("evidenceAgainst", e.target.value)}
                placeholder="Evidence against it… (e.g. Last quarter my work was praised.)"
              />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <textarea
              className={cn(field, "min-h-24")}
              value={f.realistic}
              onChange={(e) => set("realistic", e.target.value)}
              placeholder="e.g. I made a few mistakes in one report. That's feedback, not a verdict on my career."
            />
            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Re-rate “{f.emotion.toLowerCase()}” now
                </span>
                <b className="tabular-nums">{f.after}%</b>
              </div>
              <Slider
                value={[f.after]}
                max={100}
                step={5}
                onValueChange={([v]) => set("after", v ?? 40)}
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-all duration-300 hover:bg-muted disabled:opacity-0"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        <button
          onClick={() => (step === 3 ? save() : setStep((s) => s + 1))}
          disabled={!canNext}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:gap-3 disabled:opacity-40"
        >
          {step === 3 ? "Complete record" : "Next"} <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
