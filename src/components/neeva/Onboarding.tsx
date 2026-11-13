import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BrainCircuit, Moon, Users, Wind } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GOALS, type Goal } from "@/lib/neeva-data";
import { useNeeva } from "@/lib/neeva-store";
import { cn } from "@/lib/utils";
import hero from "@/assets/hero-calm.jpg";
import mark from "@/assets/neeva-mark.png";
import { IconBadge, type Tone } from "./IconBadge";

const GOAL_ICON: Record<Goal, { icon: typeof Wind; tone: Tone }> = {
  stress: { icon: Wind, tone: "sage" },
  focus: { icon: BrainCircuit, tone: "lilac" },
  community: { icon: Users, tone: "rose" },
  sleep: { icon: Moon, tone: "periwinkle" },
};

export function Onboarding() {
  const { hydrated, onboarded, update } = useNeeva();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>("stress");
  const [name, setName] = useState("");

  useEffect(() => {
    if (hydrated && !onboarded) setOpen(true);
  }, [hydrated, onboarded]);

  const finish = () => {
    update(() => ({ onboarded: true, goal, name: name.trim() }));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 sm:max-w-2xl [&>button]:hidden">
        <div className="grid sm:grid-cols-[0.9fr_1.1fr]">
          <div className="relative hidden min-h-[460px] sm:block">
            <img
              src={hero}
              alt="A woman resting peacefully among soft flowers"
              className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
              width={1600}
              height={1008}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/10 to-transparent" />
            <p className="absolute bottom-6 left-6 right-6 font-display text-3xl text-primary-foreground">
              You deserve to feel truly understood.
            </p>
          </div>
          <div className="flex flex-col p-7">
            <div className="mb-6 flex items-center gap-2">
              <img src={mark} alt="" className="size-8" width={816} height={816} />
              <span className="text-lg font-bold tracking-tight">Neeva</span>
              <span className="ml-auto text-xs font-medium text-muted-foreground">
                {step + 1} / 3
              </span>
            </div>

            <div key={step} className="flex-1 animate-rise">
              {step === 0 && (
                <>
                  <DialogTitle className="font-display text-4xl leading-tight">
                    Mental wellness, reimagined for everyone.
                  </DialogTitle>
                  <DialogDescription className="mt-3 text-sm leading-relaxed">
                    Neeva brings an empathetic AI companion, guided journaling, CBT tools and caring
                    peer communities together — in your language, for just ₹99 a month.
                  </DialogDescription>
                  <ul className="mt-5 space-y-2 text-sm">
                    {[
                      "Private by design — your words stay yours",
                      "English + 5 Indian languages",
                      "Human crisis support, one tap away",
                    ].map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-sage-deep" /> {t}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {step === 1 && (
                <>
                  <DialogTitle className="font-display text-3xl">
                    What would you like to work on first?
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm">
                    We'll shape your daily space around it. You can change this anytime.
                  </DialogDescription>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {GOALS.map((g) => {
                      const meta = GOAL_ICON[g.key];
                      return (
                        <button
                          key={g.key}
                          onClick={() => setGoal(g.key)}
                          className={cn(
                            "flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-all duration-300",
                            goal === g.key
                              ? "border-primary bg-secondary shadow-soft"
                              : "border-border hover:border-sage-deep",
                          )}
                        >
                          <IconBadge icon={meta.icon} tone={meta.tone} size="sm" />
                          <span className="text-sm font-semibold">{g.label}</span>
                          <span className="text-xs leading-snug text-muted-foreground">
                            {g.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <DialogTitle className="font-display text-3xl">
                    What should we call you?
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm">
                    A first name or a nickname is perfect. It stays on this device.
                  </DialogDescription>
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && finish()}
                    placeholder="e.g. Diya"
                    className="mt-5 h-12 rounded-2xl bg-background text-base"
                    maxLength={30}
                  />
                  <div className="mt-5 rounded-2xl bg-lilac/50 p-4 text-sm">
                    <p className="font-semibold">Your space is ready ✿</p>
                    <p className="mt-1 text-muted-foreground">
                      We've picked today's practices for{" "}
                      <b className="text-foreground">
                        {GOALS.find((g) => g.key === goal)?.label.toLowerCase()}
                      </b>
                      .
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex items-center gap-2">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i === step ? "w-6 bg-primary" : "w-1.5 bg-border",
                    )}
                  />
                ))}
              </div>
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="ml-auto inline-flex size-10 items-center justify-center rounded-full border border-border transition-all duration-300 hover:bg-muted"
                  aria-label="Back"
                >
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <button
                onClick={() => (step === 2 ? finish() : setStep((s) => s + 1))}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:gap-3",
                  step === 0 && "ml-auto",
                )}
              >
                {step === 0 ? "Begin" : step === 1 ? "Continue" : "Enter Neeva"}{" "}
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
