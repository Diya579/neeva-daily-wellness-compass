import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BrainCircuit, Headphones, Repeat2, Timer } from "lucide-react";
import { Panel, PanelTitle } from "@/components/neeva/Card";
import { BreathingCircle } from "@/components/neeva/hub/BreathingCircle";
import { DistortionGame } from "@/components/neeva/hub/DistortionGame";
import { FocusTimer } from "@/components/neeva/hub/FocusTimer";
import { MeditationPlayer } from "@/components/neeva/hub/MeditationPlayer";
import { ThoughtRecord } from "@/components/neeva/hub/ThoughtRecord";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "meditate", label: "Meditate", icon: Headphones },
  { key: "reframe", label: "Thought Record", icon: Repeat2 },
  { key: "focus", label: "Focus", icon: Timer },
  { key: "games", label: "Mind Games", icon: BrainCircuit },
] as const;
type HubTab = (typeof TABS)[number]["key"];

export const Route = createFileRoute("/hub")({
  validateSearch: (s: Record<string, unknown>): { tab?: HubTab } => {
    const t = s["tab"];
    return TABS.some((x) => x.key === t) ? { tab: t as HubTab } : {};
  },
  head: () => ({
    meta: [
      { title: "Behavioral Hub · Meditation, CBT & Focus — Neeva" },
      {
        name: "description",
        content:
          "Guided meditations, 4-7-8 breathing, CBT thought records, thinking-trap games and an ADHD-friendly Pomodoro timer.",
      },
      { property: "og:title", content: "Behavioral Hub · Neeva" },
      {
        property: "og:description",
        content: "Evidence-based tools to calm, reframe and focus — all in one gentle space.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HubPage,
});

function HubPage() {
  const { tab = "meditate" } = Route.useSearch();
  const navigate = useNavigate({ from: "/hub" });

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 @3xl:p-8">
      <div className="animate-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Behavioral hub
        </p>
        <h2 className="mt-1 font-display text-4xl @3xl:text-5xl">
          Small practices, <em className="text-terracotta">real change.</em>
        </h2>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => navigate({ search: { tab: key }, replace: true })}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300",
              tab === key
                ? "border-primary bg-primary text-primary-foreground shadow-soft"
                : "border-border bg-card hover:border-sage-deep",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-rise">
        {tab === "meditate" && (
          <div className="grid gap-5 @4xl:grid-cols-2">
            <Panel className="p-0">
              <MeditationPlayer />
            </Panel>
            <Panel>
              <PanelTitle eyebrow="Breathing" title="4-7-8 calming breath" />
              <BreathingCircle />
              <p className="mt-2 rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">
                A longer exhale activates the parasympathetic nervous system — the body's natural
                “rest and digest” mode. Four cycles is plenty to start.
              </p>
            </Panel>
          </div>
        )}
        {tab === "reframe" && (
          <Panel className="mx-auto max-w-3xl">
            <PanelTitle eyebrow="CBT worksheet" title="Thought record" />
            <ThoughtRecord />
          </Panel>
        )}
        {tab === "focus" && (
          <Panel>
            <PanelTitle eyebrow="ADHD focus tool" title="Gentle Pomodoro" />
            <FocusTimer />
          </Panel>
        )}
        {tab === "games" && (
          <Panel className="mx-auto max-w-3xl">
            <PanelTitle eyebrow="CBT game" title="Distortion Detective" />
            <DistortionGame />
          </Panel>
        )}
      </div>
    </div>
  );
}
