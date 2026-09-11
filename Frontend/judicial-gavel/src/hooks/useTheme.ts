import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  getInitialTheme,
  readStoredTheme,
  setTheme,
  type Theme,
} from "@/lib/theme-store";

/**
 * Read + write the current theme from React.
 *
 * `resolved` is the theme actually applied to <html>; `prefers-light`/
 * `prefers-dark` expose the raw intent. All routes share this hook, so the
 * theme survives client-side navigation; persistence to localStorage and the
 * first-paint bootstrap are handled by the theme store and __root.tsx.
 */
export function useTheme(): {
  /** Theme currently applied to <html>. */
  theme: Theme;
  /** True when the applied theme is light. */
  isLight: boolean;
  /** Toggle between light and dark. */
  toggleTheme: () => void;
  /** Set an explicit theme and persist it. */
  setTheme: (theme: Theme) => void;
} {
  // Must be identical on server and client during the first render.
  const [theme, setResolved] = useState<Theme>(DEFAULT_THEME);

  // Restore the persisted preference after hydration.
  useEffect(() => {
    const initialTheme = getInitialTheme();
    setResolved(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const setThemePersisted = useCallback((next: Theme) => {
    setTheme(next);
    setResolved(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const applied: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";

    const next: Theme = applied === "dark" ? "light" : "dark";

    setTheme(next);
    setResolved(next);
  }, []);

  // Cross-tab + manual-storage sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;

      const stored = readStoredTheme() ?? DEFAULT_THEME;

      applyTheme(stored);
      setResolved(stored);
    };

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    theme,
    isLight: theme === "light",
    toggleTheme,
    setTheme: setThemePersisted,
  };
}
