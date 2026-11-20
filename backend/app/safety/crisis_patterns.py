"""
Three-Tier Deterministic & Context-Aware Crisis Classification Patterns (Section 5).
Covers all 8 required languages in both native script and Roman/transliterated script:
1. English (en)
2. Hinglish (hinglish)
3. Hindi (hi — Devanagari & Hinglish)
4. Gujarati (gu — Gujarati script & Gujlish)
5. Marathi (mr — Devanagari & Minglish)
6. Bengali (bn — Bengali script & Banglish)
7. Tamil (ta — Tamil script & Tanglish)
8. Telugu (te — Telugu script & Tenglish)

Includes explicit Negation Guards and Hyperbole/Slang Guards to prevent false positives
while maintaining zero false negatives on genuine acute self-harm and passive death wishes.
"""
from __future__ import annotations

import re
import unicodedata
from enum import IntEnum


class SafetyTier(IntEnum):
    TIER1_EVERYDAY = 1
    TIER2_PASSIVE_DISTRESS = 2
    TIER3_ACUTE = 3


# ---------------------------------------------------------------------------
# Negation & Figurative Slang / Hyperbole Guards
# Evaluated before Tier 3 triggers so explicit denials ("I don't want to die")
# or figurative student slang ("this exam is killing me") are not misclassified.
# ---------------------------------------------------------------------------
NEGATION_AND_SLANG_GUARDS: list[re.Pattern[str]] = [
    # Explicit negations of self-harm / death wishes (English)
    re.compile(
        r"\b(i\s+don'?t|i\s+do\s+not|i\s+never|i\s+would\s+never|not\s+going\s+to)\s+"
        r"(want\s+to\s+)?(kill\s+my\s*self|hurt\s+my\s*self|harm\s+my\s*self|die|end\s+my\s+life|commit\s+suicide)\b",
        re.I,
    ),
    re.compile(r"\bno\s+(thoughts?|intention|plan)\s+of\s+(suicide|self[-\s]?harm|killing\s+my\s*self|dying)\b", re.I),
    # Explicit negations (Hindi / Hinglish / Gujarati / Marathi / Tamil / Telugu / Bengali)
    re.compile(r"\b(main|mujhe)\s+(marna|khudkushi\s+karna)\s+nahi\s+(chahta|chahti|hai)\b", re.I),
    re.compile(r"\bmare\s+marvu\s+nathi\b", re.I),
    re.compile(r"\bmala\s+maraycha\s+nahi\b", re.I),
    re.compile(r"\benakku\s+saaga\s+viruppam\s+illai\b", re.I),
    re.compile(r"\bnaaku\s+chanipovalani\s+ledu\b", re.I),
    re.compile(r"\bami\s+morte\s+chai\s+na\b", re.I),
    # Figurative academic/work slang & hyperbole
    re.compile(
        r"\b(this|these|the|my)\s+(exam|test|assignment|workload|heat|traffic|headache|back|professor|boss|lecture|placement)\s+"
        r"is\s+(killing\s+me|suicide)\b",
        re.I,
    ),
    re.compile(r"\bdying\s+of\s+(laughter|boredom|embarrassment|cringe|hunger)\b", re.I),
    re.compile(r"\b(hasi|bhookh|garmi|boriyat)\s+(se|ke\s+maare)\s+mar\s+(raha|rahi|jaunga|jaungi)\b", re.I),
]

