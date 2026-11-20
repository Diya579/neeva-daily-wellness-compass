import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  BookHeart,
  Download,
  Flower2,
  House,
  LogOut,
  MessageCircleHeart,
  Settings,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { exportMoods } from "@/lib/mood-export";
import { GOALS } from "@/lib/neeva-data";
import { useNeeva } from "@/lib/neeva-store";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import mark from "@/assets/neeva-mark.png";
import { CompanionAvatar } from "./CompanionAvatar";
import { CrisisButton } from "./CrisisDialog";
import { SecurityBanner } from "./SecurityBanner";

function useNav() {
  const { companion } = useProfile();
  return [
    { to: "/today", label: "Today", icon: House },
    { to: "/chat", label: companion.name, icon: MessageCircleHeart },
    { to: "/journal", label: "Journal", icon: BookHeart },
    { to: "/hub", label: "Hub", icon: Flower2 },
    { to: "/community", label: "Circles", icon: Users },
  ] as const;
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function ProfileMenu() {
  const { profile, email, goal } = useProfile();
  const { points, moods } = useNeeva();
  const signOut = useSignOut();
  const name = profile.display_name || email.split("@")[0] || "You";
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="pop press flex size-10 items-center justify-center rounded-full bg-lilac font-bold text-lilac-foreground"
          aria-label="Profile menu"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-2xl border-[1.5px] border-ink p-2 shadow-pop">
        <DropdownMenuLabel className="flex items-center gap-3 p-2">
          <span className="flex size-10 items-center justify-center rounded-full bg-lilac font-bold text-lilac-foreground">
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {GOALS.find((g) => g.key === goal)?.label} · {points} pts
            </span>
          </span>
        </DropdownMenuLabel>
        <div className="mx-2 mb-2 rounded-xl bg-zest px-3 py-2 text-xs font-semibold text-zest-foreground">
          Neeva Plus · ₹99/month
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-xl">
          <Link to="/settings">
            <Settings className="size-4" /> Settings & companion
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-xl"
          disabled={moods.length === 0}
          onSelect={() => exportMoods(moods, "csv")}
        >
          <Download className="size-4" /> Export mood data (CSV)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="rounded-xl text-muted-foreground" onSelect={() => void signOut()}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { companion } = useProfile();
  const nav = useNav();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = [...nav, { to: "/settings", label: "Settings" }].find((n) => n.to === pathname);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="relative z-10 flex h-dvh w-full bg-background">
        {/* Desktop sidebar */}
        <aside
          className="hidden w-56 shrink-0 flex-col border-r-[1.5px] border-ink/10 bg-sidebar p-4 md:flex lg:w-60 xl:w-64 xl:p-5"
        >
          <Link to="/today" className="mb-8 flex items-center gap-2.5 px-2">
            <img src={mark} alt="" className="size-9" width={816} height={816} />
            <span className="text-2xl font-extrabold tracking-tight">neeva</span>
            <span className="ml-auto rounded-full bg-zest px-2 py-0.5 font-mono text-[10px] font-bold text-zest-foreground">
              ₹99
            </span>
          </Link>
          <nav className="flex flex-1 flex-col gap-1">
            {nav.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors duration-300",
                    active ? "text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="side-active"
                      className="absolute inset-0 rounded-2xl bg-ink"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {to === "/chat" ? (
                    <CompanionAvatar avatar={companion.avatar} className="relative size-[22px] rounded-lg border" />
                  ) : (
                    <Icon className="relative size-[18px]" strokeWidth={2} />
                  )}
                  <span className="relative truncate">{label}</span>
                </Link>
              );
            })}
          </nav>
          <Link
            to="/settings"
            className={cn(
              "mb-3 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground",
              pathname === "/settings" && "bg-muted text-foreground",
            )}
          >
            <Settings className="size-[18px]" strokeWidth={2} /> Settings
          </Link>
          <div className="relative overflow-hidden rounded-3xl border-[1.5px] border-ink bg-rose p-4">
            <p className="font-display text-2xl leading-tight text-rose-foreground">
              Care that fits <em>every</em> pocket.
            </p>
            <p className="mt-1 text-xs text-rose-foreground/80">
              Unlimited chats, journaling & circles. ₹99/month.
            </p>
            <span className="absolute -right-3 -top-3 size-12 animate-spin-slow rounded-full border-[1.5px] border-dashed border-ink/40" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className="flex items-center gap-2 border-b-[1.5px] border-ink/10 bg-background/85 px-4 py-3 backdrop-blur-xl md:px-6 lg:px-8"
          >
            <Link to="/today" className="flex items-center gap-2 md:hidden">
              <img src={mark} alt="" className="size-8" width={816} height={816} />
              <span className="text-xl font-extrabold tracking-tight">neeva</span>
            </Link>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={current?.label ?? "neeva"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="hidden font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground md:block"
              >
                /{(current?.label ?? "neeva").toLowerCase()}
              </motion.h1>
            </AnimatePresence>
            <div className="ml-auto flex items-center gap-2">
              <CrisisButton />
              <ProfileMenu />
            </div>
          </header>

          <main
            className="@container relative min-h-0 flex-1 overflow-y-auto overscroll-contain [--nav-space:6.5rem] md:[--nav-space:0rem]"
          >
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="h-full"
            >
              {children}
              {pathname !== "/chat" && <div aria-hidden className="h-[var(--nav-space)]" />}
            </motion.div>
          </main>

          <div className="hidden md:block">
            <SecurityBanner />
          </div>

          {/* Mobile floating nav */}
          <nav
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:hidden"
          >
            <div className="pointer-events-auto mx-auto grid max-w-md grid-cols-5 rounded-[1.6rem] border-[1.5px] border-ink bg-card/95 p-1.5 shadow-pop backdrop-blur-xl">
              {nav.map(({ to, label, icon: Icon }) => {
                const active = pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      "relative flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-bold transition-colors duration-300",
                      active ? "text-zest-foreground" : "text-muted-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="bottom-active"
                        className="absolute inset-0 rounded-2xl bg-zest"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    )}
                    <Icon className="relative size-[19px]" strokeWidth={2} />
                    <span className="relative max-w-full truncate px-1">{label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
