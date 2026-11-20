import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Soft organic surface used throughout Neeva. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border-[1.5px] border-ink/15 bg-card p-5 transition-all duration-300 hover:border-ink/40",
        className,
      )}
      {...props}
    />
  );
}

export function PanelTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>
      </div>
      {action}
    </div>
  );
}
