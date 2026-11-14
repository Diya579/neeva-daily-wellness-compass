import { createFileRoute } from "@tanstack/react-router";
import { Download, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelTitle } from "@/components/neeva/Card";
import { CompanionSetup } from "@/components/neeva/CompanionSetup";
import { SecurityBanner } from "@/components/neeva/SecurityBanner";
import { useSignOut } from "@/components/neeva/AppShell";
import { exportMoods } from "@/lib/mood-export";
import { useNeeva } from "@/lib/neeva-store";
import { useProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Neeva" },
      { name: "description", content: "Customise your AI companion, export your mood data and manage your account." },
      { property: "og:title", content: "Settings · Neeva" },
      { property: "og:description", content: "Your companion, your data, your way." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { companion, saveProfile, saving, email } = useProfile();
  const { moods } = useNeeva();
  const signOut = useSignOut();
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 @3xl:p-8">
      <h2 className="text-4xl font-extrabold tracking-tight @3xl:text-5xl">Settings<span className="text-zest">.</span></h2>
      <Panel>
        <PanelTitle eyebrow="AI companion" title="Name & personality" />
        <CompanionSetup
          initial={companion}
          saving={saving}
          cta="Save companion"
          onSave={async (c) => {
            await saveProfile({ companion_name: c.name, companion_vibe: c.vibe, companion_length: c.length, companion_avatar: c.avatar, companion_emoji: c.emoji, companion_configured: true });
            toast.success(`${c.name} is updated`);
          }}
        />
      </Panel>
      <Panel>
        <PanelTitle eyebrow="Your data" title="Export mood check-ins" />
        <p className="text-sm text-muted-foreground">{moods.length} check-ins saved on this device. Export only includes your own logs.</p>
        <div className="mt-4 flex gap-2">
          {(["csv", "json"] as const).map((f) => (
            <button key={f} disabled={moods.length === 0} onClick={() => exportMoods(moods, f)} className="pop press inline-flex h-10 items-center gap-2 rounded-full bg-card px-4 text-sm font-bold disabled:opacity-40">
              <Download className="size-4" /> {f.toUpperCase()}
            </button>
          ))}
        </div>
      </Panel>
      <Panel>
        <PanelTitle eyebrow="Account" title={email} />
        <button onClick={() => void signOut()} className="inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-ink px-4 text-sm font-bold hover:bg-muted">
          <LogOut className="size-4" /> Sign out
        </button>
      </Panel>
      <div className="overflow-hidden rounded-2xl"><SecurityBanner /></div>
    </div>
  );
}
