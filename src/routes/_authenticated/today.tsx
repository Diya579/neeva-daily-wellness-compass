import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookHeart,
  BrainCircuit,
  Flame,
  Headphones,
  MessageCircleHeart,
  Moon,
  Repeat2,
  Sprout,
  Timer,
  Users,
  Wind,
} from "lucide-react";
import { Panel, PanelTitle } from "@/components/neeva/Card";
import { IconBadge, type Tone } from "@/components/neeva/IconBadge";
import { MoodCheckIn } from "@/components/neeva/MoodCheckIn";
import { MoodHistory } from "@/components/neeva/MoodHistory";
import { GOALS, type Goal } from "@/lib/neeva-data";
import { useNeeva } from "@/lib/neeva-store";
import hero from "@/assets/hero-calm.jpg";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today · Neeva — Your daily wellness space" },
      {
        name: "description",
        content:
          "Check in with your mood, see your emotional trends and get gentle, personalised practices for today.",
      },
      { property: "og:title", content: "Today · Neeva" },
      {
        property: "og:description",
        content:
          "Daily mood check-ins, AI wellness tips and quick calming exercises — for ₹99/month.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Today,
});

type Rec = {
  title: string;
  meta: string;
  icon: typeof Wind;
  tone: Tone;
  to: "/hub" | "/journal" | "/chat" | "/community";
  tab?: "meditate" | "reframe" | "focus" | "games";
};

const RECS: Record<Goal, Rec[]> = {
  stress: [
    {
      title: "4-7-8 Breathing Reset",
      meta: "3 min · Breathing",
      icon: Wind,
      tone: "sage",
      to: "/hub",
      tab: "meditate",
    },
    {
      title: "Reframe a worry",
      meta: "6 min · CBT thought record",
      icon: Repeat2,
      tone: "lilac",
      to: "/hub",
      tab: "reframe",
    },
    {
      title: "Talk it through with Neeva",
      meta: "Anytime · AI companion",
      icon: MessageCircleHeart,
      tone: "rose",
      to: "/chat",
    },
  ],
  focus: [
    {
      title: "25-minute Focus Sprint",
      meta: "Pomodoro · Rain sounds",
      icon: Timer,
      tone: "lilac",
      to: "/hub",
      tab: "focus",
    },
    {
      title: "Distortion Detective",
      meta: "4 min · CBT game",
      icon: BrainCircuit,
      tone: "sage",
      to: "/hub",
      tab: "games",
    },
    {
      title: "Join ADHD Focus Squad",
      meta: "98 people body-doubling now",
      icon: Users,
      tone: "rose",
      to: "/community",
    },
  ],
  community: [
    {
      title: "Campus Wellness circle",
      meta: "167 active now",
      icon: Users,
      tone: "rose",
      to: "/community",
    },
    {
      title: "What went well today?",
      meta: "5 min · Guided journal",
      icon: BookHeart,
      tone: "sage",
      to: "/journal",
    },
    {
      title: "Talk it through with Neeva",
      meta: "Anytime · AI companion",
      icon: MessageCircleHeart,
      tone: "lilac",
      to: "/chat",
    },
  ],
  sleep: [
    {
      title: "Sleep Descent",
      meta: "15 min · Guided meditation",
      icon: Moon,
      tone: "periwinkle",
      to: "/hub",
      tab: "meditate",
    },
    {
      title: "Unload your mind",
      meta: "5 min · Bedtime journal",
      icon: BookHeart,
      tone: "sage",
      to: "/journal",
    },
    {
      title: "Sleep Better Together",
      meta: "76 people online",
      icon: Users,
      tone: "rose",
      to: "/community",
    },
  ],
};

const QUICK: Rec[] = [
  { title: "Breathe", meta: "4-7-8", icon: Wind, tone: "sage", to: "/hub", tab: "meditate" },
  {
    title: "Reframe",
    meta: "Thought record",
    icon: Repeat2,
    tone: "lilac",
    to: "/hub",
    tab: "reframe",
  },
  { title: "Focus", meta: "Pomodoro", icon: Timer, tone: "rose", to: "/hub", tab: "focus" },
  {
    title: "Meditate",
    meta: "5–15 min",
    icon: Headphones,
    tone: "periwinkle",
    to: "/hub",
    tab: "meditate",
  },
];

