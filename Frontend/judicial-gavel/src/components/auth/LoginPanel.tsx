import { useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import {
  Eye,
  EyeOff,
  ArrowRight,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";

import courtroom from "@/assets/courtroom.jpg";

import { JuryHashMark } from "@/components/brand/JURYHashMark";

import { changePassword, login } from "@/lib/api";

import { setTokens, signIn } from "@/lib/user-store";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
export function LoginPanel() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState(""); 
  const [newPassword, setNewPassword] = useState(""); 
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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
      if (response.user.must_change_password) {
        setPending(false);
        setForcePasswordChange(true);
        return;
      }

      navigate({ to: "/dashboard" });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Authentication failed.");

      setPending(false);
    }
  }
  async function handleForcedPasswordChange(
  event: React.FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  if (changingPassword) return;

  setPasswordError(null);

  if (!currentPassword || !newPassword || !confirmPassword) {
    setPasswordError("All password fields are required.");
    return;
  }

  if (newPassword.length < 8) {
    setPasswordError(
      "Your new password must contain at least 8 characters.",
    );
    return;
  }

  if (newPassword !== confirmPassword) {
    setPasswordError("The new passwords do not match.");
    return;
  }

  if (newPassword === currentPassword) {
    setPasswordError(
      "Your new password must be different from the temporary password.",
    );
    return;
  }

  try {
    setChangingPassword(true);

    await changePassword(currentPassword, newPassword);

    /*
     * The backend has now set:
     * must_change_password = false
     *
     * The user can safely enter the application.
     */
    setForcePasswordChange(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    navigate({ to: "/dashboard" });
  } catch (error) {
    setPasswordError(
      error instanceof Error
        ? error.message
        : "Failed to change password.",
    );
  } finally {
    setChangingPassword(false);
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

<div className="border-t border-border pt-7">
  <div className="mb-5 flex items-center justify-between">
    <p className="label-legal">National Judicial Data</p>

    <span className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
      Archive snapshot
    </span>
  </div>

  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
    {[
      {
        label: "Civil Cases",
        value: "1,13,00,283",
        aged: "67,83,207",
        percentage: 60.03,
      },
      {
        label: "Criminal Cases",
        value: "4,18,97,804",
        aged: "2,46,39,795",
        percentage: 58.81,
      },
      {
        label: "Total Cases",
        value: "5,31,98,087",
        aged: "3,14,23,002",
        percentage: 59.07,
      },
      {
        label: "Pre-Litigation / Pre-Trial",
        value: "13,12,438",
        aged: "7,54,843",
        percentage: 57.51,
      },
    ].map((stat) => (
      <div
        key={stat.label}
        className="border border-border/70 bg-black/20 px-4 py-4"
      >
        <p className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
          {stat.label}
        </p>

        <p className="mt-2 font-display text-[1.35rem] leading-none text-parchment">
          {stat.value}
        </p>

        <div className="mt-3 flex items-end gap-2">
          <div className="relative h-10 w-20 overflow-hidden">
            <div
              className="absolute left-1/2 top-0 h-20 w-20 -translate-x-1/2 rounded-full"
              style={{
                background: `conic-gradient(
                  from 270deg,
                  var(--brass) 0deg ${stat.percentage * 1.8}deg,
                  rgba(255,255,255,0.08) ${stat.percentage * 1.8}deg 180deg,
                  transparent 180deg
                )`,
              }}
            />

            <div className="absolute left-1/2 top-2.5 h-15 w-15 -translate-x-1/2 rounded-full bg-[#0b0a09]" />
          </div>

          <div className="pb-0.5">
            <p className="font-mono text-[11px] text-brass">
              {stat.percentage.toFixed(2)}%
            </p>

            <p className="mt-1 whitespace-nowrap font-mono text-[8px] tracking-[0.06em] text-muted-foreground uppercase">
              &gt; 1 year
            </p>
          </div>
        </div>

        <p className="mt-3 font-mono text-[9px] text-muted-foreground">
          {stat.aged} &gt; 1 year
        </p>
      </div>
    ))}
  </div>
</div>
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

      {forcePasswordChange && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forced-password-change-title"
        >
          <div className="w-full max-w-md border border-brass/40 bg-background p-6 shadow-2xl">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-brass/40 bg-brass/10">
                <LockKeyhole className="h-5 w-5 text-brass" />
              </div>

              <div>
                <p className="label-legal">
                  Security requirement
                </p>

                <h2
                  id="forced-password-change-title"
                  className="mt-1 font-display text-2xl"
                >
                  Change your password
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Your account was created with a temporary password.
                  You must choose a new password before you can access
                  the archive.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleForcedPasswordChange}
              className="space-y-5"
            >
              <div className="space-y-2">
                <label
                  htmlFor="temporary-password"
                  className="label-legal block"
                >
                  Temporary password
                </label>

                <input
                  id="temporary-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(event.target.value)
                  }
                  autoComplete="current-password"
                  disabled={changingPassword}
                  className="focus-legal w-full border-b border-input bg-transparent pb-2 text-sm text-foreground outline-none transition-colors hover:border-brass-dim focus:border-brass"
                  placeholder="Your temporary password"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="new-password"
                  className="label-legal block"
                >
                  New password
                </label>

                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  disabled={changingPassword}
                  className="focus-legal w-full border-b border-input bg-transparent pb-2 text-sm text-foreground outline-none transition-colors hover:border-brass-dim focus:border-brass"
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirm-password"
                  className="label-legal block"
                >
                  Confirm new password
                </label>

                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  disabled={changingPassword}
                  className="focus-legal w-full border-b border-input bg-transparent pb-2 text-sm text-foreground outline-none transition-colors hover:border-brass-dim focus:border-brass"
                  placeholder="Repeat your new password"
                />
              </div>

              {passwordError && (
                <div
                  role="alert"
                  className="flex gap-2 border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-relaxed text-destructive"
                >
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                  <span>{passwordError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={changingPassword}
                className="focus-legal group flex w-full items-center justify-between border border-brass/60 bg-brass/10 px-5 py-3.5 text-sm font-medium tracking-wide text-parchment transition-all hover:bg-brass hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {changingPassword
                  ? "Changing password…"
                  : "Set new password"}

                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </form>

            <p className="mt-5 text-[10px] leading-relaxed text-muted-foreground">
              This security requirement cannot be skipped. You must
              change your temporary password before accessing the
              archive.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
