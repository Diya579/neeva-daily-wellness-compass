import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useNeeva } from "@/lib/neeva-store";

const PHASES = [
  { name: "Inhale", secs: 4, scale: 1.55, hint: "through your nose" },
  { name: "Hold", secs: 7, scale: 1.55, hint: "softly, no strain" },
  { name: "Exhale", secs: 8, scale: 1, hint: "slowly through your mouth" },
] as const;

/** Guided 4-7-8 breathing with a pulsing, expanding circle. */
export function BreathingCircle() {
  const { addPoints } = useNeeva();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState<number>(PHASES[0].secs);
  const [cycles, setCycles] = useState(0);
  const tick = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    tick.current = window.setInterval(() => {
      setLeft((l) => {
        if (l > 1) return l - 1;
        setPhase((p) => {
          const next = (p + 1) % PHASES.length;
          if (next === 0) {
            setCycles((c) => {
              if ((c + 1) % 4 === 0) addPoints(10);
              return c + 1;
            });
          }
          setLeft(PHASES[next].secs);
          return next;
        });
        return l;
      });
    }, 1000);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, [running, addPoints]);

  const P = PHASES[phase];
  const scale = running ? P.scale : 1;
  const dur = running ? P.secs : 0.6;

  const toggle = () => {
    if (!running) {
      setPhase(0);
      setLeft(PHASES[0].secs);
    }
    setRunning((r) => !r);
  };

  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative flex size-64 items-center justify-center">
        {running && <span className="absolute size-36 rounded-full bg-sage-deep/30 animate-pulse-ring" />}
        <span className="absolute size-36 rounded-full bg-gradient-to-br from-sage via-lilac to-rose opacity-70 blur-xl transition-transform ease-in-out" style={{ transform: `scale(${scale * 1.1})`, transitionDuration: `${dur}s` }} />
        <span
          className="absolute flex size-36 items-center justify-center rounded-full bg-gradient-to-br from-sage to-sage-deep shadow-float ring-8 ring-card/60 transition-transform ease-in-out"
          style={{ transform: `scale(${scale})`, transitionDuration: `${dur}s` }}
        />
        <div className="relative text-center text-primary">
          <p className="font-display text-4xl">{running ? P.name : "Ready"}</p>
          <p className="text-sm font-semibold tabular-nums">{running ? left : "4 · 7 · 8"}</p>
        </div>
      </div>
      <p className="mt-2 h-5 text-sm text-muted-foreground">{running ? P.hint : "Find a comfortable seat and soften your shoulders."}</p>
      <div className="mt-4 flex items-center gap-4">
        <button onClick={toggle} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:opacity-90">
          {running ? <Pause className="size-4" /> : <Play className="size-4" />} {running ? "Pause" : "Begin breathing"}
        </button>
        <span className="text-xs text-muted-foreground">
          Cycles <b className="tabular-nums text-foreground">{cycles}</b>
        </span>
      </div>
    </div>
  );
}
