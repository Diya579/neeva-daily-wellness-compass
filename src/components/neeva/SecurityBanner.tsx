import { Lock, ShieldCheck } from "lucide-react";

export function SecurityBanner({ compact = false }: { compact?: boolean }) {
  const full = compact ? "hidden" : "hidden sm:inline";
  const short = compact ? "inline" : "sm:hidden";
  return (
    <div className="flex items-center justify-center gap-2 border-t border-border/70 bg-card/70 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground backdrop-blur">
      <Lock className="size-3.5 text-sage-deep" />
      <span className={full}>End-to-End Encrypted</span>
      <span className={short}>E2E Encrypted</span>
      <span className="text-border">|</span>
      <ShieldCheck className="size-3.5 text-sage-deep" />
      <span className={full}>GDPR &amp; HIPAA Compliant Data Privacy</span>
      <span className={short}>GDPR &amp; HIPAA Compliant</span>
    </div>
  );
}
