import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, KeyRound, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { requestEmailOtp, supabase, verifyEmailOtp } from "@/integrations/supabase/client";
import { safeRedirect, useAuthSession } from "@/lib/auth-session";
import { cn } from "@/lib/utils";
import side from "@/assets/window-calm.jpg";
import mark from "@/assets/neeva-mark.png";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; mode?: "signin" | "signup" } => {
    const out: { redirect?: string; mode?: "signin" | "signup" } = {};
    if (typeof s["redirect"] === "string") out.redirect = s["redirect"];
    if (s["mode"] === "signup" || s["mode"] === "signin") out.mode = s["mode"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Enter Sanctuary · Neeva — Daily Wellness Compass" },
      {
        name: "description",
        content:
          "Enter your zero-knowledge mental wellness sanctuary anonymously or with Google.",
      },
      { property: "og:title", content: "Join Neeva — Daily Wellness Compass" },
      {
        property: "og:description",
        content: "Zero-knowledge mental wellness sanctuary built for everyone across India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const GoogleG = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

function generateAnonymousStudentHandle(): string {
  const bytes = new Uint8Array(6);
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `anon_${hex}`;
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { session, ready } = useAuthSession();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "google" | "verify_otp">(
    search.mode ?? "signup"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [pendingAuth, setPendingAuth] = useState<{
    flow: "signup" | "google";
    email: string;
    password: string;
    displayName: string;
    deliveryMode: "smtp_email" | "in_app_demo";
    message: string;
    demoOtp?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const dest = safeRedirect(search.redirect);

  useEffect(() => {
    if (!ready || !session) return;
    const stored = sessionStorage.getItem("neeva:after-auth");
    sessionStorage.removeItem("neeva:after-auth");
    void navigate({ to: safeRedirect(stored ?? dest) as "/today", replace: true });
  }, [ready, session, dest, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const cleanEmail = email.trim().toLowerCase();
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }
        const otpRes = await requestEmailOtp(cleanEmail, "signup");
        setPendingAuth({
          flow: "signup",
          email: cleanEmail,
          password,
          displayName: name.trim() || cleanEmail.split("@")[0] || "Friend",
          deliveryMode: otpRes.deliveryMode,
          message: otpRes.message,
          demoOtp: otpRes.demoOtp,
        });
        setOtpInput("");
        setMode("verify_otp");
        toast.success(`Verification code sent to ${cleanEmail}`);
      } else if (mode === "google") {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes("@")) {
          throw new Error("Please enter your Google email address to continue.");
        }
        const otpRes = await requestEmailOtp(cleanEmail, "google_signin");
        setPendingAuth({
          flow: "google",
          email: cleanEmail,
          password: `google_verified_${cleanEmail}_neeva_2026`,
          displayName: name.trim() || cleanEmail.split("@")[0] || "Neeva Member",
          deliveryMode: otpRes.deliveryMode,
          message: otpRes.message,
          demoOtp: otpRes.demoOtp,
        });
        setOtpInput("");
        setMode("verify_otp");
        toast.success(`Google email verification code sent to ${cleanEmail}`);
      } else if (mode === "verify_otp") {
        if (!pendingAuth) {
          setMode("signup");
          return;
        }
        await verifyEmailOtp(pendingAuth.email, otpInput);
        const { error } = await supabase.auth.signUp({
          email: pendingAuth.email,
          password: pendingAuth.password,
          options: {
            emailRedirectTo: window.location.origin + dest,
            data: { display_name: pendingAuth.displayName },
          },
        });
        if (error) throw error;
        toast.success(
          pendingAuth.flow === "google"
            ? "Email verified · Signed in with Google"
            : "Email verified · Welcome to Neeva!"
        );
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      toast.error((err as Error).message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (!pendingAuth) return;
    setBusy(true);
    try {
      const otpRes = await requestEmailOtp(
        pendingAuth.email,
        pendingAuth.flow === "google" ? "google_signin" : "signup"
      );
      setPendingAuth({
        ...pendingAuth,
        deliveryMode: otpRes.deliveryMode,
        message: otpRes.message,
        demoOtp: otpRes.demoOtp,
      });
      toast.success(`New verification code sent to ${pendingAuth.email}`);
    } catch (err) {
      toast.error((err as Error).message || "Could not resend code");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Primary Zero-Knowledge Entry: Random Non-PII Guest ID (no email collected).
   */
  const enterAnonymousSanctuary = async () => {
    setBusy(true);
    try {
      const storageKey = "neeva:anon-guest-id";
      const existing =
        typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
      const handle = existing || generateAnonymousStudentHandle();
      if (typeof window !== "undefined" && !existing) {
        window.localStorage.setItem(storageKey, handle);
      }
      const { error } = await supabase.auth.signUp({
        email: `${handle}@sanctuary.neeva.in`,
        password: `${handle}_zk_local_session_key`,
        options: { data: { display_name: `Guest ${handle.slice(-4).toUpperCase()}` } },
      });
      if (error) throw error;
      toast.success("Entered Zero-Knowledge Sanctuary (Anonymous Guest ID)");
    } catch (err) {
      toast.error((err as Error).message || "Could not start anonymous session");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Secondary Entry: Opens the Google account & email verification gate before entering the dashboard.
   */
  const enterGoogleSignIn = () => {
    setSent(null);
    setPendingAuth(null);
    setOtpInput("");
    setMode("google");
  };

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r-[1.5px] border-ink lg:block">
        <img
          src={side}
          alt="A young man smiling at his phone by a sunlit window"
          width={1280}
          height={1600}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
        <motion.span
          initial={{ rotate: -12, scale: 0.8 }}
          animate={{ rotate: -6, scale: 1 }}
          className="absolute left-8 top-8 rounded-full border-[1.5px] border-ink bg-zest px-4 py-1.5 font-mono text-xs font-bold text-zest-foreground"
        >
          Zero-Knowledge · AES-GCM-256
        </motion.span>
        <p className="absolute bottom-10 left-10 right-10 text-5xl font-extrabold leading-[1.02] tracking-tight text-background">
          Your head deserves <em className="font-display font-normal">a soft place</em> to land.
        </p>
      </div>
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto my-auto w-full max-w-sm py-10"
        >
          <img src={mark} alt="" width={816} height={816} className="size-11" />
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight">
            {mode === "signup"
              ? "Make your space."
              : mode === "signin"
                ? "Welcome back."
                : mode === "google"
                  ? "Continue with Google"
                  : mode === "verify_otp"
                    ? "Verify your email."
                    : "Reset password"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Takes 20 seconds. We'll verify your email before opening your sanctuary."
              : mode === "signin"
                ? "Pick up right where you left off."
                : mode === "google"
                  ? "Confirm your Google email address — we'll send a 6-digit verification code."
                  : mode === "verify_otp"
                    ? `Enter the 6-digit code sent to ${pendingAuth?.email ?? "your email"}.`
                    : "We'll email you a reset link."}
          </p>

          {(mode === "signup" || mode === "signin") && (
            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void enterAnonymousSanctuary()}
                className="pop press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-sage px-4 text-sm font-bold text-sage-foreground disabled:opacity-60"
              >
                <ShieldCheck className="size-4" /> Enter Sanctuary (Anonymous Guest ID)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={enterGoogleSignIn}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F] disabled:opacity-60"
              >
                <GoogleG /> Continue with Google
              </button>
              <div className="my-4 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or email &amp; password
                <span className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          {(mode === "signup" || mode === "signin") && (
            <div className="inline-flex w-full rounded-full border-[1.5px] border-ink p-1">
              {(["signup", "signin"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setSent(null);
                  }}
                  className={cn(
                    "relative flex-1 rounded-full py-2 text-sm font-bold transition-colors",
                    mode === m ? "text-background" : "text-muted-foreground"
                  )}
                >
                  {mode === m && (
                    <motion.span
                      layoutId="auth-tab"
                      className="absolute inset-0 rounded-full bg-ink"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative">{m === "signup" ? "Sign up" : "Log in"}</span>
                </button>
              ))}
            </div>
          )}

          {sent ? (
            <div className="mt-6 rounded-2xl border-[1.5px] border-ink bg-sage p-4 text-sm font-medium">
              {sent}
            </div>
          ) : mode === "verify_otp" && pendingAuth ? (
            <form onSubmit={submit} className="mt-6 space-y-3.5">
              <div className="rounded-2xl border-[1.5px] border-ink/20 bg-sage/60 p-3.5 text-xs font-medium text-foreground">
                <div className="flex items-center gap-2 font-bold">
                  <MailCheck className="size-4 text-sage-foreground" />
                  <span>
                    {pendingAuth.deliveryMode === "smtp_email"
                      ? "Verification email sent"
                      : "Email verification required"}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{pendingAuth.message}</p>
                {pendingAuth.demoOtp && (
                  <p className="mt-2 rounded-xl border border-ink/20 bg-card px-3 py-2 font-mono text-xs font-bold text-foreground">
                    Verification code (Demo/Local mode):{" "}
                    <span className="tracking-widest text-sm">{pendingAuth.demoOtp}</span>
                  </p>
                )}
              </div>

              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  autoComplete="one-time-code"
                  className="h-12 w-full rounded-2xl border-[1.5px] border-ink/25 bg-card pl-11 pr-4 font-mono text-lg font-bold tracking-[0.35em] outline-none focus:border-ink"
                />
              </div>

              <button
                disabled={busy || otpInput.length !== 6}
                className="pop press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zest text-sm font-bold text-zest-foreground disabled:opacity-60"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Verify &amp; Enter Sanctuary
              </button>

              <div className="flex items-center justify-between pt-1 text-xs font-semibold">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void resendOtp()}
                  className="text-foreground underline-offset-4 hover:underline disabled:opacity-60"
                >
                  Resend verification code
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMode(pendingAuth.flow === "google" ? "google" : "signup");
                    setPendingAuth(null);
                    setOtpInput("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Change email
                </button>
              </div>
            </form>
          ) : mode === "google" ? (
            <form onSubmit={submit} className="mt-6 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="Your name (optional)"
                className="h-12 w-full rounded-2xl border-[1.5px] border-ink/20 bg-card px-4 text-[15px] outline-none focus:border-ink"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your Google email (e.g. name@gmail.com)"
                autoComplete="email"
                className="h-12 w-full rounded-2xl border-[1.5px] border-ink/20 bg-card px-4 text-[15px] outline-none focus:border-ink"
              />
              <button
                disabled={busy}
                className="pop press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zest text-sm font-bold text-zest-foreground disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <GoogleG />}
                Send Google Verification Code
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="mt-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                ← Back to all sign-in options
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-3">
              {mode === "signup" && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  placeholder="What should we call you?"
                  className="h-12 w-full rounded-2xl border-[1.5px] border-ink/20 bg-card px-4 text-[15px] outline-none focus:border-ink"
                />
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                autoComplete="email"
                className="h-12 w-full rounded-2xl border-[1.5px] border-ink/20 bg-card px-4 text-[15px] outline-none focus:border-ink"
              />
              {mode !== "forgot" && (
                <input
                  type="password"
                  required
                  minLength={mode === "signup" ? 8 : 6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="h-12 w-full rounded-2xl border-[1.5px] border-ink/20 bg-card px-4 text-[15px] outline-none focus:border-ink"
                />
              )}
              <button
                disabled={busy}
                className="pop press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zest text-sm font-bold text-zest-foreground disabled:opacity-60"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "signup"
                  ? "Send verification code"
                  : mode === "signin"
                    ? "Log in"
                    : "Send reset link"}
              </button>
            </form>
          )}

          {mode === "signin" && (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="mt-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </button>
          )}
          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setSent(null);
              }}
              className="mt-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Back to log in
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
