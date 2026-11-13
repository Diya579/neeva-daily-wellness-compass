import type { MoodKey } from "@/lib/neeva-data";
import { cn } from "@/lib/utils";

const FILL: Record<MoodKey, string> = {
  peaceful: "var(--sage)",
  joyful: "var(--rose)",
  tired: "var(--periwinkle)",
  anxious: "var(--lilac)",
  overwhelmed: "var(--terracotta)",
};

const BLOB: Record<MoodKey, string> = {
  peaceful: "M50 6c22 0 40 14 42 38 2 26-16 48-42 50C24 96 6 76 8 50 10 24 27 6 50 6Z",
  joyful: "M52 5c24 2 41 20 40 44-1 27-20 46-45 45C22 93 6 73 8 48 10 22 28 3 52 5Z",
  tired: "M48 8c25-2 44 16 44 42 0 24-18 43-43 43C24 93 7 75 8 50 9 26 24 10 48 8Z",
  anxious: "M50 5c20 1 30 9 38 22 9 15 6 36-6 50-12 14-34 19-50 10C16 78 6 62 8 44 10 22 28 4 50 5Z",
  overwhelmed: "M47 7c26-3 46 14 45 40-1 28-19 46-46 46C20 93 5 72 9 47 12 25 25 9 47 7Z",
};

/** Hand-drawn style mood character used in the check-in grid and history. */
export function MoodFace({ mood, className }: { mood: MoodKey; className?: string }) {
  const ink = "var(--primary)";
  return (
    <svg viewBox="0 0 100 100" className={cn("size-14", className)} aria-hidden>
      <path d={BLOB[mood]} fill={FILL[mood]} />
      <g stroke={ink} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {mood === "peaceful" && (
          <>
            <path d="M30 46q6 5 12 0" />
            <path d="M58 46q6 5 12 0" />
            <path d="M40 64q10 7 20 0" />
          </>
        )}
        {mood === "joyful" && (
          <>
            <path d="M30 47q6-8 12 0" />
            <path d="M58 47q6-8 12 0" />
            <path d="M36 60q14 16 28 0z" fill={ink} />
          </>
        )}
        {mood === "tired" && (
          <>
            <path d="M29 48h13" />
            <path d="M58 48h13" />
            <path d="M43 66h14" />
            <path d="M72 22h8l-8 8h8" strokeWidth={2.4} />
          </>
        )}
        {mood === "anxious" && (
          <>
            <path d="M31 38l9 4" />
            <path d="M69 38l-9 4" />
            <path d="M38 67q4-5 8 0t8 0 8 0" />
            <path d="M78 30q4 7 0 10q-4-3 0-10" strokeWidth={2.4} />
          </>
        )}
        {mood === "overwhelmed" && (
          <>
            <path d="M36 46a5 5 0 1 1-1-5" />
            <path d="M66 46a5 5 0 1 1-1-5" />
            <ellipse cx="50" cy="66" rx="5" ry="6" />
          </>
        )}
      </g>
      {(mood === "anxious" || mood === "peaceful") && null}
      {(mood === "joyful" || mood === "peaceful") && (
        <g fill="var(--terracotta)" opacity={0.45}>
          <circle cx="26" cy="58" r="5" />
          <circle cx="74" cy="58" r="5" />
        </g>
      )}
      {(mood === "anxious" || mood === "tired") && (
        <g fill={ink}>
          <circle cx="36" cy="49" r="3.2" opacity={mood === "anxious" ? 1 : 0} />
          <circle cx="64" cy="49" r="3.2" opacity={mood === "anxious" ? 1 : 0} />
        </g>
      )}
    </svg>
  );
}
