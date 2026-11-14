import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Coffee, CloudRain, Pause, Play, RotateCcw, Trees, Trophy, Volume2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import {
  getAmbientLevel,
  setAmbient,
  setAmbientVolume,
  stopAllAmbient,
  type Ambient,
} from "@/lib/ambient-audio";
import { useNeeva } from "@/lib/neeva-store";
import { cn } from "@/lib/utils";
import desk from "@/assets/focus-desk.jpg";

export const MODES = {
  focus: { label: "Focus", mins: 25 },
  short: { label: "Short break", mins: 5 },
  long: { label: "Long break", mins: 15 },
} as const;
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

/** Live meter driven by the actual audio output, so "is sound playing?" is visible. */
function LevelMeter({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) {
      ref.current?.setAttribute("data-level", "0");
      return;
    }
    let raf = 0;
    const bars = ref.current?.querySelectorAll<HTMLSpanElement>("span") ?? [];
    const tick = () => {
      const lvl = getAmbientLevel();
      ref.current?.setAttribute("data-level", lvl.toFixed(3));
      bars.forEach((b, i) => {
        const wobble = 0.55 + 0.45 * Math.sin(performance.now() / (140 + i * 37) + i);
        b.style.transform = `scaleY(${Math.max(0.12, Math.min(1, lvl * 1.6 * wobble))})`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return (
    <div ref={ref} data-testid="sound-level" data-level="0" className="flex h-5 items-end gap-[3px]" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={i}
          className="h-full w-1 origin-bottom rounded-full bg-ink transition-transform duration-75"
          style={{ transform: "scaleY(0.12)" }}
        />
      ))}
    </div>
  );
}

