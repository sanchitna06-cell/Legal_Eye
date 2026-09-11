import { Menu } from "lucide-react";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface AppHeaderProps {
  /** Mobile-only: opens the off-canvas sidebar drawer below md. */
  onMenu?: () => void;
  /** Mobile: whether the off-canvas drawer is open — hides the floating button so it doesn't cover the drawer. */
  menuOpen?: boolean;
}

/**
 * Chrome-less app controls. The old full-width top bar is gone — the sidebar
 * (with the JURY HASH brand in its header) is the app chrome — so all that
 * remains is a floating mobile menu button (top left) and the floating
 * account badge (top right). The investigator's name stays hidden until the
 * badge is clicked (see UserProfileMenu).
 */
export function AppHeader({ onMenu, menuOpen = false }: AppHeaderProps) {
  return (
    <>
      {onMenu && !menuOpen && (
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open sidebar — pinned cases, case categories and archive"
          className="focus-legal fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/92 text-muted-foreground backdrop-blur transition-colors hover:border-brass-dim hover:text-parchment md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
        <ThemeToggle />
        <UserProfileMenu />
      </div>
    </>
  );
}
