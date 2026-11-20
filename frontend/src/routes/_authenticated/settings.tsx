import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, KeyRound, LogOut, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSignOut } from "@/components/neeva/AppShell";
import { Panel, PanelTitle } from "@/components/neeva/Card";
import { CompanionSetup } from "@/components/neeva/CompanionSetup";
import { SecurityBanner } from "@/components/neeva/SecurityBanner";
import { supabase } from "@/integrations/supabase/client";
import { purgeServerVaultData } from "@/lib/api";
import {
  cryptographicEraseLocalVault,
  generateRecoveryPhrase,
  getOrCreateVaultSessionKey,
} from "@/lib/crypto";
import { exportMoods } from "@/lib/mood-export";
import { LANGUAGES, SCRIPT_STYLES, langInfo } from "@/lib/neeva-data";
import { useNeeva } from "@/lib/neeva-store";
import { companionPatch, useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Neeva" },
      {
        name: "description",
        content:
          "Customise your AI companion, manage your Zero-Knowledge Vault recovery phrase, export your mood data and exercise DPDP Act 2023 cryptographic erasure.",
      },
      { property: "og:title", content: "Settings · Neeva" },
      { property: "og:description", content: "Your companion, your data, your way." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { userId, companion, saveProfile, saving, email } = useProfile();
  const { moods, language, script, update, reset } = useNeeva();
  const lang = langInfo(language);
  const signOut = useSignOut();
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null);
  const [erasing, setErasing] = useState(false);

  const handleGenerateRecoveryPhrase = async () => {
    const phrase = generateRecoveryPhrase();
    await getOrCreateVaultSessionKey(userId, phrase);
    setRecoveryPhrase(phrase);
    toast.success("12-word Zero-Knowledge recovery phrase generated");
  };

  const handleCryptographicErase = async () => {
    setErasing(true);
    try {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      await purgeServerVaultData(token);
      await cryptographicEraseLocalVault();
      reset();
      toast.success("Cryptographic Erase Complete (DPDP Act 2023)", {
        description: "Non-extractable IndexedDB keys and server ciphertext rows have been destroyed.",
      });
      await signOut();
    } finally {
      setErasing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 @3xl:p-8">
      <h2 className="text-4xl font-extrabold tracking-tight @3xl:text-5xl">
        Settings<span className="text-zest">.</span>
      </h2>
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
          Type Hindi, Gujarati or any of these in English letters — "bro thak gayi hoon", "chal ne
          have" — and your companion replies the same way.
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
                language === l.code ? "bg-zest text-zest-foreground" : "bg-card hover:bg-muted"
              )}
            >
              {l.native}
              {l.code !== "en" && (
                <span className="font-mono text-[10px] font-semibold opacity-70">{l.mix}</span>
              )}
            </button>
          ))}
        </div>
        {language !== "en" ? (
          <div
            className="mt-4 grid gap-2 @3xl:grid-cols-3"
            role="radiogroup"
            aria-label="Typing style"
          >
            {SCRIPT_STYLES.map((st) => (
              <button
                key={st.key}
                role="radio"
                aria-checked={script === st.key}
                onClick={() => update(() => ({ script: st.key }))}
                className={cn(
                  "press rounded-2xl border-[1.5px] p-4 text-left transition-colors duration-300",
                  script === st.key
                    ? "pop border-ink bg-sage"
                    : "border-border bg-card hover:border-ink"
                )}
              >
                <p className="text-sm font-bold">
                  {st.key === "roman"
                    ? `${lang.mix} (English letters)`
                    : st.key === "native"
                      ? `${lang.native} script`
                      : st.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{st.line(lang)}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground">
            On English, your companion still switches to Hinglish, Gujlish and the rest if that's
            how you type.
          </p>
        )}
      </Panel>

      {/* Zero-Knowledge Vault & 12-Word Recovery Phrase */}
      <Panel>
        <PanelTitle
          eyebrow="Zero-Knowledge Vault (Web Crypto API)"
          title="Non-extractable AES-GCM-256 key & 12-word recovery phrase"
        />
        <p className="text-sm text-muted-foreground">
          Your journal entries are encrypted on-device using <b>PBKDF2-SHA256 (100,000 iterations)</b>{" "}
          and a non-extractable <b>AES-GCM-256</b> key stored in IndexedDB. Generate a 12-word
          recovery phrase so you can restore your vault without server-side key escrow.
        </p>
        {recoveryPhrase && (
          <div className="mt-4 rounded-2xl border-[1.5px] border-ink bg-sand p-4">
            <p className="font-mono text-[11px] font-bold uppercase text-terracotta">
              Write down your 12-word recovery phrase (never stored on our servers):
            </p>
            <p className="mt-2 select-all font-mono text-sm font-bold tracking-wide">
              {recoveryPhrase}
            </p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleGenerateRecoveryPhrase()}
            className="pop press inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
          >
            <KeyRound className="size-4" />{" "}
            {recoveryPhrase ? "Rotate 12-word recovery phrase" : "Reveal 12-word recovery phrase"}
          </button>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-sage-deep" /> K-Anonymity (K &ge; 50) active for
            community analytics
          </span>
        </div>
      </Panel>

      <Panel>
        <PanelTitle eyebrow="Your data" title="Export mood check-ins" />
        <p className="text-sm text-muted-foreground">
          {moods.length} check-ins saved on this device. Export only includes your own logs.
        </p>
        <div className="mt-4 flex gap-2">
          {(["csv", "json"] as const).map((f) => (
            <button
              key={f}
              disabled={moods.length === 0}
              onClick={() => exportMoods(moods, f)}
              className="pop press inline-flex h-10 items-center gap-2 rounded-full bg-card px-4 text-sm font-bold disabled:opacity-40"
            >
              <Download className="size-4" /> {f.toUpperCase()}
            </button>
          ))}
        </div>
      </Panel>

      {/* DPDP Act 2023 Compliance & 1-Click Cryptographic Erase */}
      <Panel className="border-crisis/40">
        <PanelTitle
          eyebrow="DPDP Act 2023 · Right to Erasure"
          title="1-Click Cryptographic Erase My Data"
        />
        <p className="text-sm text-muted-foreground">
          Permanently destroy your non-extractable Web Crypto key in IndexedDB, wipe all local mood
          and journal state, and purge all ciphertext rows from the SQLite WAL vault.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={erasing}
            onClick={() => void handleCryptographicErase()}
            className="pop press inline-flex h-10 items-center gap-2 rounded-full bg-crisis px-5 text-xs font-bold text-crisis-foreground disabled:opacity-50"
          >
            <Trash2 className="size-4" />{" "}
            {erasing ? "Erasing vault…" : "Cryptographic Erase My Data"}
          </button>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldAlert className="size-4 text-crisis" /> Irreversible zero-knowledge key shred
          </span>
        </div>
      </Panel>

      <Panel>
        <PanelTitle eyebrow="Account & Subscription" title={email} />
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/payment-demo/"
            className="pop press inline-flex h-10 items-center gap-2 rounded-full bg-zest px-4 text-sm font-bold text-zest-foreground"
          >
            Manage Plan &amp; Demo Checkout (₹49–₹149) →
          </a>
          <button
            onClick={() => void signOut()}
            className="inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-ink px-4 text-sm font-bold hover:bg-muted"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </Panel>
      <div className="overflow-hidden rounded-2xl">
        <SecurityBanner />
      </div>
    </div>
  );
}
