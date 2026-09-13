import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  Link,
} from "@tanstack/react-router";

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


import type {
  CaseCategory,
  CaseRecord,
} from "@/data/cases";

import {
  CASE_CATEGORIES,
  STATUS_TONE,
  isConfidential,
  isOpenMatter,
} from "@/data/cases";

import {
  useCases,
} from "@/lib/case-store";


const HIDE_COLLAPSED =
  "md:group-data-[collapsed=true]:hidden";


interface SidebarDrawerProps {
  expanded: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
  onSelectCategory: (
    category: CaseCategory,
  ) => void;
  activeCategory:
    | CaseCategory
    | null;
}


const SIDEBAR_NAV = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },

  {
    to: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
  },

  {
    to: "/records",
    label: "Case Records",
    icon: FileText,
  },

  {
    to: "/upload",
    label: "Upload Case",
    icon: Upload,
  },
] as const;


/* ================================================================
   CASE ROW
   ================================================================ */

function DrawerCaseRow({
  record,
  onNavigate,
}: {
  record: CaseRecord;
  onNavigate: () => void;
}) {
  const confidential =
    isConfidential(
      record,
    );
  const archived =
    Boolean(record.archived) ||
    record.status === "Disposed";

  return (
    <li>
      <Link
        to="/records"
        search={{
          case: record.id,
        }}
        onClick={
          onNavigate
        }
        title={
          record.title
        }
        className={`focus-legal group flex w-full items-start gap-3 border-l-2 px-3 py-2.5 text-left transition-colors ${
          confidential
            ? "border-burgundy/60 bg-burgundy/[0.025] hover:bg-burgundy/[0.06]"
            : "border-transparent hover:border-brass-dim hover:bg-surface/70"
        }`}
      >
        <span className="min-w-0 flex-1">

          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-[9px] tracking-[0.14em] text-brass-dim">
              {record.id}
            </span>

            {confidential && (
              <Lock className="h-2.5 w-2.5 shrink-0 text-burgundy" />
            )}
          </span>


          <span className="mt-1 block line-clamp-2 font-display text-[13px] leading-snug text-parchment group-hover:text-[color:color-mix(in_oklab,var(--parchment)_90%,var(--brass))]">
            {record.title}
          </span>


          <span className="mt-1 block truncate text-[10px] text-muted-foreground">
            {record.court ||
              "Court not specified"}
          </span>

        </span>


        <span
          className={`mt-0.5 shrink-0 border px-1.5 py-0.5 text-[8px] font-medium tracking-[0.1em] uppercase ${STATUS_TONE[record.status]}`}
        >
          {record.status}
            {archived
              ? "Archived"
            : record.status}
        </span>
      </Link>
    </li>
  );
}


