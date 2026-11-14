import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, BrainCircuit, Moon, Users, Wind } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GOALS, type Goal } from "@/lib/neeva-data";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import heroImg from "@/assets/landing-hero.jpg";
import friends from "@/assets/friends-steps.jpg";
import windowImg from "@/assets/window-calm.jpg";
import mark from "@/assets/neeva-mark.png";
import { IconBadge, type Tone } from "./IconBadge";

const GOAL_ICON: Record<Goal, { icon: typeof Wind; tone: Tone }> = {
  stress: { icon: Wind, tone: "sage" },
  focus: { icon: BrainCircuit, tone: "lilac" },
  community: { icon: Users, tone: "rose" },
  sleep: { icon: Moon, tone: "periwinkle" },
};

const SIDE = [
  { src: heroImg, alt: "A young woman with headphones relaxing on a rooftop at sunset", w: 1280, h: 1600, line: "Your feelings, finally with a home." },
  { src: friends, alt: "Four college friends laughing on campus steps", w: 1600, h: 1072, line: "Built for the way you actually live." },
  { src: windowImg, alt: "A young man smiling at his phone by a sunlit window", w: 1280, h: 1600, line: "Small steps count here." },
];

export function Onboarding() {
  const { profile, saveProfile } = useProfile();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>("stress");
  const [name, setName] = useState(profile.display_name);

  useEffect(() => {
    if (!profile.onboarded) setOpen(true);
  }, [profile.onboarded]);

  const finish = async () => {
    setOpen(false);
    try {
      await saveProfile({ onboarded: true, goal, display_name: name.trim().slice(0, 40) });
    } catch {
      toast.error("Couldn't save your preferences", { description: "You can update them in Settings." });
    }
  };

  const side = SIDE[step]!;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void finish()}>
      <DialogContent className="overflow-hidden rounded-[2rem] border-[1.5px] border-ink p-0 shadow-pop-lg sm:max-w-3xl [&>button]:hidden">
        <div className="grid sm:grid-cols-[0.9fr_1.1fr]">
          <div className="relative hidden min-h-[500px] overflow-hidden border-r-[1.5px] border-ink sm:block">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.img
                key={step}
                src={side.src}
                alt={side.alt}
                width={side.w}
                height={side.h}
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
            <p className="absolute bottom-6 left-6 right-6 font-display text-3xl leading-tight text-background">
              {side.line}
            </p>
            <span className="absolute left-5 top-5 -rotate-6 rounded-full border-[1.5px] border-ink bg-zest px-3 py-1 font-mono text-[11px] font-bold text-zest-foreground">
              step {step + 1}/3
            </span>
          </div>
          <div className="flex flex-col p-6 sm:p-7">
            <div className="mb-6 flex items-center gap-2">
              <img src={mark} alt="" className="size-8" width={816} height={816} />
              <span className="text-lg font-extrabold tracking-tight">neeva</span>
              <span className="ml-auto font-mono text-xs font-medium text-muted-foreground sm:hidden">
                {step + 1}/3
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex-1"
              >
                {step === 0 && (
                  <>
                    <DialogTitle className="text-4xl font-extrabold leading-[1.05] tracking-tight">
                      You're in. <span className="font-display font-normal italic">Welcome.</span>
                    </DialogTitle>
                    <DialogDescription className="mt-3 text-sm leading-relaxed">
                      Neeva is your pocket-sized wellness space: a companion you name yourself, a
                      journal that reflects back, CBT tools, focus timers and real circles — in your
                      language, for ₹99 a month.
                    </DialogDescription>
                    <ul className="mt-5 space-y-2.5 text-sm">
                      {[
                        "Private by design — your entries stay on your device",
                        "English + 5 Indian languages",
                        "Human crisis support, one tap away",
                      ].map((t, i) => (
                        <motion.li
                          key={t}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.08 }}
                          className="flex items-center gap-2.5"
                        >
                          <span className="size-2 rotate-45 bg-zest ring-[1.5px] ring-ink" /> {t}
                        </motion.li>
                      ))}
                    </ul>
                  </>
                )}
                {step === 1 && (
                  <>
                    <DialogTitle className="text-3xl font-extrabold tracking-tight">
                      What's the main thing right now?
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-sm">
                      We'll shape your daily space around it. Change it anytime.
                    </DialogDescription>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {GOALS.map((g) => {
                        const meta = GOAL_ICON[g.key];
                        const on = goal === g.key;
                        return (
                          <motion.button
                            key={g.key}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setGoal(g.key)}
                            className={cn(
                              "flex flex-col items-start gap-2 rounded-2xl border-[1.5px] p-3 text-left transition-all duration-300",
                              on ? "border-ink bg-zest/50 shadow-pop" : "border-ink/15 hover:border-ink",
                            )}
                          >
                            <IconBadge icon={meta.icon} tone={meta.tone} size="sm" />
                            <span className="text-sm font-bold">{g.label}</span>
                            <span className="text-xs leading-snug text-muted-foreground">{g.description}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <DialogTitle className="text-3xl font-extrabold tracking-tight">
                      What should we call you?
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-sm">
                      First name, nickname, whatever feels right.
                    </DialogDescription>
                    <Input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void finish()}
                      placeholder="e.g. Diya"
                      className="mt-5 h-12 rounded-2xl border-[1.5px] border-ink/20 bg-background text-base focus-visible:border-ink"
                      maxLength={40}
                    />
                    <div className="mt-5 rounded-2xl border-[1.5px] border-ink bg-lilac p-4 text-sm">
                      <p className="font-bold">Your space is ready ✿</p>
                      <p className="mt-1 text-lilac-foreground">
                        Today's picks are tuned for{" "}
                        <b>{GOALS.find((g) => g.key === goal)?.label.toLowerCase()}</b>. Next up: name
                        your AI companion in the chat.
                      </p>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex items-center gap-2">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ width: i === step ? 24 : 6 }}
                    className={cn("h-1.5 rounded-full", i === step ? "bg-ink" : "bg-border")}
                  />
                ))}
              </div>
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="ml-auto inline-flex size-10 items-center justify-center rounded-full border-[1.5px] border-ink/20 transition-all duration-300 hover:border-ink"
                  aria-label="Back"
                >
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <button
                onClick={() => (step === 2 ? void finish() : setStep((s) => s + 1))}
                className={cn(
                  "pop press inline-flex h-11 items-center gap-2 rounded-full bg-zest px-5 text-sm font-bold text-zest-foreground",
                  step === 0 && "ml-auto",
                )}
              >
                {step === 0 ? "Let's go" : step === 1 ? "Continue" : "Enter Neeva"}
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
