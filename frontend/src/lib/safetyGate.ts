/**
 * Deterministic 3-Tier Safety Gatekeeper (< 3.2ms Client Edge & Server Mirror)
 * - Unicode Normalization (NFKC) + Zero-Width Character Stripping
 * - Obfuscation & Leetspeak Normalization + Elongated Character Collapsing ("khaaataaam" -> "khatam")
 * - Bounded Levenshtein Distance Matching on High-Risk Multilingual Tokens
 * - Negation & Indian Academic/Figurative Slang Guards
 * - Tier-3 Hard Circuit Breaker: Halts LLM calls and routes to Tele-MANAS (14416) & iCall (9152987821)
 * - Tier-2 Passive Distress State Machine: Forces suggestedAction = "breathing" (4-7-8 pacer)
 */

export type CrisisLevel = 0 | 1 | 2 | 3;
export type SuggestedAction = "breathing" | "journal" | "soundscape";

export interface SafetyHelpline {
  name: string;
  number: string;
}

export interface SafetyGateResult {
  crisisLevel: CrisisLevel;
  suggestedAction: SuggestedAction;
  reply: string;
  reframeQuestion: string;
  haltStream: boolean;
  helplines: SafetyHelpline[];
  normalizedText: string;
  matchedRule: string | null;
  latencyMs: number;
}

export const TIER3_HELPLINES: SafetyHelpline[] = [
  { name: "Tele-MANAS", number: "14416" },
  { name: "iCall", number: "9152987821" },
];

export const TIER3_CIRCUIT_BREAKER_REPLY =
  "I am routing you to help. You matter, and you do not have to carry this alone. Please connect with Tele-MANAS (14416, 24x7 toll-free across 20 Indian languages) or iCall (9152987821) right now.";

// Zero-width and invisible formatting characters
const ZERO_WIDTH_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g;

// Obfuscation separators inserted inside ASCII words (e.g., s.u.i.c.i.d.e, k-h-a-t-a-m, m_a_r)
const INTRA_WORD_OBFUSCATION_REGEX = /(?<=[a-zA-Z])[._*~\-](?=[a-zA-Z])/g;

// Common leetspeak substitutions used to evade filters
const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
};

/**
 * Normalize text with NFKC, strip zero-width chars, collapse character elongations
 * (e.g. "khaaataaam" -> "khatam", "maaaar" -> "mar"), and de-obfuscate leetspeak.
 */
