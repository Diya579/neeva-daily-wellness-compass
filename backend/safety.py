"""
Deterministic 3-Tier Safety Gatekeeper (/backend/safety.py)
- Sub-3.2ms Unicode NFKC normalization, zero-width stripping, leetspeak de-obfuscation,
  and elongated character collapsing ("khaaataaam" -> "khatam")
- Bounded Levenshtein distance matching across 8 Indian languages
  (en-IN, Hinglish, hi-IN, gu-IN, mr-IN, bn-IN, ta-IN, te-IN)
- Tier-3 Hard Circuit Breaker: Halts execution before calling Gemini and returns
  Tele-MANAS (14416) & iCall (9152987821)
- Tier-2 Passive Distress State Machine: Forces crisisLevel=2 and suggestedAction="breathing"
"""

from __future__ import annotations

import re
import time
import unicodedata
from typing import Any

TIER3_HELPLINES: list[dict[str, str]] = [
    {"name": "Tele-MANAS", "number": "14416"},
    {"name": "iCall", "number": "9152987821"},
]

TIER3_CIRCUIT_BREAKER_REPLY = (
    "I am routing you to help. You matter, and you do not have to carry this alone. "
    "Please connect with Tele-MANAS (14416, 24x7 toll-free across 20 Indian languages) "
    "or iCall (9152987821) right now."
)

ZERO_WIDTH_RE = re.compile(r"[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]")
INTRA_WORD_OBFUSCATION_RE = re.compile(r"(?<=[a-zA-Z])[._*~\-](?=[a-zA-Z])")
ELONGATION_RE = re.compile(r"(.)\1{2,}")

LEET_MAP: dict[str, str] = {
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "@": "a",
    "$": "s",
}
LEET_ADJACENT_RE = re.compile(r"(?<=[a-z])[013457@$]|[013457@$](?=[a-z])")

HIGH_RISK_FUZZY_TOKENS: list[tuple[str, int]] = [
    ("suicide", 1),
    ("suicidal", 1),
    ("khudkushi", 2),
    ("atmahatya", 2),
    ("aatmahatya", 2),
    ("aapghat", 1),
    ("apghat", 1),
    ("thatkolai", 2),
    ("tharkolai", 2),
    ("overdose", 1),
    ("unalive", 1),
    ("chanipovali", 2),
    ("saaganum", 1),
]

BENIGN_OR_NEGATED_GUARDS: list[re.Pattern[str]] = [
    re.compile(
        r"\b(exam|assignment|deadline|traffic|heat|weather|workout|professor|lecture|syllabus|math|physics|coding|bug)\s+is\s+killing\s+me\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bkilling\s+me\s+(lol|lmao|haha|bro|yaar)\b", re.IGNORECASE),
    re.compile(
        r"\bdying\s+(of\s+laughter|laughing|to\s+see|to\s+meet|of\s+boredom|of\s+cringe)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(i\s+don'?t|do\s+not|never)\s+want\s+to\s+(die|kill\s+myself|hurt\s+myself|end\s+my\s+life)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bnot\s+(suicidal|going\s+to\s+kill\s+myself|thinking\s+of\s+self\s*harm)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(marna|marne)\s+nahi\s+(chahta|chahti|hai)\b", re.IGNORECASE),
]

