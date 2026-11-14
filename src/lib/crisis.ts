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
  // Hinglish / Hindi
  /\bmar\s+jaana?\b/i,
  /\bmarna\s+(hai|chahta|chahti)\b/i,
  /\bjeena\s+nahi\b/i,
  /\bkhudkushi\b/i,
  /\baatmahatya\b/i,
  /आत्महत्या|मरना चाहत|जीना नहीं/,
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
