import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  EyeOff,
  HeartPulse,
  IndianRupee,
  Lock,
  ShieldCheck,
  TrendingDown,
  Users,
} from "lucide-react";
import { Panel, PanelTitle } from "@/components/neeva/Card";
import { IconBadge, type Tone } from "@/components/neeva/IconBadge";
import { useNeeva } from "@/lib/neeva-store";
import { anonymizeCohorts, MIN_COHORT_SIZE, type Cohort } from "@/lib/privacy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/enterprise")({
  head: () => ({
    meta: [
      { title: "Employer & University Portal · Neeva for Organisations" },
      {
        name: "description",
        content:
          "Privacy-first, aggregate wellbeing analytics for HR teams and universities — engagement, stress trends and top programmes, never individual data.",
      },
      { property: "og:title", content: "Neeva for Organisations · Wellbeing analytics" },
      {
        property: "og:description",
        content:
          "Anonymised engagement and stress insights for HR and universities, at ₹99 per member per month.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EnterprisePage,
});

type Org = {
  name: string;
  kind: string;
  seats: number;
  engagement: number[];
  stress: number[];
  programs: { name: string; sessions: number }[];
  cohortLabel: string;
  cohorts: Cohort[];
  referrals: number;
};

const WEEKS = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);
const MONTHS = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

const ORGS: Record<"uni" | "corp", Org> = {
  uni: {
    name: "Karnavati University",
    kind: "University · Gandhinagar",
    seats: 6200,
    engagement: [34, 38, 41, 45, 44, 52, 58, 61, 66, 63, 69, 72],
    stress: [62, 60, 64, 71, 58, 54],
    programs: [
      { name: "Exam Stress Toolkit", sessions: 4820 },
      { name: "Sleep Coaching", sessions: 3910 },
      { name: "AI Companion Chats", sessions: 3540 },
      { name: "Campus Wellness Circle", sessions: 2260 },
      { name: "Focus Pomodoro", sessions: 1980 },
    ],
    cohortLabel: "School",
    cohorts: [
      { name: "Design", size: 820, stress: 58, engagement: 74 },
      { name: "Law", size: 640, stress: 66, engagement: 61 },
      { name: "Management", size: 1150, stress: 61, engagement: 69 },
      { name: "Liberal Studies", size: 430, stress: 52, engagement: 71 },
      { name: "PhD Scholars", size: 7, stress: 70, engagement: 40 },
    ],
    referrals: 38,
  },
  corp: {
    name: "TechCorp India",
    kind: "Enterprise · Bengaluru & Pune",
    seats: 14500,
    engagement: [22, 27, 31, 33, 38, 42, 47, 49, 53, 57, 59, 64],
    stress: [68, 70, 66, 63, 59, 55],
    programs: [
      { name: "Burnout Recovery", sessions: 9120 },
      { name: "Sleep Coaching", sessions: 7480 },
      { name: "AI Companion Chats", sessions: 6950 },
      { name: "Manager Mental Health 101", sessions: 3310 },
      { name: "Mindful Breaks", sessions: 2870 },
    ],
    cohortLabel: "Department",
    cohorts: [
      { name: "Engineering", size: 6400, stress: 63, engagement: 66 },
      { name: "Sales", size: 2100, stress: 69, engagement: 58 },
      { name: "Customer Success", size: 1800, stress: 61, engagement: 72 },
      { name: "People & HR", size: 240, stress: 50, engagement: 81 },
      { name: "Legal", size: 8, stress: 72, engagement: 35 },
    ],
    referrals: 112,
  },
};

const tip = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    fontSize: 12,
    boxShadow: "var(--elev-float)",
  },
  labelStyle: { fontWeight: 600, color: "var(--foreground)" },
};
const axis = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "var(--muted-foreground)" },
};