TIER3_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "en_self_harm_direct",
        re.compile(
            r"\b(kill|killing|hurt|hurting|harm|harming|cut|cutting|end|ending)\s+(my\s*self|my\s+own\s+life)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "en_kms_unalive",
        re.compile(
            r"\b(kms|kys|unalive\s+myself|commit\s+suicide|suicid(e|al))\b",
            re.IGNORECASE,
        ),
    ),
    (
        "en_end_it_all",
        re.compile(
            r"\b(end(ing)?\s+(it\s+all|my\s+life|everything\s+tonight|this\s+life)|want\s+to\s+end\s+it)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "en_want_to_die",
        re.compile(
            r"\b(want|wanna|going|ready|plan(ning)?|wish\s+i\s+were|better\s+off)\s+to\s+die\b|\b(wanna|want\s+to|going\s+to)\s+die\b",
            re.IGNORECASE,
        ),
    ),
    (
        "en_better_off_dead",
        re.compile(
            r"\b(better\s+off\s+(dead|without\s+me)|world\s+is\s+better\s+without\s+me|no\s+reason\s+to\s+live|don'?t\s+want\s+to\s+(live|be\s+alive|exist|wake\s+up))\b",
            re.IGNORECASE,
        ),
    ),
    (
        "en_lethal_means",
        re.compile(
            r"\b(overdose|take\s+all\s+(these\s+|my\s+)?pills|jump\s+(off|from)\s+(the\s+)?(roof|terrace|building|bridge|balcony|train|metro)|hang\s+myself|slit\s+my\s+wrist|drink\s+poison|rat\s+poison|phenyl|fansi|phaansi|phansi)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "en_final_goodbye",
        re.compile(
            r"\b(writing\s+my\s+suicide\s+note|final\s+goodbye\s+to\s+everyone|last\s+night\s+on\s+earth|won'?t\s+be\s+here\s+tomorrow|nobody\s+will\s+miss\s+me\s+when\s+i'?m\s+gone)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "hi_latn_mar_jaana",
        re.compile(
            r"\b(ma+r)\s*(ja+n[ae]?|ja+u[n]?|jau|ja+ungi|ja+unga+|jana\s+hai|ja+ne\s+ka\s+mann)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "hi_latn_marna",
        re.compile(
            r"\b(ma+rn[ae])\s+(hai|chahta|chahti|ka\s+mann|ka\s+dil|hi\s+bacha|behtar\s+hai|chahunga|chahungi)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "hi_latn_jeena_nahi",
        re.compile(
            r"(je+n[ae]|jin[ae])\s*(na+hi|nai|nhi)|(je+n[ae]|jin[ae])\s*ka\s*(mann?|dil|kuch)\s*(na+hi|nai|nhi)",
            re.IGNORECASE,
        ),
    ),
    (
        "hi_latn_khatam",
        re.compile(
            r"\b(zindagi|life|khud\s*ko|apne\s+aap\s*ko|sab\s+kuch)\s*(khatam|khtm|maar|mar|end|finish)\s*(kar|kr|karna|krna|dunga|dungi|lu|loon|lena|lene)?\b",
            re.IGNORECASE,
        ),
    ),
    (
        "hi_latn_khatam_reverse",
        re.compile(
            r"\b(khatam|khtm)\s+(kar|kr)\s+(dunga|dungi|lena|lu|loon|raha|rahi)\s+(khud|zindagi|life|apne\s+aap)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "hi_latn_khudkushi",
        re.compile(
            r"\b(khud\s*kushi|khudkusi|a{1,2}tm[ao]h[ao]t(y|i)a|atmhathya|jaan\s+de\s*(dunga|dungi|dena|du)|apni\s+jaan\s+le)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "hi_latn_lethal_means",
        re.compile(
            r"\b(chhat\s+se\s+kood|terrace\s+se\s+kood|building\s+se\s+kood|zahar\s+kha|zeher\s+kha|neend\s+ki\s+goli(yan)?\s+kha|fansi\s+laga|phaansi\s+laga|phansi\s+laga|nas\s+kaat|nass\s+kaat|train\s+ke\s+aage)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "hi_latn_passive_death",
        re.compile(
            r"\b(so\s+jaun\s+aur\s+(?:subah\s+)?kabhi\s+na\s+uthu|subah\s+ankh\s+na\s+khule|mere\s+bina\s+sab\s+khush\s+rahenge|duniya\s+se\s+chale\s+jaana|hamesha\s+ke\s+liye\s+so\s+jaana)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "hi_deva_acute",
        re.compile(
            r"आत्महत्या|खुदकुशी|मरना\s*चाहत|मर\s*जाऊं|मर\s*जाना|जीना\s*नहीं|जीने\s*का\s*मन\s*नहीं|जिंदगी\s*खत्म|ज़िंदगी\s*खत्म|खुद\s*को\s*खत्म|जान\s*दे\s*दूं|फांसी\s*लगा|जहर\s*खा|छत\s*से\s*कूद"
        ),
    ),
    (
        "gu_latn_acute",
        re.compile(
            r"\b(mari\s+ja(v|w|a)?u(\s+chhe|\s+che)?|marvu\s+(chhe|che)|jivvu\s+(nathi|nai|nahi)|jeevvu\s+(nathi|nai|nahi)|jivu\s+nathi|aap\s*ghat|apghat|potani\s+jaat\s+ne\s+khatam|zindagi\s+tunki\s+karvi|dava\s+pivi\s+chhe|zahar\s+pivu|agasi\s+parthi\s+kudi)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "gu_native_acute",
        re.compile(
            r"આત્મહત્યા|આપઘાત|મરી\s*જવું|જીવવું\s*નથી|જીંદગી\s*ટૂંકાવી|ઝેર\s*પી|અગાસી\s*પરથી\s*કૂદી|પોતાની\s*જાતને\s*ખતમ"
        ),
    ),
    (
        "mr_latn_acute",
        re.compile(
            r"\b(mar(aych|aaych)(a|e|ay|ay\s+aahe)|marun\s+ja(ve|aave|aycha|aychay)|jag(aych|aaych)(a|e)\s+nahi|swatala\s+sampav|jeev\s+dyaycha\s+aahe|ayushya\s+sampav)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "mr_native_acute",
        re.compile(r"मरायचं|मरून\s*जावं|जगायचं\s*नाही|स्वतःला\s*संपव|जीव\s*द्यायचा"),
    ),
    (
        "bn_latn_acute",
        re.compile(
            r"\b(mor(e|te)\s+(jete\s+)?chai|bachte\s+chai\s+na|nijeke\s+shesh\s+kore|atmahatya\s+korbo|jibon\s+shesh)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "bn_native_acute",
        re.compile(r"আত্মহত্যা|মরে\s*যেতে\s*চাই|বাঁচতে\s*চাই\s*না|নিজেকে\s*শেষ"),
    ),
    (
        "ta_latn_acute",
        re.compile(
            r"\b(saaga(num|poren|poraen|venum)|sethu(dalam|duven|poganum|poyidalam|poren)|that?kolai|uyira\s+vidanum|vaazha\s+pidikkala)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "ta_native_acute",
        re.compile(r"தற்கொலை|சாகணும்|சாக\s*வேண்டும்|உயிரை\s*மாய்த்து|வாழ\s*பிடிக்கவில்லை"),
    ),
    (
        "te_latn_acute",
        re.compile(
            r"\b(chanipo(vali|thanu|tha|vaalanundi)|bratakali\s+ani\s+ledu|bratukalani\s+ledu|atmahatya\s+chesukunta|naa\s+pranam\s+teesukunta)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "te_native_acute",
        re.compile(r"ఆత్మహత్య|చనిపోవాలని\s*ఉంది|బ్రతకాలని\s*లేదు|ప్రాణం\s*తీసుకో"),
    ),
]

TIER2_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "en_passive_distress",
        re.compile(
            r"\b(can'?t\s+(take\s+this|cope|do\s+this|go\s+on|handle\s+it)\s+anymore|feel\s+(?:so\s+|completely\s+|totally\s+|really\s+|utterly\s+)?(worthless|hopeless|empty|broken|numb|trapped|like\s+a\s+burden|like\s+giving\s+up)|giving\s+up\s+on\s+everything|completely\s+burnt\s+out|panic\s+attack|can'?t\s+breathe)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "hi_latn_passive",
        re.compile(
            r"\b(ab\s+mujhse\s+(nahi|nhi|nai)\s+ho\s+raha|koi\s+fayda\s+(nahi|nhi)|sab\s+bekar\s+hai|bahut\s+akela\s+feel|bohot\s+ghutan\s+ho\s+rahi|haar\s+maan\s+li|himmat\s+toot\s+gayi|saans\s+nahi\s+aa\s+rahi)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "hi_deva_passive",
        re.compile(
            r"अब\s*मुझसे\s*नहीं\s*हो\s*रहा|कोई\s*फायदा\s*नहीं|हिम्मत\s*टूट\s*गई|बहुत\s*घुटन|बिल्कुल\s*अकेला"
        ),
    ),
    (
        "gu_passive",
        re.compile(
            r"\b(have\s+marathi\s+nathi\s+thatu|have\s+bas\s+thai\s+gayu|koi\s+samajhtu\s+nathi|himmat\s+khuti\s+gai|ghabrhat\s+thay\s+chhe)\b|હવે\s*મારાથી\s*નથી\s*થતું|કોઈ\s*સમજતું\s*નથી",
            re.IGNORECASE,
        ),
    ),
    (
        "mr_passive",
        re.compile(
            r"\b(aata\s+majhyane\s+hot\s+nahi|khup\s+ekta\s+watatay|sahan\s+hot\s+nahi)\b|आता\s*माझ्याने\s*होत\s*नाही",
            re.IGNORECASE,
        ),
    ),
    (
        "bn_passive",
        re.compile(
            r"\b(ami\s+aar\s+parchi\s+na|keu\s+bojhe\s+na|khub\s+eka\s+lagche)\b|আমি\s*আর\s*পারছি\s*না",
            re.IGNORECASE,
        ),
    ),
    (
        "ta_passive",
        re.compile(
            r"\b(ennala\s+mudiyala|yaarume\s+purinjikkala|romba\s+kashtama\s+irukku)\b|என்னால்\s*முடியவில்லை",
            re.IGNORECASE,
        ),
    ),
    (
        "te_passive",
        re.compile(
            r"\b(naa\s+valla\s+kavatledu|evaru\s+artham\s+chesukoru|chala\s+ontariga\s+undi)\b|నా\s*వల్ల\s*కావడం\s*లేదు",
            re.IGNORECASE,
        ),
    ),
]

TIER1_RE = re.compile(
    r"\b(exam|placement|interview|study|marks|cgpa|hostel|deadline|anxious|anxiety|stress|stressed|worried|worry|tired|insomnia|sleep|neend|tension|pressure|overwhelmed|parents|family)\b|पढ़ाई|प्रेशर|टेंशन|नींद|परीक्षा",
    re.IGNORECASE,
)


def normalize_for_safety_gate(raw: str) -> str:
    text = unicodedata.normalize("NFKC", raw or "")
    text = ZERO_WIDTH_RE.sub("", text)
    text = INTRA_WORD_OBFUSCATION_RE.sub("", text).lower()
    text = LEET_ADJACENT_RE.sub(lambda m: LEET_MAP.get(m.group(0), m.group(0)), text)
    text = ELONGATION_RE.sub(r"\1", text)
    text = re.sub(r"([aeiou])\1+\b", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def bounded_levenshtein(a: str, b: str, max_dist: int = 2) -> int:
    len_a, len_b = len(a), len(b)
    if abs(len_a - len_b) > max_dist:
        return max_dist + 1
    if a == b:
        return 0

    prev = list(range(len_b + 1))
    curr = [0] * (len_b + 1)
    for i in range(1, len_a + 1):
        curr[0] = i
        row_min = curr[0]
        ca = a[i - 1]
        for j in range(1, len_b + 1):
            cost = 0 if ca == b[j - 1] else 1
            val = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
            curr[j] = val
            if val < row_min:
                row_min = val
        if row_min > max_dist:
            return max_dist + 1
        prev[:] = curr[:]
    return prev[len_b]


def evaluate_safety_gate(raw_text: str) -> dict[str, Any]:
    start = time.perf_counter()
    normalized = normalize_for_safety_gate(raw_text)
    nfkc_raw = unicodedata.normalize("NFKC", raw_text or "")

    def finish(
        crisis_level: int,
        suggested_action: str,
        reply: str,
        reframe_question: str,
        halt_stream: bool,
        matched_rule: str | None,
    ) -> dict[str, Any]:
        latency_ms = round((time.perf_counter() - start) * 1000.0, 3)
        return {
            "crisisLevel": crisis_level,
            "suggestedAction": suggested_action,
            "reply": reply,
            "reframeQuestion": reframe_question,
            "haltStream": halt_stream,
            "helplines": TIER3_HELPLINES if crisis_level == 3 else [],
            "normalizedText": normalized,
            "matchedRule": matched_rule,
            "latencyMs": latency_ms,
        }

    if not normalized:
        return finish(0, "journal", "", "", False, None)

    is_benign_or_negated = any(g.search(normalized) for g in BENIGN_OR_NEGATED_GUARDS)

    if not is_benign_or_negated:
        for rule_id, pattern in TIER3_PATTERNS:
            if pattern.search(normalized) or pattern.search(nfkc_raw):
                return finish(3, "breathing", TIER3_CIRCUIT_BREAKER_REPLY, "", True, rule_id)

        tokens = [t for t in re.split(r"[^a-z0-9]+", normalized) if len(t) >= 5]
        for token in tokens:
            for target, max_dist in HIGH_RISK_FUZZY_TOKENS:
                if bounded_levenshtein(token, target, max_dist) <= max_dist:
                    return finish(
                        3,
                        "breathing",
                        TIER3_CIRCUIT_BREAKER_REPLY,
                        "",
                        True,
                        f"fuzzy_{target}",
                    )

    for rule_id, pattern in TIER2_PATTERNS:
        if pattern.search(normalized) or pattern.search(nfkc_raw):
            return finish(
                2,
                "breathing",
                (
                    "It sounds like you are carrying an overwhelming load right now. "
                    "Let's pause together and slow your nervous system down with one gentle "
                    "4-7-8 breathing cycle before we unpack anything else."
                ),
                "What is one expectation you can give yourself permission to set down for the next hour?",
                False,
                rule_id,
            )

    if TIER1_RE.search(normalized):
        is_sleep = bool(
            re.search(
                r"\b(sleep|insomnia|night|neend|thookam|nidra|ghum|oonghi|jhop)\b",
                normalized,
                re.IGNORECASE,
            )
        )
        return finish(
            1,
            "soundscape" if is_sleep else "journal",
            "",
            "What part of this pressure is within your control in the next 20 minutes?",
            False,
            "tier1_everyday_stress",
        )

    return finish(0, "journal", "", "", False, None)
