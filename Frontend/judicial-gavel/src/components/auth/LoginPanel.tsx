import { useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import { Eye, EyeOff, ArrowRight } from "lucide-react";

import courtroom from "@/assets/courtroom.jpg";

import { JuryHashMark } from "@/components/brand/JURYHashMark";

import { login } from "@/lib/api";

import { setTokens, signIn } from "@/lib/user-store";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
export function LoginPanel() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending) return;

    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!username || !password) {
      setError("Please enter your username and password.");
      setPending(false);
      return;
    }

    try {
      const response = await login(username, password);

      /*
       * The lawyer portal is currently the integrated frontend.
       * ADMIN accounts must not be treated as lawyers.
       */
      if (response.user.role !== "LAWYER") {
        setError("This account cannot access the lawyer portal.");
        setPending(false);
        return;
      }

      /*
       * Keep authentication tokens in memory rather than localStorage.
       * The user profile exists only for the current browser session.
       */
      setTokens(response.access_token, response.refresh_token);

      const fullName = response.user.full_name.trim();

      const initials = fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");

      /*
       * The backend currently returns username rather than an email
       * address, so we deliberately leave the frontend email field empty.
       */
      signIn({
        id: response.user.id,
        name: fullName,
        initials,
        email: "",
        role: "Lawyer",
        phone: "",
      });

      navigate({ to: "/dashboard" });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Authentication failed.");

      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
      {/* Chamber side — cinematic courtroom, dark in BOTH themes. */}
      <section className="dark-chrome login-cinematic relative hidden overflow-hidden border-r border-border lg:block grain">
        <img
          src={courtroom}
          alt="A dim courtroom seen through haze, with a judge's bench and seated figures"
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            filter: "saturate(0.5) brightness(0.55) contrast(0.95)",
          }}
        />

        <div className="absolute inset-0 bg-[linear-gradient(180deg,oklch(0.12_0.01_60/0.65),oklch(0.12_0.01_60/0.92))]" />

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <JuryHashMark className="h-7 w-7 text-brass" />

            <span className="font-display text-lg tracking-wide text-parchment">
              JURY <span className="text-brass">HASH</span>
            </span>
          </div>

          <div className="max-w-lg">
            <p className="label-legal">Est. Record System</p>

            <h2 className="mt-5 font-display text-[clamp(2rem,3.4vw,3.2rem)] leading-[1.08] text-parchment">
              The record of a matter, read in the time it takes to read a headnote.
            </h2>

            <div className="mt-8 h-px w-32 rule-brass" />

            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
              JURY HASH holds cases, histories and court records in one archive, and puts a legal
              intelligence layer over them — summaries, issues, timelines and parties, drawn from
              the record itself.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-8 border-t border-border pt-8">
            {[
              ["Matters", "1,284"],
              ["Courts", "37"],
              ["Records indexed", "96,510"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="label-legal">{label}</dt>

                <dd className="mt-2 font-display text-2xl text-parchment">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Authentication side */}
      <section className="login-auth-surface relative flex items-center justify-center bg-background px-6 py-16 text-foreground sm:px-12">
        <div className="absolute right-6 top-6 sm:right-10 sm:top-8">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm animate-rise-in">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <JuryHashMark className="h-7 w-7 text-brass" />

            <span className="font-display text-lg tracking-wide">
              JURY <span className="text-brass">HASH</span>
            </span>
          </div>

          <p className="label-legal">Secure access</p>

          <h1 className="mt-3 font-display text-3xl">Enter the archive</h1>

          <p className="mt-3 text-sm text-muted-foreground">
            Sign in with your JURY HASH account to access your case archive.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div className="space-y-2">
              <label htmlFor="username" className="label-legal block">
                Username
              </label>

              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                className="focus-legal w-full border-b border-input bg-transparent pb-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-brass-dim focus:border-brass"
                placeholder="your username"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor="password" className="label-legal block">
                  Passphrase
                </label>

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="focus-legal inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-brass"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}

                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                className="focus-legal w-full border-b border-input bg-transparent pb-2 text-sm text-foreground outline-none transition-colors hover:border-brass-dim focus:border-brass"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-relaxed text-destructive"
              >
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer items-center gap-2.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="focus-legal h-3.5 w-3.5 appearance-none border border-input bg-transparent transition-colors checked:border-brass checked:bg-brass"
                />
                Remember this device
              </label>

              <a
                href="#"
                className="focus-legal text-xs text-muted-foreground underline-offset-4 hover:text-brass hover:underline"
              >
                Recover access
              </a>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="focus-legal group flex w-full items-center justify-between border border-brass/60 bg-brass/10 px-5 py-3.5 text-sm font-medium tracking-wide text-parchment transition-all hover:bg-brass hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Opening the archive…" : "Sign in"}

              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          <div className="mt-10 h-px w-full rule-brass" />

          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
            Access is authenticated by the JURY HASH backend. Your authentication tokens are kept in
            memory for the current session.
          </p>
        </div>
      </section>
    </main>
  );
}
