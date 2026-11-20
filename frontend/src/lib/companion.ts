// The person's own AI companion: name, vibe and reply style. Browser + server safe.
import type { LangCode, ScriptStyle } from "./neeva-data";

export type Vibe = "bestie" | "coach" | "sage" | "hype";
export type ReplyLength = "short" | "balanced" | "deep";
export type AvatarKey = "bloom" | "moon" | "wave" | "spark";
export type Approach = "validate" | "advise" | "mix" | "explore";
export type Tone = "gentle" | "honest" | "playful";

export type Companion = {
  name: string;
  vibe: Vibe;
  length: ReplyLength;
  avatar: AvatarKey;
  emoji: boolean;
  approach: Approach;
  tone: Tone;
  /** Free-text notes the person wants the companion to remember (max 200 chars). */
  notes: string;
};

export const DEFAULT_COMPANION: Companion = {
  name: "Neeva",
  vibe: "bestie",
  length: "balanced",
  avatar: "bloom",
  emoji: true,
  approach: "mix",
  tone: "gentle",
  notes: "",
};

export const APPROACHES: { key: Approach; label: string; line: string; sample: string }[] = [
  { key: "validate", label: "Just listen", line: "Validation first. No fixing unless I ask.", sample: "That sounds really heavy, and it makes total sense you feel this way. I'm here — tell me more." },
  { key: "advise", label: "Give me advice", line: "Practical tips and next steps, please.", sample: "Okay, let's make it smaller: pick one task, set a 15-min timer, and text me when it's done." },
  { key: "mix", label: "A bit of both", line: "Hear me out, then help me move.", sample: "That's a lot to carry. When you're ready, want to try one tiny thing that might help tonight?" },
  { key: "explore", label: "Help me think", line: "Ask questions so I figure it out myself.", sample: "What part of this feels the most true to you — and what part might be the worry talking?" },
];

export const TONES: { key: Tone; label: string; line: string }[] = [
  { key: "gentle", label: "Gentle", line: "Soft and careful with my feelings" },
  { key: "honest", label: "Straight-up", line: "Kind but direct — no sugar-coating" },
  { key: "playful", label: "Playful", line: "Light, a little funny when it fits" },
];

export const NOTES_MAX = 200;

/** Clean free-text notes: single line, no braces/angle brackets, max 200 chars. */
export function sanitizeNotes(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/[{}<>`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NOTES_MAX)
    .trim();
}

export const VIBES: { key: Vibe; label: string; line: string; sample: string }[] = [
  {
    key: "bestie",
    label: "Soft bestie",
    line: "Warm, validating, talks like a close friend",
    sample: "ugh, that sounds genuinely exhausting. wanna unpack it together?",
  },
  {
    key: "coach",
    label: "Calm coach",
    line: "Structured, practical, small next steps",
    sample: "Let's break this down. What's the one part that feels heaviest?",
  },
  {
    key: "sage",
    label: "Wise elder",
    line: "Slow, reflective, gentle perspective",
    sample: "Some days ask only that we get through them. That is enough.",
  },
  {
    key: "hype",
    label: "Hype friend",
    line: "Upbeat, energising, celebrates every win",
    sample: "Okay but you showing up today? That's a W. Let's build on it.",
  },
];

export const LENGTHS: { key: ReplyLength; label: string; hint: string }[] = [
  { key: "short", label: "Quick", hint: "2–3 lines" },
  { key: "balanced", label: "Balanced", hint: "A few short paras" },
  { key: "deep", label: "Deep dive", hint: "Thorough + exercises" },
];

export const AVATARS: AvatarKey[] = ["bloom", "moon", "wave", "spark"];

export const NAME_IDEAS = ["Neeva", "Mitra", "Saathi", "Juno", "Kiki", "Sukoon", "Tara", "Rumi"];

/** Clean a user-chosen companion name: letters, numbers, spaces, - and ', max 24 chars. */
export function sanitizeCompanionName(raw: string): string {
  const cleaned = raw
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{M}\p{N} '\-]/gu, "")
    .replace(/ +/g, " ")
    .trim()
    .slice(0, 24)
    .trim();
  return cleaned || DEFAULT_COMPANION.name;
}

const WELCOME: Record<LangCode, (n: string) => string> = {
  en: (n) =>
    `Hey, I'm **${n}**. This is your space — no rush, no judgement, no wrong thing to say.\n\nWhat's actually on your mind right now?`,
  hi: (n) =>
    `हाय, मैं **${n}** हूँ। यह आपकी जगह है — कोई जल्दी नहीं, कोई जजमेंट नहीं।\n\nअभी सच में आपके मन में क्या चल रहा है?`,
  gu: (n) =>
    `હાય, હું **${n}** છું. આ તમારી જગ્યા છે — કોઈ ઉતાવળ નથી, કોઈ જજમેન્ટ નથી.\n\nઅત્યારે ખરેખર તમારા મનમાં શું ચાલે છે?`,
  ta: (n) =>
    `ஹாய், நான் **${n}**. இது உங்கள் இடம் — அவசரம் இல்லை, தீர்ப்பு இல்லை.\n\nஇப்போது உண்மையில் உங்கள் மனதில் என்ன ஓடுகிறது?`,
  mr: (n) =>
    `हाय, मी **${n}** आहे. ही तुमची जागा आहे — घाई नाही, जजमेंट नाही.\n\nआत्ता खरंच तुमच्या मनात काय चाललंय?`,
  bn: (n) =>
    `হাই, আমি **${n}**। এটা তোমার জায়গা — কোনো তাড়া নেই, কোনো বিচার নেই।\n\nএই মুহূর্তে সত্যি তোমার মনে কী চলছে?`,
};

// How young people actually type these languages: English letters, English words mixed in.
const WELCOME_ROMAN: Record<Exclude<LangCode, "en">, (n: string) => string> = {
  hi: (n) =>
    `Hey, main **${n}** hoon. Yeh tumhari space hai — koi jaldi nahi, koi judgement nahi.\n\nSach batao, abhi mann mein kya chal raha hai?`,
  gu: (n) =>
    `Hey, hu **${n}** chhu. Aa taari space chhe — koi utaval nai, koi judgement nai.\n\nSaachu kahe, atyare mann ma shu chale chhe?`,
  ta: (n) =>
    `Hey, naan **${n}**. Idhu unga space — avasaram illa, judgement illa.\n\nUnmaiya sollunga, ippo manasula enna odittu irukku?`,
  mr: (n) =>
    `Hey, mi **${n}**. Hi tujhi space aahe — ghai nahi, judgement nahi.\n\nKhara saang, aatta manaat kay chaalu aahe?`,
  bn: (n) =>
    `Hey, ami **${n}**. Eta tomar space — kono taara nei, kono judgement nei.\n\nSotyi bolo, ekhon mone ki cholche?`,
};

/** Welcome line. "auto" starts in English letters — that's how most people text — then the companion mirrors them. */
export const welcomeFor = (lang: LangCode, name: string, script: ScriptStyle = "auto") =>
  lang === "en" || script === "native" ? WELCOME[lang](name) : WELCOME_ROMAN[lang](name);
