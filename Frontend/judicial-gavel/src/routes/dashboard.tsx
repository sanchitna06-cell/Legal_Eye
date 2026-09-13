import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

import { AppHeader } from "@/components/layout/AppHeader";
import { CaseSearch } from "@/components/dashboard/CaseSearch";
import { CaseStats } from "@/components/dashboard/CaseStats";
import {
  AddCaseTile,
  CaseCard,
} from "@/components/dashboard/CaseCard";
import { SidebarDrawer } from "@/components/dashboard/SidebarDrawer";

import { useCases } from "@/lib/case-store";
import {
  getSession,
  isAuthenticated,
  useUser,
} from "@/lib/user-store";

import {
  EMPTY_CASE_SEARCH,
  caseMatchesFilters,
  caseSearchText,
  isOpenMatter,
  type CaseCategory,
  type CaseSearchFields,
} from "@/data/cases";


export const Route = createFileRoute(
  "/dashboard",
)({
  beforeLoad: () => {
    if (!getSession() || !isAuthenticated()) {
      throw redirect({ to: "/" });
    }
  },

  head: () => ({
    meta: [
      {
        title: "Lawyer's Dashboard — JURY HASH",
      },
      {
        name: "description",
        content:
          "Your JURY HASH case workspace: search matters, review active cases, and access pinned or archived records.",
      },
    ],
  }),

  component: Dashboard,
});


