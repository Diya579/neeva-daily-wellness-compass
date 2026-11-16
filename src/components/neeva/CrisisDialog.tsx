import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Ear,
  Eye,
  Hand,
  HeartHandshake,
  LifeBuoy,
  MessageSquareHeart,
  Phone,
  ShieldCheck,
  Sparkle,
  Wind,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  assessSafety,
  type SafeNow,
  type SafetyAnswers,
  type SafetyLevel,
  type Support,
  type Thoughts,
} from "@/lib/crisis";
import { HELPLINES } from "@/lib/neeva-data";
import { cn } from "@/lib/utils";

const GROUNDING = [
  { n: 5, sense: "things you can see", icon: Eye },
  { n: 4, sense: "things you can touch", icon: Hand },
  { n: 3, sense: "things you can hear", icon: Ear },
  { n: 2, sense: "things you can smell", icon: Wind },
  { n: 1, sense: "slow, kind breath", icon: Sparkle },
];

type View = "check" | "help";
type Reason = "button" | "detected";

const CrisisCtx = createContext<{ openCrisis: (reason?: Reason) => void } | null>(null);

export function useCrisis() {
  const c = useContext(CrisisCtx);
  if (!c) throw new Error("useCrisis must be used inside CrisisProvider");
  return c;
}

/** Owns the single crisis overlay so the header button, chat and journal can all open it. */
export function CrisisProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("help");
  const [reason, setReason] = useState<Reason>("button");
  const [level, setLevel] = useState<SafetyLevel | null>(null);

  const openCrisis = useCallback((r: Reason = "button") => {
    setReason(r);
    setView(r === "detected" ? "check" : "help");
    setLevel(null);
    setOpen(true);
  }, []);

  return (
    <CrisisCtx.Provider value={{ openCrisis }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.75rem] border-[1.5px] border-ink p-5 shadow-pop-lg sm:max-w-lg sm:p-6">
          <AnimatePresence mode="wait" initial={false}>
            {view === "check" ? (
              <motion.div
                key="check"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
              >
                <SafetyCheck
                  detected={reason === "detected"}
                  onDone={(l) => {
                    setLevel(l);
                    setView("help");
                  }}
                  onSkip={() => setView("help")}
                />
              </motion.div>
            ) : (
              <motion.div
                key="help"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
              >
                <HelpView level={level} onCheck={() => setView("check")} />
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </CrisisCtx.Provider>
  );
}

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={cn(
            "rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold transition-all duration-200",
            value === o.v
              ? "border-ink bg-ink text-background"
              : "border-ink/20 bg-card hover:border-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SafetyCheck({
  detected,
  onDone,
  onSkip,
}: {
  detected: boolean;
  onDone: (l: SafetyLevel) => void;
  onSkip: () => void;
}) {
  const [a, setA] = useState<Partial<SafetyAnswers>>({});
  const complete = a.safe && a.thoughts && a.support;
  return (
    <div>
      <DialogHeader className="text-left">
        <span className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-crisis-soft px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-crisis">
          <ShieldCheck className="size-3.5" /> 30-second safety check
        </span>
        <DialogTitle className="font-display text-3xl leading-tight">
          {detected ? "Hey — can we check in for a sec?" : "Let's check how safe you feel."}
        </DialogTitle>
        <DialogDescription className="text-sm">
          {detected
            ? "Something you wrote sounded really heavy. Three quick taps help us show you the right support. Nothing is shared with anyone."
            : "Three quick taps. Your answers stay on this screen."}
        </DialogDescription>
      </DialogHeader>
      <div className="mt-5 space-y-5">
        <div>
          <p className="text-sm font-semibold">1 · Are you safe right now?</p>
          <Choice<SafeNow>
            value={a.safe}
            onChange={(v) => setA((x) => ({ ...x, safe: v }))}
            options={[
              { v: "yes", label: "Yes" },
              { v: "unsure", label: "Not sure" },
              { v: "no", label: "No" },
            ]}
          />
        </div>
        <div>
          <p className="text-sm font-semibold">
            2 · Are you having thoughts of hurting yourself or ending your life?
          </p>
          <Choice<Thoughts>
            value={a.thoughts}
            onChange={(v) => setA((x) => ({ ...x, thoughts: v }))}
            options={[
              { v: "no", label: "No" },
              { v: "sometimes", label: "On and off" },
              { v: "now", label: "Yes, right now" },
            ]}
          />
        </div>
        <div>
          <p className="text-sm font-semibold">3 · Is there someone you trust you could reach today?</p>
          <Choice<Support>
            value={a.support}
            onChange={(v) => setA((x) => ({ ...x, support: v }))}
            options={[
              { v: "yes", label: "Yes" },
              { v: "no", label: "Not really" },
            ]}
          />
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Skip to helplines
        </button>
        <button
          type="button"
          disabled={!complete}
          onClick={() => complete && onDone(assessSafety(a as SafetyAnswers))}
          className="pop press ml-auto inline-flex h-11 items-center rounded-full bg-crisis px-6 text-sm font-bold text-crisis-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          See my support
        </button>
      </div>
    </div>
  );
}

const LEVEL_COPY: Record<SafetyLevel, { title: string; body: string }> = {
  urgent: {
    title: "Please reach someone right now.",
    body: "You matter, and you don't have to hold this alone. Call 112 if you're in immediate danger, or tap a helpline below — real people answer, free and confidential.",
  },
  support: {
    title: "Let's get you some backup.",
    body: "Talking to a trained listener can take the edge off. Pick a helpline below, or message someone you trust: “Can you call me? I'm having a hard day.”",
  },
  steady: {
    title: "Thanks for checking in.",
    body: "Sounds like you're safe right now. The helplines are always here, and the grounding exercise below can help you come back to your body.",
  },
};

function HelpView({ level, onCheck }: { level: SafetyLevel | null; onCheck: () => void }) {
  const [step, setStep] = useState(0);
  const copy = level ? LEVEL_COPY[level] : null;
  const urgent = level === "urgent";
  return (
    <div>
      <DialogHeader className="text-left">
        <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-crisis-soft text-crisis">
          <HeartHandshake className="size-6" />
        </div>
        <DialogTitle className="font-display text-3xl leading-tight">
          {copy?.title ?? "You're not alone right now."}
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">
          {copy?.body ?? (
            <>
              If you're in immediate danger, call{" "}
              <a className="font-semibold text-crisis underline" href="tel:112">
                112
              </a>
              . Trained, caring people are a tap away — free and confidential.
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      {urgent && (
        <a
          href="tel:112"
          className="pop press mt-4 flex items-center justify-center gap-2 rounded-2xl bg-crisis py-3.5 text-base font-bold text-crisis-foreground"
        >
          <Phone className="size-5" /> Call 112 now
        </a>
      )}

      <div className="mt-4 space-y-2">
        {HELPLINES.map((h, i) => (
          <motion.a
            key={h.name}
            href={`tel:${h.tel}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i }}
            className="flex items-center gap-3 rounded-2xl border-[1.5px] border-ink/15 bg-background p-3 transition-all duration-300 hover:border-crisis hover:bg-crisis-soft/50"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-crisis-soft text-crisis">
              <Phone className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{h.name}</span>
              <span className="block text-xs text-muted-foreground">{h.hours}</span>
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums text-crisis">{h.number}</span>
          </motion.a>
        ))}
      </div>

      {!level && (
        <button
          type="button"
          onClick={onCheck}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-ink/30 p-3 text-left text-sm transition-all duration-300 hover:border-ink hover:bg-muted"
        >
          <MessageSquareHeart className="size-5 text-crisis" />
          <span className="flex-1">
            <b>Not sure what you need?</b>{" "}
            <span className="text-muted-foreground">Take the 30-second safety check.</span>
          </span>
        </button>
      )}
      {level && (
        <button
          type="button"
          onClick={onCheck}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Redo safety check
        </button>
      )}

      <div className="mt-4 rounded-2xl bg-sage p-4">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-sage-foreground">
          5-4-3-2-1 grounding
        </p>
        {step < GROUNDING.length ? (
          (() => {
            const g = GROUNDING[step]!;
            const Icon = g.icon;
            return (
              <motion.div
                key={step}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2 flex items-center gap-3"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-card text-2xl font-bold">
                  {g.n}
                </span>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-4" /> Notice {g.n} {g.sense}
                </p>
              </motion.div>
            );
          })()
        ) : (
          <p className="mt-2 text-sm">
            You did it. Your feet are on the floor, and you are here. Stay as long as you need.
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            {GROUNDING.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-6 rounded-full transition-all duration-300",
                  i < step ? "bg-primary" : i === step ? "bg-sage-deep" : "bg-card",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep((s) => (s >= GROUNDING.length ? 0 : s + 1))}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all duration-300 hover:opacity-90"
          >
            {step >= GROUNDING.length ? "Start again" : step === GROUNDING.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CrisisButton({ compact = false }: { compact?: boolean }) {
  const { openCrisis } = useCrisis();
  return (
    <button
      type="button"
      onClick={() => openCrisis("button")}
      className={cn(
        "pop press relative inline-flex shrink-0 items-center gap-2 rounded-full bg-crisis font-bold text-crisis-foreground",
        compact ? "h-9 px-3 text-xs" : "h-9 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm",
      )}
    >
      <LifeBuoy className="size-4" />
      <span>Crisis help</span>
      <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-zest" aria-hidden />
    </button>
  );
}
