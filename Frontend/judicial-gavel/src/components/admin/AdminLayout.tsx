import { Link } from "@tanstack/react-router";
import {
  CheckCircle,
  LayoutDashboard,
  LogOut,
  Lock,
  ScrollText,
  Search,
  Shield,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAdmin, signOutAdmin, DEFAULT_ADMIN_USER } from "@/lib/admin-store";

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6 L8 10 L12 6" />
    </svg>
  );
}

function GovtEmblem() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-7 w-7 text-amber-300"
      aria-hidden="true"
      role="img"
      focusable="false"
    >
      <title>Indian National Emblem</title>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="32" cy="32" r="28" className="opacity-20" />
        <path d="M28 16 L28 32 L20 38 L28 44 L28 56 L32 52 L36 56 L36 44 L44 38 L36 32 L36 16 Z" />
        <path d="M28 16 L36 16 L32 20 Z" fill="currentColor" stroke="none" opacity="0.35" />
        {[
          [30, 22, 26, 26],
          [28, 20, 24, 24],
          [32, 20, 28, 24],
        ].map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} className="opacity-40" />
        ))}
      </g>
    </svg>
  );
}

function StatusDot({ healthy }: { healthy: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`inline-flex h-2 w-2 rounded-full ${healthy ? "bg-emerald-400" : "bg-red-400"}`}
        aria-hidden="true"
      />
      {healthy ? "All Systems Operational" : "Degraded"}
    </span>
  );
}

function AdminUserMenu() {
  const user = useAdmin();
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

  const effectiveUser = user ?? DEFAULT_ADMIN_USER;

  function handleSignOut() {
    setOpen(false);
    signOutAdmin();
    window.location.href = "/admin-login";
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${effectiveUser.name}`}
        className="focus-legal flex items-center gap-2.5"
      >
        <span className="flex h-8 w-8 items-center justify-center border border-emerald-400/40 rounded-full text-emerald-300 text-xs font-semibold">
          {effectiveUser.initials}
        </span>
        <div className="hidden text-right sm:block">
          <p className="text-[11px] text-muted-foreground">Signed in as</p>
          <p className="text-xs text-parchment">{effectiveUser.name}</p>
        </div>
        <ChevronDown className="hidden h-3 w-3 text-emerald-300/70 transition-transform duration-200 sm:block" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="chamber-panel grain absolute right-0 top-full z-50 mt-2 w-60 border border-border shadow-2xl shadow-black/50"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate font-display text-sm text-parchment">{effectiveUser.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{effectiveUser.email}</p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="focus-legal flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface/60 hover:text-burgundy"
            >
              <LogOut className="h-3.5 w-3.5 text-emerald-300/70" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const NAV: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin", label: "User Management", icon: Users },
  { to: "/admin", label: "Audit Logs", icon: ScrollText },
  { to: "/admin", label: "Security Events", icon: Shield },
  { to: "/admin", label: "Document Integrity", icon: ShieldCheck },
  { to: "/admin", label: "Event Pipeline", icon: ScrollText },
  { to: "/admin", label: "System Health", icon: CheckCircle },
  { to: "/admin", label: "Settings", icon: Users },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [searchFocused, setSearchFocused] = useState(false);
  const now = new Date();
  const dateTime = now.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div className="min-h-screen bg-[#0b131e]">
      <aside className="fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-[#1a2737] bg-[#080d15] px-4 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1a3b5e] px-2 text-[#38bdf8] text-xs font-semibold">
            LE
          </div>
          <div className="leading-tight">
            <p className="font-display text-white text-base tracking-wide">
              Legal<span className="text-[#38bdf8]">Eye</span>
            </p>
            <p className="truncate text-[10px] leading-4 text-[#8ea3bb] tracking-[0.18em] uppercase">
              Evidence. Integrity. Justice.
            </p>
          </div>
        </div>

        <div className="mt-8 flex-1 space-y-1">
          {NAV.map((item, index) => {
            const active = item.to === "/admin";
            return (
              <Link
                key={index}
                to={item.to}
                className={`focus-legal flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-l-2 border-[#38bdf8] bg-[#122236] text-white pl-4"
                    : "border-l-2 border-transparent text-[#a3b6cd] hover:bg-[#122236] hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-auto space-y-3 border-t border-[#1a2737] pt-4">
          <div className="rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-3 text-center">
            <Lock className="mx-auto h-3.5 w-3.5 text-amber-300/80" />
            <p className="text-xs text-[#8ea3bb]">Restricted Console</p>
            <p className="text-[10px] text-[#5f7891] tracking-wide">Authorized Personnel Only</p>
          </div>
          <p className="text-center text-[10px] text-[#5f7891] tracking-wide">v0.1.0</p>
          <blockquote className="border-t border-[#1a2737] pt-3 text-center text-[10px] leading-relaxed text-[#5f7891] italic">
            “Technology in service
            <br />
            of a more transparent
            <br />
            justice system.”
          </blockquote>
        </div>
      </aside>

      <div className="ml-64 flex flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[#1a2737] bg-[#0b131e]/92 backdrop-blur px-6">
          <div className="hidden sm:flex items-center gap-2">
            <GovtEmblem />
            <div className="leading-tight">
              <p className="text-[11px] text-[#8ea3bb] tracking-wide">Government of India</p>
              <p className="text-[11px] text-[#a3b6cd] tracking-wide">Digital Justice Initiative</p>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f7891]" />
              <input
                type="search"
                aria-label="Global search"
                className={`w-full border-b border-[#5f7891]/40 bg-transparent py-2 text-sm text-white placeholder:text-[#5f7891] focus:border-[#38bdf8] transition-colors ${
                  searchFocused ? "pb-2" : "pb-0"
                }`}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search users, cases, documents, logs...  Ctrl + K"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 h-5 rounded border border-[#1a2737] bg-[#080d15] px-1.5 text-[10px] text-[#5f7891]">
                Ctrl K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <StatusDot healthy={true} />
            <time className="text-[12px] text-[#8ea3bb] tabular-nums">{dateTime}</time>
            <AdminUserMenu />
          </div>
        </header>

        <main className="flex flex-1 flex-col px-6 pb-10 pt-6">{children}</main>
      </div>
    </div>
  );
}