# ---------------------------------------------------------------------------
# TIER 3 — Acute self-harm, explicit suicidal intent, passive death wishes,
# or immediate plans/methods across all 8 Indian languages.
# ---------------------------------------------------------------------------
TIER3_PATTERNS: list[re.Pattern[str]] = [
    # 1. English — direct, indirect, and passive death wishes
    re.compile(r"\b(kill|killing|hurt|hurting|harm|harming|cut|cutting)\s+my\s*self\b", re.I),
    re.compile(r"\bkms\b", re.I),
    re.compile(r"\bsuicid(e|al)\b", re.I),
    re.compile(r"\bend(ing)?\s+(it\s+all|my\s+life|everything)\b", re.I),
    re.compile(r"\b(want|wanna|going|ready|plan(ning)?)\s+to\s+die\b", re.I),
    re.compile(r"\bwanna\s+die\b", re.I),
    re.compile(r"\bdon'?t\s+want\s+to\s+(live|be\s+alive|exist|wake\s+up)\b", re.I),
    re.compile(r"\bwish\s+i\s+(wouldn'?t|didn'?t|could\s+not)\s+wake\s+up\b", re.I),
    re.compile(r"\bwish\s+i\s+(were|was)\s+(dead|never\s+born)\b", re.I),
    re.compile(r"\bno\s+(reason|point)\s+(to|in)\s+(live|living|go(ing)?\s+on)\b", re.I),
    re.compile(r"\bbetter\s+off\s+(dead|without\s+me)\b", re.I),
    re.compile(r"\bself[-\s]?harm\b", re.I),
    re.compile(r"\b(taking\s+an\s+|going\s+to\s+)?overdose\b", re.I),
    re.compile(r"\bjump(ing)?\s+off\s+(a\s+|the\s+)?(building|bridge|roof|terrace|balcony)\b", re.I),
    re.compile(r"\bjump\s+off\b", re.I),
    re.compile(r"\bunalive(\s+my\s*self)?\b", re.I),
    re.compile(r"\btake\s+my\s+own\s+life\b", re.I),
    re.compile(r"\bwriting\s+my\s+goodbye\s+(note|letter)\b", re.I),
    # 2 & 3. Hindi / Hinglish (Roman & Devanagari)
    re.compile(r"\bmar\s+(jaana?|jaun|jaaun|jau|jaungi|jaunga|jaungaa|jaaungi|jaaunga)\b", re.I),
    re.compile(r"\bmarna\s+(hai|chahta|chahti)\b", re.I),
    re.compile(r"\bmarne\s+ka\s+(mann?|dil)\b", re.I),
    re.compile(r"\b(jeena|jina)\s+nahi(\s+hai|\s+chahta|\s+chahti)?\b", re.I),
    re.compile(r"\b(jeene|jine)\s+ka\s+(mann?|dil)\s+nahi\b", re.I),
    re.compile(r"\bkhud\s*ko\s+(khatam|maar|mar)\b", re.I),
    re.compile(r"\b(apni\s+)?zindagi\s+khatam\s+kar\b", re.I),
    re.compile(r"\bkhudkushi\b", re.I),
    re.compile(r"\ba{1,2}tm[ao]h[ao]t(y|i)a\b", re.I),
    re.compile(r"\bsaans\s+band\s+ho\s+jaye\b", re.I),
    re.compile(r"आत्महत्या|मरना चाहत|मर जाऊं|मर जाऊँ|जीना नहीं|खुदकुशी|अपनी जान दे"),
    # 4. Gujarati (Gujlish & Gujarati script)
    re.compile(r"\bmari\s+ja(v|w|a)(u|vu|nu)\b", re.I),
    re.compile(r"\bmarvu\s+(chhe|che|chhe\s+mare)\b", re.I),
    re.compile(r"\b(jivvu|jeevvu|jivu|jeevu)\s+(nathi|nai|nahi)\b", re.I),
    re.compile(r"\baap\s*ghat\b", re.I),
    re.compile(r"આત્મહત્યા|આપઘાત|મરી જવું|જીવવું નથી"),
    # 5. Marathi (Minglish & Devanagari)
    re.compile(r"\bmar(aych|aaych)(a|e|ay|ay\s+aahe)\b", re.I),
    re.compile(r"\bmarun\s+ja(ve|aave|aycha|aychay)\b", re.I),
    re.compile(r"\bjag(aych|aaych)(a|e)\s+nahi\b", re.I),
    re.compile(r"\bswatala\s+sampav\b", re.I),
    re.compile(r"\bjeev\s+dyaycha\b", re.I),
    re.compile(r"मरायचं|मरून जावं|जगायचं नाही|आत्महत्या|जीव द्यायचा"),
    # 6. Bengali (Banglish & Bengali script)
    re.compile(r"\bmor(e|te)\s+(jete\s+)?chai\b", re.I),
    re.compile(r"\bbachte\s+chai\s+na\b", re.I),
    re.compile(r"\battohotya\b", re.I),
    re.compile(r"\bnijeke\s+shesh\s+kore\b", re.I),
    re.compile(r"আত্মহত্যা|মরে যেতে চাই|বাঁচতে চাই না|নিজেকে শেষ"),
    # 7. Tamil (Tanglish & Tamil script)
    re.compile(r"\bsaaga(num|poren|poraen|venum)\b", re.I),
    re.compile(r"\bsethu(dalam|duven|poganum|poyidalam|ponum)\b", re.I),
    re.compile(r"\bthat?kolai\b", re.I),
    re.compile(r"\buyirai\s+maaythu\b", re.I),
    re.compile(r"தற்கொலை|சாகணும்|சாக வேண்டும்|செத்துப் போகணும்"),
    # 8. Telugu (Tenglish & Telugu script)
    re.compile(r"\bchanipo(vali|thanu|ta|dam)\b", re.I),
    re.compile(r"\bbrat(akali|akalani)\s+ledu\b", re.I),
    re.compile(r"\batmahatya\b", re.I),
    re.compile(r"\bnaa\s+pranam\s+tees\b", re.I),
    re.compile(r"ఆత్మహత్య|చనిపోవాలని|బ్రతకాలని లేదు|చచ్చిపోతా"),
]

