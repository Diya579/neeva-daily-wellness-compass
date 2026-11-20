// Static content for Neeva. Browser-safe (no server imports). No fabricated user data lives here.

export type MoodKey = "peaceful" | "joyful" | "tired" | "anxious" | "overwhelmed";
export type Goal = "stress" | "focus" | "community" | "sleep";
export type LangCode = "en" | "hinglish" | "hi" | "gu" | "mr" | "bn" | "ta" | "te";
export const LANG_CODES = ["en", "hinglish", "hi", "gu", "mr", "bn", "ta", "te"] as const;

export const MOODS: {
  key: MoodKey;
  label: string;
  blurb: string;
  score: number;
  tone: "sage" | "rose" | "lilac" | "periwinkle" | "terracotta";
}[] = [
  { key: "peaceful", label: "Peaceful", blurb: "Settled and steady", score: 8, tone: "sage" },
  { key: "joyful", label: "Joyful", blurb: "Light and bright", score: 9, tone: "rose" },
  { key: "tired", label: "Tired", blurb: "Running on low", score: 5, tone: "periwinkle" },
  { key: "anxious", label: "Anxious", blurb: "Restless, on edge", score: 4, tone: "lilac" },
  {
    key: "overwhelmed",
    label: "Overwhelmed",
    blurb: "Too much at once",
    score: 3,
    tone: "terracotta",
  },
];

export const moodByKey = (k: MoodKey) => MOODS.find((m) => m.key === k)!;

export const TRIGGERS = [
  "Work",
  "Studies",
  "Sleep",
  "Family",
  "Relationships",
  "Health",
  "Money",
  "Social media",
];

export const GOALS: { key: Goal; label: string; description: string }[] = [
  { key: "stress", label: "Manage stress", description: "Calm the noise, one breath at a time" },
  { key: "focus", label: "Improve focus", description: "ADHD-friendly tools to get into flow" },
  { key: "community", label: "Find community", description: "Talk to people who truly get it" },
  { key: "sleep", label: "Sleep better", description: "Wind down and rest more deeply" },
];

/** How the companion writes a non-English language: mirror the person, English letters, or native script. */
export type ScriptStyle = "auto" | "roman" | "native";

export const LANGUAGES: {
  code: LangCode;
  label: string;
  native: string;
  /** What people call it when typed in English letters and mixed with English. */
  mix: string;
  /** Name of the native writing system. */
  scriptName: string;
  /** A real-feeling example of how young people type it in English letters. */
  example: string;
}[] = [
  { code: "en", label: "English", native: "English", mix: "English", scriptName: "Latin", example: "ugh today was a lot" },
  { code: "hinglish", label: "Hinglish", native: "Hinglish", mix: "Hinglish", scriptName: "Latin", example: "bro thak gayi hoon yaar" },
  { code: "hi", label: "Hindi", native: "हिन्दी", mix: "Hinglish", scriptName: "Devanagari", example: "sach mein bahut thak gayi hoon" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", mix: "Gujlish", scriptName: "Gujarati", example: "yaar have bas thai gayu" },
  { code: "mr", label: "Marathi", native: "मराठी", mix: "Minglish", scriptName: "Devanagari", example: "khup thaklo yaar aaj" },
  { code: "bn", label: "Bengali", native: "বাংলা", mix: "Banglish", scriptName: "Bengali", example: "aaj khub klanto lagche" },
  { code: "ta", label: "Tamil", native: "தமிழ்", mix: "Tanglish", scriptName: "Tamil", example: "romba tired ah irukku da" },
  { code: "te", label: "Telugu", native: "తెలుగు", mix: "Tenglish", scriptName: "Telugu", example: "chala tired ga undi ra" },
];

export const langInfo = (code: LangCode) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]!;

/** Languages where the person can choose English letters vs native script (not English, not Hinglish). */
export const hasScriptChoice = (code: LangCode) => code !== "en" && code !== "hinglish";

