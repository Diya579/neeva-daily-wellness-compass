import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Soft organic surface used throughout Neeva. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl border border-border/70 bg-card p-5 shadow-soft transition-all duration-300", className)} {...props} />;
}

export function PanelTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>}
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      </div>
      {action}
    </div>
  );
}
