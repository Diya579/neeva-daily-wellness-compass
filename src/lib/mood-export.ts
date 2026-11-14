import { moodByKey } from "./neeva-data";
import type { MoodLog } from "./neeva-store";

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Oldest-first CSV of the person's own mood check-ins (no sample data). */
export function moodsToCSV(moods: MoodLog[]): string {
  const rows = [...moods].sort((a, b) => a.at.localeCompare(b.at));
  const header = ["date", "time", "mood", "mood_score", "intensity", "triggers"];
  const lines = rows.map((m) => {
    const d = new Date(m.at);
    return [
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      moodByKey(m.mood).label,
      moodByKey(m.mood).score,
      m.intensity,
      m.triggers.join("; "),
    ]
      .map(esc)
      .join(",");
  });
  return [header.join(","), ...lines].join("\n") + "\n";
}

export function moodsToJSON(moods: MoodLog[]): string {
  const rows = [...moods]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((m) => ({
      at: m.at,
      mood: m.mood,
      label: moodByKey(m.mood).label,
      score: moodByKey(m.mood).score,
      intensity: m.intensity,
      triggers: m.triggers,
    }));
  return JSON.stringify({ app: "Neeva", exportedAt: new Date().toISOString(), moods: rows }, null, 2);
}

export function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function exportMoods(moods: MoodLog[], format: "csv" | "json") {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") downloadText(moodsToCSV(moods), `neeva-moods-${stamp}.csv`, "text/csv;charset=utf-8");
  else downloadText(moodsToJSON(moods), `neeva-moods-${stamp}.json`, "application/json");
}