export const SCRIPT_STYLES: { key: ScriptStyle; label: string; line: (lang: (typeof LANGUAGES)[number]) => string }[] = [
  { key: "auto", label: "Match how I type", line: (l) => `English letters if you type "${l.example}", ${l.native} if you type in ${l.native}` },
  { key: "roman", label: "English letters", line: (l) => `Always ${l.mix}, like "${l.example}"` },
  { key: "native", label: "Native script", line: (l) => `Always written in ${l.native}` },
];

/** Starter chips, written the way people actually type in each language. */
export const CHAT_SUGGESTIONS: Record<LangCode, string[]> = {
  en: ["Exam pressure is getting to me", "I can't switch off at night", "Help me reframe a thought", "Guide me through a breathing exercise"],
  hinglish: ["Yaar sab kuch bahut zyada ho raha hai", "Exam ka pressure bohot hai", "Raat ko neend nahi aati", "Ek thought reframe karne mein help karo"],
  hi: ["पढ़ाई का बहुत प्रेशर है", "Raat ko dimaag band hi nahi hota", "Ghar pe sab expect karte hain", "Breathing exercise karwao"],
  gu: ["Exam nu bau tension chhe", "Raat na oonghi nathi avti", "Ghar ma koi samajhtu nathi", "Breathing exercise karavo ne"],
  mr: ["Exam cha khup tension aahe", "Raatri jhop yet nahi", "Sagla khup jaast hotay", "Breathing exercise karun ghe"],
  bn: ["Exam niye khub chinta hocche", "Raate ghum ashe na", "Sob kichu onek beshi lagche", "Ekta breathing exercise koro"],
  ta: ["Exam pressure romba irukku", "Night thookam varala", "Ellam romba overwhelming ah irukku", "Breathing exercise sollunga"],
  te: ["Exam pressure chala undi", "Raatri nidra raavatledu", "Antha chala ekkuva ga undi", "Breathing exercise cheyyinchu"],
};

const TIPS: Record<MoodKey, string[]> = {
  peaceful: [
    "Bottle this feeling. Write one line about what made today feel steady — future-you will want the recipe.",
    "Calm days are the best time to build habits. Try a 3-minute body scan to anchor this feeling in your body.",
  ],
  joyful: [
    "Savour it: pause for 20 seconds and notice where joy sits in your body. Savouring makes good moments last longer.",
    "Share the light — send a short voice note to someone who'd love to hear from you today.",
  ],
  tired: [
    "Tiredness is information, not failure. Try a 10-minute 'non-sleep deep rest' break before pushing on.",
    "Lower the bar for today: pick one thing that truly matters and let the rest be 'good enough'.",
  ],
  anxious: [
    "Try 4-7-8 breathing: inhale 4, hold 7, exhale 8. A long exhale tells your nervous system you're safe.",
    "Name it to tame it. Write the worry down, then ask: 'What's the most likely outcome — not the worst?'",
  ],
  overwhelmed: [
    "Shrink the horizon. What's the next 15 minutes? Do only that, then check in again.",
    "Brain-dump everything onto paper, then circle just one item. Overwhelm loosens once it's outside your head.",
  ],
};

const TRIGGER_TIPS: Record<string, string> = {
  Work: "Since work came up, try a hard stop today — close the laptop and do a 2-minute 'shutdown ritual' to separate work from rest.",
  Studies:
    "With studies on your mind, a 25-minute Pomodoro with a real break often beats a 3-hour marathon.",
  Sleep:
    "Sleep seems to be in the mix — dim screens 45 minutes before bed and try the 'Sleep Descent' meditation.",
  Family:
    "Family dynamics can be heavy. It's okay to love people and still need space — a short walk alone counts.",
  Relationships:
    "Relationships matter deeply. Before a hard conversation, try writing what you need in one sentence.",
  Health:
    "Your body is asking for care. Hydrate, stretch for 3 minutes, and be gentle with yourself today.",
  Money:
    "Money stress is real. Pick one tiny, concrete action — like listing this week's essentials — to regain a sense of control.",
  "Social media":
    "Notice the scroll. Try a 30-minute phone-free window and see how your mind feels after.",
};