function Dashboard() {
  const cases = useCases();
  const user = useUser();

  const [query, setQuery] =
    useState("");

  const [filters, setFilters] =
    useState<CaseSearchFields>(
      EMPTY_CASE_SEARCH,
    );

  const [category, setCategory] =
    useState<CaseCategory | null>(
      null,
    );

  const [sidebarExpanded, setSidebarExpanded] =
    useState(true);

  const [mobileDrawerOpen, setMobileDrawerOpen] =
    useState(false);


  const openSidebar = () => {
    if (
      window.matchMedia(
        "(min-width: 768px)",
      ).matches
    ) {
      setSidebarExpanded(true);
    } else {
      setMobileDrawerOpen(true);
    }
  };


  const openMatters = useMemo(
  () =>
    cases.filter(
      (record) =>
        isOpenMatter(record) &&
        !record.archived,
    ),
  [cases],
);


  const hasQuery =
    query.trim().length > 0;

  const hasFilters =
    Object.values(filters).some(
      (value) => value.trim(),
    );


  const filtered = useMemo(() => {
    const q =
      query.trim().toLowerCase();

    return openMatters.filter(
      (record) => {
        if (
          q &&
          !caseSearchText(
            record,
          ).includes(q)
        ) {
          return false;
        }

        if (
          category &&
          record.category !== category
        ) {
          return false;
        }

        return caseMatchesFilters(
          record,
          filters,
        );
      },
    );
  }, [
    query,
    filters,
    category,
    openMatters,
  ]);


  const displayName =
    user?.name?.trim() || "Lawyer";


  return (
    <div className="min-h-screen bg-background">
      <SidebarDrawer
        expanded={sidebarExpanded}
        mobileOpen={mobileDrawerOpen}
        onToggle={() =>
          setSidebarExpanded(
            (value) => !value,
          )
        }
        onMobileClose={() =>
          setMobileDrawerOpen(false)
        }
        onSelectCategory={
          setCategory
        }
        activeCategory={
          category
        }
      />

      <AppHeader
        onMenu={() =>
          setMobileDrawerOpen(true)
        }
        menuOpen={
          mobileDrawerOpen
        }
      />


      <div
        className={`transition-[padding-left] duration-300 ease-out ${
          sidebarExpanded
            ? "md:pl-80"
            : "md:pl-16"
        }`}
      >
        <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">

          {/* ========================================================
              HEADER
              ======================================================== */}

          <header className="pt-12 sm:pt-14">
            <p className="label-legal">
              JURY HASH · CASE MANAGER
            </p>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1 className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1.02] tracking-[-0.015em] text-parchment">
                  Welcome back,{" "}
                  <span className="text-brass">
                    {displayName}
                  </span>
                  .
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Review your active matters,
                  locate case records, and continue
                  working with your evidence archive.
                </p>
              </div>

              <div className="pb-1 text-right">
                <p className="font-mono text-[18px] tracking-[0.14em] text-brass">
                  {String(
                    cases.length,
                  ).padStart(2, "0")}
                </p>

                <p className="mt-1 font-mono text-[9px] tracking-[0.16em] text-brass-dim uppercase">
                  matters on file
                </p>
              </div>
            </div>

            <div className="mt-6 h-px w-full rule-brass" />
          </header>


          {/* ========================================================
              SEARCH
              ======================================================== */}

          <section
            aria-label="Search cases"
            className="mt-6"
          >
            <CaseSearch
              value={query}
              onChange={setQuery}
              filters={filters}
              onFiltersChange={
                setFilters
              }
            />
          </section>


          {/* ========================================================
              SUMMARY
              ======================================================== */}

          <section
            aria-label="Case overview"
            className="mt-6"
          >
            <CaseStats
              cases={cases}
            />
          </section>


          {/* ========================================================
              ACTIVE MATTERS
              ======================================================== */}

          <section
            aria-label="Active matters"
            className="mt-10"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                  <h2 className="font-display text-[27px] leading-none text-parchment">
                    Active matters
                  </h2>

                  <span className="font-mono text-[10px] tracking-[0.13em] text-brass-dim uppercase">
                    {openMatters.length}{" "}
                    {openMatters.length ===
                    1
                      ? "matter"
                      : "matters"}{" "}
                    on file
                  </span>

                  {(hasQuery ||
                    hasFilters ||
                    category) && (
                    <span className="text-xs text-muted-foreground">
                      {filtered.length}{" "}
                      of{" "}
                      {openMatters.length}{" "}
                      match your search
                    </span>
                  )}
                </div>

                {category && (
                  <button
                    type="button"
                    onClick={() =>
                      setCategory(null)
                    }
                    className="focus-legal mt-3 inline-flex items-center gap-1.5 border border-brass/40 px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-brass uppercase transition-colors hover:bg-brass/10"
                  >
                    {category}
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={openSidebar}
                className="focus-legal inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium tracking-[0.14em] text-brass-dim uppercase transition-colors hover:text-brass"
              >
                Pinned & archived
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 h-px w-full bg-[var(--rule-brass)]" />


            {/* ======================================================
                RESULTS
                ====================================================== */}

            {filtered.length > 0 ? (
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map(
                  (record) => (
                    <CaseCard
                      key={
                        record.id
                      }
                      record={
                        record
                      }
                    />
                  ),
                )}

                {!hasQuery &&
                  !hasFilters &&
                  !category && (
                    <AddCaseTile />
                  )}
              </div>
            ) : (
    <div className="mt-7 border border-dashed border-border bg-surface/20 px-6 py-14 text-center">
      <p className="font-display text-lg text-parchment">
        {hasQuery || hasFilters || category
          ? "No active matter matches your search."
          : "No active matters yet."}
      </p>

        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {hasQuery || hasFilters || category ? (
          <>
            Try broadening your search or check the{" "}
            <button
              type="button"
              onClick={openSidebar}
              className="focus-legal text-brass underline-offset-4 hover:underline"
            >
              archived cases
            </button>
              .
            </>
          ) : (
            "Create a new case to begin building your workspace."
          )}
        </p>

        {hasQuery || hasFilters || category ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilters(EMPTY_CASE_SEARCH);
              setCategory(null);
            }}
              className="focus-legal mt-5 border border-brass/40 px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-brass uppercase transition-colors hover:bg-brass/10"
            >
              Clear search
            </button>
          ) : (
            <a
              href="/upload"
              className="focus-legal mt-5 inline-flex border border-brass/40 px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-brass uppercase transition-colors hover:bg-brass/10"
            >
              Create new case
            </a>
          )}
        </div>
            )}
          </section>


          {/* ========================================================
              MOBILE SIDEBAR ACTION
              ======================================================== */}

          <div className="mt-10 flex justify-center md:hidden">
            <button
              type="button"
              onClick={() =>
                setMobileDrawerOpen(
                  true,
                )
              }
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