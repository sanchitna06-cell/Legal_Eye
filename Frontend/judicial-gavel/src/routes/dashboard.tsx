import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { CaseSearch } from "@/components/dashboard/CaseSearch";
import { CaseStats } from "@/components/dashboard/CaseStats";
import { AddCaseTile, CaseCard } from "@/components/dashboard/CaseCard";
import { SidebarDrawer } from "@/components/dashboard/SidebarDrawer";
import { useCases } from "@/lib/case-store";
import { getSession, isAuthenticated, useUser } from "@/lib/user-store";
import {
  EMPTY_CASE_SEARCH,
  caseMatchesFilters,
  caseSearchText,
  isOpenMatter,
  type CaseCategory,
  type CaseSearchFields,
} from "@/data/cases";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (!getSession() || !isAuthenticated()) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Lawyer's Dashboard — JURY HASH" },
      {
        name: "description",
        content:
          "Your JURY HASH command centre: search the case archive, review open matters and open pinned or completed records.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const cases = useCases();
  const user = useUser();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CaseSearchFields>(EMPTY_CASE_SEARCH);
  const [category, setCategory] = useState<CaseCategory | null>(null);
  // App-shell sidebar: expanded by default on desktop, with a separate
  // off-canvas drawer state for small screens.
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // "Pinned & archived" entry points: expand the docked sidebar on desktop,
  // open the off-canvas drawer on mobile.
  const openSidebar = () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      setSidebarExpanded(true);
    } else {
      setMobileDrawerOpen(true);
    }
  };

  const openMatters = useMemo(() => cases.filter(isOpenMatter), [cases]);

  const hasQuery = query.trim().length > 0;
  const hasFilters = Object.values(filters).some((v) => v.trim());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return openMatters.filter((c) => {
      if (q && !caseSearchText(c).includes(q)) return false;
      if (category && c.category !== category) return false;
      return caseMatchesFilters(c, filters);
    });
  }, [query, filters, category, openMatters]);

  return (
    <div className="min-h-screen bg-background">
      <SidebarDrawer
        expanded={sidebarExpanded}
        mobileOpen={mobileDrawerOpen}
        onToggle={() => setSidebarExpanded((v) => !v)}
        onMobileClose={() => setMobileDrawerOpen(false)}
        onSelectCategory={setCategory}
        activeCategory={category}
      />

      {/* Fixed top bar spans the viewport; the sidebar docks beneath it. */}
      <AppHeader onMenu={() => setMobileDrawerOpen(true)} menuOpen={mobileDrawerOpen} />

      {/* Scrollable content — left padding tracks the sidebar width on md+. */}
      <div
        className={`transition-[padding-left] duration-300 ease-out ${
          sidebarExpanded ? "md:pl-80" : "md:pl-16"
        }`}
      >
        <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          {/* Page title */}
          <div className="pt-16 sm:pt-12">
            <p className="label-legal">JURY HASH · Case Manager</p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <h1 className="font-display text-[clamp(1.9rem,4vw,2.9rem)] leading-none tracking-[-0.01em] text-parchment">
                Welcome back, <span className="text-brass">{user?.name ?? "Lawyer"}</span>.
              </h1>
              <p className="pb-1 font-mono text-[11px] tracking-[0.14em] text-brass-dim">
                {String(cases.length).padStart(3, "0")} matters on file
              </p>
            </div>
            <div className="mt-5 h-px w-full rule-brass" />
          </div>

          {/* Search */}
          <section aria-label="Search cases" className="mt-6">
            <CaseSearch
              value={query}
              onChange={setQuery}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </section>

          {/* Overview */}
          <div className="mt-6">
            <CaseStats cases={cases} />
          </div>

          {/* Case records */}
          <section aria-label="Case records" className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-4">
                <h2 className="font-display text-[26px] text-parchment">Active matters</h2>
                {category && (
                  <button
                    type="button"
                    onClick={() => setCategory(null)}
                    className="focus-legal inline-flex items-center gap-1.5 border border-brass/40 px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-brass uppercase transition-colors hover:bg-brass/10"
                  >
                    {category} <X className="h-3 w-3" />
                  </button>
                )}
                {hasQuery || hasFilters ? (
                  <span className="text-xs text-muted-foreground">
                    {filtered.length} of {openMatters.length} match your search
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {openMatters.length} on file
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={openSidebar}
                className="focus-legal inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-brass-dim uppercase transition-colors hover:text-brass"
              >
                Pinned & archived <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 h-px w-full bg-[var(--rule-brass)]" />

            {filtered.length > 0 ? (
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((record) => (
                  <CaseCard key={record.id} record={record} />
                ))}
                {!hasQuery && !hasFilters && !category && <AddCaseTile />}
              </div>
            ) : (
              <div className="mt-7 border border-dashed border-border px-6 py-14 text-center">
                <p className="font-display text-lg text-parchment">
                  No open matter answers that search.
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {(hasQuery || hasFilters || category) && (
                    <>
                      The reference may belong to a completed matter — check the{" "}
                      <button
                        type="button"
                        onClick={openSidebar}
                        className="focus-legal text-brass underline-offset-4 hover:underline"
                      >
                        archive in the sidebar
                      </button>
                      .
                    </>
                  )}
                </p>
              </div>
            )}
          </section>

          {/* Mobile quick action */}
          <div className="mt-10 flex items-center justify-center md:hidden">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="focus-legal inline-flex items-center gap-2 border border-border bg-surface/60 px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:border-brass-dim hover:text-parchment"
            >
              <Menu className="h-3.5 w-3.5" />
              Pinned cases & archive
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
