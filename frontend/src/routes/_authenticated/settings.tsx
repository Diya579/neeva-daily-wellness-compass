import { createFileRoute } from "@tanstack/react-router";
import { Download, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelTitle } from "@/components/neeva/Card";
import { CompanionSetup } from "@/components/neeva/CompanionSetup";
import { SecurityBanner } from "@/components/neeva/SecurityBanner";
import { useSignOut } from "@/components/neeva/AppShell";
import { exportMoods } from "@/lib/mood-export";
import { LANGUAGES, SCRIPT_STYLES, langInfo } from "@/lib/neeva-data";
import { cn } from "@/lib/utils";
import { useNeeva } from "@/lib/neeva-store";
import { companionPatch, useProfile } from "@/lib/profile";

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
  const { moods, language, script, update } = useNeeva();
  const lang = langInfo(language);
  const signOut = useSignOut();
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 @3xl:p-8">
      <h2 className="text-4xl font-extrabold tracking-tight @3xl:text-5xl">Settings<span className="text-zest">.</span></h2>
      <Panel>
        <PanelTitle eyebrow="AI companion" title="Name, personality & how they talk" />
        <CompanionSetup
          initial={companion}
          saving={saving}
          cta="Save companion"
          saveAnytime
          onSave={async (c) => {
            await saveProfile(companionPatch(c));
            toast.success(`${c.name} is updated`);
          }}
        />
      </Panel>
      <Panel>
        <PanelTitle eyebrow="Language & typing" title="Talk the way you text" />
        <p className="text-sm text-muted-foreground">
          Type Hindi, Gujarati or any of these in English letters — "bro thak gayi hoon", "chal ne have" — and your companion replies the same way.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Language">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              role="radio"
              aria-checked={language === l.code}
              onClick={() => update(() => ({ language: l.code }))}
              className={cn(
                "press inline-flex h-10 items-center gap-1.5 rounded-full border-[1.5px] border-ink px-4 text-sm font-bold transition-colors duration-300",
                language === l.code ? "bg-zest text-zest-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {l.native}
              {l.code !== "en" && <span className="font-mono text-[10px] font-semibold opacity-70">{l.mix}</span>}
            </button>
          ))}
        </div>
        {language !== "en" ? (
          <div className="mt-4 grid gap-2 @3xl:grid-cols-3" role="radiogroup" aria-label="Typing style">
            {SCRIPT_STYLES.map((st) => (
              <button
                key={st.key}
                role="radio"
                aria-checked={script === st.key}
                onClick={() => update(() => ({ script: st.key }))}
                className={cn(
                  "press rounded-2xl border-[1.5px] p-4 text-left transition-colors duration-300",
                  script === st.key ? "pop border-ink bg-sage" : "border-border bg-card hover:border-ink",
                )}
              >
                <p className="text-sm font-bold">{st.key === "roman" ? `${lang.mix} (English letters)` : st.key === "native" ? `${lang.native} script` : st.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{st.line(lang)}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground">
            On English, your companion still switches to Hinglish, Gujlish and the rest if that's how you type.
          </p>
        )}
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
