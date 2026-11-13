import { Lock, ShieldCheck } from "lucide-react";

export function SecurityBanner() {
  return (
    <div className="flex items-center justify-center gap-2 border-t border-border/70 bg-card/70 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground backdrop-blur">
      <Lock className="size-3.5 text-sage-deep" />
      <span>End-to-End Encrypted</span>
      <span className="text-border">|</span>
      <ShieldCheck className="size-3.5 text-sage-deep" />
      <span>GDPR &amp; HIPAA Compliant Data Privacy</span>
    </div>
  );
}
