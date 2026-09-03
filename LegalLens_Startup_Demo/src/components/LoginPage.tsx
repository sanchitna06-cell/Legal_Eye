import { useState, type FormEvent } from "react";
import type { StartupPhase } from "../lib/timeline";
import { EyeIcon, EyeOffIcon, LockIcon, MoonIcon, PersonIcon, SunIcon } from "./icons";
import "./LoginPage.css";

interface LoginPageProps {
  phase: StartupPhase;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

/**
 * The final login screen. Purely visual — no real authentication.
 * The card slides in from the right inside LoginTransition; everything
 * here is interactive once it arrives (typing, password visibility,
 * theme toggle).
 */
export default function LoginPage({ phase, theme, onToggleTheme }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <button
        type="button"
        className="theme-toggle"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title="Toggle light / dark theme"
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="login-card-wrap">
        <form
          className="login-card"
          onSubmit={(e: FormEvent) => e.preventDefault()}
          noValidate
        >
          <h2 className="card-title">Welcome Back</h2>
          <p className="card-subtitle">Sign in to continue to LegalLens</p>

          <div className="field">
            <label htmlFor="login-email">Username or Email</label>
            <div className="input-wrap">
              <PersonIcon className="field-icon" />
              <input
                id="login-email"
                name="email"
                type="text"
                autoComplete="username"
                placeholder="name@agency.gov"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="login-password">Password</label>
            <div className="password-wrap">
              <LockIcon className="field-icon" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={phase === "done" ? 0 : -1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button className="login-button" type="submit">
            Login
          </button>

          <a
            className="forgot-link"
            href="#"
            onClick={(e) => e.preventDefault()}
            tabIndex={phase === "done" ? 0 : -1}
          >
            Forgot password?
          </a>
        </form>
      </div>
    </>
  );
}