export function wellnessTip(mood: MoodKey, triggers: string[], seed = 0): string {
  const base = TIPS[mood][seed % TIPS[mood].length]!;
  const t = triggers.find((x) => TRIGGER_TIPS[x]);
  return t ? `${base} ${TRIGGER_TIPS[t]}` : base;
}

// Deterministic pseudo-random so SSR and client agree.
export function seeded(n: number) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export const JOURNAL_PROMPTS = [
  "What went well today, even if it was small?",
  "Describe a challenge you faced and how you met it.",
  "What is taking up the most space in your mind right now?",
  "Write a letter to yourself from one year in the future.",
  "When did you feel most like yourself this week?",
  "What would you tell a friend who felt the way you do today?",
];

/**
 * Verified 19 Nov 2026 against official sources:
 * Tele-MANAS — telemanas.mohfw.gov.in (14416 / 1-800-891-4416, 24×7, 20 languages).
 * iCall (TISS) — icallhelpline.org (9152987821, Mon–Sat 8am–9pm IST).
 * KIRAN (1800-599-0019) was merged into Tele-MANAS in 2024, so it is no longer listed.
 */
export const HELPLINES_VERIFIED_ON = "19 Nov 2026";
export type Helpline = { id: "telemanas" | "icall" | "112" | "vandrevala"; name: string; number: string; tel: string; hours: string; alwaysOpen: boolean };
export const HELPLINES: Helpline[] = [
  { id: "telemanas", name: "Tele-MANAS (Govt. of India)", number: "14416", tel: "14416", hours: "24×7 · free · 20 languages · also 1-800-891-4416", alwaysOpen: true },
  { id: "icall", name: "iCall (TISS)", number: "9152987821", tel: "+919152987821", hours: "Mon–Sat · 8am–9pm · free counselling", alwaysOpen: false },
  { id: "112", name: "Emergency services", number: "112", tel: "112", hours: "24×7 · if you're in immediate danger", alwaysOpen: true },
  { id: "vandrevala", name: "Vandrevala Foundation", number: "+91 9999 666 555", tel: "+919999666555", hours: "24×7 · call or WhatsApp", alwaysOpen: true },
];

/** iCall answers Mon–Sat, 8:00–21:00 India time. */
export function isIcallOpen(now: Date = new Date()): boolean {
  const ist = new Date(now.getTime() + (5.5 * 60 + now.getTimezoneOffset()) * 60_000);
  const day = ist.getDay();
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return day !== 0 && mins >= 8 * 60 && mins < 21 * 60;
}

export type Meditation = {
  id: string;
  title: string;
  minutes: number;
  tag: string;
  tone: "sage" | "lilac" | "rose" | "periwinkle";
  /** Spoken/shown guidance, by second. */
  cues: { at: number; text: string }[];
};

