import { useState } from "react";
import { Ear, Eye, Hand, HeartHandshake, LifeBuoy, Phone, Sparkle, Wind } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HELPLINES } from "@/lib/neeva-data";
import { cn } from "@/lib/utils";

const GROUNDING = [
  { n: 5, sense: "things you can see", icon: Eye },
  { n: 4, sense: "things you can touch", icon: Hand },
  { n: 3, sense: "things you can hear", icon: Ear },
  { n: 2, sense: "things you can smell", icon: Wind },
  { n: 1, sense: "slow, kind breath", icon: Sparkle },
];

export function CrisisButton({ compact = false }: { compact?: boolean }) {
  const [step, setStep] = useState(0);
  return (
    <Dialog onOpenChange={(o) => o && setStep(0)}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "group relative inline-flex items-center gap-2 rounded-full bg-crisis font-semibold text-crisis-foreground shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float active:translate-y-0",
            compact ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm",
          )}
        >
          <span className="absolute inset-0 rounded-full bg-crisis animate-pulse-ring" aria-hidden />
          <LifeBuoy className="relative size-4" />
          <span className="relative">Crisis help</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl border-crisis/20 sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-crisis-soft text-crisis">
            <HeartHandshake className="size-6" />
          </div>
          <DialogTitle className="font-display text-3xl">You're not alone right now.</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            If you're in immediate danger, call <a className="font-semibold text-crisis underline" href="tel:112">112</a>. Trained, caring people are a tap away — free and confidential.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {HELPLINES.map((h) => (
            <a
              key={h.name}
              href={`tel:${h.tel}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3 transition-all duration-300 hover:border-crisis/40 hover:bg-crisis-soft/50"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-crisis-soft text-crisis">
                <Phone className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{h.name}</span>
                <span className="block text-xs text-muted-foreground">{h.hours}</span>
              </span>
              <span className="text-sm font-bold tabular-nums text-crisis">{h.number}</span>
            </a>
          ))}
        </div>

        <div className="rounded-2xl bg-sage/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage-foreground">Grounding · 5-4-3-2-1</p>
          {step < GROUNDING.length ? (
            <div className="mt-3 flex items-center gap-4">
              {(() => {
                const G = GROUNDING[step]!;
                const Icon = G.icon;
                return (
                  <>
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-card font-display text-3xl text-primary">{G.n}</span>
                    <div className="flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <Icon className="size-4" /> Notice {G.n} {G.sense}
                      </p>
                      <p className="text-xs text-muted-foreground">Take your time. Name each one, silently or out loud.</p>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <p className="mt-3 text-sm">You did it. Your feet are on the floor, and you are here. Stay as long as you need.</p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1.5">
              {GROUNDING.map((_, i) => (
                <span key={i} className={cn("h-1.5 w-6 rounded-full transition-all duration-300", i < step ? "bg-primary" : i === step ? "bg-sage-deep" : "bg-card")} />
              ))}
            </div>
            <button
              onClick={() => setStep((s) => (s >= GROUNDING.length ? 0 : s + 1))}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all duration-300 hover:opacity-90"
            >
              {step >= GROUNDING.length ? "Start again" : step === GROUNDING.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
