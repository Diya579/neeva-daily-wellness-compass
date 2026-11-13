import { useState } from "react";
import { Check, Leaf } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { MOODS, TRIGGERS, moodByKey, wellnessTip, type MoodKey } from "@/lib/neeva-data";
import { uid, useNeeva } from "@/lib/neeva-store";
import { cn } from "@/lib/utils";
import { MoodFace } from "./MoodFace";
import { toneBg } from "./IconBadge";

export function MoodCheckIn() {
  const { moods, update, addPoints, hydrated } = useNeeva();
  const [picked, setPicked] = useState<MoodKey | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [triggers, setTriggers] = useState<string[]>([]);

  const todayKey = hydrated ? new Date().toISOString().slice(0, 10) : "";
  const todays = moods.filter((m) => m.at.slice(0, 10) === todayKey);
  const latest = todays.at(-1);

  const save = () => {
    if (!picked) return;
    update((s) => ({
      moods: [
        ...s.moods,
        { id: uid(), mood: picked, intensity, triggers, at: new Date().toISOString() },
      ],
    }));
    addPoints(10);
    toast.success(`Logged: ${moodByKey(picked).label}`, {
      description: "+10 wellness points. Thank you for checking in.",
    });
    setPicked(null);
    setTriggers([]);
    setIntensity(3);
  };

  return (
    <div>
      <div className="grid grid-cols-5 gap-2 @lg:gap-3">
        {MOODS.map((m) => {
          const active = picked === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setPicked(active ? null : m.key)}
              className={cn(
                "group flex flex-col items-center gap-1.5 rounded-2xl border border-transparent p-2 pb-3 transition-all duration-300 hover:-translate-y-1",
                active
                  ? cn(toneBg[m.tone], "border-primary/20 shadow-soft")
                  : "bg-muted/60 hover:bg-muted",
              )}
              aria-pressed={active}
            >
              <MoodFace
                mood={m.key}
                className={cn(
                  "size-12 transition-transform duration-300 @lg:size-16",
                  active && "scale-110",
                )}
              />
              <span className="w-full break-words text-center text-[11px] font-semibold leading-tight hyphens-manual @lg:text-xs">
                {m.key === "overwhelmed" ? "Over\u00ADwhelmed" : m.label}
              </span>
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-4 animate-rise space-y-4 rounded-2xl bg-muted/60 p-4">
          <div>
            <div className="mb-2 flex justify-between text-xs font-medium text-muted-foreground">
              <span>How strongly?</span>
              <span className="text-foreground">
                {["", "A little", "Somewhat", "Noticeably", "Strongly", "Intensely"][intensity]}
              </span>
            </div>
            <Slider
              value={[intensity]}
              min={1}
              max={5}
              step={1}
              onValueChange={([v]) => setIntensity(v ?? 3)}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              What's connected to it? (optional)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TRIGGERS.map((t) => {
                const on = triggers.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => setTriggers((x) => (on ? x.filter((y) => y !== t) : [...x, t]))}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-all duration-300",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-sage-deep",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={save}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-all duration-300 hover:opacity-90"
          >
            <Check className="size-4" /> Save check-in
          </button>
        </div>
      )}

      {latest && !picked && (
        <div className="mt-4 flex gap-3 rounded-2xl bg-sage/60 p-4 animate-rise">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-sage-foreground">
            <Leaf className="size-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage-foreground">
              AI wellness tip · feeling {moodByKey(latest.mood).label.toLowerCase()}
            </p>
            <p className="mt-1 text-sm leading-relaxed">
              {wellnessTip(latest.mood, latest.triggers, todays.length)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
