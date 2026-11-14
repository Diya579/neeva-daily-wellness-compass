// The person's own AI companion: name, vibe and reply style. Browser + server safe.
import type { LangCode } from "./neeva-data";

export type Vibe = "bestie" | "coach" | "sage" | "hype";
export type ReplyLength = "short" | "balanced" | "deep";
export type AvatarKey = "bloom" | "moon" | "wave" | "spark";

export type Companion = {
  name: string;
  vibe: Vibe;
  length: ReplyLength;
  avatar: AvatarKey;
  emoji: boolean;
};

export const DEFAULT_COMPANION: Companion = {
  name: "Neeva",
  vibe: "bestie",
  length: "balanced",
  avatar: "bloom",
  emoji: true,
};

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
    .replace(/[^\p{L}\p{M}\p{N} '\-]/gu, "")
    .replace(/\s+/g, " ")
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

export const welcomeFor = (lang: LangCode, name: string) => WELCOME[lang](name);