export const MEDITATIONS: Meditation[] = [
  {
    id: "arrive", title: "Morning Arrival", minutes: 5, tag: "Calm start", tone: "sage",
    cues: [
      { at: 0, text: "Sit comfortably. Let your shoulders drop away from your ears." },
      { at: 20, text: "Breathe in through your nose for four… and out slowly for six." },
      { at: 60, text: "Notice where your body touches the chair or the floor. Let it hold you." },
      { at: 110, text: "If your mind jumps to today's to-do list, that's okay. Gently come back to the breath." },
      { at: 170, text: "Ask yourself: what is one thing I need today? Just notice the answer." },
      { at: 230, text: "Breathe in a little energy. Breathe out any rush." },
      { at: 280, text: "Slowly open your eyes. Carry this pace into your first task." },
    ],
  },
  {
    id: "exam", title: "Body Scan for Exam Stress", minutes: 10, tag: "Students", tone: "lilac",
    cues: [
      { at: 0, text: "Put your books aside for ten minutes. Close your eyes or soften your gaze." },
      { at: 30, text: "Bring attention to your forehead and jaw. Exam stress hides here — let them soften." },
      { at: 100, text: "Move down to your neck and shoulders. Breathe into any tightness, then let it go on the out-breath." },
      { at: 180, text: "Notice your chest and stomach rising and falling. No need to change anything." },
      { at: 260, text: "Your hands: unclench them. Let your fingers rest." },
      { at: 340, text: "Your legs and feet. Feel the floor under you — steady, solid." },
      { at: 420, text: "Thoughts like 'I'll fail' may show up. Label them 'worry' and return to your body." },
      { at: 500, text: "Remind yourself: one exam is one day, not my whole life." },
      { at: 570, text: "Take three slow breaths. When you're ready, return to study with one small task." },
    ],
  },
  {
    id: "workday", title: "Letting Go of the Day", minutes: 8, tag: "Burnout", tone: "rose",
    cues: [
      { at: 0, text: "The day is done, even if the list isn't. Settle in." },
      { at: 30, text: "Breathe in for four. Hold for a moment. Breathe out for six." },
      { at: 90, text: "Picture today's tasks as tabs in a browser. Close them one by one." },
      { at: 170, text: "Notice any frustration or guilt. Say silently: this was a lot, and I did what I could." },
      { at: 260, text: "Relax your eyes, your jaw, your hands." },
      { at: 340, text: "Think of one small thing that went okay today. Let yourself have it." },
      { at: 420, text: "Breathe out the day. You're allowed to rest now." },
    ],
  },
  {
    id: "sleep", title: "Sleep Descent", minutes: 15, tag: "Sleep", tone: "periwinkle",
    cues: [
      { at: 0, text: "Lie down and put your phone face-down after starting this. Let the sound carry you." },
      { at: 40, text: "Make your out-breath longer than your in-breath. Four in, seven out." },
      { at: 120, text: "Feel the weight of your head on the pillow. Let it get heavier." },
      { at: 220, text: "Let your arms sink. Your legs sink. Nothing to do, nowhere to be." },
      { at: 340, text: "If a thought pulls you, picture it floating past like a cloud." },
      { at: 480, text: "Count slow breaths backwards from ten. If you lose count, start again — that's fine." },
      { at: 640, text: "Your only job now is to rest." },
      { at: 800, text: "Stay here as long as you like. Goodnight." },
    ],
  },
];

export const DISTORTIONS = [
  { key: "catastrophizing", label: "Catastrophising", hint: "Jumping to the worst-case outcome" },
  { key: "mind-reading", label: "Mind reading", hint: "Assuming you know what others think" },
  {
    key: "all-or-nothing",
    label: "All-or-nothing",
    hint: "Seeing things as total success or failure",
  },
  { key: "should", label: "'Should' statements", hint: "Rigid rules about how things must be" },
  { key: "labeling", label: "Labelling", hint: "Defining yourself by one mistake" },
  { key: "fortune-telling", label: "Fortune telling", hint: "Predicting the future negatively" },
  { key: "discounting", label: "Discounting positives", hint: "Brushing off what went well" },
];

