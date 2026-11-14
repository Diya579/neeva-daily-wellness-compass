import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password · Neeva" },
      { name: "description", content: "Choose a new password for your Neeva account." },
      { property: "og:title", content: "Reset password · Neeva" },
      { property: "og:description", content: "Choose a new password for your Neeva account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    void navigate({ to: "/today" });
  };
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-[1.75rem] border-[1.5px] border-ink bg-card p-6 shadow-pop-lg">
        <h1 className="text-3xl font-extrabold tracking-tight">New password</h1>
        <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" className="h-12 w-full rounded-2xl border-[1.5px] border-ink/20 bg-background px-4 outline-none focus:border-ink" />
        <button disabled={busy} className="pop press h-12 w-full rounded-2xl bg-zest text-sm font-bold text-zest-foreground">Save password</button>
      </form>
    </div>
  );
}