export function normalizeForSafetyGate(raw: string): string {
  let text = raw
    .normalize("NFKC")
    .replace(ZERO_WIDTH_REGEX, "")
    .replace(INTRA_WORD_OBFUSCATION_REGEX, "")
    .toLowerCase();

  // Replace leetspeak characters when adjacent to Latin letters
  text = text.replace(/(?<=[a-z])[013457@$]|[013457@$](?=[a-z])/g, (ch) => LEET_MAP[ch] ?? ch);

  // Collapse 3+ repeated characters to a single character ("khaaataaam" -> "khatam", "suiiiciiide" -> "suicide")
  text = text.replace(/(.)\1{2,}/g, "$1");

  // Collapse trailing doubled vowels on words ("khudkushii" -> "khudkushi", "atmahatyaa" -> "atmahatya", "unalivee" -> "unalive")
  text = text.replace(/([aeiou])\1+\b/g, "$1");

  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/**
 * Fast bounded Levenshtein distance with early exit when distance > maxDist.
 */
export function boundedLevenshtein(a: string, b: string, maxDist: number = 2): number {
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;
  if (a === b) return 0;

  const prev = new Uint16Array(lenB + 1);
  const curr = new Uint16Array(lenB + 1);
  for (let j = 0; j <= lenB; j++) prev[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const charA = a.charCodeAt(i - 1);
    for (let j = 1; j <= lenB; j++) {
      const cost = charA === b.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let j = 0; j <= lenB; j++) prev[j] = curr[j]!;
  }
  return prev[lenB]!;
}

// High-risk single tokens where a typo/evasion within Levenshtein distance <= 1 (or <= 2 for 8+ char words) triggers Tier 3
const HIGH_RISK_FUZZY_TOKENS: { token: string; maxDist: number }[] = [
  { token: "suicide", maxDist: 1 },
  { token: "suicidal", maxDist: 1 },
  { token: "khudkushi", maxDist: 2 },
  { token: "atmahatya", maxDist: 2 },
  { token: "aatmahatya", maxDist: 2 },
  { token: "aapghat", maxDist: 1 },
  { token: "apghat", maxDist: 1 },
  { token: "thatkolai", maxDist: 2 },
  { token: "tharkolai", maxDist: 2 },
  { token: "overdose", maxDist: 1 },
  { token: "unalive", maxDist: 1 },
  { token: "chanipovali", maxDist: 2 },
  { token: "saaganum", maxDist: 1 },
];

// Idiomatic / academic slang & explicit negation guards (prevents false positives on benign venting)
const BENIGN_OR_NEGATED_GUARDS: RegExp[] = [
  /\b(exam|assignment|deadline|traffic|heat|weather|workout|professor|lecture|syllabus|math|physics|coding|bug)\s+is\s+killing\s+me\b/i,
  /\bkilling\s+me\s+(lol|lmao|haha|bro|yaar)\b/i,
  /\bdying\s+(of\s+laughter|laughing|to\s+see|to\s+meet|of\s+boredom|of\s+cringe)\b/i,
  /\b(i\s+don'?t|do\s+not|never)\s+want\s+to\s+(die|kill\s+myself|hurt\s+myself|end\s+my\s+life)\b/i,
  /\bnot\s+(suicidal|going\s+to\s+kill\s+myself|thinking\s+of\s+self\s*harm)\b/i,
  /\b(marna|marne)\s+nahi\s+(chahta|chahti|hai)\b/i,
];

// Tier-3 Acute Crisis Patterns across all 8 Indian languages (English, Hinglish, Hindi, Gujarati, Marathi, Bengali, Tamil, Telugu)
const TIER3_PATTERNS: { id: string; pattern: RegExp }[] = [
  // English explicit & implicit self-harm
  { id: "en_self_harm_direct", pattern: /\b(kill|killing|hurt|hurting|harm|harming|cut|cutting|end|ending)\s+(my\s*self|my\s+own\s+life)\b/i },
  { id: "en_kms_unalive", pattern: /\b(kms|kys|unalive\s+myself|commit\s+suicide|suicid(e|al))\b/i },
  { id: "en_end_it_all", pattern: /\b(end(ing)?\s+(it\s+all|my\s+life|everything\s+tonight|this\s+life)|want\s+to\s+end\s+it)\b/i },
  { id: "en_want_to_die", pattern: /\b(want|wanna|going|ready|plan(ning)?|wish\s+i\s+were|better\s+off)\s+to\s+die\b|\b(wanna|want\s+to|going\s+to)\s+die\b/i },
  { id: "en_better_off_dead", pattern: /\b(better\s+off\s+(dead|without\s+me)|world\s+is\s+better\s+without\s+me|no\s+reason\s+to\s+live|don'?t\s+want\s+to\s+(live|be\s+alive|exist|wake\s+up))\b/i },
  { id: "en_lethal_means", pattern: /\b(overdose|take\s+all\s+(these\s+|my\s+)?pills|jump\s+(off|from)\s+(the\s+)?(roof|terrace|building|bridge|balcony|train|metro)|hang\s+myself|slit\s+my\s+wrist|drink\s+poison|rat\s+poison|phenyl|fansi|phaansi|phansi)\b/i },
  { id: "en_final_goodbye", pattern: /\b(writing\s+my\s+suicide\s+note|final\s+goodbye\s+to\s+everyone|last\s+night\s+on\s+earth|won'?t\s+be\s+here\s+tomorrow|nobody\s+will\s+miss\s+me\s+when\s+i'?m\s+gone)\b/i },

  // Hinglish / Roman Hindi
  { id: "hi_latn_mar_jaana", pattern: /\b(ma+r)\s*(ja+n[ae]?|ja+u[n]?|jau|ja+ungi|ja+unga+|jana\s+hai|ja+ne\s+ka\s+mann)\b/i },
  { id: "hi_latn_marna", pattern: /\b(ma+rn[ae])\s+(hai|chahta|chahti|ka\s+mann|ka\s+dil|hi\s+bacha|behtar\s+hai|chahunga|chahungi)\b/i },
  { id: "hi_latn_jeena_nahi", pattern: /(je+n[ae]|jin[ae])\s*(na+hi|nai|nhi)|(je+n[ae]|jin[ae])\s*ka\s*(mann?|dil|kuch)\s*(na+hi|nai|nhi)/i },
  { id: "hi_latn_khatam", pattern: /\b(zindagi|life|khud\s*ko|apne\s+aap\s*ko|sab\s+kuch)\s*(khatam|khtm|maar|mar|end|finish)\s*(kar|kr|karna|krna|dunga|dungi|lu|loon|lena|lene)?\b/i },
  { id: "hi_latn_khatam_reverse", pattern: /\b(khatam|khtm)\s+(kar|kr)\s+(dunga|dungi|lena|lu|loon|raha|rahi)\s+(khud|zindagi|life|apne\s+aap)\b/i },
  { id: "hi_latn_khudkushi", pattern: /\b(khud\s*kushi|khudkusi|a{1,2}tm[ao]h[ao]t(y|i)a|atmhathya|jaan\s+de\s*(dunga|dungi|dena|du)|apni\s+jaan\s+le)\b/i },
  { id: "hi_latn_lethal_means", pattern: /\b(chhat\s+se\s+kood|terrace\s+se\s+kood|building\s+se\s+kood|zahar\s+kha|zeher\s+kha|neend\s+ki\s+goli(yan)?\s+kha|fansi\s+laga|phaansi\s+laga|phansi\s+laga|nas\s+kaat|nass\s+kaat|train\s+ke\s+aage)\b/i },
  { id: "hi_latn_passive_death", pattern: /\b(so\s+jaun\s+aur\s+(?:subah\s+)?kabhi\s+na\s+uthu|subah\s+ankh\s+na\s+khule|mere\s+bina\s+sab\s+khush\s+rahenge|duniya\s+se\s+chale\s+jaana|hamesha\s+ke\s+liye\s+so\s+jaana)\b/i },

  // Hindi Devanagari
  { id: "hi_deva_acute", pattern: /आत्महत्या|खुदकुशी|मरना\s*चाहत|मर\s*जाऊं|मर\s*जाना|जीना\s*नहीं|जीने\s*का\s*मन\s*नहीं|जिंदगी\s*खत्म|ज़िंदगी\s*खत्म|खुद\s*को\s*खत्म|जान\s*दे\s*दूं|फांसी\s*लगा|जहर\s*खा|छत\s*से\s*कूद/ },

  // Gujarati (Gujlish & Gujarati Script)
  { id: "gu_latn_acute", pattern: /\b(mari\s+ja(v|w|a)?u(\s+chhe|\s+che)?|marvu\s+(chhe|che)|jivvu\s+(nathi|nai|nahi)|jeevvu\s+(nathi|nai|nahi)|jivu\s+nathi|aap\s*ghat|apghat|potani\s+jaat\s+ne\s+khatam|zindagi\s+tunki\s+karvi|dava\s+pivi\s+chhe|zahar\s+pivu|agasi\s+parthi\s+kudi)\b/i },
  { id: "gu_native_acute", pattern: /આત્મહત્યા|આપઘાત|મરી\s*જવું|જીવવું\s*નથી|જીંદગી\s*ટૂંકાવી|ઝેર\s*પી|અગાસી\s*પરથી\s*કૂદી|પોતાની\s*જાતને\s*ખતમ/ },

  // Marathi (Minglish & Devanagari)
  { id: "mr_latn_acute", pattern: /\b(mar(aych|aaych)(a|e|ay|ay\s+aahe)|marun\s+ja(ve|aave|aycha|aychay)|jag(aych|aaych)(a|e)\s+nahi|swatala\s+sampav|jeev\s+dyaycha\s+aahe|ayushya\s+sampav)\b/i },
  { id: "mr_native_acute", pattern: /मरायचं|मरून\s*जावं|जगायचं\s*नाही|स्वतःला\s*संपव|जीव\s*द्यायचा/ },

  // Bengali (Banglish & Bengali Script)
  { id: "bn_latn_acute", pattern: /\b(mor(e|te)\s+(jete\s+)?chai|bachte\s+chai\s+na|nijeke\s+shesh\s+kore|atmahatya\s+korbo|jibon\s+shesh)\b/i },
  { id: "bn_native_acute", pattern: /আত্মহত্যা|মরে\s*যেতে\s*চাই|বাঁচতে\s*চাই\s*না|নিজেকে\s*শেষ/ },

  // Tamil (Tanglish & Tamil Script)
  { id: "ta_latn_acute", pattern: /\b(saaga(num|poren|poraen|venum)|sethu(dalam|duven|poganum|poyidalam|poren)|that?kolai|uyira\s+vidanum|vaazha\s+pidikkala)\b/i },
  { id: "ta_native_acute", pattern: /தற்கொலை|சாகணும்|சாக\s*வேண்டும்|உயிரை\s*மாய்த்து|வாழ\s*பிடிக்கவில்லை/ },

  // Telugu (Tenglish & Telugu Script)
  { id: "te_latn_acute", pattern: /\b(chanipo(vali|thanu|tha|vaalanundi)|bratakali\s+ani\s+ledu|bratukalani\s+ledu|atmahatya\s+chesukunta|naa\s+pranam\s+teesukunta)\b/i },
  { id: "te_native_acute", pattern: /ఆత్మహత్య|చనిపోవాలని\s*ఉంది|బ్రతకాలని\s*లేదు|ప్రాణం\s*తీసుకో/ },
];

// Tier-2 Passive Distress / Exhaustion / Burnout Patterns across all 8 Indian languages
const TIER2_PATTERNS: { id: string; pattern: RegExp }[] = [
  { id: "en_passive_distress", pattern: /\b(can'?t\s+(take\s+this|cope|do\s+this|go\s+on|handle\s+it)\s+anymore|feel\s+(?:so\s+|completely\s+|totally\s+|really\s+|utterly\s+)?(worthless|hopeless|empty|broken|numb|trapped|like\s+a\s+burden|like\s+giving\s+up)|giving\s+up\s+on\s+everything|completely\s+burnt\s+out|panic\s+attack|can'?t\s+breathe)\b/i },
  { id: "hi_latn_passive", pattern: /\b(ab\s+mujhse\s+(nahi|nhi|nai)\s+ho\s+raha|koi\s+fayda\s+(nahi|nhi)|sab\s+bekar\s+hai|bahut\s+akela\s+feel|bohot\s+ghutan\s+ho\s+rahi|haar\s+maan\s+li|himmat\s+toot\s+gayi|saans\s+nahi\s+aa\s+rahi)\b/i },
  { id: "hi_deva_passive", pattern: /अब\s*मुझसे\s*नहीं\s*हो\s*रहा|कोई\s*फायदा\s*नहीं|हिम्मत\s*टूट\s*गई|बहुत\s*घुटन|बिल्कुल\s*अकेला/ },
  { id: "gu_passive", pattern: /\b(have\s+marathi\s+nathi\s+thatu|have\s+bas\s+thai\s+gayu|koi\s+samajhtu\s+nathi|himmat\s+khuti\s+gai|ghabrhat\s+thay\s+chhe)\b|હવે\s*મારાથી\s*નથી\s*થતું|કોઈ\s*સમજતું\s*નથી/i },
  { id: "mr_passive", pattern: /\b(aata\s+majhyane\s+hot\s+nahi|khup\s+ekta\s+watatay|sahan\s+hot\s+nahi)\b|आता\s*माझ्याने\s*होत\s*नाही/i },
  { id: "bn_passive", pattern: /\b(ami\s+aar\s+parchi\s+na|keu\s+bojhe\s+na|khub\s+eka\s+lagche)\b|আমি\s*আর\s*পারছি\s*না/i },
  { id: "ta_passive", pattern: /\b(ennala\s+mudiyala|yaarume\s+purinjikkala|romba\s+kashtama\s+irukku)\b|என்னால்\s*முடியவில்லை/i },
  { id: "te_passive", pattern: /\b(naa\s+valla\s+kavatledu|evaru\s+artham\s+chesukoru|chala\s+ontariga\s+undi)\b|నా\s*వల్ల\s*కావడం\s*లేదు/i },
];

// Tier-1 Academic / Career / Family / Sleep Stress Patterns
const TIER1_PATTERNS: RegExp[] = [
  /\b(exam|placement|interview|study|marks|cgpa|hostel|deadline|anxious|anxiety|stress|stressed|worried|worry|tired|insomnia|sleep|neend|tension|pressure|overwhelmed|parents|family)\b/i,
  /पढ़ाई|प्रेशर|टेंशन|नींद|परीक्षा/,
];

/**
 * Evaluate user input through the deterministic 3-Tier Safety Gatekeeper in < 3.2ms.
 */
export function evaluateSafetyGate(rawText: string): SafetyGateResult {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const normalizedText = normalizeForSafetyGate(rawText);

  const finish = (
    crisisLevel: CrisisLevel,
    suggestedAction: SuggestedAction,
    reply: string,
    reframeQuestion: string,
    haltStream: boolean,
    matchedRule: string | null
  ): SafetyGateResult => {
    const end = typeof performance !== "undefined" ? performance.now() : Date.now();
    return {
      crisisLevel,
      suggestedAction,
      reply,
      reframeQuestion,
      haltStream,
      helplines: crisisLevel === 3 ? TIER3_HELPLINES : [],
      normalizedText,
      matchedRule,
      latencyMs: Number((end - start).toFixed(3)),
    };
  };

  if (!normalizedText) {
    return finish(0, "journal", "", "", false, null);
  }

  // Check explicit negation or idiomatic academic slang guard first
  const isBenignSlangOrNegated = BENIGN_OR_NEGATED_GUARDS.some((g) => g.test(normalizedText));

  if (!isBenignSlangOrNegated) {
    // 1. Direct Regex Match for Tier-3 Acute Crisis
    for (const rule of TIER3_PATTERNS) {
      if (rule.pattern.test(normalizedText) || rule.pattern.test(rawText.normalize("NFKC"))) {
        return finish(3, "breathing", TIER3_CIRCUIT_BREAKER_REPLY, "", true, rule.id);
      }
    }

    // 2. Bounded Levenshtein Fuzzy Token Match for Tier-3 Evasion / Typos
    const tokens = normalizedText.split(/[^a-z0-9]+/).filter((t) => t.length >= 5);
    for (const token of tokens) {
      for (const target of HIGH_RISK_FUZZY_TOKENS) {
        if (boundedLevenshtein(token, target.token, target.maxDist) <= target.maxDist) {
          return finish(
            3,
            "breathing",
            TIER3_CIRCUIT_BREAKER_REPLY,
            "",
            true,
            `fuzzy_${target.token}`
          );
        }
      }
    }
  }

  // 3. Tier-2 Passive Distress / Severe Exhaustion State Machine
  for (const rule of TIER2_PATTERNS) {
    if (rule.pattern.test(normalizedText) || rule.pattern.test(rawText.normalize("NFKC"))) {
      return finish(
        2,
        "breathing",
        "It sounds like you are carrying an overwhelming load right now. Let's pause together and slow your nervous system down with one gentle 4-7-8 breathing cycle before we unpack anything else.",
        "What is one expectation you can give yourself permission to set down for the next hour?",
        false,
        rule.id
      );
    }
  }

  // 4. Tier-1 Everyday / Academic / Sleep Stress
  if (TIER1_PATTERNS.some((p) => p.test(normalizedText))) {
    const isSleep = /\b(sleep|insomnia|night|neend|thookam|nidra|ghum|oonghi|jhop)\b/i.test(normalizedText);
    return finish(
      1,
      isSleep ? "soundscape" : "journal",
      "",
      "What part of this pressure is within your control in the next 20 minutes?",
      false,
      "tier1_everyday_stress"
    );
  }

  // 5. Tier-0 Calm / General Reflection
  return finish(0, "journal", "", "", false, null);
}

// Pre-warm JIT for regex and bounded Levenshtein at module initialization so cold-start never exceeds 3.2ms
void evaluateSafetyGate("warmup token check");
void boundedLevenshtein("khudkushii", "khudkushi", 2);

// ============================================================================
// Clinical Guardrail Validator & Strict 4-Field Gemini Schema Enforcer
// ============================================================================

export interface GeminiStructuredResponse {
  crisisLevel: CrisisLevel;
  suggestedAction: SuggestedAction;
  reply: string;
  reframeQuestion: string;
}

const PROHIBITED_CLINICAL_PATTERNS: RegExp[] = [
  /\byou\s+(have|are\s+suffering\s+from|are\s+diagnosed\s+with)\s+(clinical\s+depression|major\s+depressive\s+disorder|bipolar\s+disorder|schizophrenia|borderline\s+personality|ptsd|generalized\s+anxiety\s+disorder)\b/i,
  /\b(prescribe|take\s+\d+\s*mg\s+of|start\s+taking\s+(ssri|fluoxetine|sertraline|escitalopram|alprazolam|xanax|clonazepam|lithium))\b/i,
];

/**
 * Strictly validate and sanitize a 4-field structured JSON response from Gemini 2.5 Flash.
 * Ensures `crisisLevel` is ordered first in the returned object and strips any prohibited clinical diagnosis.
 */
export function validateGeminiStructuredResponse(input: unknown): GeminiStructuredResponse {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid Gemini structured response: payload must be a JSON object.");
  }
  const obj = input as Record<string, unknown>;

  if (
    typeof obj["crisisLevel"] !== "number" ||
    !Number.isInteger(obj["crisisLevel"]) ||
    obj["crisisLevel"] < 0 ||
    obj["crisisLevel"] > 3
  ) {
    throw new Error("Invalid crisisLevel: must be an integer enum 0 | 1 | 2 | 3.");
  }

  const validActions: SuggestedAction[] = ["breathing", "journal", "soundscape"];
  if (
    typeof obj["suggestedAction"] !== "string" ||
    !validActions.includes(obj["suggestedAction"] as SuggestedAction)
  ) {
    throw new Error(
      'Invalid suggestedAction: must be one of "breathing" | "journal" | "soundscape".'
    );
  }

  if (typeof obj["reply"] !== "string" || obj["reply"].trim().length === 0) {
    throw new Error("Invalid reply: must be a non-empty string.");
  }

  if (typeof obj["reframeQuestion"] !== "string") {
    throw new Error("Invalid reframeQuestion: must be a string.");
  }

  const crisisLevel = obj["crisisLevel"] as CrisisLevel;
  // Force breathing action whenever crisisLevel is 2 or 3
  const suggestedAction: SuggestedAction =
    crisisLevel >= 2 ? "breathing" : (obj["suggestedAction"] as SuggestedAction);

  let reply = obj["reply"].trim();
  for (const pat of PROHIBITED_CLINICAL_PATTERNS) {
    if (pat.test(reply)) {
      reply =
        "I hear how heavy this feels. While I'm an AI wellness companion and cannot provide a medical diagnosis or medication advice, we can explore a gentle grounding or CBT reframing step together.";
      break;
    }
  }

  if (crisisLevel === 3) {
    return {
      crisisLevel: 3,
      suggestedAction: "breathing",
      reply: TIER3_CIRCUIT_BREAKER_REPLY,
      reframeQuestion: "",
    };
  }

  // Return with `crisisLevel` strictly ordered first
  return {
    crisisLevel,
    suggestedAction,
    reply,
    reframeQuestion: obj["reframeQuestion"].trim(),
  };
}
