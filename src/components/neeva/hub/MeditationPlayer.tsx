import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { MEDITATIONS } from "@/lib/neeva-data";
import { setAmbient } from "@/lib/ambient-audio";
import { useNeeva } from "@/lib/neeva-store";
import { cn } from "@/lib/utils";
import cover from "@/assets/meditation-cover.jpg";
import { toneBg } from "../IconBadge";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function MeditationPlayer() {
  const { addPoints } = useNeeva();
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const track = MEDITATIONS[idx]!;
  const total = track.minutes * 60;

  useEffect(() => {
    setAmbient("drone", playing);
  }, [playing]);
  useEffect(() => () => setAmbient("drone", false), []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setPos((p) => Math.min(total, p + 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, total]);

  useEffect(() => {
    if (playing && pos >= total) {
      setPlaying(false);
      addPoints(20);
    }
  }, [pos, total, playing, addPoints]);

  const select = (i: number) => {
    setIdx(i);
    setPos(0);
    setPlaying(true);
  };

  return (
    <div className="overflow-hidden rounded-3xl bg-card">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img src={cover} alt="Misty pastel hills at sunrise" className={cn("h-full w-full object-cover transition-transform duration-[4000ms]", playing && "scale-110")} width={1024} height={1024} loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/10 to-transparent" />
        <div className="absolute bottom-4 left-5 right-5 text-primary-foreground">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{track.tag} · with {track.guide}</p>
          <p className="font-display text-3xl">{track.title}</p>
        </div>
      </div>
      <div className="p-5">
        <Slider value={[pos]} max={total} step={1} onValueChange={([v]) => setPos(v ?? 0)} aria-label="Progress" />
        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>{fmt(pos)}</span>
          <span>-{fmt(total - pos)}</span>
        </div>
        <div className="mt-3 flex items-center justify-center gap-4">
          <button onClick={() => setPos(0)} className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-muted hover:text-foreground" aria-label="Restart">
            <RotateCcw className="size-4" />
          </button>
          <button onClick={() => setPlaying((p) => !p)} className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float transition-all duration-300 hover:scale-105" aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
          </button>
          <button onClick={() => select((idx + 1) % MEDITATIONS.length)} className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-muted hover:text-foreground" aria-label="Next">
            <SkipForward className="size-4" />
          </button>
        </div>
        <div className="mt-4 space-y-1.5">
          {MEDITATIONS.map((m, i) => (
            <button key={m.id} onClick={() => select(i)} className={cn("flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-all duration-300", i === idx ? "bg-muted" : "hover:bg-muted/60")}>
              <span className={cn("flex size-9 items-center justify-center rounded-xl", toneBg[m.tone])}>
                {i === idx && playing ? (
                  <span className="flex h-3 items-end gap-0.5">
                    {[0, 1, 2].map((b) => <span key={b} className="w-0.5 animate-pulse rounded-full bg-primary" style={{ height: `${6 + b * 3}px`, animationDelay: `${b * 0.15}s` }} />)}
                  </span>
                ) : (
                  <Play className="size-3.5 text-primary" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{m.title}</span>
                <span className="text-[11px] text-muted-foreground">{m.guide} · {m.minutes} min</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