function RecLink({
  r,
  children,
  className,
}: {
  r: Rec;
  children: React.ReactNode;
  className?: string;
}) {
  if (r.to === "/hub")
    return (
      <Link to="/hub" search={r.tab ? { tab: r.tab } : {}} className={className}>
        {children}
      </Link>
    );
  return (
    <Link to={r.to} className={className}>
      {children}
    </Link>
  );
}

function Today() {
  const { name, goal, points, moods, focusSessions, journal, hydrated } = useNeeva();
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);

  const days = new Set(moods.map((m) => m.at.slice(0, 10)));
  let streak = 0;
  if (hydrated) {
    const d = new Date();
    while (days.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 @3xl:p-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-primary text-primary-foreground shadow-float animate-rise">
        <img
          src={hero}
          alt="A woman resting with eyes closed among soft pastel flowers"
          width={1600}
          height={1008}
          className="absolute inset-0 h-full w-full object-cover object-[75%_center] opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary/0 @3xl:via-primary/60" />
        <div className="relative max-w-xl p-6 @3xl:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
            {greeting}
            {name ? `, ${name}` : ""}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-[1.02] @3xl:text-6xl">
            You deserve to feel <em className="text-rose">truly understood.</em>
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-primary-foreground/80">
            Today's focus:{" "}
            <b className="text-primary-foreground">{GOALS.find((g) => g.key === goal)?.label}</b>.
            Take a breath — small steps count here.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/chat"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary-foreground px-5 text-sm font-semibold text-primary transition-all duration-300 hover:gap-3"
            >
              Talk to Neeva <ArrowUpRight className="size-4" />
            </Link>
            <Link
              to="/journal"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-primary-foreground/30 px-5 text-sm font-semibold backdrop-blur transition-all duration-300 hover:bg-primary-foreground/10"
            >
              Write today's entry
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: "Day streak", value: streak, icon: Flame, tone: "rose" as Tone },
          { label: "Wellness points", value: points, icon: Sprout, tone: "sage" as Tone },
          {
            label: "Practices done",
            value: focusSessions + journal.length + moods.length,
            icon: Headphones,
            tone: "lilac" as Tone,
          },
        ].map((s) => (
          <Panel key={s.label} className="flex flex-col gap-3 p-4 @3xl:flex-row @3xl:items-center">
            <IconBadge icon={s.icon} tone={s.tone} size="sm" />
            <div>
              <p className="text-2xl font-bold tabular-nums leading-none">
                {hydrated ? s.value : "–"}
              </p>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">{s.label}</p>
            </div>
          </Panel>
        ))}
      </section>

      <div className="grid gap-5 @4xl:grid-cols-5">
        <Panel className="@4xl:col-span-2">
          <PanelTitle eyebrow="Daily check-in" title="How are you feeling today?" />
          <MoodCheckIn />
        </Panel>
        <Panel className="@4xl:col-span-3">
          <PanelTitle eyebrow="Mood history" title="Your emotional weather" />
          <MoodHistory />
        </Panel>
      </div>

      <div className="grid gap-5 @4xl:grid-cols-5">
        <Panel className="@4xl:col-span-2">
          <PanelTitle eyebrow="Quick exercises" title="Two minutes for you" />
          <div className="grid grid-cols-2 gap-3">
            {QUICK.map((q) => (
              <RecLink
                key={q.title}
                r={q}
                className="group flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-muted"
              >
                <IconBadge icon={q.icon} tone={q.tone} size="sm" />
                <span>
                  <span className="block text-sm font-semibold">{q.title}</span>
                  <span className="text-xs text-muted-foreground">{q.meta}</span>
                </span>
              </RecLink>
            ))}
          </div>
        </Panel>
        <Panel className="@4xl:col-span-3">
          <PanelTitle
            eyebrow="Picked for you"
            title={`Because you want to ${GOALS.find((g) => g.key === goal)?.label.toLowerCase()}`}
          />
          <div className="space-y-2.5">
            {RECS[goal].map((r) => (
              <RecLink
                key={r.title}
                r={r}
                className="group flex items-center gap-4 rounded-2xl border border-border/70 p-3 transition-all duration-300 hover:border-sage-deep hover:bg-muted/50"
              >
                <IconBadge icon={r.icon} tone={r.tone} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{r.title}</span>
                  <span className="text-xs text-muted-foreground">{r.meta}</span>
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
              </RecLink>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
