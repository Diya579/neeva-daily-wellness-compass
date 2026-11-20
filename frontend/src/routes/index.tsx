import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  BookHeart,
  Check,
  Flower2,
  Headphones,
  LifeBuoy,
  Lock,
  MessageCircleHeart,
  Moon,
  Phone,
  Sun,
  Sunset,
  Timer,
  Users,
  Wind,
} from "lucide-react";
import { useAuthSession } from "@/lib/auth-session";
import { APPROACHES, LENGTHS, TONES, type Approach, type ReplyLength, type Tone } from "@/lib/companion";
import { SecurityBanner } from "@/components/neeva/SecurityBanner";
import { CompanionAvatar } from "@/components/neeva/CompanionAvatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import mark from "@/assets/neeva-mark.png";
import hero from "@/assets/landing-hero.jpg";
import metro from "@/assets/chat-metro.jpg";
import friends from "@/assets/friends-steps.jpg";
import journal from "@/assets/journal-chai.jpg";
import desk from "@/assets/focus-desk.jpg";
import circle from "@/assets/circle-terrace.jpg";
import balcony from "@/assets/night-balcony.jpg";
import sticky from "@/assets/sticky-wall.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neeva — Mental wellness reimagined for everyone · ₹99/month" },
      { name: "description", content: "A companion you name yourself, a journal that reflects back, CBT tools, focus timers and real circles — in 6 Indian languages for ₹99/month." },
      { property: "og:title", content: "Neeva — Your head deserves a soft place to land" },
      { property: "og:description", content: "AI companion, journaling, CBT tools and peer circles for ₹99/month." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const WORDS = ["Feel", "it.", "Name", "it.", "Get", "through", "it."];
const TICKER = ["English", "हिन्दी", "ગુજરાતી", "தமிழ்", "मराठी", "বাংলা", "₹99/month", "CBT + ACT", "24×7 crisis help", "no judgement"];

const FEATURES = [
  { icon: MessageCircleHeart, tag: "chat", title: "A companion you name", body: "Pick their vibe — soft bestie, calm coach, wise elder or hype friend.", img: metro, alt: "A young man smiling at his phone on the metro" },
  { icon: BookHeart, tag: "journal", title: "Journal that reads back", body: "Tone, themes and kind reframes after every entry.", img: journal, alt: "Hands holding chai beside an open journal" },
  { icon: Timer, tag: "focus", title: "ADHD-friendly focus", body: "Pomodoro with rain, forest & café sounds, plus points.", img: desk, alt: "A desk by a rainy window with a warm lamp" },
  { icon: Users, tag: "circles", title: "Circles that get it", body: "Anonymous groups for campus, burnout, anxiety & sleep.", img: circle, alt: "Friends talking on a terrace at dusk" },
];

const STATS = [
  { big: "6", small: "languages, incl. Hinglish-friendly replies" },
  { big: "₹99", small: "a month — less than two chais" },
  { big: "24×7", small: "Indian crisis lines, one tap away" },
  { big: "4×3", small: "companion personalities × tones" },
];

const DAY = [
  { time: "8:30 am", icon: Sun, title: "30-sec check-in", body: "Tap a mood, tag what's behind it. Watch your weather over weeks.", bg: "bg-zest", rot: "-rotate-2" },
  { time: "2:00 pm", icon: Timer, title: "Focus sprint", body: "25 minutes, café sounds, phone face-down. Earn points, keep a streak.", bg: "bg-lilac", rot: "rotate-1" },
  { time: "6:15 pm", icon: Users, title: "Circle time", body: "Drop into Burnout Club or Campus Wellness. Anonymous by default.", bg: "bg-rose", rot: "-rotate-1" },
  { time: "11:40 pm", icon: Moon, title: "Brain dump", body: "Journal it out. Neeva reads back themes and one kind reframe.", bg: "bg-sage", rot: "rotate-2" },
];

const THOUGHTS = [
  "my brain has 47 tabs open and one of them is playing music",
  "placement season is eating me alive",
  "i'm fine. (i am not fine.)",
  "everyone else seems to have it figured out??",
  "can't sleep, thinking about that thing i said in 2019",
  "family expectations hitting different this week",
];

const HELLOS = [
  { t: "How are you, really?", r: "ngl, how are you actually?", l: "English" },
  { t: "सच में, कैसे हो?", r: "sach mein, kaise ho?", l: "हिन्दी" },
  { t: "ખરેખર, કેમ છો?", r: "kharekhar, kem chho?", l: "ગુજરાતી" },
  { t: "உண்மையா, எப்படி இருக்கீங்க?", r: "unmaiya, eppadi irukeenga?", l: "தமிழ்" },
  { t: "खरंच, कसा आहेस?", r: "kharach, kasa aahes?", l: "मराठी" },
  { t: "সত্যি, কেমন আছো?", r: "sotyi, kemon achho?", l: "বাংলা" },
];

const PLAN = [
  "Unlimited chats with your own companion",
  "AI journal with mood & theme read-backs",
  "Breathing, meditation & CBT thought records",
  "Focus timer with ambient sounds",
  "Anonymous peer circles",
  "Mood history + CSV/JSON export",
];

const FAQ = [
  { q: "Is Neeva a replacement for therapy?", a: "No. Neeva is a daily support space built on CBT and ACT techniques. It doesn't diagnose or prescribe, and it will nudge you towards a professional when that would truly help." },
  { q: "Can I change how the AI talks to me?", a: "Yes — anytime. Choose its name, look, personality, tone, reply length, emoji, and whether you want it to just listen, give advice, do both, or ask questions so you can think it through. You can also leave it a short note, like what to call you." },
  { q: "Who can read my journal and chats?", a: "Your journal entries, moods and chat history stay on the device you use. Your account only stores your name and companion settings." },
  { q: "What happens if I'm in crisis?", a: "If you write something worrying, Neeva gently opens a 30-second safety check and shows Indian helplines like Tele-MANAS 14416 and KIRAN 1800-599-0019, plus a one-tap call to 112." },
  { q: "Which languages are supported?", a: "English, Hindi, Gujarati, Tamil, Marathi and Bengali — in their own script or typed in English letters, like Hinglish (\"bro thak gayi hoon\") or Gujlish (\"chal ne have\"). Your companion replies the way you type, and you can switch mid-conversation." },
  { q: "How much does it cost?", a: "₹99 a month. Cancel anytime." },
];

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay, type: "spring", stiffness: 160, damping: 22 }} className={className}>
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

