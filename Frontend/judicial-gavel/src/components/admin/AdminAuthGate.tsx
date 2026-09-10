import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, ArrowRight, Lock } from "lucide-react";
import { checkAdminCredentials, signInAsAdmin, DEFAULT_ADMIN_USER } from "@/lib/admin-store";

export function AdminAuthGate() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    await new Promise((r) => setTimeout(r, 450));

    if (!checkAdminCredentials(email, password)) {
      setError("Invalid admin credentials.");
      setPending(false);
      return;
    }

    signInAsAdmin({ ...DEFAULT_ADMIN_USER, email: email || DEFAULT_ADMIN_USER.email });
    navigate({ to: "/admin" });
  }

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_1fr]">
      {/* Branding side */}
      <section className="hidden bg-[#0b131e] lg:flex lg:flex-col lg:items-end lg:p-12 xl:p-16">
        <div className="max-w-md">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1a3b5e] px-2 text-[#38bdf8] text-xs font-semibold">
              LE
            </div>
            <span className="font-display text-lg tracking-wide text-white">
              Legal<span className="text-[#38bdf8]">Eye</span>
            </span>
          </div>
          <div className="mt-14">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8ea3bb]">Admin Portal</p>
            <h1 className="mt-4 font-display text-[clamp(2.2rem,4vw,3.4rem)] leading-[1.08] text-white">
              Operate the system.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#8ea3bb]">
              Monitor system activity, manage users, and ensure the security and integrity of
              LegalLens.
            </p>
          </div>
        </div>
      </section>

      {/* Auth form side */}
      <section className="flex items-center justify-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-sm animate-rise-in">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1a3b5e] px-2 text-[#38bdf8] text-xs font-semibold">
              LE
            </div>
            <span className="font-display text-lg tracking-wide text-white">
              Legal<span className="text-[#38bdf8]">Eye</span>
            </span>
          </div>

          <p className="text-[10px] tracking-[0.2em] uppercase text-[#8ea3bb]">Restricted access</p>
          <h2 className="mt-3 font-display text-3xl text-white">Admin sign-in</h2>
          <p className="mt-2 text-sm text-[#8ea3bb]">
            Only system administrators may access this portal.
          </p>

          {error && (
            <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-[10px] tracking-[0.2em] uppercase text-[#8ea3bb]"
              >
                Admin email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                defaultValue="admin"
                className="w-full border-b border-[#5f7891]/40 bg-transparent py-2 text-sm text-white placeholder:text-[#5f7891] focus:border-[#38bdf8] outline-none transition-colors"
                placeholder="admin@legaleye.in"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="password"
                  className="block text-[10px] tracking-[0.2em] uppercase text-[#8ea3bb]"
                >
                  Passphrase
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="flex items-center gap-1 text-[10px] text-[#8ea3bb] transition-colors hover:text-[#38bdf8]"
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                defaultValue="admin"
                className="w-full border-b border-[#5f7891]/40 bg-transparent py-2 text-sm text-white placeholder:text-[#5f7891] focus:border-[#38bdf8] outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="group flex w-full items-center justify-between border border-[#38bdf8]/50 bg-[#38bdf8]/10 px-5 py-3 text-sm font-medium text-white transition-all hover:bg-[#38bdf8] hover:text-[#0b131e] disabled:opacity-60"
            >
              {pending ? "Signing in…" : "Sign in"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          <div className="mt-8 border-t border-[#1a2737] pt-4">
            <p className="text-[10px] leading-relaxed text-[#5f7891]">
              Prototype build — credential check is illustrative. No credentials are transmitted or
              stored.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
