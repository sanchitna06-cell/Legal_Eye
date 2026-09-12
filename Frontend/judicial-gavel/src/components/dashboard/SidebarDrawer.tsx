import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  CalendarDays,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Lock,
  Menu,
  Pin,
  Scale,
  Upload,
} from "lucide-react";
import type { CaseCategory, CaseRecord } from "@/data/cases";
import { CASE_CATEGORIES, STATUS_TONE, isConfidential, isOpenMatter } from "@/data/cases";
import { useCases } from "@/lib/case-store";

/**
 * Literal class for elements that disappear while the sidebar is collapsed
 * into its icon rail (md+). The rail state lives on the `data-collapsed`
 * attribute of the group <aside>, so Tailwind's group-data variant drives it.
 */
const HIDE_COLLAPSED = "md:group-data-[collapsed=true]:hidden";

interface SidebarDrawerProps {
  /** Desktop: true = full sidebar (default), false = collapsed icon rail. */
  expanded: boolean;
  /** Mobile: drawer visibility (off-canvas under md). */
  mobileOpen: boolean;
  /** Toggle the desktop sidebar between expanded and rail. */
  onToggle: () => void;
  /** Close the mobile drawer. */
  onMobileClose: () => void;
  /** Raised when a category in The Bar is picked. */
  onSelectCategory: (category: CaseCategory) => void;
  /** Category currently filtering the dashboard, if any. */
  activeCategory: CaseCategory | null;
}