function EnterprisePage() {
  const { hydrated } = useNeeva();
  const [key, setKey] = useState<"uni" | "corp">("uni");
  const org = ORGS[key];
  const eng = org.engagement.at(-1)!;
  const stressNow = org.stress.at(-1)!;
  const stressDelta = stressNow - org.stress[0]!;
  const safe = anonymizeCohorts(org.cohorts);

  const kpis: { label: string; value: string; sub: string; icon: typeof Users; tone: Tone }[] = [
    {
      label: "Enrolled members",
      value: org.seats.toLocaleString("en-IN"),
      sub: "Licensed seats",
      icon: Users,
      tone: "sage",
    },
    {
      label: "Anonymised engagement",
      value: `${eng}%`,
      sub: `+${eng - org.engagement[0]!} pts in 12 weeks`,
      icon: Activity,
      tone: "lilac",
    },
    {
      label: "Avg. stress index",
      value: `${stressNow}/100`,
      sub: `${stressDelta}% over 6 months`,
      icon: TrendingDown,
      tone: "rose",
    },
    {
      label: "Monthly investment",
      value: `₹${((org.seats * 99) / 100000).toFixed(1)}L`,
      sub: "₹99 per member / month",
      icon: IndianRupee,
      tone: "periwinkle",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 @3xl:p-8">
      <div className="flex flex-col gap-4 animate-rise @3xl:flex-row @3xl:items-end">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Enterprise HR view
          </p>
          <h2 className="mt-1 font-display text-4xl @3xl:text-5xl">{org.name}</h2>
          <p className="text-sm text-muted-foreground">{org.kind} · Aggregate data only</p>
        </div>
        <div className="inline-flex self-start rounded-full bg-muted p-1">
          {(["uni", "corp"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKey(k)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300",
                key === k ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {ORGS[k].name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-3xl border border-sage-deep/40 bg-sage/50 p-4">
        <Lock className="mt-0.5 size-5 shrink-0 text-sage-foreground" />
        <p className="text-sm text-sage-foreground">
          <b>Privacy guaranteed.</b> Organisations only ever see anonymised, aggregated trends.
          Conversations, journals and mood logs never leave a member's account, and any group
          smaller than {MIN_COHORT_SIZE} people is automatically hidden.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 @4xl:grid-cols-4">
        {kpis.map((k) => (
          <Panel key={k.label} className="p-4">
            <IconBadge icon={k.icon} tone={k.tone} size="sm" />
            <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{k.value}</p>
            <p className="text-xs font-semibold">{k.label}</p>
            <p className="text-[11px] text-muted-foreground">{k.sub}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-5 @4xl:grid-cols-2">
        <Panel>
          <PanelTitle eyebrow="Weekly active members" title="Anonymized engagement rate" />
          <div className="h-56">
            {hydrated && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={org.engagement.map((v, i) => ({ w: WEEKS[i], v }))}
                  margin={{ left: -20, right: 8, top: 8 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 6" />
                  <XAxis dataKey="w" {...axis} />
                  <YAxis domain={[0, 100]} unit="%" {...axis} />
                  <Tooltip {...tip} formatter={(v) => [`${v}%`, "Engagement"]} />
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "var(--card)", stroke: "var(--primary)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelTitle eyebrow="Lower is better" title="Average organisation stress trend" />
          <div className="h-56">
            {hydrated && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={org.stress.map((v, i) => ({ m: MONTHS[i], v }))}
                  margin={{ left: -20, right: 8, top: 8 }}
                >
                  <defs>
                    <linearGradient id="stressFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--terracotta)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--rose)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 6" />
                  <XAxis dataKey="m" {...axis} />
                  <YAxis domain={[30, 90]} {...axis} />
                  <Tooltip {...tip} formatter={(v) => [`${v}/100`, "Stress index"]} />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="var(--terracotta)"
                    strokeWidth={2.5}
                    fill="url(#stressFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {key === "uni" && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              September spike aligns with mid-semester exams — Exam Stress Toolkit usage rose 3×
              that month.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 @4xl:grid-cols-5">
        <Panel className="@4xl:col-span-3">
          <PanelTitle eyebrow="Last 90 days" title="Top accessed programmes" />
          <div className="h-64">
            {hydrated && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={org.programs} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="4 6" />
                  <XAxis type="number" {...axis} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    {...axis}
                    tick={{ fontSize: 11, fill: "var(--foreground)" }}
                  />
                  <Tooltip
                    {...tip}
                    cursor={{ fill: "var(--muted)" }}
                    formatter={(v) => [Number(v).toLocaleString("en-IN"), "Sessions"]}
                  />
                  <Bar
                    dataKey="sessions"
                    fill="var(--sage-deep)"
                    radius={[0, 10, 10, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
        <Panel className="@4xl:col-span-2">
          <PanelTitle eyebrow={`By ${org.cohortLabel.toLowerCase()}`} title="Cohort wellbeing" />
          <div className="space-y-2">
            {safe.map((c) => (
              <div
                key={c.name}
                className={cn(
                  "rounded-2xl border border-border/70 p-3",
                  c.suppressed && "bg-muted/60",
                )}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {c.suppressed
                      ? `< ${MIN_COHORT_SIZE} members`
                      : `${c.size.toLocaleString("en-IN")} members`}
                  </span>
                </div>
                {c.suppressed ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <EyeOff className="size-3.5" /> Hidden to protect individual privacy
                  </p>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <div className="mb-1 flex justify-between">
                        <span className="text-muted-foreground">Stress</span>
                        <b className="tabular-nums">{c.stress}</b>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-terracotta"
                          style={{ width: `${c.stress}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between">
                        <span className="text-muted-foreground">Engagement</span>
                        <b className="tabular-nums">{c.engagement}%</b>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-sage-deep"
                          style={{ width: `${c.engagement}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 @4xl:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            tone: "sage" as Tone,
            title: "Zero individual data",
            text: "HR never sees names, chats, journals or moods — only aggregate trends.",
          },
          {
            icon: HeartPulse,
            tone: "rose" as Tone,
            title: `${org.referrals} confidential referrals`,
            text: "Members connected to licensed counsellors this quarter, privately.",
          },
          {
            icon: Lock,
            tone: "lilac" as Tone,
            title: "Enterprise-grade security",
            text: "End-to-end encryption, GDPR & HIPAA-aligned controls, India data residency.",
          },
        ].map((c) => (
          <Panel key={c.title} className="flex gap-4">
            <IconBadge icon={c.icon} tone={c.tone} />
            <div>
              <p className="font-semibold">{c.title}</p>
              <p className="text-sm text-muted-foreground">{c.text}</p>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
