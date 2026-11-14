import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/neeva/AppShell";
import { CrisisProvider } from "@/components/neeva/CrisisDialog";
import { Onboarding } from "@/components/neeva/Onboarding";
import { NeevaProvider } from "@/lib/neeva-store";
import { ProfileProvider } from "@/lib/profile";
import mark from "@/assets/neeva-mark.png";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  pendingComponent: Splash,
  component: AuthedLayout,
});

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <img src={mark} alt="" width={816} height={816} className="size-12 animate-float" />
    </div>
  );
}

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <ProfileProvider userId={user.id} email={user.email ?? ""} fallback={<Splash />}>
      <NeevaProvider userId={user.id}>
        <CrisisProvider>
          <AppShell>
            <Outlet />
          </AppShell>
          <Onboarding />
        </CrisisProvider>
      </NeevaProvider>
    </ProfileProvider>
  );
}