export function FocusTimer() {
  const { points, focusSessions, update, addPoints } = useNeeva();
  const [mode, setMode] = useState<Mode>("focus");
  const [left, setLeft] = useState<number>(MODES.focus.mins * 60);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [sounds, setSounds] = useState<string[]>([]);
  const [vol, setVol] = useState(80);
  const running = endAt !== null;
  const total = MODES[mode].mins * 60;

  // Wall-clock based so the timer stays accurate in background tabs.
  useEffect(() => {
    if (endAt === null) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endAt]);

  useEffect(() => {
    if (!running) return;
    const prev = document.title;
    document.title = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")} · ${MODES[mode].label}`;
    return () => {
      document.title = prev;
    };
  }, [left, running, mode]);

  useEffect(() => {
    if (left > 0 || !running) return;
    setEndAt(null);
    if (mode === "focus") {
      const done = focusSessions + 1;
      addPoints(25);
      update((s) => ({ focusSessions: s.focusSessions + 1 }));
      toast.success("Focus session complete!", {
        description:
          done % 4 === 0
            ? "+25 points. Four in a row — you've earned a long break."
            : "+25 points. Take a real break — stretch, sip water.",
      });
      switchMode(done % 4 === 0 ? "long" : "short");
    } else {
      toast("Break's over", { description: "Ready for another gentle sprint?" });
      switchMode("focus");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running]);

  useEffect(() => () => stopAllAmbient(), []);

  function switchMode(m: Mode) {
    setMode(m);
    setLeft(MODES[m].mins * 60);
    setEndAt(null);
  }

  const toggleRun = () => {
    if (running) {
      setEndAt(null);
    } else {
      setEndAt(Date.now() + left * 1000);
    }
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
  const today = focusSessions % 4;

  return (
    <div className="grid gap-6 @3xl:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col items-center">
        <div className="mb-5 inline-flex rounded-full border-[1.5px] border-ink bg-card p-1">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn(
                "relative rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-300 @md:px-4",
                mode === m ? "text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {mode === m && (
                <motion.span
                  layoutId="pomo-mode"
                  className="absolute inset-0 rounded-full bg-ink"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{MODES[m].label}</span>
            </button>
          ))}
        </div>
        <div className="relative size-56 @md:size-64">
          <svg viewBox="0 0 240 240" className="size-full -rotate-90">
            <circle cx="120" cy="120" r={r} fill="none" stroke="var(--muted)" strokeWidth="16" />
            <circle
              cx="120"
              cy="120"
              r={r}
              fill="none"
              stroke={mode === "focus" ? "var(--ink)" : "var(--sage-deep)"}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-300 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p data-testid="pomodoro-time" className="font-mono text-5xl font-bold tabular-nums tracking-tight @md:text-6xl">
              {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              {running && <span className="size-1.5 animate-pulse rounded-full bg-crisis" />}
              {running ? (mode === "focus" ? "locked in" : "recharging") : "paused"}
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => switchMode(mode)}
            className="pop press inline-flex size-11 items-center justify-center rounded-full bg-card"
            aria-label="Reset timer"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            onClick={toggleRun}
            className="pop press inline-flex h-12 min-w-36 items-center justify-center gap-2 rounded-full bg-zest px-7 text-sm font-bold text-zest-foreground"
          >
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {running ? "Pause" : "Start"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-3xl border-[1.5px] border-ink">
          <img
            src={desk}
            alt="A desk by a rainy window at night with a warm lamp"
            width={1600}
            height={1072}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/50 to-ink/10" />
          <div className="relative p-4">
            <div className="flex items-center justify-between text-background">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider">Atmosphere</p>
              <LevelMeter active={sounds.length > 0} />
            </div>
            <div className="mt-16 grid grid-cols-3 gap-2">
              {SOUNDS.map(({ key, label, icon: Icon }) => {
                const on = sounds.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleSound(key)}
                    aria-pressed={on}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-2xl border-[1.5px] p-3 text-xs font-semibold backdrop-blur-md transition-all duration-300",
                      on
                        ? "border-ink bg-zest text-zest-foreground"
                        : "border-background/30 bg-background/15 text-background hover:bg-background/25",
                    )}
                  >
                    <Icon className={cn("size-5", on && "animate-wiggle")} /> {label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-3 text-background">
              <Volume2 className="size-4 shrink-0" />
              <Slider
                value={[vol]}
                onValueChange={([v]) => {
                  setVol(v ?? 0);
                  setAmbientVolume((v ?? 0) / 100);
                }}
                max={100}
                step={1}
                aria-label="Sound volume"
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border-[1.5px] border-ink bg-lilac p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-card text-lilac-foreground">
              <Trophy className="size-5" />
            </span>
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-lilac-foreground">
                Level · {level.name}
              </p>
              <p className="text-2xl font-bold tabular-nums">{points} pts</p>
            </div>
          </div>
          {nextLevel && (
            <>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-card">
                <motion.div
                  className="h-full rounded-full bg-ink"
                  initial={false}
                  animate={{ width: `${((points - level.at) / (nextLevel.at - level.at)) * 100}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              <p className="mt-1.5 text-xs text-lilac-foreground">
                {nextLevel.at - points} pts to {nextLevel.name}
              </p>
            </>
          )}
        </div>
        <div className="rounded-3xl border-[1.5px] border-ink/15 bg-card p-5">
          <p className="text-sm font-semibold">Sprint streak · long break after 4</p>
          <div className="mt-3 flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                initial={false}
                animate={{ scale: i < today ? 1 : 0.94 }}
                className={cn(
                  "flex h-10 flex-1 items-center justify-center rounded-2xl transition-colors duration-500",
                  i < today ? "bg-zest text-zest-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <Zap className="size-4" />
              </motion.span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            <span data-testid="focus-sessions">{focusSessions}</span> sessions done · +25 points each
          </p>
        </div>
        <div className="rounded-3xl bg-sand p-5 text-sm">
          <p className="font-semibold">ADHD-friendly tip</p>
          <p className="mt-1 text-muted-foreground">
            Before you start, write the <b className="text-foreground">tiniest next action</b> on a
            sticky note — “open the doc” beats “finish the report”.
          </p>
        </div>
      </div>
    </div>
  );
}
