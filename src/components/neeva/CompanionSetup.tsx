import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import {
  APPROACHES,
  AVATARS,
  LENGTHS,
  NAME_IDEAS,
  NOTES_MAX,
  TONES,
  VIBES,
  sanitizeCompanionName,
  sanitizeNotes,
  type Companion,
} from "@/lib/companion";
import { cn } from "@/lib/utils";
import { CompanionAvatar } from "./CompanionAvatar";

const STEPS = ["Meet", "Personality", "How to help", "Details"] as const;

const label = "mb-2 block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

function Choice({
  on,
  onClick,
  title,
  line,
  tone = "lilac",
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  line: string;
  tone?: "lilac" | "sage" | "rose";
}) {
  const bg = { lilac: "bg-lilac", sage: "bg-sage", rose: "bg-rose" }[tone];
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-2xl border-[1.5px] p-3 text-left transition-all duration-200",
        on ? `border-ink ${bg} shadow-pop` : "border-ink/15 hover:border-ink",
      )}
    >
      <span className="flex items-center justify-between gap-2 text-sm font-bold">
        {title}
        {on && <Check className="size-4 shrink-0" />}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{line}</span>
    </motion.button>
  );
}

/** Pick a name, look, personality, tone, what kind of help, reply length and notes for the AI companion. */
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
  const [step, setStep] = useState(0);
  const set = (p: Partial<Companion>) => setC((x) => ({ ...x, ...p }));
  const approach = APPROACHES.find((a) => a.key === c.approach)!;
  const last = step === STEPS.length - 1;
  const save = () => void onSave({ ...c, name: sanitizeCompanionName(c.name), notes: sanitizeNotes(c.notes) });

  return (
    <div className="space-y-6">
      {/* Step chips */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Companion setup steps">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={step === i}
            onClick={() => setStep(i)}
            className={cn(
              "relative rounded-full border-[1.5px] px-3 py-1 font-mono text-[11px] font-bold transition-colors",
              step === i ? "border-ink text-background" : "border-ink/15 text-muted-foreground hover:border-ink",
            )}
          >
            {step === i && (
              <motion.span layoutId="setup-step" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
            )}
            <span className="relative">{i + 1}. {s}</span>
          </button>
        ))}
      </div>

      {/* Live preview */}
      <div className="flex items-start gap-3 rounded-3xl border-[1.5px] border-ink bg-card p-4 shadow-pop">
        <motion.div key={c.avatar} initial={{ scale: 0.6, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
          <CompanionAvatar avatar={c.avatar} animated className="size-12 rounded-2xl" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {sanitizeCompanionName(c.name)}{" "}
            <span className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
              · {VIBES.find((v) => v.key === c.vibe)?.label} · {TONES.find((t) => t.key === c.tone)?.label}
            </span>
          </p>
          <AnimatePresence mode="wait">
            <motion.p key={c.approach + c.vibe} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="mt-1 text-sm leading-snug">
              {step === 1 ? VIBES.find((v) => v.key === c.vibe)?.sample : approach.sample}
              {c.emoji && " 🌿"}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ type: "spring", stiffness: 320, damping: 30 }} className="space-y-6">
          {step === 0 && (
            <>
              <div>
                <label htmlFor="companion-name" className={label}>Name your companion</label>
                <input id="companion-name" value={c.name} maxLength={24} onChange={(e) => set({ name: e.target.value })} className="h-12 w-full rounded-2xl border-[1.5px] border-ink/20 bg-card px-4 text-lg font-bold outline-none focus:border-ink" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {NAME_IDEAS.map((n) => (
                    <button key={n} type="button" onClick={() => set({ name: n })} className={cn("rounded-full border-[1.5px] px-3 py-1 text-xs font-semibold transition-all", c.name === n ? "border-ink bg-zest" : "border-ink/15 hover:border-ink")}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className={label}>Look</p>
                <div className="flex flex-wrap gap-3">
                  {AVATARS.map((a) => (
                    <button key={a} type="button" aria-label={`Avatar ${a}`} aria-pressed={c.avatar === a} onClick={() => set({ avatar: a })} className={cn("rounded-2xl p-1 transition-all", c.avatar === a ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100")}>
                      <CompanionAvatar avatar={a} className="size-12" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <p className={label}>Personality</p>
                <div className="grid gap-2 @xl:grid-cols-2">
                  {VIBES.map((v) => (
                    <Choice key={v.key} on={c.vibe === v.key} onClick={() => set({ vibe: v.key })} title={v.label} line={v.line} />
                  ))}
                </div>
              </div>
              <div>
                <p className={label}>Tone</p>
                <div className="grid gap-2 @xl:grid-cols-3">
                  {TONES.map((t) => (
                    <Choice key={t.key} tone="rose" on={c.tone === t.key} onClick={() => set({ tone: t.key })} title={t.label} line={t.line} />
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div>
              <p className={label}>When you're going through something, you want…</p>
              <div className="grid gap-2 @xl:grid-cols-2">
                {APPROACHES.map((a) => (
                  <Choice key={a.key} tone="sage" on={c.approach === a.key} onClick={() => set({ approach: a.key })} title={a.label} line={a.line} />
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <>
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className={label}>Reply length</p>
                  <div className="inline-flex rounded-full border-[1.5px] border-ink p-1">
                    {LENGTHS.map((l) => (
                      <button key={l.key} type="button" title={l.hint} aria-pressed={c.length === l.key} onClick={() => set({ length: l.key })} className={cn("rounded-full px-3 py-1.5 text-xs font-bold transition-colors", c.length === l.key ? "bg-ink text-background" : "text-muted-foreground")}>{l.label}</button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{LENGTHS.find((l) => l.key === c.length)?.hint}</p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 pb-6 text-sm font-semibold">
                  <input type="checkbox" checked={c.emoji} onChange={(e) => set({ emoji: e.target.checked })} className="size-4 accent-[var(--ink)]" /> Emoji allowed
                </label>
              </div>
              <div>
                <label htmlFor="companion-notes" className={label}>Anything {sanitizeCompanionName(c.name)} should know? (optional)</label>
                <textarea
                  id="companion-notes"
                  value={c.notes}
                  maxLength={NOTES_MAX}
                  rows={3}
                  onChange={(e) => set({ notes: e.target.value })}
                  placeholder="e.g. I'm a 2nd-year engineering student, call me Diya, please mix Hindi and English"
                  className="w-full resize-none rounded-2xl border-[1.5px] border-ink/20 bg-card px-4 py-3 text-sm outline-none focus:border-ink"
                />
                <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">{c.notes.length}/{NOTES_MAX}</p>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} aria-label="Back" className="inline-flex size-12 items-center justify-center rounded-full border-[1.5px] border-ink/20 transition-colors hover:border-ink">
            <ArrowLeft className="size-4" />
          </button>
        )}
        {!last && (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="pop press inline-flex h-12 items-center gap-2 rounded-full bg-card px-6 text-sm font-bold">
            Next: {STEPS[step + 1]} <ArrowRight className="size-4" />
          </button>
        )}
        {(last || cta !== "Meet your companion") && (
          <button type="button" disabled={saving} onClick={save} className="pop press inline-flex h-12 items-center gap-2 rounded-full bg-zest px-6 text-sm font-bold text-zest-foreground disabled:opacity-60">
            <Sparkles className="size-4" /> {cta}
          </button>
        )}
      </div>
    </div>
  );
}
