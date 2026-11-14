import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowUpRight, BookHeart, Flower2, LifeBuoy, MessageCircleHeart, Timer, Users } from "lucide-react";
import { useAuthSession } from "@/lib/auth-session";
import { SecurityBanner } from "@/components/neeva/SecurityBanner";
import { CompanionAvatar } from "@/components/neeva/CompanionAvatar";
import mark from "@/assets/neeva-mark.png";
import hero from "@/assets/landing-hero.jpg";
import friends from "@/assets/friends-steps.jpg";
import journal from "@/assets/journal-chai.jpg";
import desk from "@/assets/focus-desk.jpg";
import circle from "@/assets/circle-terrace.jpg";
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
  { icon: MessageCircleHeart, tag: "chat", title: "A companion you name", body: "Pick their vibe — soft bestie, calm coach, wise elder or hype friend.", img: hero, w: 1280, h: 1600 },
  { icon: BookHeart, tag: "journal", title: "Journal that reads back", body: "Tone, themes and kind reframes after every entry.", img: journal, w: 1280, h: 1600 },
  { icon: Timer, tag: "focus", title: "ADHD-friendly focus", body: "Pomodoro with rain, forest & café sounds, plus points.", img: desk, w: 1600, h: 1072 },
  { icon: Users, tag: "circles", title: "Circles that get it", body: "Anonymous groups for campus, burnout, anxiety & sleep.", img: circle, w: 1600, h: 1072 },
];

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
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="absolute -left-4 bottom-10 max-w-[15rem] animate-float rounded-2xl border-[1.5px] border-ink bg-card p-3 shadow-pop sm:-left-10">
            <div className="flex items-center gap-2"><CompanionAvatar avatar="bloom" className="size-7 rounded-lg" /><b className="text-xs">Saathi</b></div>
            <p className="mt-1.5 text-xs leading-snug">ugh, placement week sounds brutal. wanna try a 2-min reset together?</p>
          </motion.div>
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9, type: "spring" }} className="absolute -right-3 top-6 flex size-20 animate-wiggle items-center justify-center rounded-full border-[1.5px] border-ink bg-zest text-center font-mono text-[11px] font-bold leading-tight text-zest-foreground">₹99<br />/month</motion.span>
        </div>
      </section>

      <div className="overflow-hidden border-y-[1.5px] border-ink bg-ink py-3 text-background">
        <div className="flex w-max animate-marquee gap-8 whitespace-nowrap font-mono text-sm font-bold">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="flex items-center gap-8">{t}<span className="text-zest">✺</span></span>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">Everything your brain asked for. <em className="font-display font-normal">Nothing it didn't.</em></h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.tag} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: i * 0.08, type: "spring", stiffness: 160, damping: 20 }} whileHover={{ y: -6, rotate: i % 2 ? 1 : -1 }} className="group overflow-hidden rounded-[1.75rem] border-[1.5px] border-ink bg-card">
              <div className="relative h-44 overflow-hidden border-b-[1.5px] border-ink">
                <img src={f.img} alt="" width={f.w} height={f.h} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
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

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-20 sm:px-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="overflow-hidden rounded-[2rem] border-[1.5px] border-ink">
          <img src={friends} alt="Four college friends laughing on campus steps" width={1600} height={1072} loading="lazy" className="h-full w-full object-cover" />
        </motion.div>
        <div className="flex flex-col justify-center rounded-[2rem] border-[1.5px] border-ink bg-sage p-8">
          <p className="font-mono text-xs font-bold uppercase tracking-wider">How it works</p>
          {["Sign up in 20 seconds — nickname is fine.", "Name your companion and pick its vibe.", "Check in daily. Watch your emotional weather shift."].map((s, i) => (
            <motion.div key={s} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} className="mt-5 flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-card font-mono font-bold">{i + 1}</span>
              <p className="pt-2 text-lg font-semibold">{s}</p>
            </motion.div>
          ))}
        </div>
      </section>

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
          <img src={mark} alt="" width={816} height={816} className="size-6" /> © 2026 Neeva · Not a substitute for emergency care.
        </div>
        <SecurityBanner />
      </footer>
    </div>
  );
}
