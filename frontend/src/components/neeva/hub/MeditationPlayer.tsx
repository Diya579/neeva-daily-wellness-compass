import { useEffect, useMemo, useRef, useState } from "react";
import {
  CloudRain,
  Music,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Sun,
  Trees,
  Volume2,
  VolumeX,
  Waves,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { setAmbient, type Ambient } from "@/lib/ambient-audio";
import { MEDITATIONS } from "@/lib/neeva-data";
import { useNeeva } from "@/lib/neeva-store";
import { cn } from "@/lib/utils";
import cover from "@/assets/meditation-cover.jpg";
import { toneBg } from "../IconBadge";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const SOUNDSCAPE_OPTIONS: { key: Ambient; label: string; icon: typeof Sun }[] = [
  { key: "morning", label: "Sunrise", icon: Sun },
  { key: "rain", label: "Rain", icon: CloudRain },
  { key: "forest", label: "Forest", icon: Trees },
  { key: "ocean", label: "Ocean", icon: Waves },
];

function speakCalmCue(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 0.86; // Calm, unhurried meditation cadence
    u.pitch = 0.96;
    u.volume = 0.95;
    const voices = synth.getVoices?.() ?? [];
    const calmVoice =
      voices.find((v) => v.lang.toLowerCase() === "en-in") ??
      voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (calmVoice) u.voice = calmVoice;
    synth.speak(u);
  } catch {
    /* ignore speech synthesis errors */
  }
}

function stopCalmVoice() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

