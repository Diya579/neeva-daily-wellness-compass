import { useState } from "react";
import { motion } from "motion/react";
import { Check, Sparkles } from "lucide-react";
import { AVATARS, LENGTHS, NAME_IDEAS, VIBES, sanitizeCompanionName, type Companion } from "@/lib/companion";
import { cn } from "@/lib/utils";
import { CompanionAvatar } from "./CompanionAvatar";

/** Pick a name, vibe, reply length, avatar and emoji use for the AI companion. */
export function CompanionSetup({
  initial,
  onSave,
  saving,
  cta = "Meet your companion",
}: {
  initial: Companion;
  onSave: (c: Companion) => void | Promise<void>;
  saving?: boolean;
  cta?: string;
}) {
  const [c, setC] = useState<Companion>(initial);
  const set = (p: Partial<Companion>) => setC((x) => ({ ...x, ...p }));
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <motion.div key={c.avatar} initial={{ scale: 0.6, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
          <CompanionAvatar avatar={c.avatar} animated className="size-16 rounded-3xl shadow-pop" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <label htmlFor="companion-name" className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name your companion</label>
          <input id="companion-name" value={c.name} maxLength={24} onChange={(e) => set({ name: e.target.value })} className="mt-1 h-12 w-full rounded-2xl border-[1.5px] border-ink/20 bg-card px-4 text-lg font-bold outline-none focus:border-ink" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {NAME_IDEAS.map((n) => (
          <button key={n} type="button" onClick={() => set({ name: n })} className={cn("rounded-full border-[1.5px] px-3 py-1 text-xs font-semibold transition-all", c.name === n ? "border-ink bg-zest" : "border-ink/15 hover:border-ink")}>{n}</button>
        ))}
      </div>
      <div>
        <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Look</p>
        <div className="flex gap-3">
          {AVATARS.map((a) => (
            <button key={a} type="button" aria-label={`Avatar ${a}`} aria-pressed={c.avatar === a} onClick={() => set({ avatar: a })} className={cn("rounded-2xl p-1 transition-all", c.avatar === a ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100")}>
              <CompanionAvatar avatar={a} className="size-12" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vibe</p>
        <div className="grid gap-2 @xl:grid-cols-2">
          {VIBES.map((v) => (
            <motion.button whileTap={{ scale: 0.97 }} key={v.key} type="button" onClick={() => set({ vibe: v.key })} className={cn("rounded-2xl border-[1.5px] p-3 text-left transition-all", c.vibe === v.key ? "border-ink bg-lilac shadow-pop" : "border-ink/15 hover:border-ink")}>
              <span className="flex items-center justify-between text-sm font-bold">{v.label}{c.vibe === v.key && <Check className="size-4" />}</span>
              <span className="block text-xs text-muted-foreground">{v.line}</span>
              <span className="mt-2 block text-xs italic">“{v.sample}”</span>
            </motion.button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reply length</p>
          <div className="inline-flex rounded-full border-[1.5px] border-ink p-1">
            {LENGTHS.map((l) => (
              <button key={l.key} type="button" title={l.hint} onClick={() => set({ length: l.key })} className={cn("rounded-full px-3 py-1.5 text-xs font-bold transition-colors", c.length === l.key ? "bg-ink text-background" : "text-muted-foreground")}>{l.label}</button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={c.emoji} onChange={(e) => set({ emoji: e.target.checked })} className="size-4 accent-[var(--ink)]" /> Emoji allowed
        </label>
      </div>
      <button type="button" disabled={saving} onClick={() => void onSave({ ...c, name: sanitizeCompanionName(c.name) })} className="pop press inline-flex h-12 items-center gap-2 rounded-full bg-zest px-6 text-sm font-bold text-zest-foreground disabled:opacity-60">
        <Sparkles className="size-4" /> {cta}
      </button>
    </div>
  );
}
