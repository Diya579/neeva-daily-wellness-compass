import { useEffect, useState } from "react";
import { Coffee, CloudRain, Pause, Play, RotateCcw, Trees, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { setAmbient, stopAllAmbient, type Ambient } from "@/lib/ambient-audio";
import { useNeeva } from "@/lib/neeva-store";
import { cn } from "@/lib/utils";

const MODES = { focus: { label: "Focus", mins: 25 }, short: { label: "Short break", mins: 5 }, long: { label: "Long break", mins: 15 } } as const;
type Mode = keyof typeof MODES;

const SOUNDS: { key: Exclude<Ambient, "drone">; label: string; icon: typeof CloudRain }[] = [
  { key: "rain", label: "Rain", icon: CloudRain },
  { key: "forest", label: "Forest", icon: Trees },
  { key: "cafe", label: "Cozy Café", icon: Coffee },
];

const LEVELS = [
  { at: 0, name: "Seedling" },
  { at: 200, name: "Sprout" },
  { at: 500, name: "Sapling" },
  { at: 1000, name: "Banyan" },
];

export function FocusTimer() {
  const { points, focusSessions, update, addPoints } = useNeeva();
  const [mode, setMode] = useState<Mode>("focus");
  const [left, setLeft] = useState(MODES.focus.mins * 60);
  const [running, setRunning] = useState(false);
  const [sounds, setSounds] = useState<string[]>([]);
  const total = MODES[mode].mins * 60;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (left > 0 || !running) return;
    setRunning(false);
    if (mode === "focus") {
      addPoints(25);
      update((s) => ({ focusSessions: s.focusSessions + 1 }));
      toast.success("Focus session complete!", { description: "+25 points. Take a real break — stretch, sip water." });
      switchMode("short");
    } else {
      toast("Break's over", { description: "Ready for another gentle sprint?" });
      switchMode("focus");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running]);

  useEffect(() => () => stopAllAmbient(), []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setLeft(MODES[m].mins * 60);
    setRunning(false);
  };

  const toggleSound = (k: Exclude<Ambient, "drone">) => {
    const on = !sounds.includes(k);
    setAmbient(k, on);
    setSounds((s) => (on ? [...s, k] : s.filter((x) => x !== k)));
  };

  const r = 100;
  const circ = 2 * Math.PI * r;
  const progress = 1 - left / total;
  const level = [...LEVELS].reverse().find((l) => points >= l.at)!;
  const nextLevel = LEVELS.find((l) => l.at > points);
  const today = Math.min(4, focusSessions % 5);

  return (
    <div className="grid gap-6 @3xl:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col items-center">
        <div className="mb-5 inline-flex rounded-full bg-muted p-1">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <button key={m} onClick={() => switchMode(m)} className={cn("rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300", mode === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground")}>
              {MODES[m].label}
            </button>
          ))}
        </div>
        <div className="relative size-60">
          <svg viewBox="0 0 240 240" className="size-full -rotate-90">
            <circle cx="120" cy="120" r={r} fill="none" stroke="var(--muted)" strokeWidth="14" />
            <circle cx="120" cy="120" r={r} fill="none" stroke={mode === "focus" ? "var(--primary)" : "var(--sage-deep)"} strokeWidth="14" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-5xl font-bold tabular-nums tracking-tight">
              {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
            </p>
            <p className="text-xs font-medium text-muted-foreground">{running ? (mode === "focus" ? "In the flow" : "Recharging") : "Paused"}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button onClick={() => switchMode(mode)} className="inline-flex size-11 items-center justify-center rounded-full border border-border transition-all duration-300 hover:bg-muted" aria-label="Reset timer">
            <RotateCcw className="size-4" />
          </button>
          <button onClick={() => setRunning((x) => !x)} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-float transition-all duration-300 hover:scale-105">
            {running ? <Pause className="size-4" /> : <Play className="size-4" />} {running ? "Pause" : "Start"}
          </button>
        </div>
        <div className="mt-6 w-full">
          <p className="mb-2 text-center text-xs font-semibold text-muted-foreground">Atmosphere</p>
          <div className="grid grid-cols-3 gap-2">
            {SOUNDS.map(({ key, label, icon: Icon }) => {
              const on = sounds.includes(key);
              return (
                <button key={key} onClick={() => toggleSound(key)} aria-pressed={on} className={cn("flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-semibold transition-all duration-300", on ? "border-sage-deep bg-sage text-sage-foreground" : "border-border hover:bg-muted")}>
                  <Icon className={cn("size-5", on && "animate-pulse")} /> {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl bg-lilac/60 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-card text-lilac-foreground"><Trophy className="size-5" /></span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-lilac-foreground">Level · {level.name}</p>
              <p className="text-2xl font-bold tabular-nums">{points} pts</p>
            </div>
          </div>
          {nextLevel && (
            <>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-card"><div className="h-full rounded-full bg-lilac-foreground/70 transition-all duration-700" style={{ width: `${((points - level.at) / (nextLevel.at - level.at)) * 100}%` }} /></div>
              <p className="mt-1.5 text-xs text-lilac-foreground/80">{nextLevel.at - points} pts to {nextLevel.name}</p>
            </>
          )}
        </div>
        <div className="rounded-3xl border border-border p-5">
          <p className="text-sm font-semibold">Today's sprint path</p>
          <div className="mt-3 flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn("flex h-10 flex-1 items-center justify-center rounded-2xl transition-all duration-500", i < today ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Zap className="size-4" />
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{focusSessions} sessions completed · +25 points each</p>
        </div>
        <div className="rounded-3xl bg-sand p-5 text-sm">
          <p className="font-semibold">ADHD-friendly tip</p>
          <p className="mt-1 text-muted-foreground">Before you start, write the <b className="text-foreground">tiniest next action</b> on a sticky note — “open the doc” beats “finish the report”.</p>
        </div>
      </div>
    </div>
  );
}