/* ================================================================
   COLLAPSIBLE SECTION
   ================================================================ */

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
  const [
    open,
    setOpen,
  ] = useState(
    defaultOpen,
  );

  const expandedSection =
    !railCollapsed &&
    open;


  return (
    <section className="border-t border-border pt-3">

      <button
        type="button"
        onClick={() => {
          if (
            !railCollapsed
          ) {
            setOpen(
              (value) =>
                !value,
            );
          }
        }}
        aria-expanded={
          expandedSection
        }
        title={
          railCollapsed
            ? title
            : undefined
        }
        className={`focus-legal flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-surface/40 ${
          railCollapsed
            ? "md:justify-center"
            : "justify-between"
        }`}
      >

        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-brass-dim" />

          <span
            className={`text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase ${HIDE_COLLAPSED}`}
          >
            {title}
          </span>
        </span>


        <span
          className={`flex items-center gap-2 ${HIDE_COLLAPSED}`}
        >
          <span className="font-mono text-[9px] text-brass-dim">
            {String(
              count,
            ).padStart(
              2,
              "0",
            )}
          </span>

          <ChevronDown
            className={`h-3.5 w-3.5 text-brass-dim transition-transform duration-300 ${
              open
                ? "rotate-180"
                : ""
            }`}
          />
        </span>

      </button>


      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expandedSection
            ? "grid-rows-[1fr]"
            : "grid-rows-[0fr]"
        }`}
      >
        <div
          className="min-h-0 overflow-hidden"
          inert={!expandedSection}
        >
          {children}
        </div>
      </div>

    </section>
  );
}


/* ================================================================
   CATEGORY
   ================================================================ */

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
        onClick={
          onSelect
        }
        aria-pressed={
          active
        }
        className={`focus-legal flex w-full items-center justify-between gap-2 border-l-2 px-3 py-1.5 text-left text-[10px] font-semibold tracking-[0.08em] transition-colors ${
          active
            ? "border-brass bg-surface/60 text-parchment"
            : "border-transparent text-muted-foreground hover:border-brass-dim hover:bg-surface/40 hover:text-parchment"
        }`}
      >
        <span>
          {category}
        </span>

        <span className="font-mono text-[9px] text-brass-dim">
          {String(
            count,
          ).padStart(
            2,
            "0",
          )}
        </span>
      </button>
    </li>
  );
}


/* ================================================================
   SIDEBAR
   ================================================================ */

export function SidebarDrawer({
  expanded,
  mobileOpen,
  onToggle,
  onMobileClose,
  onSelectCategory,
  activeCategory,
}: SidebarDrawerProps) {
  const cases =
    useCases();

  const closeRef =
    useRef<
      HTMLButtonElement
    >(null);

  const rail =
    !expanded;


  const pinned =
    useMemo(
      () =>
        cases.filter(
          (record) =>
            record.pinned &&
            isOpenMatter(
              record,
            ),
        ),
      [cases],
    );


  const archived =
    useMemo(
      () =>
        cases.filter(
          (record) =>
            record.archived ||
            record.status ===
              "Disposed",
        ),
      [cases],
    );


  const barCounts =
    useMemo(() => {
      const counts =
        new Map<
          CaseCategory,
          number
        >(
          CASE_CATEGORIES.map(
            (category) => [
              category,
              0,
            ],
          ),
        );

      for (const record of cases) {
        if (
          record.category
        ) {
          counts.set(
            record.category,
            (
              counts.get(
                record.category,
              ) ?? 0
            ) + 1,
          );
        }
      }

      return counts;
    }, [cases]);


  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    closeRef.current?.focus();

    const onKey = (
      event: globalThis.KeyboardEvent,
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        onMobileClose();
      }
    };

    document.addEventListener(
      "keydown",
      onKey,
    );

    if (
      window.matchMedia(
        "(max-width: 767px)",
      ).matches
    ) {
      document.body.style.overflow =
        "hidden";
    }

    return () => {
      document.removeEventListener(
        "keydown",
        onKey,
      );

      document.body.style.overflow =
        "";
    };
  }, [
    mobileOpen,
    onMobileClose,
  ]);


  const pickCategory = (
    category: CaseCategory,
  ) => {
    onSelectCategory(
      category,
    );

    if (
      window.matchMedia(
        "(max-width: 767px)",
      ).matches
    ) {
      onMobileClose();
    }
  };


  return (
    <>
      {/* Mobile scrim */}

      <div
        aria-hidden="true"
        onClick={
          onMobileClose
        }
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 md:hidden ${
          mobileOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />


      {/* Sidebar */}

      <aside
        aria-label="Case intelligence navigation"
        data-collapsed={
          expanded
            ? "false"
            : "true"
        }
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

        {/* ========================================================
            BRAND / HANDLE
            ======================================================== */}

        <div
          className={`flex items-center justify-between border-b border-border px-5 py-4 ${
            rail
              ? "md:justify-center md:px-0"
              : ""
          }`}
        >
          <span
            className={`font-display text-[19px] font-black tracking-wide text-parchment ${HIDE_COLLAPSED}`}
          >
            JURY
            <span className="text-brass">
              HASH
            </span>
          </span>


          <button
            ref={
              closeRef
            }
            type="button"
            onClick={
              onMobileClose
            }
            aria-label="Close sidebar"
            className="focus-legal flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-surface/60 hover:text-parchment md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>


          <button
            type="button"
            onClick={
              onToggle
            }
            aria-expanded={
              expanded
            }
            aria-label={
              expanded
                ? "Collapse sidebar"
                : "Expand sidebar"
            }
            title={
              expanded
                ? "Collapse sidebar"
                : "Expand sidebar"
            }
            className="focus-legal hidden h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-surface/60 hover:text-parchment md:flex"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>


        {/* ========================================================
            NAVIGATION
            ======================================================== */}

        <div className="flex-1 overflow-y-auto px-3 pb-6">

          <p
            className={`px-3 pt-5 text-[10px] font-bold tracking-[0.2em] text-muted-foreground/80 uppercase ${HIDE_COLLAPSED}`}
          >
            Case intelligence
          </p>


          <nav
            aria-label="Sidebar primary"
            className="mt-2"
          >
            <ul className="space-y-0.5">
              {SIDEBAR_NAV.map(
                (item) => (
                  <li
                    key={
                      item.to
                    }
                  >
                    <Link
                      to={
                        item.to
                      }
                      title={
                        rail
                          ? item.label
                          : undefined
                      }
                      className={`focus-legal flex items-center gap-3 border-l-2 border-transparent px-3 py-2 text-[9px] font-bold tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:border-brass-dim hover:bg-surface/40 hover:text-parchment data-[status=active]:border-brass data-[status=active]:bg-surface/70 data-[status=active]:text-parchment ${
                        rail
                          ? "md:justify-center"
                          : ""
                      }`}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0 text-brass-dim" />

                      <span
                        className={
                          HIDE_COLLAPSED
                        }
                      >
                        {
                          item.label
                        }
                      </span>
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>


          {/* ======================================================
              MATTERS
              ====================================================== */}

          <p
            className={`px-3 pt-6 text-[10px] font-bold tracking-[0.2em] text-muted-foreground/80 uppercase ${HIDE_COLLAPSED}`}
          >
            Matters
          </p>


          <SidebarSection
            icon={Pin}
            title="Pinned Cases"
            count={
              pinned.length
            }
            defaultOpen
            railCollapsed={
              rail
            }
          >
            {pinned.length >
            0 ? (
              <ul className="mt-3 space-y-1">
                {pinned.map(
                  (
                    record,
                  ) => (
                    <DrawerCaseRow
                      key={
                        record.id
                      }
                      record={
                        record
                      }
                      onNavigate={
                        onMobileClose
                      }
                    />
                  ),
                )}
              </ul>
            ) : (
              <p className="mt-3 px-3 text-[11px] leading-relaxed text-muted-foreground/80">
                No pinned cases yet.
                Pin a matter from
                its case card for
                one-tap access here.
              </p>
            )}
          </SidebarSection>


          <SidebarSection
            icon={Scale}
            title="Categories"
            count={
              CASE_CATEGORIES.length
            }
            railCollapsed={
              rail
            }
          >
            <ul className="mt-3 space-y-0.5">
              {CASE_CATEGORIES.map(
                (
                  category,
                ) => (
                  <BarCategoryRow
                    key={
                      category
                    }
                    category={
                      category
                    }
                    count={
                      barCounts.get(
                        category,
                      ) ?? 0
                    }
                    active={
                      activeCategory ===
                      category
                    }
                    onSelect={() =>
                      pickCategory(
                        category,
                      )
                    }
                  />
                ),
              )}
            </ul>
          </SidebarSection>


          <div className="mt-6">
            <SidebarSection
              icon={Archive}
              title="Archived Cases"
              count={
                archived.length
              }
              railCollapsed={
                rail
              }
            >
              {archived.length >
              0 ? (
                <ul className="mt-3 space-y-1">
                  {archived.map(
                    (
                      record,
                    ) => (
                      <DrawerCaseRow
                        key={
                          record.id
                        }
                        record={
                          record
                        }
                        onNavigate={
                          onMobileClose
                        }
                      />
                    ),
                  )}
                </ul>
              ) : (
                  <p className="mt-3 px-3 text-[11px] leading-relaxed text-muted-foreground/80">
                      Archived matters will
                      appear here for
                      reference and later restoration.
                  </p>
              )}
            </SidebarSection>
          </div>

        </div>


        {/* ========================================================
            FOOTER
            ======================================================== */}

        <div
          className={`border-t border-border px-5 py-3 ${HIDE_COLLAPSED}`}
        >
          <p className="text-[9px] font-bold tracking-[0.16em] text-muted-foreground/70 uppercase">
            Case archive
          </p>
        </div>

      </aside>
    </>
  );
}