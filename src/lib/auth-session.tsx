import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthSession = { session: Session | null; ready: boolean };
const Ctx = createContext<AuthSession>({ session: null, ready: false });

/** The app's single auth listener: keeps the session in context and refreshes routes on sign-in/out. */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthSession>({ session: null, ready: false });

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setState({ session: data.session, ready: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, ready: true });
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuthSession = () => useContext(Ctx);

/** Only same-origin relative paths are allowed as post-login destinations. */
export function safeRedirect(target: unknown, fallback = "/today"): string {
  if (typeof target !== "string") return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  if (target.startsWith("/auth")) return fallback;
  return target;
}
