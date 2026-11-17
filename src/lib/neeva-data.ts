// Static content and deterministic sample data for Neeva. Browser-safe (no server imports).

export type MoodKey = "peaceful" | "joyful" | "tired" | "anxious" | "overwhelmed";
export type Goal = "stress" | "focus" | "community" | "sleep";
export type LangCode = "en" | "hi" | "gu" | "ta" | "mr" | "bn";

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
  { code: "hi", label: "Hindi", native: "हिन्दी", mix: "Hinglish", scriptName: "Devanagari", example: "bro thak gayi hoon yaar" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", mix: "Gujlish", scriptName: "Gujarati", example: "yaar have bas thai gayu" },
  { code: "ta", label: "Tamil", native: "தமிழ்", mix: "Tanglish", scriptName: "Tamil", example: "romba tired ah irukku da" },
  { code: "mr", label: "Marathi", native: "मराठी", mix: "Minglish", scriptName: "Devanagari", example: "khup thaklo yaar aaj" },
  { code: "bn", label: "Bengali", native: "বাংলা", mix: "Banglish", scriptName: "Bengali", example: "ar parchi na bhai" },
];

export const langInfo = (code: LangCode) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

export const SCRIPT_STYLES: { key: ScriptStyle; label: string; line: (lang: (typeof LANGUAGES)[number]) => string }[] = [
  { key: "auto", label: "Match how I type", line: (l) => `English letters if you type "${l.example}", ${l.native} if you type in ${l.native}` },
  { key: "roman", label: "English letters", line: (l) => `Always ${l.mix}, like "${l.example}"` },
  { key: "native", label: "Native script", line: (l) => `Always written in ${l.native}` },
];

export const CHAT_WELCOME: Record<LangCode, string> = {
  en: "Hi, I'm **Neeva**. This is a calm, private space — there's no rush and no wrong thing to say.\n\nWhatever brought you here today, I'm glad you came. How are you really feeling right now?",
  hi: "नमस्ते, मैं **नीवा** हूँ। यह एक शांत, निजी जगह है — यहाँ कोई जल्दी नहीं, और कुछ भी कहना गलत नहीं।\n\nआज आप जिस भी वजह से आए हैं, मुझे खुशी है कि आप यहाँ हैं। अभी आप सच में कैसा महसूस कर रहे हैं?",
  gu: "નમસ્તે, હું **નીવા** છું. આ એક શાંત, ખાનગી જગ્યા છે — અહીં કોઈ ઉતાવળ નથી અને કંઈ પણ કહેવું ખોટું નથી.\n\nઆજે તમે જે કારણે પણ આવ્યા હો, મને આનંદ છે કે તમે અહીં છો. અત્યારે તમે ખરેખર કેવું અનુભવો છો?",
  ta: "வணக்கம், நான் **நீவா**. இது அமைதியான, தனிப்பட்ட இடம் — இங்கே அவசரம் இல்லை, எதைச் சொன்னாலும் தவறில்லை.\n\nஇன்று நீங்கள் எந்தக் காரணத்திற்காக வந்திருந்தாலும், நீங்கள் வந்ததில் மகிழ்ச்சி. இப்போது நீங்கள் உண்மையில் எப்படி உணர்கிறீர்கள்?",
  mr: "नमस्कार, मी **नीवा** आहे. ही एक शांत, खासगी जागा आहे — इथे घाई नाही आणि काहीही बोलणं चुकीचं नाही.\n\nआज तुम्ही कोणत्याही कारणाने आला असाल, तुम्ही इथे आलात याचा मला आनंद आहे. आत्ता तुम्हाला खरंच कसं वाटतंय?",
  bn: "নমস্কার, আমি **নীভা**। এটি একটি শান্ত, ব্যক্তিগত জায়গা — এখানে কোনো তাড়া নেই, কিছু বলাই ভুল নয়।\n\nআজ আপনি যে কারণেই এসে থাকুন, আপনি এসেছেন বলে আমি খুশি। এই মুহূর্তে আপনি সত্যি কেমন অনুভব করছেন?",
};

export const CHAT_SUGGESTIONS = [
  "I'm feeling burnt out",
  "Guide me through a breathing exercise",
  "Help me reframe this thought",
  "I can't switch off at night",
  "Exam pressure is getting to me",
  "Yaar sab kuch bahut zyada ho raha hai",
];

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

