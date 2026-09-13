import { Link } from "@tanstack/react-router";
import {
  CheckCircle,
  LayoutDashboard,
  LogOut,
  Lock,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  getAdminSystemHealth,
  type AdminSystemHealth,
} from "@/lib/api";

import {
  useAdmin,
  signOutAdmin,
  DEFAULT_ADMIN_USER,
} from "@/lib/admin-store";

import emblemOfIndia from "@/assets/emblem_of_india.png";


function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6 L8 10 L12 6" />
    </svg>
  );
}


/* ================================================================
   SYSTEM STATUS
   ================================================================ */

function StatusDot({
  status,
}: {
  status: AdminSystemHealth["status"] | "loading";
}) {
  const healthy = status === "healthy";
  const degraded = status === "degraded";
  const critical = status === "critical";

  const state = healthy
    ? "healthy"
    : degraded
      ? "degraded"
      : critical
        ? "critical"
        : "loading";

  const text = healthy
    ? "All Systems Operational"
    : degraded
      ? "Systems Degraded"
      : critical
        ? "Critical"
        : "Checking Systems";

  return (
    <div
      className={`admin-system-status admin-system-status--${state}`}
      aria-label={text}
    >
      <span className="admin-system-status__dot" />
      <span className="admin-system-status__label">
        {text}
      </span>
    </div>
  );
}


/* ================================================================
   ADMIN USER MENU
   ================================================================ */

function AdminUserMenu() {
  const user = useAdmin();

  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
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
    <div
      ref={rootRef}
      className="admin-account"
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${effectiveUser.name}`}
        className="admin-account__trigger"
      >
        <span className="admin-account__avatar">
          {effectiveUser.initials}
        </span>

        <span className="admin-account__identity">
          <span className="admin-account__eyebrow">
            Signed in as
          </span>

          <span className="admin-account__name">
            {effectiveUser.name}
          </span>
        </span>

        <ChevronDown
          className={`admin-account__chevron ${
            open ? "is-open" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="admin-account__menu"
        >
          <div className="admin-account__menu-header">
            <p className="admin-account__menu-name">
              {effectiveUser.name}
            </p>

            <p className="admin-account__menu-email">
              {effectiveUser.username}
            </p>
          </div>

          <div className="admin-account__menu-actions">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="admin-account__signout"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ================================================================
   NAVIGATION
   ================================================================ */

type AdminNavTo =
  | "/admin"
  | "/admin/users"
  | "/admin/audit-logs"
  | "/admin/security-events"
  | "/admin/document-integrity"
  | "/admin/event-pipeline"
  | "/admin/system-health"
  | "/admin/settings";

const NAV: Array<{
  to: AdminNavTo;
  label: string;
  icon: LucideIcon;
  section: "Overview" | "Operations" | "System";
}> = [
  {
    to: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    section: "Overview",
  },
  {
    to: "/admin/users",
    label: "User Management",
    icon: Users,
    section: "Operations",
  },
  {
    to: "/admin/audit-logs",
    label: "Audit Logs",
    icon: ScrollText,
    section: "Operations",
  },
  {
    to: "/admin/security-events",
    label: "Security Events",
    icon: Shield,
    section: "Operations",
  },
  {
    to: "/admin/document-integrity",
    label: "Document Integrity",
    icon: ShieldCheck,
    section: "Operations",
  },
  {
    to: "/admin/event-pipeline",
    label: "Event Pipeline",
    icon: Workflow,
    section: "System",
  },
  {
    to: "/admin/system-health",
    label: "System Health",
    icon: CheckCircle,
    section: "System",
  },
  {
    to: "/admin/settings",
    label: "Settings",
    icon: Settings,
    section: "System",
  },
];

const NAV_SECTIONS: Array<
  "Overview" | "Operations" | "System"
> = [
  "Overview",
  "Operations",
  "System",
];


/* ================================================================
   ADMIN LAYOUT
   ================================================================ */

export function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentTime, setCurrentTime] =
    useState(() => new Date());

  const [systemHealth, setSystemHealth] =
    useState<AdminSystemHealth["status"] | "loading">(
      "loading",
    );

  /* Live clock */

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  /* Live system health */

  useEffect(() => {
    let active = true;

    async function loadHealth() {
      try {
        const health = await getAdminSystemHealth();

        if (active) {
          setSystemHealth(health.status);
        }
      } catch {
        if (active) {
          setSystemHealth("critical");
        }
      }
    }

    void loadHealth();

    const interval = window.setInterval(() => {
      void loadHealth();
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const dateTime = currentTime.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div className="admin-console">
      {/* ============================================================
          SIDEBAR
          ============================================================ */}

      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <div className="admin-sidebar__logo">
            JH
          </div>

          <div className="admin-sidebar__brand-copy">
            <p className="admin-sidebar__brand-name">
              Jury<span>Hash</span>
            </p>

            <p className="admin-sidebar__tagline">
              Evidence. Integrity. Justice.
            </p>
          </div>
        </div>


        <nav
          aria-label="Admin console"
          className="admin-sidebar__nav"
        >
          {NAV_SECTIONS.map((section) => (
            <section
              key={section}
              className="admin-sidebar__section"
            >
              <p className="admin-sidebar__section-label">
                {section}
              </p>

              <div className="admin-sidebar__links">
                {NAV.filter(
                  (item) => item.section === section,
                ).map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{
                        exact: item.to === "/admin",
                      }}
                      className="admin-nav-link"
                    >
                      <Icon className="admin-nav-link__icon" />
                      <span className="admin-nav-link__label">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>


        <div className="admin-sidebar__footer">
          <div className="admin-restricted">
            <div className="admin-restricted__icon">
              <Lock />
            </div>

            <div>
              <p className="admin-restricted__title">
                Restricted Console
              </p>

              <p className="admin-restricted__subtitle">
                Authorized Personnel Only
              </p>
            </div>
          </div>

          <div className="admin-sidebar__meta">
            <span>Jury Hash</span>
            <span>v0.1.0</span>
          </div>

          <blockquote className="admin-sidebar__quote">
            “Technology in service
            <br />
            of a more transparent
            <br />
            justice system.”
          </blockquote>
        </div>
      </aside>


      {/* ============================================================
          MAIN
          ============================================================ */}

      <div className="admin-main">
        {/* ============================================================
            TOP BAR
            ============================================================ */}

        <header className="admin-topbar">
          <div className="admin-government">
            <img
              src={emblemOfIndia}
              alt="Government of India emblem"
              className="admin-government__emblem"
            />

            <div className="admin-government__copy">
              <p>Government of India</p>
              <p>Digital Justice Initiative</p>
            </div>
          </div>


          <div className="admin-search">
            <Search className="admin-search__icon" />

            <input
              type="search"
              aria-label="Global search"
              placeholder="Search users, cases, documents, logs..."
              className="admin-search__input"
            />

            <kbd className="admin-search__shortcut">
              Ctrl K
            </kbd>
          </div>


          <div className="admin-topbar__meta">
            <StatusDot status={systemHealth} />

            <div className="admin-topbar__divider" />

            <time
              dateTime={currentTime.toISOString()}
              className="admin-clock"
            >
              {dateTime}
            </time>

            <div className="admin-topbar__divider" />

            <AdminUserMenu />
          </div>
        </header>


        {/* ============================================================
            CONTENT
            ============================================================ */}

        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}