/** Three levels of five. Level 1 shows 2 choices, level 2 shows 3, level 3 shows 4. */
export const DISTORTION_ROUNDS: { level: 1 | 2 | 3; thought: string; answer: string; why: string }[] = [
  { level: 1, thought: "If I don't top this exam, my whole career is ruined.", answer: "catastrophizing", why: "One exam is a single data point — careers are built over years, with many second chances." },
  { level: 1, thought: "My friend didn't reply. She must be angry with me.", answer: "mind-reading", why: "Silence has many explanations — she might simply be busy. You can't see inside her head." },
  { level: 1, thought: "I missed one class, so the whole semester is a write-off.", answer: "all-or-nothing", why: "Progress isn't binary. Missing one class is a dip, not the end of the semester." },
  { level: 1, thought: "I should be able to handle everything without help.", answer: "should", why: "'Should' sets an impossible standard. Asking for help is a skill, not a weakness." },
  { level: 1, thought: "I forgot her birthday. I'm such a horrible friend.", answer: "labeling", why: "One slip doesn't define you. A good friend can forget and then make it right." },
  { level: 2, thought: "The presentation went fine, but that was just luck.", answer: "discounting", why: "You prepared and delivered it. Let yourself count the win." },
  { level: 2, thought: "I'll definitely freeze at the placement interview tomorrow.", answer: "fortune-telling", why: "You can't know the future. Nerves are common — and preparation helps more than prediction." },
  { level: 2, thought: "Everyone in the group chat thinks my idea was stupid.", answer: "mind-reading", why: "You're guessing what a whole group thinks. Has anyone actually said that?" },
  { level: 2, thought: "Papa got one bad report from me — now he'll never trust me again.", answer: "catastrophizing", why: "One report is one moment. Trust is built over many moments, and can be rebuilt." },
  { level: 2, thought: "I got 8 out of 10, which basically means I failed.", answer: "all-or-nothing", why: "8/10 is a strong score. Anything short of perfect isn't failure." },
  { level: 3, thought: "My cousin got into IIT and I didn't. I'm the family failure.", answer: "labeling", why: "Comparing one result doesn't make you 'the failure'. You are far more than one admission list." },
  { level: 3, thought: "A good student would never feel this stressed.", answer: "should", why: "There's no rule that good students don't feel stress. Stress is normal, not a sign you're doing it wrong." },
  { level: 3, thought: "My manager praised my work, but she says that to everyone.", answer: "discounting", why: "You're filtering out real feedback. Maybe she says it because the work was good." },
  { level: 3, thought: "Nobody will ever want to date someone like me.", answer: "fortune-telling", why: "'Never' predicts a future you can't see. Who you'll meet is genuinely unknown." },
  { level: 3, thought: "If I say no to my friends once, they'll drop me completely.", answer: "catastrophizing", why: "Real friendships survive a 'no'. The worst case is rarely the likely case." },
];

export type Group = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  tone: "sage" | "rose" | "lilac" | "periwinkle" | "terracotta";
  icon: "wind" | "graduation" | "briefcase" | "baby" | "flower" | "zap" | "moon" | "heart" | "book";
};

export const GROUPS: Group[] = [
  {
    id: "anxiety",
    name: "Anxiety Support",
    description: "Gentle space to share racing thoughts and what helps you breathe again.",
    tags: ["anxiety", "panic", "worry"],
    tone: "lilac",
    icon: "wind",
  },
  {
    id: "campus",
    name: "Campus Wellness",
    description: "For students juggling exams, hostels, placements and figuring life out.",
    tags: ["students", "exams", "university"],
    tone: "sage",
    icon: "graduation",
  },
  {
    id: "burnout",
    name: "Corporate Burnout",
    description: "Long hours, Sunday scaries and the art of logging off. You're not alone.",
    tags: ["work", "burnout", "career"],
    tone: "rose",
    icon: "briefcase",
  },
  {
    id: "parents",
    name: "New Parents Circle",
    description: "Sleepless nights, big feelings and tiny wins — shared without judgement.",
    tags: ["parenting", "postpartum"],
    tone: "periwinkle",
    icon: "baby",
  },
  {
    id: "grief",
    name: "Grief & Healing",
    description: "Hold space for loss at your own pace, with people who understand.",
    tags: ["grief", "loss"],
    tone: "terracotta",
    icon: "flower",
  },
  {
    id: "adhd",
    name: "ADHD Focus Squad",
    description: "Body-doubling sessions, dopamine-friendly tips and zero shame.",
    tags: ["adhd", "focus", "productivity"],
    tone: "sage",
    icon: "zap",
  },
  {
    id: "sleep",
    name: "Sleep Better Together",
    description: "Wind-down rituals and late-night check-ins for restless minds.",
    tags: ["sleep", "insomnia"],
    tone: "periwinkle",
    icon: "moon",
  },
  {
    id: "pride",
    name: "Queer Safe Space",
    description: "An affirming, moderated circle for LGBTQIA+ folks across India.",
    tags: ["lgbtqia", "identity"],
    tone: "lilac",
    icon: "heart",
  },
];