const SIM_MOODS: MoodKey[] = [
  "peaceful",
  "tired",
  "anxious",
  "joyful",
  "peaceful",
  "overwhelmed",
  "tired",
  "peaceful",
  "joyful",
  "anxious",
];

/** Simulated past 30 days of check-ins (excluding today) to seed the history chart. */
export function simulatedHistory(today: Date, days = 30) {
  const out: { date: string; mood: MoodKey; score: number; triggers: string[] }[] = [];
  for (let i = days; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const mood = SIM_MOODS[Math.floor(seeded(i) * SIM_MOODS.length)]!;
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const score = Math.min(
      10,
      Math.max(2, moodByKey(mood).score + (weekend ? 0.8 : -0.3) + (seeded(i + 7) - 0.5) * 1.6),
    );
    const triggers: string[] = [TRIGGERS[Math.floor(seeded(i + 3) * 4)]!];
    if (seeded(i + 11) > 0.6) triggers.push(TRIGGERS[2 + Math.floor(seeded(i + 5) * 6)]!);
    out.push({
      date: d.toISOString().slice(0, 10),
      mood,
      score: Math.round(score * 10) / 10,
      triggers,
    });
  }
  return out;
}

export const JOURNAL_PROMPTS = [
  "What went well today, even if it was small?",
  "Describe a challenge you faced and how you met it.",
  "What is taking up the most space in your mind right now?",
  "Write a letter to yourself from one year in the future.",
  "When did you feel most like yourself this week?",
  "What would you tell a friend who felt the way you do today?",
];

export const HELPLINES = [
  {
    name: "Tele-MANAS (Govt. of India)",
    number: "14416",
    tel: "14416",
    hours: "24×7 · 20+ languages",
  },
  {
    name: "KIRAN Mental Health Helpline",
    number: "1800-599-0019",
    tel: "18005990019",
    hours: "24×7 · Toll-free",
  },
  {
    name: "Vandrevala Foundation",
    number: "+91 9999 666 555",
    tel: "+919999666555",
    hours: "24×7 · Call or WhatsApp",
  },
  {
    name: "iCall (TISS)",
    number: "+91 91529 87821",
    tel: "+919152987821",
    hours: "Mon–Sat · 10am–8pm",
  },
  { name: "AASRA", number: "+91 98204 66726", tel: "+919820466726", hours: "24×7" },
];

