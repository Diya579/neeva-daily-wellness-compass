import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { moodByKey, simulatedHistory, type MoodKey } from "@/lib/neeva-data";
import { useNeeva } from "@/lib/neeva-store";
import { cn } from "@/lib/utils";
import { MoodFace } from "./MoodFace";

type Point = { date: string; label: string; score: number; mood: MoodKey; triggers: string[]; you: boolean };

export function MoodHistory() {
  const { moods, hydrated } = useNeeva();
  const [range, setRange] = useState<"week" | "month">("week");

  const data = useMemo<Point[]>(() => {
    if (!hydrated) return [];
    const today = new Date();
    const sim = simulatedHistory(today, 30);
    const byDay = new Map<string, Point>();
    for (const s of sim) byDay.set(s.date, { ...s, label: "", you: false });
    for (const m of moods) {
      const date = m.at.slice(0, 10);
      const base = moodByKey(m.mood).score;
      const adj = m.mood === "joyful" || m.mood === "peaceful" ? (m.intensity - 3) * 0.3 : -(m.intensity - 3) * 0.4;
      byDay.set(date, { date, mood: m.mood, score: Math.round((base + adj) * 10) / 10, triggers: m.triggers, label: "", you: true });
    }
    const all = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    const slice = all.slice(range === "week" ? -7 : -30);
    return slice.map((p) => {
      const d = new Date(p.date + "T00:00:00");
      return { ...p, label: range === "week" ? d.toLocaleDateString("en-IN", { weekday: "short" }) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) };
    });
  }, [moods, hydrated, range]);

  const avg = data.length ? data.reduce((s, p) => s + p.score, 0) / data.length : 0;
  const half = Math.floor(data.length / 2);
  const trend = data.length > 2 ? data.slice(half).reduce((s, p) => s + p.score, 0) / (data.length - half) - data.slice(0, half).reduce((s, p) => s + p.score, 0) / Math.max(1, half) : 0;
  const triggerCounts = useMemo(() => {
    const c = new Map<string, number>();
    data.filter((p) => p.score < 6).forEach((p) => p.triggers.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [data]);
  const maxT = triggerCounts[0]?.[1] ?? 1;
  const moodCounts = useMemo(() => {
    const c = new Map<MoodKey, number>();
    data.forEach((p) => c.set(p.mood, (c.get(p.mood) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full bg-muted p-1">
          {(["week", "month"] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={cn("rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-300", range === r ? "bg-card text-foreground shadow-soft" : "text-muted-foreground")}>
              {r === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <span>
            <span className="text-muted-foreground">Avg </span>
            <b className="tabular-nums">{avg.toFixed(1)}</b>
            <span className="text-muted-foreground">/10</span>
          </span>
          <span className={cn("inline-flex items-center gap-1 font-semibold", trend >= 0 ? "text-sage-foreground" : "text-rose-foreground")}>
            {trend >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {trend >= 0 ? "+" : ""}
            {trend.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="h-52">
        {hydrated && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: -24, right: 6, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--sage-deep)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--lilac)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 6" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={range === "week" ? 0 : 6} />
              <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip
                cursor={{ stroke: "var(--sage-deep)", strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload as Point | undefined;
                  if (!p) return null;
                  return (
                    <div className="flex items-center gap-2 rounded-2xl border border-border bg-popover p-2.5 pr-4 shadow-float">
                      <MoodFace mood={p.mood} className="size-9" />
                      <div className="text-xs">
                        <p className="font-semibold">
                          {moodByKey(p.mood).label} · {p.score}
                        </p>
                        <p className="text-muted-foreground">{p.triggers.join(", ") || "No triggers"}{p.you ? " · your log" : ""}</p>
                      </div>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2.2} fill="url(#moodFill)" dot={range === "week" ? { r: 3.5, fill: "var(--card)", stroke: "var(--primary)", strokeWidth: 2 } : false} activeDot={{ r: 5, fill: "var(--primary)" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 grid gap-3 @xl:grid-cols-2">
        <div className="rounded-2xl bg-muted/60 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mood mix</p>
          <div className="flex flex-wrap gap-2">
            {moodCounts.map(([m, n]) => (
              <span key={m} className="inline-flex items-center gap-1 rounded-full bg-card py-0.5 pl-0.5 pr-2.5 text-xs font-medium">
                <MoodFace mood={m} className="size-6" /> {moodByKey(m).label} <span className="text-muted-foreground">×{n}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-muted/60 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Triggers on tougher days</p>
          <div className="space-y-1.5">
            {triggerCounts.length === 0 && <p className="text-xs text-muted-foreground">No tough days in this range — lovely.</p>}
            {triggerCounts.map(([t, n]) => (
              <div key={t} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 font-medium">{t}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-card">
                  <span className="block h-full rounded-full bg-terracotta transition-all duration-500" style={{ width: `${(n / maxT) * 100}%` }} />
                </span>
                <span className="w-4 tabular-nums text-muted-foreground">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
