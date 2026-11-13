import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "sage" | "rose" | "lilac" | "periwinkle" | "terracotta" | "primary" | "crisis";

const TONES: Record<Tone, string> = {
  sage: "bg-sage text-sage-foreground ring-sage-deep/40",
  rose: "bg-rose text-rose-foreground ring-terracotta/40",
  lilac: "bg-lilac text-lilac-foreground ring-periwinkle/60",
  periwinkle: "bg-periwinkle text-lilac-foreground ring-lilac/60",
  terracotta: "bg-terracotta/40 text-rose-foreground ring-terracotta/50",
  primary: "bg-primary text-primary-foreground ring-primary/30",
  crisis: "bg-crisis-soft text-crisis ring-crisis/30",
};

/** Dual-tone pastel circle behind a Lucide icon. */
export function IconBadge({
  icon: Icon,
  tone = "sage",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims =
    size === "sm"
      ? "size-8 [&_svg]:size-4"
      : size === "lg"
        ? "size-14 [&_svg]:size-6"
        : "size-11 [&_svg]:size-5";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full ring-4",
        TONES[tone],
        dims,
        className,
      )}
    >
      <Icon strokeWidth={1.8} />
    </span>
  );
}

export const toneBg: Record<Tone, string> = {
  sage: "bg-sage",
  rose: "bg-rose",
  lilac: "bg-lilac",
  periwinkle: "bg-periwinkle",
  terracotta: "bg-terracotta/40",
  primary: "bg-primary",
  crisis: "bg-crisis-soft",
};