function DrawerCaseRow({ record, onNavigate }: { record: CaseRecord; onNavigate: () => void }) {
  const confidential = isConfidential(record);
  return (
    <li>
      <Link
        to="/records"
        search={{ case: record.id }}
        onClick={onNavigate}
        className={`focus-legal group flex w-full items-start gap-3 border-l-2 px-3 py-2.5 text-left transition-colors ${
          confidential
            ? "border-burgundy/60 hover:bg-burgundy/[0.06]"
            : "border-transparent hover:border-brass-dim hover:bg-surface/70"
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-[0.14em] text-brass-dim">
              {record.id}
            </span>
            {confidential && <Lock className="h-2.5 w-2.5 shrink-0 text-burgundy" />}
          </span>
          <span className="mt-1 line-clamp-2 font-display text-[13px] leading-snug text-parchment group-hover:text-[color:color-mix(in_oklab,var(--parchment)_90%,var(--brass))]">
            {record.title}
          </span>
          <span className="mt-1 block truncate text-[11px] text-muted-foreground">
            {record.court}
          </span>
        </span>
        <span
          className={`mt-0.5 shrink-0 border px-1.5 py-0.5 text-[9px] tracking-[0.1em] uppercase ${STATUS_TONE[record.status]}`}
        >
          {record.status}
        </span>
      </Link>
    </li>
  );
}

function SidebarSection({
  icon: Icon,
  title,
  count,
  defaultOpen = false,
  railCollapsed,
  children,
}: {
  icon: typeof Pin;
  title: string;
  count: number;
  defaultOpen?: boolean;
  railCollapsed: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expandedSection = !railCollapsed && open;
  return (
    <section className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => {
          if (!railCollapsed) setOpen((o) => !o);
        }}
        aria-expanded={expandedSection}
        title={railCollapsed ? title : undefined}
        className={`focus-legal flex w-full items-center gap-2 px-3 py-1 text-left transition-colors hover:bg-surface/40 ${
          railCollapsed ? "md:justify-center" : "justify-between"
        }`}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-brass-dim" />
          <span
            className={`text-[12px] font-extrabold tracking-[0.18em] text-muted-foreground uppercase ${HIDE_COLLAPSED}`}
          >
            {title}
          </span>
        </span>
        <span className={`flex items-center gap-2 ${HIDE_COLLAPSED}`}>
          <span className="font-mono text-[10px] text-brass-dim">
            {String(count).padStart(2, "0")}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-brass-dim transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expandedSection ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden" inert={!expandedSection}>
          {children}
        </div>
      </div>
    </section>
  );
}

function BarCategoryRow({
  category,
  count,
  active,
  onSelect,
}: {
  category: CaseCategory;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={`focus-legal flex w-full items-center justify-between gap-2 border-l-2 px-3 py-1.5 text-left text-[12px] font-bold transition-colors ${
          active
            ? "border-brass bg-surface/60 text-parchment"
            : "border-transparent text-muted-foreground hover:border-brass-dim hover:bg-surface/40 hover:text-parchment"
        }`}
      >
        <span>{category}</span>
        <span className="font-mono text-[10px] text-brass-dim">
          {String(count).padStart(2, "0")}
        </span>
      </button>
    </li>
  );
}

/** Primary routes mirrored in the sidebar so the collapsed rail stays navigable. */
const SIDEBAR_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/records", label: "Case Records", icon: FileText },
  { to: "/upload", label: "Upload Case", icon: Upload },
] as const;

export function SidebarDrawer({
  expanded,
  mobileOpen,
  onToggle,
  onMobileClose,
  onSelectCategory,
  activeCategory,
}: SidebarDrawerProps) {
  const cases = useCases();
  const closeRef = useRef<HTMLButtonElement>(null);
  const rail = !expanded;

  const pinned = useMemo(() => cases.filter((c) => c.pinned && isOpenMatter(c)), [cases]);
  const archived = useMemo(
    () => cases.filter((c) => c.archived || c.status === "Disposed"),
    [cases],
  );
  const barCounts = useMemo(() => {
    const counts = new Map<CaseCategory, number>(CASE_CATEGORIES.map((c) => [c, 0]));
    for (const c of cases) {
      if (c.category) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    }
    return counts;
  }, [cases]);

  // Mobile drawer only: Escape closes, body scroll locks. The desktop sidebar
  // is a fixed push-layout column and never locks scroll.
  useEffect(() => {
    if (!mobileOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose();
    };
    document.addEventListener("keydown", onKey);
    if (window.matchMedia("(max-width: 767px)").matches) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen, onMobileClose]);

  const pickCategory = (category: CaseCategory) => {
    onSelectCategory(category);
    // Close the drawer on mobile so the filtered dashboard is visible.
    if (window.matchMedia("(max-width: 767px)").matches) onMobileClose();
  };

  return (
    <>
      {/* Scrim — mobile drawer mode only; desktop uses the push layout. */}
      <div
        aria-hidden="true"
        onClick={onMobileClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel — full-height fixed column on md+ (no top bar above it), full-height drawer on mobile. */}
      <aside
        aria-label="Case intelligence — navigation, pinned matters, case categories and archive"
        data-collapsed={expanded ? "false" : "true"}
        className={`dark-chrome group fixed left-0 z-50 flex w-72 flex-col border-r border-chrome-border bg-sidebar grain shadow-2xl shadow-black/40 transition-[width,transform,visibility] duration-300 ease-out md:shadow-none
          max-md:inset-y-0
          md:bottom-0 md:top-0
          ${rail ? "md:w-16" : ""}
          ${
            mobileOpen
              ? "max-md:translate-x-0"
              : "max-md:pointer-events-none max-md:invisible max-md:-translate-x-full"
          }`}
      >
        {/* Handle row — JURY HASH brand top-left; the triple-line button collapses (desktop) / closes (mobile). */}
        <div
          className={`flex items-center justify-between border-b border-border px-5 py-3 ${
            rail ? "md:justify-center md:px-0" : ""
          }`}
        >
          <span
            className={`font-display text-[20px] font-black text-base tracking-wide ${HIDE_COLLAPSED}`}
          >
            JURY<span className="text-brass">HASH</span>
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onMobileClose}
            aria-label="Close sidebar"
            className="focus-legal flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface/60 hover:text-parchment md:hidden"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
            className="focus-legal hidden h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface/60 hover:text-parchment md:flex"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <p
            className={`px-3 pt-4 text-[12px] font-bold tracking-[0.18em] text-muted-foreground/80 uppercase ${HIDE_COLLAPSED}`}
          >
            Case intelligence
          </p>

          {/* Primary navigation — mirrors the top bar so the rail stays usable when collapsed. */}
          <nav aria-label="Sidebar primary" className="mt-1">
            <ul className="space-y-0.5">
              {SIDEBAR_NAV.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    title={rail ? item.label : undefined}
                    className={`focus-legal flex items-center gap-3 px-3 py-2 text-[10px] font-mono font-bold tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:bg-surface/40 hover:text-parchment data-[status=active]:bg-surface/80 data-[status=active]:text-parchment ${
                      rail ? "md:justify-center" : ""
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0 text-brass-dim" />
                    <span className={HIDE_COLLAPSED}>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <p
            className={`px-3 pt-5 text-[11px] font-bold tracking-[0.18em] text-muted-foreground/80 uppercase ${HIDE_COLLAPSED}`}
          >
            Matters
          </p>

          {/* Pinned cases */}
          <SidebarSection
            icon={Pin}
            title="Pinned Cases"
            count={pinned.length}
            defaultOpen
            railCollapsed={rail}
          >
            {pinned.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {pinned.map((record) => (
                  <DrawerCaseRow key={record.id} record={record} onNavigate={onMobileClose} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 px-3 text-xs leading-relaxed text-muted-foreground/80">
                No pinned cases yet. Pin a matter from its case card or record for one-tap access
                here.
              </p>
            )}
          </SidebarSection>

          {/* The Bar — case-type browser */}
          <SidebarSection
            icon={Scale}
            title="Categories"
            count={CASE_CATEGORIES.length}
            railCollapsed={rail}
          >
            <ul className="mt-3 space-y-0.5">
              {CASE_CATEGORIES.map((category) => (
                <BarCategoryRow
                  key={category}
                  category={category}
                  count={barCounts.get(category) ?? 0}
                  active={activeCategory === category}
                  onSelect={() => pickCategory(category)}
                />
              ))}
            </ul>
          </SidebarSection>

          {/* Archive — positioned lower, with clear breathing space */}
          <div className="mt-6">
            <SidebarSection
              icon={Archive}
              title="Archived Cases"
              count={archived.length}
              railCollapsed={rail}
            >
              {archived.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {archived.map((record) => (
                    <DrawerCaseRow key={record.id} record={record} onNavigate={onMobileClose} />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 px-3 text-xs leading-relaxed text-muted-foreground/80">
                  Completed cases will appear here when a matter is closed.
                </p>
              )}
            </SidebarSection>
          </div>
        </div>

        <div className={`border-t border-border px-5 py-2.5 ${HIDE_COLLAPSED}`}>
          <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground/70 uppercase">
            Case Archive
          </p>
        </div>
      </aside>
    </>
  );
}
