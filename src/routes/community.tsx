import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Baby,
  BookOpen,
  Briefcase,
  Check,
  Flower,
  GraduationCap,
  Heart,
  MessageCircle,
  Moon,
  Search,
  Send,
  ShieldCheck,
  Wind,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelTitle } from "@/components/neeva/Card";
import { CrisisButton } from "@/components/neeva/CrisisDialog";
import { IconBadge } from "@/components/neeva/IconBadge";
import { ALIASES, GROUPS, POSTS, type Group, type Post } from "@/lib/neeva-data";
import { useNeeva } from "@/lib/neeva-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community & Support · Neeva" },
      {
        name: "description",
        content:
          "Anonymous, moderated peer support groups for anxiety, campus life, corporate burnout, ADHD and more — plus instant crisis help.",
      },
      { property: "og:title", content: "Community & Support · Neeva" },
      {
        property: "og:description",
        content: "Find people who truly get it — anonymously, safely, kindly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunityPage,
});

const ICONS: Record<Group["icon"], typeof Wind> = {
  wind: Wind,
  graduation: GraduationCap,
  briefcase: Briefcase,
  baby: Baby,
  flower: Flower,
  zap: Zap,
  moon: Moon,
  heart: Heart,
  book: BookOpen,
};
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const ago = (m: number) => (m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`);

function CommunityPage() {
  const { joinedGroups, update } = useNeeva();
  const [q, setQ] = useState("");
  const [posts, setPosts] = useState<Post[]>(POSTS);
  const [hugged, setHugged] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [postGroup, setPostGroup] = useState(joinedGroups[0] ?? "anxiety");
  const [filter, setFilter] = useState<string | null>(null);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    return GROUPS.filter(
      (g) =>
        !s ||
        g.name.toLowerCase().includes(s) ||
        g.tags.some((t) => t.includes(s)) ||
        g.description.toLowerCase().includes(s),
    );
  }, [q]);

  const toggleJoin = (g: Group) => {
    const joined = joinedGroups.includes(g.id);
    update((s) => ({
      joinedGroups: joined ? s.joinedGroups.filter((x) => x !== g.id) : [...s.joinedGroups, g.id],
    }));
    if (!joined)
      toast.success(`Welcome to ${g.name}`, {
        description: "You'll appear as an anonymous alias. Be kind, be you.",
      });
  };

  const share = () => {
    if (draft.trim().length < 5) return;
    setPosts((p) => [
      {
        id: Math.random().toString(36).slice(2),
        alias: ALIASES[p.length % ALIASES.length]!,
        group: postGroup,
        minutesAgo: 0,
        text: draft.trim(),
        support: 0,
        replies: 0,
      },
      ...p,
    ]);
    setDraft("");
    toast.success("Shared anonymously", { description: "Peer listeners will see it shortly." });
  };

  const feed = posts.filter((p) => !filter || p.group === filter);
  const groupName = (id: string) => GROUPS.find((g) => g.id === id)?.name ?? id;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 @3xl:p-8">
      <div className="animate-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Community &amp; support
        </p>
        <h2 className="mt-1 font-display text-4xl @3xl:text-5xl">
          You're among <em className="text-lilac-foreground">people who get it.</em>
        </h2>
      </div>

      <div className="flex flex-col gap-4 rounded-3xl bg-crisis-soft p-5 @2xl:flex-row @2xl:items-center">
        <div className="flex-1">
          <p className="font-semibold">Need to talk to someone right now?</p>
          <p className="text-sm text-muted-foreground">
            Free, confidential helplines and a grounding exercise — available 24×7.
          </p>
        </div>
        <CrisisButton />
      </div>

      <div className="grid gap-5 @4xl:grid-cols-5">
        <div className="space-y-5 @4xl:col-span-3">
          <Panel>
            <div className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage text-sm font-bold text-sage-foreground">
                ✿
              </span>
              <div className="flex-1">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={600}
                  placeholder="Share something anonymously — a win, a worry, a question…"
                  className="min-h-20 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={postGroup}
                    onChange={(e) => setPostGroup(e.target.value)}
                    className="h-9 rounded-full border border-border bg-background px-3 text-xs font-medium outline-none"
                    aria-label="Post to group"
                  >
                    {GROUPS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-sage-deep" /> Posted as an alias
                  </span>
                  <button
                    onClick={share}
                    disabled={draft.trim().length < 5}
                    className="ml-auto inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-all duration-300 disabled:opacity-40"
                  >
                    <Send className="size-3.5" /> Share
                  </button>
                </div>
              </div>
            </div>
          </Panel>

          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            <button
              onClick={() => setFilter(null)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-300",
                !filter
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card",
              )}
            >
              All circles
            </button>
            {GROUPS.filter((g) => posts.some((p) => p.group === g.id)).map((g) => (
              <button
                key={g.id}
                onClick={() => setFilter(g.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-300",
                  filter === g.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card",
                )}
              >
                {g.name}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {feed.map((p) => {
              const on = hugged.includes(p.id);
              return (
                <Panel key={p.id} className="animate-rise p-4">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-full bg-lilac text-xs font-bold text-lilac-foreground">
                      {p.alias
                        .split(" ")
                        .map((w) => w[0])
                        .join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{p.alias}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {groupName(p.group)} · {p.minutesAgo === 0 ? "just now" : ago(p.minutesAgo)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed">{p.text}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() =>
                        setHugged((h) => (on ? h.filter((x) => x !== p.id) : [...h, p.id]))
                      }
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all duration-300",
                        on
                          ? "bg-rose text-rose-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Heart
                        className={cn(
                          "size-3.5 transition-transform duration-300",
                          on && "scale-125 fill-current",
                        )}
                      />{" "}
                      {p.support + (on ? 1 : 0)} support
                    </button>
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground">
                      <MessageCircle className="size-3.5" /> {p.replies} replies
                    </span>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>

        <div className="space-y-5 @4xl:col-span-2">
          <Panel>
            <PanelTitle eyebrow="Peer circles" title="Find your people" />
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search anxiety, exams, burnout…"
                className="h-11 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm outline-none transition-all duration-300 focus:border-sage-deep focus:ring-4 focus:ring-sage/50"
              />
            </div>
            <div className="space-y-2.5">
              {groups.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No circles match “{q}” yet.
                </p>
              )}
              {groups.map((g) => {
                const joined = joinedGroups.includes(g.id);
                return (
                  <div
                    key={g.id}
                    className="flex items-start gap-3 rounded-2xl border border-border/70 p-3 transition-all duration-300 hover:border-sage-deep"
                  >
                    <IconBadge icon={ICONS[g.icon]} tone={g.tone} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{g.name}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{g.description}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-sage-deep" /> {g.activeNow} online
                        · {k(g.members + (joined ? 1 : 0))} members
                      </p>
                    </div>
                    <button
                      onClick={() => toggleJoin(g)}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold transition-all duration-300",
                        joined
                          ? "bg-sage text-sage-foreground"
                          : "bg-primary text-primary-foreground hover:opacity-90",
                      )}
                    >
                      {joined ? (
                        <>
                          <Check className="size-3.5" /> Joined
                        </>
                      ) : (
                        "Join"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel className="bg-sand">
            <p className="font-semibold">Community promise</p>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li>• Every member is anonymous by default</li>
              <li>• Trained peer listeners moderate 24×7</li>
              <li>• Posts mentioning risk are gently escalated to crisis support</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
