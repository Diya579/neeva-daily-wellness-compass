export type JournalAnalysis = {
  summary: string;
  primaryTone: string;
  valence: number; // -100 (heavy) .. 100 (uplifted)
  emotions: { name: string; intensity: number }[];
  themes: string[];
  distortions: { name: string; quote: string; explanation: string }[];
  reframes: { original: string; reframe: string }[];
  strengths: string[];
  nextStep: string;
};

export const JOURNAL_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "primaryTone",
    "valence",
    "emotions",
    "themes",
    "distortions",
    "reframes",
    "strengths",
    "nextStep",
  ],
  properties: {
    summary: {
      type: "string",
      description: "2 warm sentences reflecting the entry back to the writer, second person.",
    },
    primaryTone: {
      type: "string",
      description: "One or two words, e.g. 'Hopeful', 'Weary but determined'.",
    },
    valence: {
      type: "integer",
      description: "Overall emotional valence from -100 (very heavy) to 100 (very uplifted).",
    },
    emotions: {
      type: "array",
      description: "3 to 5 emotions detected, strongest first.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "intensity"],
        properties: {
          name: { type: "string" },
          intensity: { type: "integer", description: "0-100" },
        },
      },
    },
    themes: { type: "array", description: "2 to 4 short key themes.", items: { type: "string" } },
    distortions: {
      type: "array",
      description: "0 to 3 cognitive distortions present, with the exact phrase from the entry.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quote", "explanation"],
        properties: {
          name: { type: "string" },
          quote: { type: "string" },
          explanation: { type: "string" },
        },
      },
    },
    reframes: {
      type: "array",
      description: "1 to 3 CBT-style balanced reframes of difficult thoughts in the entry.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "reframe"],
        properties: { original: { type: "string" }, reframe: { type: "string" } },
      },
    },
    strengths: {
      type: "array",
      description: "1 to 3 strengths or values the writer showed.",
      items: { type: "string" },
    },
    nextStep: {
      type: "string",
      description: "One small, concrete, compassionate action for the next 24 hours.",
    },
  },
} as const;
