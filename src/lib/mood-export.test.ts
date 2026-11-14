import { describe, expect, it } from "vitest";
import { moodsToCSV, moodsToJSON } from "./mood-export";
import type { MoodLog } from "./neeva-store";

const local = (y: number, m: number, d: number, h: number, min: number) =>
  new Date(y, m - 1, d, h, min).toISOString();

const MOODS: MoodLog[] = [
  { id: "b", mood: "anxious", intensity: 4, triggers: ["Work", "Sleep"], at: local(2026, 11, 13, 21, 5) },
  { id: "a", mood: "peaceful", intensity: 3, triggers: [], at: local(2026, 11, 12, 8, 30) },
];

describe("mood export", () => {
  it("writes a CSV with a header and one row per check-in, oldest first", () => {
    const lines = moodsToCSV(MOODS).trim().split("\n");
    expect(lines[0]).toBe("date,time,mood,mood_score,intensity,triggers");
    expect(lines[1]).toBe("2026-11-12,08:30,Peaceful,8,3,");
    expect(lines[2]).toBe("2026-11-13,21:05,Anxious,4,4,Work; Sleep");
    expect(lines).toHaveLength(3);
  });

  it("writes JSON containing only the person's own check-ins", () => {
    const parsed = JSON.parse(moodsToJSON(MOODS));
    expect(parsed.moods).toHaveLength(2);
    expect(parsed.moods[0].mood).toBe("peaceful");
  });
});