export function MeditationPlayer() {
  const { addPoints } = useNeeva();
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [voiceGuideOn, setVoiceGuideOn] = useState(true);
  const [soundscapeOn, setSoundscapeOn] = useState(true);
  const [activeAmbient, setActiveAmbient] = useState<Ambient>(MEDITATIONS[0]!.ambient);
  const lastSpokenCueRef = useRef<string | null>(null);

  const track = MEDITATIONS[idx]!;
  const total = track.minutes * 60;

  // Determine the current guided instruction cue based on playback position
  const { currentCue, cueIndex } = useMemo(() => {
    let activeIdx = 0;
    for (let i = 0; i < track.cues.length; i++) {
      if (pos >= track.cues[i]!.at) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return { currentCue: track.cues[activeIdx]!, cueIndex: activeIdx };
  }, [track, pos]);

  // Switch background ambient soundscape cleanly per meditation track
  useEffect(() => {
    const allMeditationAmbients: Ambient[] = ["morning", "rain", "forest", "ocean", "drone"];
    for (const a of allMeditationAmbients) {
      setAmbient(a, playing && soundscapeOn && a === activeAmbient);
    }
  }, [playing, soundscapeOn, activeAmbient]);

  // Cleanup audio and voice on unmount
  useEffect(() => {
    return () => {
      (["morning", "rain", "forest", "ocean", "drone"] as Ambient[]).forEach((a) =>
        setAmbient(a, false)
      );
      stopCalmVoice();
    };
  }, []);

  // Speak each new guided cue calmly via browser-native Web Speech API
  useEffect(() => {
    if (!playing || !voiceGuideOn) {
      stopCalmVoice();
      if (!playing) lastSpokenCueRef.current = null;
      return;
    }
    const cueKey = `${track.id}:${cueIndex}`;
    if (lastSpokenCueRef.current !== cueKey) {
      lastSpokenCueRef.current = cueKey;
      speakCalmCue(currentCue.text);
    }
  }, [playing, voiceGuideOn, track.id, cueIndex, currentCue.text]);

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
      stopCalmVoice();
      addPoints(20);
    }
  }, [pos, total, playing, addPoints]);

  const select = (i: number) => {
    stopCalmVoice();
    lastSpokenCueRef.current = null;
    setIdx(i);
    setActiveAmbient(MEDITATIONS[i]!.ambient);
    setPos(0);
    setPlaying(true);
  };

  const jumpToNextCue = () => {
    const nextCue = track.cues[cueIndex + 1];
    if (nextCue) {
      setPos(nextCue.at);
    } else {
      select((idx + 1) % MEDITATIONS.length);
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl bg-card">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={cover}
          alt="Misty pastel hills at sunrise"
          className={cn(
            "h-full w-full object-cover transition-transform duration-[4000ms]",
            playing && "scale-110"
          )}
          width={1024}
          height={1024}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/35 to-transparent" />

        {/* Live Guided Instruction Overlay */}
        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-foreground backdrop-blur">
            <Sparkles className="size-3 text-sage-deep" /> {currentCue.phase} · Step {cueIndex + 1}/
            {track.cues.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setVoiceGuideOn((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur transition-colors",
                voiceGuideOn
                  ? "bg-zest text-zest-foreground"
                  : "bg-background/75 text-muted-foreground"
              )}
              title="Toggle spoken guided meditation voice"
            >
              {voiceGuideOn ? <Volume2 className="size-3" /> : <VolumeX className="size-3" />}
              Voice
            </button>
            <button
              type="button"
              onClick={() => setSoundscapeOn((s) => !s)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur transition-colors",
                soundscapeOn
                  ? "bg-sage text-sage-foreground"
                  : "bg-background/75 text-muted-foreground"
              )}
              title="Toggle background ambient soundscape"
            >
              <Music className="size-3" />
              Sound
            </button>
          </div>
        </div>

        <div className="absolute bottom-4 left-5 right-5 text-primary-foreground">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
            {track.tag} · {track.guide} · {track.soundscapeLabel}
          </p>
          <p className="font-display text-3xl">{track.title}</p>
        </div>
      </div>

      <div className="p-5">
        {/* Spoken & Visual Guided Prompt Box */}
        <div className="mb-4 rounded-2xl border border-border/80 bg-sand/70 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-sage-foreground">
              {playing ? `Now guiding · ${currentCue.phase}` : "Press play for guided voice & soundscape"}
            </span>
            <button
              type="button"
              onClick={jumpToNextCue}
              className="text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
            >
              Next prompt →
            </button>
          </div>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-foreground">
            “{currentCue.text}”
          </p>
        </div>

        <Slider
          value={[pos]}
          max={total}
          step={1}
          onValueChange={([v]) => setPos(v ?? 0)}
          aria-label="Progress"
        />
        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>{fmt(pos)}</span>
          <span>-{fmt(total - pos)}</span>
        </div>

        <div className="mt-3 flex items-center justify-center gap-4">
          <button
            onClick={() => {
              lastSpokenCueRef.current = null;
              setPos(0);
            }}
            className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-muted hover:text-foreground"
            aria-label="Restart"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float transition-all duration-300 hover:scale-105"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
          </button>
          <button
            onClick={() => select((idx + 1) % MEDITATIONS.length)}
            className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-muted hover:text-foreground"
            aria-label="Next meditation"
          >
            <SkipForward className="size-4" />
          </button>
        </div>

        {/* Soundscape Selector Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold text-muted-foreground">Background:</span>
          {SOUNDSCAPE_OPTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActiveAmbient(key);
                setSoundscapeOn(true);
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all",
                activeAmbient === key && soundscapeOn
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-sage-deep"
              )}
            >
              <Icon className="size-3" /> {label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-1.5">
          {MEDITATIONS.map((m, i) => (
            <button
              key={m.id}
              onClick={() => select(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-all duration-300",
                i === idx ? "bg-muted" : "hover:bg-muted/60"
              )}
            >
              <span
                className={cn("flex size-9 items-center justify-center rounded-xl", toneBg[m.tone])}
              >
                {i === idx && playing ? (
                  <span className="flex h-3 items-end gap-0.5">
                    {[0, 1, 2].map((b) => (
                      <span
                        key={b}
                        className="w-0.5 animate-pulse rounded-full bg-primary"
                        style={{ height: `${6 + b * 3}px`, animationDelay: `${b * 0.15}s` }}
                      />
                    ))}
                  </span>
                ) : (
                  <Play className="size-3.5 text-primary" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{m.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  {m.soundscapeLabel} · {m.minutes} min
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
