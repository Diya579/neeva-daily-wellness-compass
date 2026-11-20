import { Lock, ShieldCheck } from "lucide-react";

export function SecurityBanner() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t-[1.5px] border-ink/10 bg-background px-4 py-2 font-mono text-[10.5px] font-medium tracking-wide text-muted-foreground">
      <Lock className="size-3.5 text-sage-deep" />
      <span>Neeva AI — Zero-Knowledge Wellness Compass</span>
      <span className="text-border">|</span>
      <ShieldCheck className="size-3.5 text-sage-deep" />
      <span>Built for Indian Higher Education · AES-GCM-256 &amp; DPDP Act 2023</span>
    </div>
  );
}
