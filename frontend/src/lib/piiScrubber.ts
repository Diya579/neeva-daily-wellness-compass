/**
 * Client-Side Deterministic Indian PII Scrubber
 * Strips sensitive Indian identifiers before ANY text leaves the browser for the backend or LLM:
 * - Aadhaar (12-digit UIDAI format: \b\d{4}\s?\d{4}\s?\d{4}\b)
 * - PAN (Income Tax Permanent Account Number: \b[A-Z]{5}\d{4}[A-Z]\b)
 * - Indian Phone Numbers ((?:\+91|0)?[6-9]\d{9})
 * - Email Addresses
 * - Campus / University Student Roll Numbers & IDs
 */

export type IndianPIIType = "AADHAAR" | "PAN" | "PHONE" | "EMAIL" | "STUDENT_ID";

export interface PIIRedactionMatch {
  type: IndianPIIType;
  replacement: string;
  count: number;
}

export interface PIIScrubResult {
  scrubbedText: string;
  piiDetected: boolean;
  totalRedactions: number;
  redactions: PIIRedactionMatch[];
  durationMs: number;
}

const PII_RULES: { type: IndianPIIType; pattern: RegExp; replacement: string }[] = [
  {
    type: "EMAIL",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[REDACTED_EMAIL]",
  },
  {
    type: "PAN",
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/gi,
    replacement: "[REDACTED_PAN]",
  },
  {
    type: "AADHAAR",
    pattern: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: "[REDACTED_AADHAAR]",
  },
  {
    type: "PHONE",
    pattern: /(?:\+91[\s-]?)?(?:\b0)?[6-9]\d{9}\b/g,
    replacement: "[REDACTED_PHONE]",
  },
  {
    type: "STUDENT_ID",
    // Matches Indian university/IIT/NIT/BITS roll numbers (e.g., 2023CS10452, 21BCE1024, IITB2024019, ROLL-2024981)
    pattern: /\b(?:20\d{2}[A-Z]{2,5}\d{3,6}|\d{2}[A-Z]{2,5}\d{3,6}|(?:IIT|NIT|BITS|IIIT|ROLL|ID)[\s:-]*[A-Z0-9]{4,12})\b/gi,
    replacement: "[REDACTED_STUDENT_ID]",
  },
];

/**
 * Scrub Indian PII patterns on the client edge before sending text to any API.
 */
export function scrubIndianPII(input: string): PIIScrubResult {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  let scrubbedText = input.normalize("NFKC");
  const redactions: PIIRedactionMatch[] = [];
  let totalRedactions = 0;

  for (const rule of PII_RULES) {
    const matches = scrubbedText.match(rule.pattern);
    if (matches && matches.length > 0) {
      scrubbedText = scrubbedText.replace(rule.pattern, rule.replacement);
      redactions.push({
        type: rule.type,
        replacement: rule.replacement,
        count: matches.length,
      });
      totalRedactions += matches.length;
    }
  }

  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    scrubbedText,
    piiDetected: totalRedactions > 0,
    totalRedactions,
    redactions,
    durationMs: Number((end - start).toFixed(3)),
  };
}