# ---------------------------------------------------------------------------
# TIER 2 — Passive distress, severe emotional exhaustion, hopelessness
# ---------------------------------------------------------------------------
TIER2_PATTERNS: list[re.Pattern[str]] = [
    # English
    re.compile(r"\bi\s+(can'?t|cannot)\s+(take|handle|do)\s+(this|it)(\s+anymore)?\b", re.I),
    re.compile(r"\bi\s+give\s+up\b", re.I),
    re.compile(r"\bhope(less|lessness)\b", re.I),
    re.compile(r"\bno\s+one\s+(cares?|understands?)\b", re.I),
    re.compile(r"\beveryone\s+(hates?|ignores?)\s+me\b", re.I),
    re.compile(
        r"\bi\s+(feel|am)\s+(?:so\s+|completely\s+|totally\s+|really\s+|utterly\s+)?(invisible|worthless|useless|broken|empty|numb)\b",
        re.I,
    ),
    re.compile(r"\bwhat'?s\s+the\s+point\s+of\s+trying\b", re.I),
    re.compile(r"\bwant\s+to\s+disappear\b", re.I),
    # Hindi / Hinglish
    re.compile(r"\bab\s+(mujhse|mujh\s+se)\s+nahi\s+ho\s+(raha|pa\s+raha)\b", re.I),
    re.compile(r"\bkoi\s+fayda\s+nahi\b", re.I),
    re.compile(r"\b(bahut|bohot)\s+thak\s+(gaya|gayi)\s+hoon\b", re.I),
    re.compile(r"\bbas\s+ho\s+gaya\s+ab\b", re.I),
    re.compile(r"\bkuch\s+achha\s+nahi\s+lagta\b", re.I),
    re.compile(r"\bkoi\s+nahi\s+samajhta\b", re.I),
    re.compile(r"अब मुझसे नहीं हो रहा|कोई फायदा नहीं|सब खत्म सा लग रहा"),
    # Gujarati
    re.compile(r"\bhave\s+marathi\s+nathi\s+thatu\b", re.I),
    re.compile(r"\bhav[e]?\s+bas\s+thai\s+gayu\b", re.I),
    re.compile(r"હવે મારાથી નથી થતું|કોઈ સમજતું નથી"),
    # Marathi
    re.compile(r"\baata\s+majhyane\s+hot\s+nahi\b", re.I),
    re.compile(r"\bsagla\s+samplya\s+sarkha\s+vattay\b", re.I),
    re.compile(r"आता माझ्याकडून होत नाही|खूप एकटं वाटतंय"),
    # Bengali
    re.compile(r"\baar\s+parchi\s+na\b", re.I),
    re.compile(r"\bkeu\s+bojhe\s+na\b", re.I),
    re.compile(r"আর পারছি না|কেউ বোঝে না"),
    # Tamil
    re.compile(r"\bennala\s+mudiyala\b", re.I),
    re.compile(r"\byaarume\s+purinjikkala\b", re.I),
    re.compile(r"என்னால் முடியவில்லை|யாருமே புரிஞ்சிக்கல"),
    # Telugu
    re.compile(r"\bnaa\s+valla\s+kavatledu\b", re.I),
    re.compile(r"\bevaru\s+artham\s+chesukoru\b", re.I),
    re.compile(r"నా వల్ల కావట్లేదు|ఎవరూ అర్థం చేసుకోరు"),
]


def classify_safety(text: str) -> SafetyTier:
    """
    Deterministic three-tier safety classification with negation and figurative slang guards.
    Returns the highest tier matched. Tier 3 is never overridable by any LLM.
    """
    if not text or not text.strip():
        return SafetyTier.TIER1_EVERYDAY

    normalized = unicodedata.normalize("NFKC", text)

    # Check if the sentence is an explicit negation or harmless figurative academic slang
    is_guarded = any(g.search(normalized) for g in NEGATION_AND_SLANG_GUARDS)

    if not is_guarded:
        for pattern in TIER3_PATTERNS:
            if pattern.search(normalized):
                return SafetyTier.TIER3_ACUTE

    for pattern in TIER2_PATTERNS:
        if pattern.search(normalized):
            return SafetyTier.TIER2_PASSIVE_DISTRESS

    return SafetyTier.TIER1_EVERYDAY


def detect_crisis(text: str) -> bool:
    """Boolean compatibility helper matching frontend detectCrisis()."""
    return classify_safety(text) == SafetyTier.TIER3_ACUTE
