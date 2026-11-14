import type { AvatarKey } from "@/lib/companion";
import { cn } from "@/lib/utils";

/** Hand-built companion marks — flat shapes with an outline, no stock faces. */
export function CompanionAvatar({
  avatar,
  className,
  animated = false,
}: {
  avatar: AvatarKey;
  className?: string;
  animated?: boolean;
}) {
  const ink = "var(--ink)";
  return (
    <span
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-[1.5px] border-ink",
        avatar === "bloom" && "bg-sage",
        avatar === "moon" && "bg-lilac",
        avatar === "wave" && "bg-periwinkle",
        avatar === "spark" && "bg-zest",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 48 48" className={cn("size-[78%]", animated && avatar !== "moon" && avatar !== "wave" && "animate-spin-slow")}>
        {avatar === "bloom" && (
          <g stroke={ink} strokeWidth="2">
            {[0, 60, 120, 180, 240, 300].map((r) => (
              <ellipse key={r} cx="24" cy="12" rx="6" ry="10" fill="var(--rose)" transform={`rotate(${r} 24 24)`} />
            ))}
            <circle cx="24" cy="24" r="6" fill="var(--zest)" />
          </g>
        )}
        {avatar === "moon" && (
          <g stroke={ink} strokeWidth="2" className={animated ? "origin-center animate-float" : undefined}>
            <path d="M30 8a17 17 0 1 0 10 28A14 14 0 0 1 30 8Z" fill="var(--card)" />
            <circle cx="36" cy="12" r="2" fill={ink} />
            <circle cx="40" cy="20" r="1.2" fill={ink} />
          </g>
        )}
        {avatar === "wave" && (
          <g stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round">
            <path d="M6 18c4-5 8-5 12 0s8 5 12 0 8-5 12 0" className={animated ? "animate-float" : undefined} />
            <path d="M6 27c4-5 8-5 12 0s8 5 12 0 8-5 12 0" />
            <path d="M6 36c4-5 8-5 12 0s8 5 12 0 8-5 12 0" />
          </g>
        )}
        {avatar === "spark" && (
          <g stroke={ink} strokeWidth="2" strokeLinejoin="round">
            <path d="M24 4l4.5 15.5L44 24l-15.5 4.5L24 44l-4.5-15.5L4 24l15.5-4.5Z" fill="var(--card)" />
            <circle cx="24" cy="24" r="3.5" fill="var(--rose)" />
          </g>
        )}
      </svg>
    </span>
  );
}
