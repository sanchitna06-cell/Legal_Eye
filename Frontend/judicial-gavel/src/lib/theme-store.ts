/**
 * Theme store — the single source of truth for the light/dark theme.
 *
 * localStorage("legaleye-theme") persists the user's choice. The theme is
 * applied by toggling the `dark` class on <html>, which drives the
 * `@custom-variant dark` in styles.css. Because the store is called during
 * module evaluation, the theme persists across route navigation; the root
 * layout re-applies it on mount so a hard refresh on any route also restores
 * it (paired with the no-flash inline script in __root.tsx).
 *
 * Default: DARK — the existing Legal Eye interface is primarily dark, so
 * first-time visitors keep the established visual baseline.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "legaleye-theme";
export const DEFAULT_THEME: Theme = "dark";

const VALID: Theme[] = ["light", "dark"];

export function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return VALID.includes(raw as Theme) ? (raw as Theme) : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

/** The effective theme at startup: saved preference or the dark default. */
export function getInitialTheme(): Theme {
  return readStoredTheme() ?? DEFAULT_THEME;
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — the theme still applies for this session */
  }
}

/**
 * Inline bootstrap source. Rendered into <head> before hydration so the
 * correct theme class exists on the very first paint (no flash).
 */
export const THEME_BOOTSTRAP_SNIPPET = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t="${DEFAULT_THEME}";}var d=t==="dark";var c=document.documentElement.classList;c.add("dark");if(!d){c.remove("dark");}}catch(e){}})();`;
