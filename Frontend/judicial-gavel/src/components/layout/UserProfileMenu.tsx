import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { signOut, useUser } from "@/lib/user-store";

export function UserProfileMenu() {
  const user = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  function handleSignOut() {
    setOpen(false);
    signOut();
    navigate({ to: "/" });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className="focus-legal flex items-center gap-3"
      >
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 items-center justify-center rounded-full border border-brass-dim bg-background/92 font-display text-xs text-brass backdrop-blur transition-colors hover:border-brass ${
            open ? "border-brass" : ""
          }`}
        >
          {user.initials}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="chamber-panel grain absolute right-0 top-full z-50 mt-2 w-60 border border-border shadow-2xl shadow-black/50"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="label-legal">Signed in as</p>
            <p className="mt-1.5 truncate font-display text-sm text-parchment">{user.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {user.email || "Logged in"}
            </p>
          </div>
          <div className="p-1.5">
            <Link
              to="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="focus-legal flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface/60 hover:text-parchment"
            >
              <User className="h-3.5 w-3.5 text-brass-dim" />
              Profile Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="focus-legal flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface/60 hover:text-burgundy"
            >
              <LogOut className="h-3.5 w-3.5 text-brass-dim" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
