import { describe, expect, it } from "vitest";
import { assessSafety, detectCrisis } from "./crisis";

describe("detectCrisis", () => {
  it("flags clear self-harm language", () => {
    expect(detectCrisis("honestly I want to die")).toBe(true);
    expect(detectCrisis("I keep thinking about suicide")).toBe(true);
    expect(detectCrisis("everyone would be better off without me")).toBe(true);
    expect(detectCrisis("mujhe ab jeena nahi hai")).toBe(true);
  });
  it("flags self-harm language typed in English letters across Indian languages", () => {
    expect(detectCrisis("bro sach mein mar jaun aisa lagta hai")).toBe(true); // Hinglish
    expect(detectCrisis("yaar mane have mari javu chhe")).toBe(true); // Gujlish
    expect(detectCrisis("mala marayche aahe")).toBe(true); // Marathi in English letters
    expect(detectCrisis("enaku saaganum pola irukku")).toBe(true); // Tanglish
    expect(detectCrisis("ami more jete chai")).toBe(true); // Banglish
  });
  it("flags the same in native scripts", () => {
    expect(detectCrisis("મારે મરી જવું છે")).toBe(true);
    expect(detectCrisis("আমি মরে যেতে চাই")).toBe(true);
  });
  it("does not flag everyday Gen Z venting in mixed languages", () => {
    expect(detectCrisis("Bro thak gayi hoon")).toBe(false);
    expect(detectCrisis("Ruk na ek call aa raha hai")).toBe(false);
    expect(detectCrisis("Yaar have chhe ne bas thai gyu")).toBe(false);
    expect(detectCrisis("Chal ne have, bau bhav nai kha")).toBe(false);
  });
  it("does not flag everyday stress", () => {
    expect(detectCrisis("this exam is killing me lol")).toBe(false);
    expect(detectCrisis("I'm so tired and burnt out from work")).toBe(false);
  });
});

describe("assessSafety", () => {
  it("is urgent when not safe right now", () => {
    expect(assessSafety({ safe: "no", thoughts: "no", support: "yes" })).toBe("urgent");
  });
  it("is urgent with thoughts of self-harm right now", () => {
    expect(assessSafety({ safe: "yes", thoughts: "now", support: "yes" })).toBe("urgent");
  });
  it("needs support when there is no one to reach", () => {
    expect(assessSafety({ safe: "yes", thoughts: "no", support: "no" })).toBe("support");
  });
  it("is steady when safe, no thoughts and supported", () => {
    expect(assessSafety({ safe: "yes", thoughts: "no", support: "yes" })).toBe("steady");
  });
});
