"""
Three-Tier Deterministic Crisis & Distress Classification Patterns.
Covers all 8 supported languages in both native script and Roman/mixed script:
1. English (en)
2. Hinglish (hinglish)
3. Hindi (hi — Devanagari & Hinglish)
4. Gujarati (gu — Gujarati script & Gujlish)
5. Marathi (mr — Devanagari & Minglish)
6. Bengali (bn — Bengali script & Banglish)
7. Tamil (ta — Tamil script & Tanglish)
8. Telugu (te — Telugu script & Tenglish)
"""
from __future__ import annotations

import re
import unicodedata
from enum import IntEnum


class SafetyTier(IntEnum):
    TIER1_EVERYDAY = 1
    TIER2_PASSIVE_DISTRESS = 2
    TIER3_ACUTE = 3


TIER3_PATTERNS: list[re.Pattern[str]] = [
    # 1. English
    re.compile(r"\b(kill|killing|hurt|hurting|harm|harming|cut|cutting)\s+my\s*self\b", re.I),
    re.compile(r"\bkms\b", re.I),
    re.compile(r"\bsuicid(e|al)\b", re.I),
    re.compile(r"\bend(ing)?\s+(it\s+all|my\s+life|everything)\b", re.I),
    re.compile(r"\b(want|wanna|going)\s+to\s+die\b", re.I),
    re.compile(r"\bwanna\s+die\b", re.I),
    re.compile(r"\bdon'?t\s+want\s+to\s+(live|be\s+alive|exist|wake\s+up)\b", re.I),
    re.compile(r"\bno\s+(reason|point)\s+(to|in)\s+(live|living|go(ing)?\s+on)\b", re.I),
    re.compile(r"\bbetter\s+off\s+(dead|without\s+me)\b", re.I),
    re.compile(r"\bself[-\s]?harm\b", re.I),
    re.compile(r"\boverdose\b", re.I),
    re.compile(r"\bjump\s+off\b", re.I),
    re.compile(r"\bunalive\b", re.I),
    re.compile(r"\btake\s+my\s+own\s+life\b", re.I),
    # 2 & 3. Hindi / Hinglish (Roman & Devanagari)
    re.compile(r"\bmar\s+(jaana?|jaun|jaaun|jau|jaungi|jaunga|jaungaa|jaaungi|jaaunga)\b", re.I),
    re.compile(r"\bmarna\s+(hai|chahta|chahti)\b", re.I),
    re.compile(r"\bmarne\s+ka\s+(mann?|dil)\b", re.I),
    re.compile(r"\b(jeena|jina)\s+nahi\b", re.I),
    re.compile(r"\b(jeene|jine)\s+ka\s+(mann?|dil)\s+nahi\b", re.I),
    re.compile(r"\bkhud\s*ko\s+(khatam|maar|mar)\b", re.I),
    re.compile(r"\bzindagi\s+khatam\s+kar\b", re.I),
    re.compile(r"\bkhudkushi\b", re.I),
    re.compile(r"\ba{1,2}tm[ao]h[ao]t(y|i)a\b", re.I),
    re.compile(r"आत्महत्या|मरना चाहत|मर जाऊं|मर जाऊँ|जीना नहीं|खुदकुशी"),
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
    re.compile(r"मरायचं|मरून जावं|जगायचं नाही"),
    # 6. Bengali (Banglish & Bengali script)
    re.compile(r"\bmor(e|te)\s+(jete\s+)?chai\b", re.I),
    re.compile(r"\bbachte\s+chai\s+na\b", re.I),
    re.compile(r"\battohotya\b", re.I),
    re.compile(r"আত্মহত্যা|মরে যেতে চাই|বাঁচতে চাই না"),
    # 7. Tamil (Tanglish & Tamil script)
    re.compile(r"\bsaaga(num|poren|poraen|venum)\b", re.I),
    re.compile(r"\bsethu(dalam|duven|poganum|poyidalam|ponum)\b", re.I),
    re.compile(r"\bthat?kolai\b", re.I),
    re.compile(r"தற்கொலை|சாகணும்|சாக வேண்டும்|செத்துப் போகணும்"),
    # 8. Telugu (Tenglish & Telugu script)
    re.compile(r"\bchanipo(vali|thanu|ta|dam)\b", re.I),
    re.compile(r"\bbrat(akali|akalani)\s+ledu\b", re.I),
    re.compile(r"\batmahatya\b", re.I),
    re.compile(r"\bnaa\s+pranam\s+tees\b", re.I),
    re.compile(r"ఆత్మహత్య|చనిపోవాలని|బ్రతకాలని లేదు|చచ్చిపోతా"),
]

TIER2_PATTERNS: list[re.Pattern[str]] = [
    # English
    re.compile(r"\bi\s+(can'?t|cannot)\s+(take|handle|do)\s+(this|it)(\s+anymore)?\b", re.I),
    re.compile(r"\bi\s+give\s+up\b", re.I),
    re.compile(r"\bhope(less|lessness)\b", re.I),
    re.compile(r"\bno\s+one\s+(cares?|understands?)\b", re.I),
    re.compile(r"\beveryone\s+(hates?|ignores?)\s+me\b", re.I),
    re.compile(r"\bi\s+(feel|am)\s+(invisible|worthless|useless|broken|empty)\b", re.I),
    re.compile(r"\bwhat'?s\s+the\s+point\s+of\s+trying\b", re.I),
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
    Deterministic three-tier safety classification.
    Returns the highest tier matched. Tier 3 is never overridable.
    """
    if not text or not text.strip():
        return SafetyTier.TIER1_EVERYDAY

    normalized = unicodedata.normalize("NFKC", text)
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

