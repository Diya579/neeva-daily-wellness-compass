// Crisis-language detection and the quick safety check-in. Delegated to the deterministic 3-tier safetyGate.
import { evaluateSafetyGate } from "./safetyGate";

/** True when the text contains language that suggests the person may be at acute risk (Tier 3). */
export function detectCrisis(text: string): boolean {
  return evaluateSafetyGate(text).crisisLevel === 3;
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
