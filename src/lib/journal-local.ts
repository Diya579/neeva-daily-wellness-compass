import type { JournalAnalysis } from "./journal-types";

// Offline fallback used when the AI service is unreachable, so the writer always gets a reflection.
const LEX: { name: string; words: string[]; valence: number }[] = [
  {
    name: "Gratitude",
    words: ["grateful", "thankful", "lucky", "appreciate", "blessed"],
    valence: 1,
  },
  {
    name: "Joy",
    words: ["happy", "joy", "excited", "fun", "laughed", "proud", "great"],
    valence: 1,
  },
  { name: "Calm", words: ["calm", "peace", "relaxed", "rest", "slow", "quiet"], valence: 1 },
  {
    name: "Anxiety",
    words: ["anxious", "worry", "worried", "nervous", "panic", "scared", "fear"],
    valence: -1,
  },
  {
    name: "Exhaustion",
    words: ["tired", "exhausted", "drained", "burnt", "burnout", "sleep"],
    valence: -1,
  },
  {
    name: "Sadness",
    words: ["sad", "lonely", "cry", "cried", "miss", "empty", "low"],
    valence: -1,
  },
  {
    name: "Frustration",
    words: ["angry", "annoyed", "frustrated", "unfair", "hate", "irritated"],
    valence: -1,
  },
];
const THEMES: [string, string[]][] = [
  ["Work & career", ["work", "office", "manager", "deadline", "job", "meeting", "boss"]],
  ["Studies", ["exam", "study", "college", "class", "assignment", "marks", "placement"]],
  ["Family", ["mom", "dad", "mother", "father", "family", "parents", "sister", "brother"]],
  ["Relationships", ["friend", "partner", "love", "relationship", "people"]],
  ["Self-care", ["walk", "sleep", "exercise", "yoga", "rest", "meditate"]],
];

export function analyzeLocally(text: string): JournalAnalysis {
  const t = text.toLowerCase();
  const emotions = LEX.map((e) => ({ ...e, hits: e.words.filter((w) => t.includes(w)).length }))
    .filter((e) => e.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  const val = emotions.reduce((s, e) => s + e.valence * e.hits, 0);
  const valence = Math.max(-100, Math.min(100, val * 22));
  const themes = THEMES.filter(([, ws]) => ws.some((w) => t.includes(w))).map(([n]) => n);
  const absolutes = (
    text.match(/\b(always|never|everyone|nobody|everything|nothing|ruined|should)\b/gi) ?? []
  ).slice(0, 2);
  return {
    summary:
      valence >= 0
        ? "You're noticing what's working, and that awareness is a quiet strength. There's warmth in how you describe your day."
        : "It sounds like you've been carrying a lot. Putting it into words is already a way of setting some of it down.",
    primaryTone: valence > 30 ? "Uplifted" : valence < -30 ? "Heavy but honest" : "Reflective",
    valence,
    emotions: (emotions.length ? emotions : [{ name: "Reflective", hits: 1 }])
      .slice(0, 4)
      .map((e, i) => ({ name: e.name, intensity: Math.max(30, 85 - i * 15) })),
    themes: themes.length ? themes.slice(0, 4) : ["Daily life", "Self-awareness"],
    distortions: absolutes.map((w) => ({
      name: w.toLowerCase() === "should" ? "'Should' statements" : "All-or-nothing thinking",
      quote: w,
      explanation: "Absolute words can make a situation feel more fixed than it really is.",
    })),
    reframes: [
      {
        original: absolutes.length
          ? `Things ${absolutes[0]!.toLowerCase()} go wrong for me.`
          : "I should be doing better.",
        reframe: "Some things are hard right now, and I'm still showing up. That counts.",
      },
    ],
    strengths: ["Honesty with yourself", "Willingness to reflect"],
    nextStep:
      valence >= 0
        ? "Write down one thing you'd like to repeat tomorrow."
        : "Take a 5-minute walk or try one round of 4-7-8 breathing before bed.",
  };
}
