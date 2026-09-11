import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

/**
 * Compact light/dark toggle. The icon shows what you switch TO: a Sun in
 * dark mode (tap for light), a Moon in light mode (tap for dark). Sized and
 * styled to sit beside the floating account badge / profile menu without
 * disturbing the existing controls.
 */
export function ThemeToggle() {
  const { isLight, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      aria-pressed={!isLight}
      title={isLight ? "Dark mode" : "Light mode"}
      className="focus-legal flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/92 text-muted-foreground backdrop-blur transition-colors hover:border-brass-dim hover:text-parchment"
    >
      {isLight ? (
        <Moon className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Sun className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
