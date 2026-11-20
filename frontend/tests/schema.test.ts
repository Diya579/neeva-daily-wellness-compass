import { describe, expect, it } from "vitest";
import {
  TIER3_CIRCUIT_BREAKER_REPLY,
  validateGeminiStructuredResponse,
} from "@/lib/safetyGate";

describe("Phase 3 & 7 Gemini 2.5 Flash Strict 4-Field Schema Validator (`tests/schema.test.ts`)", () => {
  it("accepts a valid 4-field response and guarantees `crisisLevel` is the very first key", () => {
    const payload = {
      reply: "It sounds like exam pressure has been building up all week. Let's take it one subject at a time.",
      reframeQuestion: "What is one chapter you can spend just 20 focused minutes on tonight?",
      suggestedAction: "journal",
      crisisLevel: 1,
    };

    const validated = validateGeminiStructuredResponse(payload);
    expect(Object.keys(validated)).toEqual([
      "crisisLevel",
      "suggestedAction",
      "reply",
      "reframeQuestion",
    ]);
    expect(validated.crisisLevel).toBe(1);
    expect(validated.suggestedAction).toBe("journal");
  });

  it("forces suggestedAction to 'breathing' when crisisLevel is 2 (Passive Distress)", () => {
    const validated = validateGeminiStructuredResponse({
      crisisLevel: 2,
      suggestedAction: "journal",
      reply: "You are carrying so much right now. Let's slow your breathing down first.",
      reframeQuestion: "Can we pause for 60 seconds together?",
    });
    expect(validated.crisisLevel).toBe(2);
    expect(validated.suggestedAction).toBe("breathing");
  });

  it("overrides reply with deterministic helpline routing when crisisLevel is 3", () => {
    const validated = validateGeminiStructuredResponse({
      crisisLevel: 3,
      suggestedAction: "soundscape",
      reply: "Any model text",
      reframeQuestion: "Any question",
    });
    expect(validated.crisisLevel).toBe(3);
    expect(validated.suggestedAction).toBe("breathing");
    expect(validated.reply).toBe(TIER3_CIRCUIT_BREAKER_REPLY);
    expect(validated.reframeQuestion).toBe("");
  });

  it("strips prohibited clinical psychiatric diagnoses and medication prescriptions", () => {
    const validated = validateGeminiStructuredResponse({
      crisisLevel: 1,
      suggestedAction: "journal",
      reply: "You are diagnosed with major depressive disorder and should start taking fluoxetine 20mg daily.",
      reframeQuestion: "How have you been sleeping?",
    });
    expect(validated.reply).not.toContain("diagnosed with major depressive disorder");
    expect(validated.reply).not.toContain("fluoxetine");
    expect(validated.reply).toContain("cannot provide a medical diagnosis or medication advice");
  });

  it("rejects malformed payloads missing required fields or using out-of-range enums", () => {
    expect(() =>
      validateGeminiStructuredResponse({
        crisisLevel: 5,
        suggestedAction: "breathing",
        reply: "Hello",
        reframeQuestion: "",
      })
    ).toThrow(/Invalid crisisLevel/);

    expect(() =>
      validateGeminiStructuredResponse({
        crisisLevel: 1,
        suggestedAction: "invalid_tool",
        reply: "Hello",
        reframeQuestion: "",
      })
    ).toThrow(/Invalid suggestedAction/);

    expect(() =>
      validateGeminiStructuredResponse({
        crisisLevel: 1,
        suggestedAction: "breathing",
        reply: "   ",
        reframeQuestion: "",
      })
    ).toThrow(/Invalid reply/);
  });
});