export const MEDITATIONS = [
  {
    id: "arrive",
    title: "Morning Arrival",
    guide: "Ananya",
    minutes: 5,
    tag: "Calm start",
    tone: "sage" as const,
  },
  {
    id: "exam",
    title: "Body Scan for Exam Stress",
    guide: "Rohan",
    minutes: 10,
    tag: "Students",
    tone: "lilac" as const,
  },
  {
    id: "workday",
    title: "Letting Go of the Workday",
    guide: "Meera",
    minutes: 8,
    tag: "Burnout",
    tone: "rose" as const,
  },
  {
    id: "sleep",
    title: "Sleep Descent",
    guide: "Kabir",
    minutes: 15,
    tag: "Sleep",
    tone: "periwinkle" as const,
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

export const DISTORTION_ROUNDS = [
  {
    thought: "If I don't top this exam, my whole career is ruined.",
    answer: "catastrophizing",
    why: "One exam is a single data point — careers are built over years, with many second chances.",
  },
  {
    thought: "My manager didn't reply. She must think my work is terrible.",
    answer: "mind-reading",
    why: "Silence has many explanations — she might simply be busy. You can't see inside her head.",
  },
  {
    thought: "I missed one workout, so the whole week is a write-off.",
    answer: "all-or-nothing",
    why: "Progress isn't binary. Four out of five workouts is still a strong week.",
  },
  {
    thought: "I should be able to handle everything without help.",
    answer: "should",
    why: "'Should' sets an impossible standard. Asking for help is a skill, not a weakness.",
  },
  {
    thought: "I forgot her birthday. I'm such a horrible friend.",
    answer: "labeling",
    why: "One slip doesn't define you. A good friend can forget and then make it right.",
  },
  {
    thought: "The presentation went fine, but that was just luck.",
    answer: "discounting",
    why: "You prepared and delivered it. Let yourself count the win.",
  },
  {
    thought: "I'll definitely freeze at the interview tomorrow.",
    answer: "fortune-telling",
    why: "You can't know the future. Nerves are common — and preparation helps more than prediction.",
  },
];

export type Group = {
  id: string;
  name: string;
  description: string;
  members: number;
  activeNow: number;
  tags: string[];
  tone: "sage" | "rose" | "lilac" | "periwinkle" | "terracotta";
  icon: "wind" | "graduation" | "briefcase" | "baby" | "flower" | "zap" | "moon" | "heart" | "book";
};

export const GROUPS: Group[] = [
  {
    id: "anxiety",
    name: "Anxiety Support",
    description: "Gentle space to share racing thoughts and what helps you breathe again.",
    members: 12480,
    activeNow: 214,
    tags: ["anxiety", "panic", "worry"],
    tone: "lilac",
    icon: "wind",
  },
  {
    id: "campus",
    name: "Campus Wellness",
    description: "For students juggling exams, hostels, placements and figuring life out.",
    members: 8930,
    activeNow: 167,
    tags: ["students", "exams", "university"],
    tone: "sage",
    icon: "graduation",
  },
  {
    id: "burnout",
    name: "Corporate Burnout",
    description: "Long hours, Sunday scaries and the art of logging off. You're not alone.",
    members: 10215,
    activeNow: 189,
    tags: ["work", "burnout", "career"],
    tone: "rose",
    icon: "briefcase",
  },
  {
    id: "parents",
    name: "New Parents Circle",
    description: "Sleepless nights, big feelings and tiny wins — shared without judgement.",
    members: 4120,
    activeNow: 52,
    tags: ["parenting", "postpartum"],
    tone: "periwinkle",
    icon: "baby",
  },
  {
    id: "grief",
    name: "Grief & Healing",
    description: "Hold space for loss at your own pace, with people who understand.",
    members: 3380,
    activeNow: 31,
    tags: ["grief", "loss"],
    tone: "terracotta",
    icon: "flower",
  },
  {
    id: "adhd",
    name: "ADHD Focus Squad",
    description: "Body-doubling sessions, dopamine-friendly tips and zero shame.",
    members: 6740,
    activeNow: 98,
    tags: ["adhd", "focus", "productivity"],
    tone: "sage",
    icon: "zap",
  },
  {
    id: "sleep",
    name: "Sleep Better Together",
    description: "Wind-down rituals and late-night check-ins for restless minds.",
    members: 5310,
    activeNow: 76,
    tags: ["sleep", "insomnia"],
    tone: "periwinkle",
    icon: "moon",
  },
  {
    id: "pride",
    name: "Queer Safe Space",
    description: "An affirming, moderated circle for LGBTQIA+ folks across India.",
    members: 2890,
    activeNow: 44,
    tags: ["lgbtqia", "identity"],
    tone: "lilac",
    icon: "heart",
  },
];

export type Post = {
  id: string;
  alias: string;
  group: string;
  minutesAgo: number;
  text: string;
  support: number;
  replies: number;
};

export const POSTS: Post[] = [
  {
    id: "p1",
    alias: "Quiet Banyan",
    group: "burnout",
    minutesAgo: 12,
    text: "Logged off at 6:30 today for the first time in months. Felt guilty for an hour, then made chai and sat on the balcony. Small win, but it's mine.",
    support: 148,
    replies: 23,
  },
  {
    id: "p2",
    alias: "Gentle Monsoon",
    group: "campus",
    minutesAgo: 34,
    text: "Placement season is making me feel like everyone has it figured out except me. Anyone else practising the 4-7-8 breathing before interviews? It actually helped yesterday.",
    support: 96,
    replies: 31,
  },
  {
    id: "p3",
    alias: "Soft Marigold",
    group: "anxiety",
    minutesAgo: 58,
    text: "Had a panic spike in the metro. Used the 5-4-3-2-1 grounding from the crisis card — counted 5 ads I could see. Got through it. Sharing in case it helps someone today.",
    support: 212,
    replies: 40,
  },
  {
    id: "p4",
    alias: "Still Lotus",
    group: "adhd",
    minutesAgo: 95,
    text: "Body-doubling session at 9pm tonight — bring the task you've been avoiding. Mine is my tax folder 😅",
    support: 64,
    replies: 18,
  },
  {
    id: "p5",
    alias: "Warm Tamarind",
    group: "sleep",
    minutesAgo: 140,
    text: "Three nights in a row of the Sleep Descent track and I'm finally falling asleep before 1am. Not perfect, but trending the right way.",
    support: 87,
    replies: 12,
  },
];

export const ALIASES = [
  "Calm Peepal",
  "Kind Neem",
  "Bright Jasmine",
  "Soft Cardamom",
  "Steady River",
  "Quiet Lotus",
];
