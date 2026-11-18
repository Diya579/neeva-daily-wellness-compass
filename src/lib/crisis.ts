// Crisis-language detection and the quick safety check-in. Pure logic so it can be tested.

const PATTERNS: RegExp[] = [
  /\b(kill|killing|hurt|hurting|harm|harming|cut|cutting)\s+my\s*self\b/i,
  /\bkms\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend(ing)?\s+(it\s+all|my\s+life|everything)\b/i,
  /\b(want|wanna|going)\s+to\s+die\b/i,
  /\bwanna\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|exist|wake\s+up)\b/i,
  /\bno\s+(reason|point)\s+(to|in)\s+(live|living|go(ing)?\s+on)\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\bself[-\s]?harm\b/i,
  /\boverdose\b/i,
  /\bjump\s+off\b/i,
  /\bunalive\b/i,
  // Hindi — typed in English letters (Hinglish) or Devanagari
  /\bmar\s+(jaana?|jaun|jaaun|jau|jaungi|jaunga|jaungaa|jaaungi|jaaunga)\b/i,
  /\bmarna\s+(hai|chahta|chahti)\b/i,
  /\bmarne\s+ka\s+(mann?|dil)\b/i,
  /\b(jeena|jina)\s+nahi\b/i,
  /\b(jeene|jine)\s+ka\s+(mann?|dil)\s+nahi\b/i,
  /\bkhud\s*ko\s+(khatam|maar|mar)\b/i,
  /\bzindagi\s+khatam\s+kar\b/i,
  /\bkhudkushi\b/i,
  /\ba{1,2}tm[ao]h[ao]t(y|i)a\b/i,
  /आत्महत्या|मरना चाहत|मर जाऊं|जीना नहीं/,
  // Gujarati — Gujlish or Gujarati script
  /\bmari\s+ja(v|w|a)u\b/i,
  /\bmarvu\s+(chhe|che|chhe\s+mare)\b/i,
  /\b(jivvu|jeevvu|jivu|jeevu)\s+(nathi|nai|nahi)\b/i,
  /\baap\s*ghat\b/i,
  /આત્મહત્યા|આપઘાત|મરી જવું|જીવવું નથી/,
  // Marathi — Minglish or Devanagari
  /\bmar(aych|aaych)(a|e|ay|ay\s+aahe)\b/i,
  /\bmarun\s+ja(ve|aave|aycha|aychay)\b/i,
  /\bjag(aych|aaych)(a|e)\s+nahi\b/i,
  /मरायचं|मरून जावं|जगायचं नाही/,
  // Tamil — Tanglish or Tamil script
  /\bsaaga(num|poren|poraen|venum)\b/i,
  /\bsethu(dalam|duven|poganum|poyidalam)\b/i,
  /\bthat?kolai\b/i,
  /தற்கொலை|சாகணும்|சாக வேண்டும்/,
  // Bengali — Banglish or Bengali script
  /\bmor(e|te)\s+(jete\s+)?chai\b/i,
  /\bbachte\s+chai\s+na\b/i,
  /আত্মহত্যা|মরে যেতে চাই|বাঁচতে চাই না/,
];

/** True when the text contains language that suggests the person may be at risk. */
export function detectCrisis(text: string): boolean {
  const t = text.normalize("NFKC");
  return PATTERNS.some((p) => p.test(t));
}

export type SafeNow = "yes" | "unsure" | "no";
export type Thoughts = "no" | "sometimes" | "now";
export type Support = "yes" | "no";
export type SafetyAnswers = { safe: SafeNow; thoughts: Thoughts; support: Support };
export type SafetyLevel = "urgent" | "support" | "steady";

/**
 * urgent  → not safe, or thoughts of self-harm right now: call a helpline / 112 immediately.
 * support → unsure, passing thoughts, or nobody to reach: helplines + grounding + reach out.
 * steady  → safe, no thoughts, has someone: grounding and gentle next steps.
 */
export function assessSafety(a: SafetyAnswers): SafetyLevel {
  if (a.safe === "no" || a.thoughts === "now") return "urgent";
  if (a.safe === "unsure" || a.thoughts === "sometimes" || a.support === "no") return "support";
  return "steady";
}
