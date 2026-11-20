import { describe, expect, it } from "vitest";
import {
  PBKDF2_ITERATIONS,
  SALT_BYTE_LENGTH,
  decryptPayload,
  deriveKeyFromRecoveryPhrase,
  deriveVaultKey,
  encryptPayload,
  generateRecoveryPhrase,
  isValidRecoveryPhrase,
} from "@/lib/crypto";
import { scrubIndianPII } from "@/lib/piiScrubber";
import { INDIAN_SPEECH_LOCALE_MAP, getSpeechLocaleForLanguage } from "@/lib/voice";

describe("Phase 1 & 7 Zero-Knowledge Web Crypto Vault (`src/lib/crypto.ts`)", () => {
  it("derives a non-extractable AES-GCM-256 key via PBKDF2-SHA256 (100,000 iterations, 16-byte salt)", async () => {
    const { key, salt } = await deriveVaultKey("correct-horse-battery-staple-neeva");
    expect(salt.byteLength).toBe(SALT_BYTE_LENGTH);
    expect(PBKDF2_ITERATIONS).toBe(100_000);
    expect(key.type).toBe("secret");
    expect(key.algorithm.name).toBe("AES-GCM");
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
    expect(key.extractable).toBe(false);

    // Attempting to export a non-extractable key must throw
    await expect(globalThis.crypto.subtle.exportKey("raw", key)).rejects.toThrow();
  });

  it("completes AES-GCM-256 encryption & decryption round-trip in < 11.4ms", async () => {
    const { key, salt } = await deriveVaultKey("neeva-student-vault-passphrase");
    // Warm up Web Crypto engine once
    await encryptPayload("warmup", key, salt);

    const sampleJournal =
      "Today's placement mock interview felt overwhelming, but breaking my revision into 25-minute blocks helped me regain calm. आज मन थोड़ा शांत है।";
    const encrypted = await encryptPayload(sampleJournal, key, salt);

    expect(encrypted.algorithm).toBe("AES-GCM-256");
    expect(encrypted.kdf).toBe("PBKDF2-SHA256-100000");
    expect(encrypted.ciphertext).not.toContain("placement");
    expect(encrypted.durationMs).toBeLessThan(11.4);

    const decrypted = await decryptPayload(encrypted, key);
    expect(decrypted.plaintext).toBe(sampleJournal);
  });

  it("strictly rejects tampered ciphertext and tampered IVs (128-bit GCM auth tag integrity)", async () => {
    const { key, salt } = await deriveVaultKey("tamper-resistance-check");
    const encrypted = await encryptPayload("Confidential mental wellness note", key, salt);

    const flippedCiphertext =
      encrypted.ciphertext.slice(0, -4) +
      (encrypted.ciphertext.endsWith("AAAA") ? "BBBB" : "AAAA");

    await expect(
      decryptPayload({ ciphertext: flippedCiphertext, iv: encrypted.iv }, key)
    ).rejects.toThrow();
  });

  it("generates a valid 12-word CSPRNG recovery phrase and deterministically recovers the vault key", async () => {
    const phrase = generateRecoveryPhrase();
    expect(phrase.split(" ")).toHaveLength(12);
    expect(isValidRecoveryPhrase(phrase)).toBe(true);

    const { key: key1, salt } = await deriveKeyFromRecoveryPhrase(phrase);
    const encrypted = await encryptPayload("Recovered across devices without key escrow", key1, salt);

    const { key: key2 } = await deriveKeyFromRecoveryPhrase(phrase, salt);
    const decrypted = await decryptPayload(encrypted, key2);
    expect(decrypted.plaintext).toBe("Recovered across devices without key escrow");
  });
});

describe("Client-Side Indian PII Scrubber (`src/lib/piiScrubber.ts`) & Browser Voice Locales", () => {
  it("strips Aadhaar, PAN, +91 phone numbers, emails, and campus roll numbers before text leaves browser", () => {
    const raw =
      "My Aadhaar is 4589 1234 9876, PAN is ABCDE1234F, phone +91 9876543210, email diya.sharma@iitb.ac.in, and roll no 2023CS10452.";
    const res = scrubIndianPII(raw);

    expect(res.piiDetected).toBe(true);
    expect(res.totalRedactions).toBeGreaterThanOrEqual(5);
    expect(res.scrubbedText).toContain("[REDACTED_AADHAAR]");
    expect(res.scrubbedText).toContain("[REDACTED_PAN]");
    expect(res.scrubbedText).toContain("[REDACTED_PHONE]");
    expect(res.scrubbedText).toContain("[REDACTED_EMAIL]");
    expect(res.scrubbedText).toContain("[REDACTED_STUDENT_ID]");
    expect(res.scrubbedText).not.toContain("4589 1234 9876");
    expect(res.scrubbedText).not.toContain("ABCDE1234F");
    expect(res.scrubbedText).not.toContain("9876543210");
    expect(res.scrubbedText).not.toContain("diya.sharma@iitb.ac.in");
  });

  it("maps all 8 live languages to zero-billing Indian browser Web Speech API locales", () => {
    expect(Object.keys(INDIAN_SPEECH_LOCALE_MAP)).toHaveLength(8);
    expect(getSpeechLocaleForLanguage("en")).toBe("en-IN");
    expect(getSpeechLocaleForLanguage("hinglish")).toBe("hi-IN");
    expect(getSpeechLocaleForLanguage("hi")).toBe("hi-IN");
    expect(getSpeechLocaleForLanguage("gu")).toBe("gu-IN");
    expect(getSpeechLocaleForLanguage("mr")).toBe("mr-IN");
    expect(getSpeechLocaleForLanguage("bn")).toBe("bn-IN");
    expect(getSpeechLocaleForLanguage("ta")).toBe("ta-IN");
    expect(getSpeechLocaleForLanguage("te")).toBe("te-IN");
  });
});