const TONE_PREFIX: Record<Tone, string> = { gentle: "", honest: "Real talk: ", playful: "Okay, deep breath (dramatic, I know). " };
const LENGTH_TAIL: Record<ReplyLength, string> = {
  short: "",
  balanced: " We can go slow — no pressure to have it all sorted tonight.",
  deep: " Try this: 1) name the feeling, 2) rate it 1–10, 3) write the thought that's loudest. Then we look at it together.",
};

function TalkYourWay() {
  const [approach, setApproach] = useState<Approach>("validate");
  const [tone, setTone] = useState<Tone>("gentle");
  const [length, setLength] = useState<ReplyLength>("short");
  const sample = APPROACHES.find((a) => a.key === approach)!.sample;
  const reply = TONE_PREFIX[tone] + sample + LENGTH_TAIL[length];
  const chip = (on: boolean) =>
    cn("rounded-full border-[1.5px] px-3 py-1.5 text-xs font-bold transition-all duration-200", on ? "border-ink bg-ink text-background" : "border-ink/20 hover:border-ink");
  return (
    <section id="talk" className="scroll-mt-20 border-y-[1.5px] border-ink bg-lilac">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <Eyebrow>Talk your way</Eyebrow>
          <h2 className="mt-2 max-w-xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Some days you want advice. <em className="font-display font-normal">Some days you just want to be heard.</em>
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">Tell your companion how to show up for you. Try it — the reply changes as you tap.</p>
          <div className="mt-8 space-y-5">
            <div>
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider">I want…</p>
              <div className="flex flex-wrap gap-2">
                {APPROACHES.map((a) => (
                  <button key={a.key} type="button" aria-pressed={approach === a.key} onClick={() => setApproach(a.key)} className={chip(approach === a.key)}>{a.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider">Tone</p>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button key={t.key} type="button" aria-pressed={tone === t.key} onClick={() => setTone(t.key)} className={chip(tone === t.key)}>{t.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider">Replies</p>
              <div className="flex flex-wrap gap-2">
                {LENGTHS.map((l) => (
                  <button key={l.key} type="button" aria-pressed={length === l.key} onClick={() => setLength(l.key)} className={chip(length === l.key)}>{l.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <div className="rounded-[2rem] border-[1.5px] border-ink bg-card p-5 shadow-pop-lg">
            <div className="flex items-center gap-2 border-b-[1.5px] border-ink/10 pb-3">
              <CompanionAvatar avatar="moon" animated className="size-9 rounded-xl" />
              <div>
                <p className="text-sm font-bold">Mitra</p>
                <p className="font-mono text-[10px] text-muted-foreground">your companion · named by you</p>
              </div>
            </div>
            <div className="ml-auto mt-4 w-fit max-w-[85%] rounded-3xl rounded-br-lg border-[1.5px] border-ink bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              exams in 3 days and i haven't started. i feel like such a failure
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={approach + tone + length} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 300, damping: 26 }} className="mt-3 max-w-[92%] rounded-3xl rounded-bl-lg bg-muted px-4 py-3 text-sm leading-relaxed">
                {reply}
              </motion.div>
            </AnimatePresence>
          </div>
          <span className="absolute -right-3 -top-4 rotate-6 rounded-full border-[1.5px] border-ink bg-zest px-3 py-1 font-mono text-[11px] font-bold text-zest-foreground">live preview</span>
        </div>
      </div>
    </section>
  );
}

function Landing() {
  const { session } = useAuthSession();
  const cta = session ? { to: "/today" as const, label: "Open my space" } : { to: "/auth" as const, label: "Start for ₹99" };
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 border-b-[1.5px] border-ink/10 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={mark} alt="" width={816} height={816} className="size-8" />
            <span className="text-xl font-extrabold tracking-tight">neeva</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 text-sm font-semibold text-muted-foreground lg:flex">
            {[["#features", "Features"], ["#talk", "Talk your way"], ["#safety", "Safety"], ["#pricing", "Pricing"], ["#faq", "FAQ"]].map(([h, l]) => (
              <a key={h} href={h} className="rounded-full px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground">{l}</a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!session && (
              <Link to="/auth" search={{ mode: "signin" }} className="hidden h-10 items-center rounded-full px-4 text-sm font-bold hover:bg-muted sm:inline-flex">Log in</Link>
            )}
            <Link to={cta.to} className="pop press inline-flex h-10 items-center gap-1.5 rounded-full bg-zest px-4 text-sm font-bold text-zest-foreground">
              {cta.label} <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:pt-16">
        <div>
          <motion.span initial={{ opacity: 0, rotate: -8 }} animate={{ opacity: 1, rotate: -3 }} className="inline-block rounded-full border-[1.5px] border-ink bg-lilac px-3 py-1 font-mono text-xs font-bold">
            mental wellness, reimagined for everyone
          </motion.span>
          <h1 className="mt-5 text-[clamp(2.8rem,8vw,6.5rem)] font-extrabold leading-[0.92] tracking-[-0.04em]">
            {WORDS.map((w, i) => (
              <motion.span key={i} initial={{ opacity: 0, y: 40, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.08 * i, type: "spring", stiffness: 220, damping: 20 }} className={`mr-[0.22em] inline-block ${w === "it." ? "font-display font-normal italic" : ""}`}>
                {w === "through" ? <span className="highlight">{w}</span> : w}
              </motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Neeva is your pocket wellness space — an AI companion you name yourself, a journal that reflects back, CBT tools and circles of people who get it. In your language, for the price of two chais a month.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }} className="mt-8 flex flex-wrap items-center gap-3">
            <Link to={cta.to} className="pop press inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-background">
              {session ? cta.label : "Create my space"} <ArrowUpRight className="size-4" />
            </Link>
            <span className="font-mono text-xs text-muted-foreground">₹99/month · cancel anytime</span>
          </motion.div>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <motion.div initial={{ opacity: 0, scale: 0.92, rotate: 4 }} animate={{ opacity: 1, scale: 1, rotate: 2 }} transition={{ type: "spring", stiffness: 120, damping: 16 }} className="grain overflow-hidden rounded-[2rem] border-[1.5px] border-ink shadow-pop-lg">
            <img src={hero} alt="A young woman with headphones relaxing on a rooftop at sunset" width={1280} height={1600} className="aspect-[4/5] w-full object-cover" />
          </motion.div>
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="absolute -left-2 bottom-10 max-w-[15rem] animate-float rounded-2xl border-[1.5px] border-ink bg-card p-3 shadow-pop sm:-left-10">
            <div className="flex items-center gap-2"><CompanionAvatar avatar="bloom" className="size-7 rounded-lg" /><b className="text-xs">Saathi</b></div>
            <p className="mt-1.5 text-xs leading-snug">ugh, placement week sounds brutal. wanna try a 2-min reset together?</p>
          </motion.div>
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9, type: "spring" }} className="absolute -right-2 top-6 flex size-20 animate-wiggle items-center justify-center rounded-full border-[1.5px] border-ink bg-zest text-center font-mono text-[11px] font-bold leading-tight text-zest-foreground sm:-right-3">₹99<br />/month</motion.span>
        </div>
      </section>

      <div className="overflow-hidden border-y-[1.5px] border-ink bg-ink py-3 text-background">
        <div className="flex w-max animate-marquee gap-8 whitespace-nowrap font-mono text-sm font-bold">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="flex items-center gap-8">{t}<span className="text-zest">✺</span></span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 pt-16 sm:px-6 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.big} delay={i * 0.06} className="border-l-[1.5px] border-ink/15 px-4 py-2">
            <p className="text-5xl font-extrabold tracking-tight sm:text-6xl">{s.big}</p>
            <p className="mt-1 max-w-[14rem] text-sm text-muted-foreground">{s.small}</p>
          </Reveal>
        ))}
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">Everything your brain asked for. <em className="font-display font-normal">Nothing it didn't.</em></h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.tag} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: i * 0.08, type: "spring", stiffness: 160, damping: 20 }} whileHover={{ y: -6, rotate: i % 2 ? 1 : -1 }} className="group overflow-hidden rounded-[1.75rem] border-[1.5px] border-ink bg-card">
              <div className="relative h-44 overflow-hidden border-b-[1.5px] border-ink">
                <img src={f.img} alt={f.alt} width={1600} height={1072} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <span className="absolute left-3 top-3 rounded-full border-[1.5px] border-ink bg-zest px-2.5 py-0.5 font-mono text-[11px] font-bold text-zest-foreground">/{f.tag}</span>
              </div>
              <div className="p-5">
                <f.icon className="size-5" />
                <h3 className="mt-3 text-lg font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <TalkYourWay />

      {/* Sound familiar */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Eyebrow>Sound familiar?</Eyebrow>
        <h2 className="mt-2 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">The 2am thoughts <em className="font-display font-normal">we were built for.</em></h2>
        <div className="mt-10 flex flex-wrap gap-3">
          {THOUGHTS.map((t, i) => (
            <motion.p key={t} initial={{ opacity: 0, scale: 0.85, rotate: 0 }} whileInView={{ opacity: 1, scale: 1, rotate: i % 2 ? 1.5 : -1.5 }} whileHover={{ rotate: 0, scale: 1.04 }} viewport={{ once: true }} transition={{ delay: i * 0.05, type: "spring", stiffness: 260, damping: 18 }} className={cn("rounded-2xl border-[1.5px] border-ink px-4 py-3 text-base font-semibold sm:text-lg", ["bg-card", "bg-rose", "bg-sage", "bg-lilac", "bg-zest text-zest-foreground", "bg-card"][i])}>
              “{t}”
            </motion.p>
          ))}
        </div>
      </section>

      {/* A day with Neeva */}
      <section className="bg-sand py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Eyebrow>A day with Neeva</Eyebrow>
          <h2 className="mt-2 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">Tiny moments. <em className="font-display font-normal">Big difference.</em></h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DAY.map((d, i) => (
              <Reveal key={d.time} delay={i * 0.08}>
                <div className={cn("h-full rounded-[1.75rem] border-[1.5px] border-ink p-5 shadow-pop transition-transform duration-300 hover:rotate-0", d.bg, d.rot)}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold">{d.time}</span>
                    <span className="flex size-9 items-center justify-center rounded-full border-[1.5px] border-ink bg-card"><d.icon className="size-4" /></span>
                  </div>
                  <h3 className="mt-6 text-xl font-extrabold">{d.title}</h3>
                  <p className="mt-1 text-sm">{d.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="overflow-hidden rounded-[2rem] border-[1.5px] border-ink">
          <img src={friends} alt="Four college friends laughing on campus steps" width={1600} height={1072} loading="lazy" className="h-full w-full object-cover" />
        </motion.div>
        <div className="flex flex-col justify-center rounded-[2rem] border-[1.5px] border-ink bg-sage p-8">
          <Eyebrow>How it works</Eyebrow>
          {["Sign up in 20 seconds — nickname is fine.", "Name your companion and choose how it talks to you.", "Check in daily. Watch your emotional weather shift."].map((s, i) => (
            <motion.div key={s} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} className="mt-5 flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-card font-mono font-bold">{i + 1}</span>
              <p className="pt-2 text-lg font-semibold">{s}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Languages */}
      <section className="border-y-[1.5px] border-ink bg-primary py-20 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground/70">Your language, your way</p>
          <h2 className="mt-2 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">Feelings don't always come <em className="font-display font-normal text-zest">in English.</em></h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HELLOS.map((h, i) => (
              <Reveal key={h.l} delay={i * 0.05}>
                <div className="group flex items-end justify-between gap-3 rounded-2xl border-[1.5px] border-primary-foreground/25 p-5 transition-colors duration-300 hover:border-zest hover:bg-primary-foreground/5">
                  <div>
                    <p className="text-2xl font-bold leading-tight">{h.t}</p>
                    <p className="mt-1 font-mono text-xs text-primary-foreground/70">or just type: “{h.r}”</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-zest px-2.5 py-0.5 font-mono text-[11px] font-bold text-zest-foreground transition-transform duration-300 group-hover:-rotate-6">{h.l}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Safety */}
      <section id="safety" className="mx-auto grid max-w-7xl scroll-mt-20 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Reveal className="relative">
          <div className="overflow-hidden rounded-[2rem] border-[1.5px] border-ink shadow-pop-lg">
            <img src={balcony} alt="A young woman on a balcony at night, calmly talking on the phone with tea" width={1600} height={1072} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          </div>
          <span className="absolute -bottom-4 left-6 -rotate-3 rounded-full border-[1.5px] border-ink bg-crisis px-4 py-1.5 font-mono text-xs font-bold text-crisis-foreground">Tele-MANAS 14416 · 24×7</span>
        </Reveal>
        <div>
          <Eyebrow>Safe by design</Eyebrow>
          <h2 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">Soft vibes. <em className="font-display font-normal">Serious care.</em></h2>
          <div className="mt-8 space-y-4">
            {[
              { icon: LifeBuoy, title: "Crisis check built in", body: "Worrying words open a gentle 30-second safety check with real Indian helplines and one-tap 112." },
              { icon: Lock, title: "Private by default", body: "Your journal, moods and chats stay on your device. Your account holds only your name and companion settings." },
              { icon: Wind, title: "Grounded in real techniques", body: "CBT thought records, ACT defusion, 4-7-8 breathing and 5-4-3-2-1 grounding." },
              { icon: Phone, title: "Not a replacement for therapy", body: "Neeva tells you when a professional would truly help — and never diagnoses." },
            ].map((x, i) => (
              <Reveal key={x.title} delay={i * 0.06} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border-[1.5px] border-ink bg-card"><x.icon className="size-5" /></span>
                <div>
                  <h3 className="font-bold">{x.title}</h3>
                  <p className="text-sm text-muted-foreground">{x.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6">
        <div className="grid gap-6 rounded-[2rem] border-[1.5px] border-ink bg-rose p-6 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Eyebrow>One plan. That's it.</Eyebrow>
            <p className="mt-3 flex items-end gap-2">
              <span className="text-7xl font-extrabold tracking-tighter sm:text-8xl">₹99</span>
              <span className="pb-3 font-mono text-sm font-bold">/month</span>
            </p>
            <p className="mt-2 max-w-sm text-rose-foreground">Everything included. No tiers, no upsells, cancel anytime.</p>
            <Link to={cta.to} className="pop press mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-background">{cta.label} <ArrowUpRight className="size-4" /></Link>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {PLAN.map((p, i) => (
              <Reveal key={p} delay={i * 0.04}>
                <li className="flex items-center gap-3 rounded-2xl border-[1.5px] border-ink bg-card px-4 py-3 text-sm font-semibold">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zest text-zest-foreground"><Check className="size-3.5" /></span>
                  {p}
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto grid max-w-7xl scroll-mt-20 gap-8 px-4 pb-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">Questions, <em className="font-display font-normal">answered.</em></h2>
          <div className="mt-6 flex gap-2">
            <Headphones className="size-5" /><Sunset className="size-5" /><Flower2 className="size-5" />
          </div>
        </div>
        <Accordion type="single" collapsible className="space-y-2">
          {FAQ.map((f, i) => (
            <AccordionItem key={f.q} value={`q${i}`} className="rounded-2xl border-[1.5px] border-ink bg-card px-5 last:border-b-[1.5px]">
              <AccordionTrigger className="text-left text-base font-bold hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] border-[1.5px] border-ink">
          <img src={sticky} alt="A wall of pastel sticky notes and polaroids" width={1600} height={1072} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-ink/70" />
          <div className="relative flex flex-col items-start gap-5 p-8 text-background sm:p-14">
            <Flower2 className="size-8 text-zest" />
            <h2 className="max-w-xl text-4xl font-extrabold tracking-tight sm:text-6xl">Two chais a month. <em className="font-display font-normal">Real care.</em></h2>
            <Link to={cta.to} className="pop press inline-flex h-12 items-center gap-2 rounded-full bg-zest px-6 text-sm font-bold text-zest-foreground">{cta.label} <ArrowUpRight className="size-4" /></Link>
            <p className="flex items-center gap-2 text-sm text-background/80"><LifeBuoy className="size-4" /> In crisis? Call Tele-MANAS 14416 (24×7) or 112.</p>
          </div>
        </div>
      </section>

      <footer className="border-t-[1.5px] border-ink/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <img src={mark} alt="" width={816} height={816} className="size-6" /> Neeva AI — Zero-Knowledge Wellness Compass | Mental Wellness for Everyone Across India
        </div>
        <SecurityBanner />
      </footer>
    </div>
  );
}
