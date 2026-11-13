import { useMemo, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { DISTORTIONS, DISTORTION_ROUNDS, seeded } from "@/lib/neeva-data";
import { useNeeva } from "@/lib/neeva-store";
import { cn } from "@/lib/utils";

/** "Distortion Detective": spot the thinking trap. */
export function DistortionGame() {
  const { addPoints } = useNeeva();
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const R = DISTORTION_ROUNDS[round]!;
  const finished = round >= DISTORTION_ROUNDS.length;

  const options = useMemo(() => {
    if (!R) return [];
    const others = DISTORTIONS.filter((d) => d.key !== R.answer)
      .sort((a, b) => seeded(round * 13 + a.key.length) - seeded(round * 13 + b.key.length))
      .slice(0, 3);
    return [...others, DISTORTIONS.find((d) => d.key === R.answer)!].sort((a, b) => seeded(round + a.label.length) - seeded(round + b.label.length));
  }, [R, round]);

  const choose = (k: string) => {
    if (picked) return;
    setPicked(k);
    if (k === R.answer) {
      setScore((s) => s + 1);
      addPoints(5);
    }
  };

  if (finished) {
    return (
      <div className="animate-rise py-6 text-center">
        <p className="font-display text-5xl">{score}/{DISTORTION_ROUNDS.length}</p>
        <p className="mt-2 text-sm text-muted-foreground">{score >= 5 ? "Sharp eye, detective. Spotting traps is the first step to escaping them." : "Every trap you learn to spot gets easier to step around. Try another round?"}</p>
        <button onClick={() => { setRound(0); setScore(0); setPicked(null); }} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
          <RotateCcw className="size-4" /> Play again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>Round {round + 1} of {DISTORTION_ROUNDS.length}</span>
        <span>Score <b className="text-foreground">{score}</b></span>
      </div>
      <div key={round} className="animate-rise">
        <div className="rounded-3xl bg-rose/60 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-foreground">The thought</p>
          <p className="mt-2 font-display text-3xl leading-tight">“{R.thought}”</p>
        </div>
        <p className="my-4 text-sm font-semibold">Which thinking trap is this?</p>
        <div className="grid gap-2 @xl:grid-cols-2">
          {options.map((o) => {
            const correct = picked && o.key === R.answer;
            const wrong = picked === o.key && o.key !== R.answer;
            return (
              <button key={o.key} onClick={() => choose(o.key)} className={cn("flex items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-300", correct ? "border-sage-deep bg-sage" : wrong ? "border-terracotta bg-rose" : "border-border hover:border-sage-deep hover:bg-muted/50", picked && !correct && !wrong && "opacity-50")}>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="text-xs text-muted-foreground">{o.hint}</span>
                </span>
                {correct && <Check className="size-5 text-sage-foreground" />}
                {wrong && <X className="size-5 text-rose-foreground" />}
              </button>
            );
          })}
        </div>
        {picked && (
          <div className="mt-4 flex animate-rise items-start gap-3 rounded-2xl bg-muted/70 p-4">
            <p className="flex-1 text-sm">{R.why}</p>
            <button onClick={() => { setRound((r) => r + 1); setPicked(null); }} className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
              {round === DISTORTION_ROUNDS.length - 1 ? "See score" : "Next"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
