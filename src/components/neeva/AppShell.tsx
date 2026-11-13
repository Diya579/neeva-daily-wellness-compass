import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BookHeart, Building2, Crown, Flower2, House, Monitor, RotateCcw, Smartphone, Users, MessageCircleHeart } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { GOALS } from "@/lib/neeva-data";
import { useNeeva } from "@/lib/neeva-store";
import { cn } from "@/lib/utils";
import mark from "@/assets/neeva-mark.png";
import { CrisisButton } from "./CrisisDialog";
import { SecurityBanner } from "./SecurityBanner";

const NAV = [
  { to: "/", label: "Today", icon: House },
  { to: "/chat", label: "Neeva AI", icon: MessageCircleHeart },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/hub", label: "Hub", icon: Flower2 },
  { to: "/community", label: "Community", icon: Users },
] as const;

function ViewToggle({ className }: { className?: string }) {
  const { viewMode, update } = useNeeva();
  return (
    <div className={cn("hidden items-center rounded-full border border-border bg-card/80 p-1 shadow-soft backdrop-blur md:inline-flex", className)}>
      {(
        [
          { k: "mobile", icon: Smartphone, label: "Mobile" },
          { k: "desktop", icon: Monitor, label: "Desktop" },
        ] as const
      ).map(({ k, icon: Icon, label }) => (
        <button
          key={k}
          onClick={() => update(() => ({ viewMode: k }))}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all duration-300",
            viewMode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={viewMode === k}
        >
          <Icon className="size-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

function ProfileMenu() {
  const { name, goal, points, reset } = useNeeva();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const enterprise = pathname === "/enterprise";
  const initial = (name || "N").slice(0, 1).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex size-10 items-center justify-center rounded-full bg-lilac font-semibold text-lilac-foreground ring-2 ring-card transition-all duration-300 hover:ring-sage-deep" aria-label="Profile menu">
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-2xl p-2">
        <DropdownMenuLabel className="flex items-center gap-3 p-2">
          <span className="flex size-10 items-center justify-center rounded-full bg-lilac font-semibold text-lilac-foreground">{initial}</span>
          <span>
            <span className="block text-sm font-semibold">{name || "Friend"}</span>
            <span className="block text-xs font-normal text-muted-foreground">Goal · {GOALS.find((g) => g.key === goal)?.label}</span>
          </span>
        </DropdownMenuLabel>
        <div className="mx-2 mb-2 flex items-center gap-2 rounded-xl bg-rose/60 px-3 py-2 text-xs">
          <Crown className="size-4 text-rose-foreground" />
          <span className="flex-1 font-semibold text-rose-foreground">Neeva Plus · ₹99/month</span>
          <span className="tabular-nums text-muted-foreground">{points} pts</span>
        </div>
        <DropdownMenuSeparator />
        <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-sm hover:bg-muted">
          <Building2 className="size-4 text-muted-foreground" />
          <span className="flex-1 font-medium">Switch to Enterprise HR View</span>
          <Switch checked={enterprise} onCheckedChange={(v) => navigate({ to: v ? "/enterprise" : "/" })} />
        </label>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="rounded-xl text-muted-foreground"
          onSelect={() => {
            reset();
            navigate({ to: "/" });
          }}
        >
          <RotateCcw className="size-4" /> Restart onboarding
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { viewMode } = useNeeva();
  const framed = viewMode === "mobile";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = [...NAV, { to: "/enterprise", label: "Enterprise", icon: Building2 }].find((n) => n.to === pathname);

  return (
    <div className={cn("relative min-h-dvh overflow-hidden", framed && "md:flex md:items-center md:justify-center md:p-6")}>
      {/* atmospheric blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 size-[28rem] rounded-full bg-sage/60 blur-3xl animate-drift" />
        <div className="absolute -right-32 top-1/3 size-[26rem] rounded-full bg-lilac/50 blur-3xl animate-drift-slow" />
        <div className="absolute -bottom-32 left-1/3 size-[24rem] rounded-full bg-rose/50 blur-3xl animate-drift" />
      </div>

      {framed && (
        <div className="absolute left-1/2 top-4 z-20 hidden -translate-x-1/2 md:block lg:left-auto lg:right-8 lg:top-8 lg:translate-x-0">
          <ViewToggle />
        </div>
      )}

      <div
        className={cn(
          "relative z-10 flex h-dvh w-full bg-background/80 backdrop-blur-xl",
          framed && "md:h-[min(880px,calc(100dvh-5rem))] md:w-[400px] md:overflow-hidden md:rounded-[2.75rem] md:border-[10px] md:border-primary md:shadow-device md:mt-8 lg:mt-0",
        )}
      >
        {/* Desktop sidebar */}
        <aside className={cn("w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/70 p-5", framed ? "hidden" : "hidden md:flex")}>
          <Link to="/" className="mb-8 flex items-center gap-2.5 px-2">
            <img src={mark} alt="Neeva" className="size-9" width={816} height={816} />
            <span>
              <span className="block text-xl font-bold leading-none tracking-tight">Neeva</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Wellness, reimagined</span>
            </span>
          </Link>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-300 hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
              >
                <Icon className="size-[18px]" strokeWidth={1.8} /> {label}
              </Link>
            ))}
            <div className="my-3 h-px bg-sidebar-border" />
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">For organisations</p>
            <Link
              to="/enterprise"
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-300 hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              <Building2 className="size-[18px]" strokeWidth={1.8} /> Employer Portal
            </Link>
          </nav>
          <div className="rounded-3xl bg-rose/70 p-4">
            <p className="font-display text-2xl leading-tight text-rose-foreground">Care that fits every pocket.</p>
            <p className="mt-1 text-xs text-rose-foreground/80">Unlimited AI sessions, journaling & groups for ₹99/month.</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className={cn("flex items-center gap-3 border-b border-border/60 bg-background/60 px-4 py-3 backdrop-blur-xl", !framed && "md:px-8 md:py-4")}>
            <Link to="/" className={cn("flex items-center gap-2", !framed && "md:hidden")}>
              <img src={mark} alt="Neeva" className="size-8" width={816} height={816} />
              <span className="text-lg font-bold tracking-tight">Neeva</span>
            </Link>
            <h1 className={cn("hidden text-sm font-semibold text-muted-foreground", !framed && "md:block")}>{current?.label ?? "Neeva"}</h1>
            <div className="ml-auto flex items-center gap-2">
              {!framed && <ViewToggle className="mr-1" />}
              <CrisisButton compact={framed} />
              <ProfileMenu />
            </div>
          </header>

          <main className="@container relative min-h-0 flex-1 overflow-y-auto">{children}</main>

          <SecurityBanner />

          {/* Bottom nav */}
          <nav className={cn("grid grid-cols-5 border-t border-border/70 bg-card/90 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl", framed ? "grid" : "md:hidden")}>
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="group flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[10px] font-semibold text-muted-foreground transition-all duration-300 data-[status=active]:text-primary"
              >
                <span className="flex h-7 w-12 items-center justify-center rounded-full transition-all duration-300 group-data-[status=active]:bg-sage">
                  <Icon className="size-[18px]" strokeWidth={1.8} />
                </span>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
