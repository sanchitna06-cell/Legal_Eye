import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Search,
  Scale,
  FileText,
  Clock,
  Users,
  ChevronRight,
  Lock,
  X,
  Menu,
  ArrowUpRight,
  FolderOpen,
  ShieldCheck,
  Gavel,
  Archive,
  Pin,
} from "lucide-react";

import {
  useCaseActions,
  useCases,
} from "@/lib/case-store";

import {
  CLASSIFICATION_LABEL,
  CLASSIFICATION_OPTIONS,
  STATUS_OPTIONS,
  STATUS_TONE,
  caseSearchText,
  isConfidential,
  type CaseCategory,
  type CaseClassification,
  type CaseRecord,
  type CaseStatus,
} from "@/data/cases";

import {
  getCaseDocuments,
  type BackendDocument,
} from "@/lib/api";

import { getSession } from "@/lib/user-store";

import {
  SidebarDrawer,
} from "@/components/dashboard/SidebarDrawer";

import {
  AppHeader,
} from "@/components/layout/AppHeader";


/* ==========================================================================
   ROUTE
   ========================================================================== */

export const Route = createFileRoute(
  "/records",
)({
  beforeLoad: () => {
    if (!getSession()) {
      throw redirect({
        to: "/",
      });
    }
  },

  validateSearch: (
    search: Record<string, unknown>,
  ) => {
    const caseId =
      search["case"];

    return {
      case:
        typeof caseId === "string" &&
        caseId.trim()
          ? caseId
          : undefined,
    };
  },

  head: () => ({
    meta: [
      {
        title:
          "Case Records — JURY HASH",
      },
      {
        name: "description",
        content:
          "Browse the JURY HASH case archive and review structured case intelligence, parties, histories and preserved evidence.",
      },
    ],
  }),

  component: Records,
});


/* ==========================================================================
   MAIN
   ========================================================================== */

function Records() {
  const navigate =
    useNavigate();

  const {
    case: caseParam,
  } = useSearch({
    from: "/records",
  });

  const records =
    useCases();
  const { togglePinned } = useCaseActions();


  /* ------------------------------------------------------------------------
     Filters
     ------------------------------------------------------------------------ */

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    CaseStatus | "All"
  >("All");

  const [
    classFilter,
    setClassFilter,
  ] = useState<
    CaseClassification | "All"
  >("All");

  const [
    category,
    setCategory,
  ] = useState<
    CaseCategory | null
  >(null);


  /* ------------------------------------------------------------------------
     Navigation state
     ------------------------------------------------------------------------ */

  const [
    sidebarExpanded,
    setSidebarExpanded,
  ] = useState(true);

  const [
    mobileDrawerOpen,
    setMobileDrawerOpen,
  ] = useState(false);


  /* ------------------------------------------------------------------------
     Selected case
     ------------------------------------------------------------------------ */

  const [
    selectedId,
    setSelectedId,
  ] = useState<
    string | undefined
  >(() => {
    if (
      caseParam &&
      records.some(
        (record) =>
          record.id ===
          caseParam,
      )
    ) {
      return caseParam;
    }

    return (
      records[0]?.id ??
      undefined
    );
  });


  useEffect(() => {
    if (
      caseParam &&
      records.some(
        (record) =>
          record.id ===
          caseParam,
      )
    ) {
      setSelectedId(
        caseParam,
      );

      return;
    }

    if (
      selectedId &&
      !records.some(
        (record) =>
          record.id ===
          selectedId,
      )
    ) {
      setSelectedId(
        records[0]?.id ??
        undefined,
      );
    }
  }, [
    caseParam,
    records,
    selectedId,
  ]);


  /* ------------------------------------------------------------------------
     Filtered docket
     ------------------------------------------------------------------------ */

  const filtered =
    useMemo(() => {
      const q =
        query
          .trim()
          .toLowerCase();

      return records.filter(
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
            statusFilter !==
              "All" &&
            record.status !==
              statusFilter
          ) {
            return false;
          }

          if (
            classFilter !==
              "All" &&
            record.classification !==
              classFilter
          ) {
            return false;
          }

          if (
            category &&
            record.category !==
              category
          ) {
            return false;
          }

          return true;
        },
      );
    }, [
      query,
      records,
      statusFilter,
      classFilter,
      category,
    ]);


  const selected =
    selectedId
      ? records.find(
          (record) =>
            record.id ===
            selectedId,
        )
      : undefined;


  /* ------------------------------------------------------------------------
     Archive summary
     ------------------------------------------------------------------------ */

  const archiveSummary =
    useMemo(() => {
      let active = 0;
      let reserved = 0;
      let confidential = 0;
      let disposed = 0;

      for (
        const record of records
      ) {
        if (
          record.status ===
          "Active"
        ) {
          active += 1;
        }

        if (
          record.status ===
          "Reserved"
        ) {
          reserved += 1;
        }

        if (
          record.status ===
          "Disposed"
        ) {
          disposed += 1;
        }

        if (
          isConfidential(
            record,
          )
        ) {
          confidential += 1;
        }
      }

      return {
        active,
        reserved,
        confidential,
        disposed,
      };
    }, [records]);


  function selectCase(
    id: string,
  ) {
    setSelectedId(id);

    navigate({
      to: "/records",
      search: {
        case: id,
      },
      replace: true,
    });
  }


  function clearFilters() {
    setQuery("");
    setStatusFilter("All");
    setClassFilter("All");
    setCategory(null);
  }


  /* ==========================================================================
     RENDER
     ========================================================================== */

  return (
    <div className="min-h-screen bg-background">

      <SidebarDrawer
        expanded={
          sidebarExpanded
        }
        mobileOpen={
          mobileDrawerOpen
        }
        onToggle={() =>
          setSidebarExpanded(
            (value) =>
              !value,
          )
        }
        onMobileClose={() =>
          setMobileDrawerOpen(
            false,
          )
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
          setMobileDrawerOpen(
            true,
          )
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

        <main className="mx-auto max-w-[1540px] px-4 pb-24 sm:px-6 lg:px-8">

          {/* ==================================================================
             PAGE HEADER
             ================================================================== */}

          <header className="pt-12 sm:pt-14">

            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

              <div className="min-w-0">

                <p className="label-legal">
                  JURY HASH · CASE ARCHIVE
                </p>


                <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">

                  <h1 className="font-display text-[clamp(2.4rem,4vw,3.6rem)] leading-[0.95] tracking-[-0.02em] text-parchment">
                    Case Records
                  </h1>


                  <span className="font-mono text-[10px] tracking-[0.16em] text-brass uppercase">
                    {records.length}{" "}
                    {records.length ===
                    1
                      ? "matter"
                      : "matters"}
                  </span>

                </div>


                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Review active matters,
                  structured case intelligence
                  and preserved evidence from one
                  controlled archive.
                </p>

              </div>


              <Link
                to="/upload"
                search={{
                  case: undefined,
                }}
                className="focus-legal inline-flex w-fit shrink-0 items-center gap-2 border border-brass/50 bg-brass/[0.05] px-4 py-2.5 font-mono text-[10px] tracking-[0.12em] text-brass uppercase transition-colors hover:border-brass hover:bg-brass/10"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Add case file
              </Link>

            </div>


            <div className="mt-7 h-px w-full rule-brass" />

          </header>


          {/* ==================================================================
   SEARCH + FILTERS
   ================================================================== */}

<section
  aria-label="Case search and filters"
  className="mt-7"
>
  {/* Search */}

  <div className="relative w-full">
    <Search
      className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />

    <input
      value={query}
      onChange={(event) =>
        setQuery(
          event.target.value,
        )
      }
      aria-label="Search case records"
      placeholder="Search matters, courts, case numbers, parties..."
      className="focus-legal w-full border-b border-input bg-transparent py-3 pl-7 pr-2 text-sm text-parchment outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-brass-dim focus:border-brass"
    />
  </div>


  {/* Status */}

  <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-border pb-5">
    <span className="mr-2 font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
      Status
    </span>

    {(
      [
        "All",
        ...STATUS_OPTIONS,
      ] as Array<
        CaseStatus | "All"
      >
    ).map((value) => (
      <FilterButton
        key={value}
        active={
          statusFilter === value
        }
        onClick={() =>
          setStatusFilter(
            value,
          )
        }
      >
        {value}
      </FilterButton>
    ))}
  </div>


  {/* Classification */}

  <div className="mt-4 flex flex-wrap items-center gap-2">
    <span className="mr-2 font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
      Class
    </span>

    {(
      [
        "All",
        ...CLASSIFICATION_OPTIONS,
      ] as Array<
        CaseClassification | "All"
      >
    ).map((value) => (
      <FilterButton
        key={value}
        active={
          classFilter === value
        }
        confidential={
          value === "confidential"
        }
        onClick={() =>
          setClassFilter(
            value,
          )
        }
      >
        {value === "All"
          ? "All"
          : CLASSIFICATION_LABEL[
              value
            ]}
      </FilterButton>
    ))}

    {(query ||
      statusFilter !== "All" ||
      classFilter !== "All" ||
      category) && (
      <button
        type="button"
        onClick={clearFilters}
        className="focus-legal ml-2 inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.1em] text-muted-foreground uppercase transition-colors hover:text-parchment"
      >
        <X className="h-3 w-3" />
        Clear
      </button>
    )}
  </div>


  {category && (
    <div className="mt-4">
      <button
        type="button"
        onClick={() =>
          setCategory(null)
        }
        className="focus-legal inline-flex items-center gap-1.5 border border-brass/40 bg-brass/[0.04] px-2.5 py-1.5 font-mono text-[9px] tracking-[0.12em] text-brass uppercase transition-colors hover:bg-brass/10"
      >
        Category: {category}

        <X className="h-3 w-3" />
      </button>
    </div>
  )}
</section>

          {/* ==================================================================
             WORKSPACE
             ================================================================== */}

          <section
            aria-label="Case archive workspace"
            className="mt-8"
          >

            <div className="grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">

              {/* ==============================================================
                 DOCKET
                 ============================================================== */}

              <aside className="xl:sticky xl:top-24">

                <section
                  aria-label="Case docket"
                  className="border border-border bg-surface/[0.08]"
                >

                  <div className="border-b border-border px-5 py-5">

                    <div className="flex items-start justify-between gap-4">

                      <div>

                        <p className="label-legal">
                          DOCKET
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {filtered.length}{" "}
                          visible{" "}
                          {filtered.length ===
                          1
                            ? "matter"
                            : "matters"}
                        </p>

                      </div>


                      <span className="font-mono text-[8px] tracking-[0.14em] text-muted-foreground/50 uppercase">
                        Live archive
                      </span>

                    </div>

                  </div>


                  {records.length ===
                  0 ? (
                    <EmptyDocket />
                  ) : filtered.length ===
                    0 ? (
                    <FilteredEmpty
                      onClear={
                        clearFilters
                      }
                    />
                  ) : (
                    <div className="max-h-[700px] overflow-y-auto">

                      <ul>

                        {filtered.map(
                          (
                            record,
                            index,
                          ) => {
                            const active =
                              record.id ===
                              selectedId;

                            return (
                              <li
                                key={
                                  record.id
                                }
                              >

                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() =>
                                    selectCase(
                                      record.id,
                                    )
                                  }
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault();
                                      selectCase(
                                        record.id,
                                      );
                                    }
                                  }}
                                  aria-current={
                                    active
                                      ? "true"
                                      : undefined
                                  }
                                  className={`focus-legal group relative w-full cursor-pointer border-b border-border px-5 py-5 text-left transition-all ${
                                    active
                                      ? "bg-surface/60"
                                      : "hover:bg-surface/30"
                                  }`}
                                >

                                  {active && (
                                    <span className="absolute inset-y-0 left-0 w-0.5 bg-brass" />
                                  )}


                                  <div className="flex items-start gap-3">

                                    <div className="min-w-0 flex-1">

                                      <div className="flex items-center justify-between gap-3">
  <span className="flex items-center gap-2">
    <span className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground/50">
      {String(index + 1).padStart(2, "0")}
    </span>

    <span className="truncate font-mono text-[8px] tracking-[0.1em] text-brass-dim">
      {record.id}
    </span>
  </span>

  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        togglePinned(record.id);
      }}
      aria-pressed={Boolean(record.pinned)}
      aria-label={
        record.pinned
          ? `Unpin ${record.id}`
          : `Pin ${record.id}`
      }
      title={
        record.pinned
          ? "Remove from pinned cases"
          : "Pin for quick access"
      }
      className={`focus-legal flex h-7 w-7 items-center justify-center border transition-colors ${
        record.pinned
          ? "border-brass/50 text-brass"
          : "border-transparent text-muted-foreground/45 hover:border-border hover:text-parchment"
      }`}
    >
      <Pin
        className={`h-3.5 w-3.5 ${
          record.pinned
            ? "fill-brass/25"
            : ""
        }`}
      />
    </button>

    <span
      className={`shrink-0 border px-2 py-1 font-mono text-[8px] tracking-[0.1em] uppercase ${
        STATUS_TONE[record.status]
      }`}
    >
      {record.status}
    </span>
  </div>
</div>

                                      <p className="mt-3 font-display text-[17px] leading-snug text-parchment">
                                        {
                                          record.title
                                        }
                                      </p>


                                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">

                                        <span>
                                          {
                                            record.court ||
                                            "Court not recorded"
                                          }
                                        </span>

                                        <span className="text-border">
                                          ·
                                        </span>

                                        <span className="flex items-center gap-1.5">

                                          <Clock className="h-3 w-3" />

                                          {
                                            record.updated
                                          }

                                        </span>

                                      </div>


                                      {active && (
                                        <div className="mt-4 flex items-center justify-between">

                                          <span className="font-mono text-[8px] font-medium tracking-[0.12em] text-brass uppercase">
                                            Open matter
                                          </span>

                                          <ChevronRight className="h-3.5 w-3.5 text-brass" />

                                        </div>
                                      )}

                                    </div>

                                  </div>

                                </div>

                              </li>
                            );
                          },
                        )}

                      </ul>

                    </div>
                  )}


                  
                </section>

              </aside>


              {/* ==============================================================
                 CASE FILE
                 ============================================================== */}

              <div className="min-w-0">

                {selected ? (
                  <CaseWorkspace
                    record={
                      selected
                    }
                  />
                ) : (
                  <EmptySelection />
                )}

              </div>

            </div>

          </section>


          <div className="mt-8 md:hidden">

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
              Open navigation
            </button>

          </div>

        </main>

      </div>

    </div>
  );
}


/* ==========================================================================
   CASE WORKSPACE
   ========================================================================== */

function CaseWorkspace({
  record,
}: {
  record: CaseRecord;
}) {

  const navigate =
    useNavigate();

  const {
    archiveCase,
    unarchiveCase,
  } = useCaseActions();


  const [
    documents,
    setDocuments,
  ] = useState<
    BackendDocument[]
  >([]);

  const [
    documentsLoading,
    setDocumentsLoading,
  ] = useState(true);

  const [
    documentsError,
    setDocumentsError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    openingDocumentId,
    setOpeningDocumentId,
  ] =
    useState<string | null>(
      null,
    );


  /* ------------------------------------------------------------------------
     Load documents
     ------------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled =
      false;

    const loadDocuments =
      async () => {
        setDocumentsLoading(
          true,
        );

        setDocumentsError(
          null,
        );

        try {
          const result =
            await getCaseDocuments(
              record.id,
            );

          if (!cancelled) {
            setDocuments(
              result,
            );
          }
        } catch (error) {
          if (!cancelled) {
            setDocumentsError(
              error instanceof
                Error
                ? error.message
                : "Failed to load case documents.",
            );
          }
        } finally {
          if (!cancelled) {
            setDocumentsLoading(
              false,
            );
          }
        }
      };

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [
    record.id,
  ]);


  async function openDocument(
    documentId: string,
  ) {
    setOpeningDocumentId(
      documentId,
    );

    try {
      await navigate({
        to:
          "/documents/$documentId",
        params: {
          documentId,
        },
        search: {
          case:
            record.id,
        },
      });
    } finally {
      setOpeningDocumentId(
        null,
      );
    }
  }


  return (
    <section
      key={record.id}
      aria-label="Selected case file"
      className="animate-rise-in"
    >

      {/* ====================================================================
         IDENTITY
         ==================================================================== */}

      <header className="chamber-panel grain">

        <div className="border-b border-border px-6 py-6 sm:px-7">

          <div className="flex items-start justify-between gap-4">

            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">

              <span className="font-mono text-[8px] tracking-[0.15em] text-brass">
                MATTER
              </span>

              <span className="truncate font-mono text-[9px] tracking-[0.12em] text-muted-foreground">
                {record.id}
              </span>

              <span className="h-3 w-px bg-border" />

              <span
                className={`border px-2 py-1 font-mono text-[8px] tracking-[0.11em] uppercase ${
                  STATUS_TONE[
                    record.status
                  ]
                }`}
              >
                {record.status}
              </span>

              {isConfidential(record) && (
                <span className="seal-confidential">
                  <Lock className="h-3 w-3" />
                  Confidential
                </span>
              )}

              {record.archived && (
                <span className="border border-brass/40 bg-brass/[0.05] px-2 py-1 font-mono text-[8px] tracking-[0.11em] text-brass uppercase">
                  Archived
                </span>
              )}

            </div>

            <button
              type="button"
              onClick={() => {
                if (record.archived) {
                  unarchiveCase(record.id);
                } else {
                  archiveCase(record.id);
                }
              }}
              className={`focus-legal inline-flex shrink-0 items-center gap-2 border px-3 py-2 font-mono text-[9px] tracking-[0.1em] uppercase transition-colors ${
                record.archived
                  ? "border-brass/50 bg-brass/[0.05] text-brass hover:bg-brass/10"
                  : "border-border text-muted-foreground hover:border-brass-dim hover:text-brass"
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              {record.archived
                ? "Restore case"
                : "Archive case"}
            </button>

          </div>

          <h2 className="mt-5 max-w-5xl font-display text-[clamp(2rem,3.5vw,3.2rem)] leading-[1.02] tracking-[-0.015em] text-parchment">
            {record.title}
          </h2>

        </div>


        {/* Core metadata */}

        <div className="grid grid-cols-2 divide-x divide-y divide-border lg:grid-cols-4 lg:divide-y-0">

          <MetaField
            label="Court"
            value={
              record.court ||
              "Not recorded"
            }
          />

          <MetaField
            label="Bench"
            value={
              record.bench ||
              "To be assigned"
            }
          />

          <MetaField
            label="Filed"
            value={
              record.filed ||
              "Not recorded"
            }
          />

          <MetaField
  label="Classification"
  value={
    CLASSIFICATION_LABEL[
      record.classification
    ]
  }
/>

        </div>

      </header>


      {/* ====================================================================
         QUICK CASE SNAPSHOT
         ==================================================================== */}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">

        <CompactPanel
          icon={
            <Users className="h-4 w-4 text-brass" />
          }
          label="Parties"
          description="People and entities named in the matter"
        >

          <div className="grid grid-cols-2 divide-x divide-border">

            {record.parties.map(
              (
                party,
                index,
              ) => (
                <div
                  key={`${party.role}-${party.name}`}
                  className={`px-4 py-4 ${
                    index === 0
                      ? "pl-0"
                      : ""
                  }`}
                >

                  <p className="label-legal">
                    {
                      party.role
                    }
                  </p>

                  <p className="mt-2 text-sm leading-relaxed text-parchment">
                    {
                      party.name ||
                      "Not recorded"
                    }
                  </p>

                </div>
              ),
            )}

          </div>

        </CompactPanel>


        <CompactPanel
          icon={
            <FileText className="h-4 w-4 text-brass" />
          }
          label="Case files"
          description="Preserved evidence attached to this matter"
          action={
            <button
              type="button"
              onClick={() =>
                navigate({
                  to:
                    "/upload",
                  search: {
                    case:
                      record.id,
                  },
                })
              }
              className="focus-legal inline-flex items-center gap-1.5 border border-brass/40 px-2.5 py-1.5 font-mono text-[8px] tracking-[0.1em] text-brass uppercase transition-colors hover:bg-brass/10"
            >
              +
              Add file
            </button>
          }
        >

          {documentsLoading ? (
            <InlineStatus>
              Loading preserved files...
            </InlineStatus>
          ) : documentsError ? (
            <div className="border border-burgundy/40 bg-burgundy/[0.05] px-3 py-3 text-xs leading-relaxed text-burgundy">
              {
                documentsError
              }
            </div>
          ) : documents.length ===
            0 ? (
            <div className="flex items-center justify-between gap-4">

              <p className="text-xs text-muted-foreground">
                No files attached to this
                matter.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate({
                    to:
                      "/upload",
                    search: {
                      case:
                        record.id,
                    },
                  })
                }
                className="focus-legal shrink-0 font-mono text-[8px] tracking-[0.1em] text-brass uppercase hover:text-parchment"
              >
                Add file{" "}
                <ArrowUpRight className="ml-1 inline h-3 w-3" />
              </button>

            </div>
          ) : (
            <ul className="space-y-2">

              {documents.map(
                (
                  document,
                ) => (
                  <li
                    key={
                      document.id
                    }
                  >

                    <button
                      type="button"
                      onClick={() =>
                        openDocument(
                          document.id,
                        )
                      }
                      disabled={
                        openingDocumentId ===
                        document.id
                      }
                      className="focus-legal group flex w-full items-center gap-3 border border-border p-3 text-left transition-colors hover:border-brass-dim disabled:cursor-wait disabled:opacity-60"
                    >

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-brass/30 text-brass">

                        <FileText className="h-4 w-4" />

                      </div>


                      <div className="min-w-0 flex-1">

                        <p className="truncate text-sm text-parchment group-hover:text-brass">
                          {openingDocumentId ===
                          document.id
                            ? "Opening..."
                            : document.file_name}
                        </p>

                        <div className="mt-1 flex items-center gap-2">

                          <span className="h-1.5 w-1.5 rounded-full bg-success" />

                          <span className="font-mono text-[8px] tracking-[0.1em] text-success uppercase">
                            {
                              document.status
                            }
                          </span>

                        </div>

                      </div>


                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brass" />

                    </button>

                  </li>
                ),
              )}

            </ul>
          )}

        </CompactPanel>

      </div>


      {/* ====================================================================
         INTELLIGENCE
         ==================================================================== */}

      <article className="mt-5 border border-border">

        <SectionHeader
          icon={
            <Scale className="h-4 w-4 text-brass" />
          }
          title="Case Intelligence"
          subtitle="Derived from the matter record"
        />


        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">

          {/* Summary */}

          <div className="border-b border-border p-6 lg:border-b-0 lg:border-r sm:p-7">

            <p className="label-legal">
              Summary of the matter
            </p>

            <p className="mt-4 max-w-3xl text-[15px] leading-[1.85] text-parchment/90">
              {
                record.summary
              }
            </p>

          </div>


          {/* Issues / authorities */}

          <div className="divide-y divide-border">

            <InsightBlock
              label="Issues before the court"
            >

              {record.issues.length >
              0 ? (
                <ol className="space-y-3">

                  {record.issues.map(
                    (
                      issue,
                      index,
                    ) => (
                      <li
                        key={
                          issue
                        }
                        className="flex gap-3 text-sm leading-relaxed text-parchment/85"
                      >

                        <span className="shrink-0 font-mono text-[9px] text-brass-dim">
                          {String(
                            index +
                              1,
                          ).padStart(
                            2,
                            "0",
                          )}
                        </span>

                        <span>
                          {
                            issue
                          }
                        </span>

                      </li>
                    ),
                  )}

                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No issues recorded yet.
                </p>
              )}

            </InsightBlock>


            <InsightBlock
              label="Authorities referred"
            >

              {record.authorities.length >
              0 ? (
                <div className="flex flex-wrap gap-2">

                  {record.authorities.map(
                    (
                      authority,
                    ) => (
                      <span
                        key={
                          authority
                        }
                        className="border border-border px-2.5 py-1.5 text-xs text-muted-foreground"
                      >
                        {
                          authority
                        }
                      </span>
                    ),
                  )}

                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No authorities recorded
                  yet.
                </p>
              )}

            </InsightBlock>

          </div>

        </div>

      </article>


      {/* ====================================================================
         HISTORY
         ==================================================================== */}

      <article className="mt-5 border border-border">

        <SectionHeader
          icon={
            <Clock className="h-4 w-4 text-brass" />
          }
          title="Case History"
          subtitle="Chronological record of matter activity"
        />


        <div className="p-6 sm:p-7">

          {record.history.length >
          0 ? (
            <ol className="relative ml-1 border-l border-border">

              {record.history.map(
                (
                  entry,
                ) => (
                  <li
                    key={`${entry.date}-${entry.title}`}
                    className="relative pb-9 pl-7 last:pb-0"
                  >

                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brass-dim ring-4 ring-background" />


                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">

                      <p className="font-mono text-[9px] tracking-[0.14em] text-brass-dim uppercase">
                        {
                          entry.date
                        }
                      </p>

                      <span className="font-mono text-[8px] tracking-[0.1em] text-muted-foreground/40 uppercase">
                        Matter history
                      </span>

                    </div>


                    <p className="mt-2 font-display text-lg text-parchment">
                      {
                        entry.title
                      }
                    </p>


                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {
                        entry.note
                      }
                    </p>

                  </li>
                ),
              )}

            </ol>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">

              <Archive className="h-4 w-4 text-brass-dim" />

              No historical entries recorded
              yet.

            </div>
          )}

        </div>

      </article>


      {/* ====================================================================
         PRESERVATION NOTE
         ==================================================================== */}

      <div className="mt-5 border border-border bg-surface/[0.12] px-5 py-4">

        <div className="flex items-start gap-3">

          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass" />

          <div>

            <p className="font-mono text-[9px] font-bold tracking-[0.13em] text-brass uppercase">
              Evidence preservation
            </p>

            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Documents attached to this matter
              are preserved through the JURY HASH
              document workflow and can be opened
              in the document workspace for further
              review.
            </p>

          </div>

        </div>

      </div>

    </section>
  );
}


/* ==========================================================================
   FILTER COMPONENTS
   ========================================================================== */

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">

      <span className="mr-1 font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </span>

      {children}

    </div>
  );
}


function FilterButton({
  active,
  confidential = false,
  onClick,
  children,
}: {
  active: boolean;
  confidential?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      aria-pressed={
        active
      }
      className={`focus-legal border px-2.5 py-1.5 font-mono text-[9px] tracking-[0.1em] uppercase transition-colors ${
        active
          ? confidential
            ? "border-burgundy/60 bg-burgundy/[0.08] text-burgundy"
            : "border-brass/60 bg-brass/[0.06] text-brass"
          : "border-border text-muted-foreground hover:border-brass-dim hover:text-parchment"
      }`}
    >
      {children}
    </button>
  );
}


/* ==========================================================================
   ARCHIVE SUMMARY
   ========================================================================== */

function ArchiveStat({
  value,
  label,
  accent = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="px-5 py-4">

      <p
        className={`font-display text-xl ${
          accent
            ? "text-burgundy"
            : "text-parchment"
        }`}
      >
        {String(value).padStart(
          2,
          "0",
        )}
      </p>

      <p className="mt-1 font-mono text-[8px] tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </p>

    </div>
  );
}


/* ==========================================================================
   EMPTY STATES
   ========================================================================== */

function EmptyDocket() {
  return (
    <div className="px-5 py-14 text-center">

      <FolderOpen className="mx-auto h-6 w-6 text-muted-foreground/40" />

      <p className="mt-4 font-display text-base text-parchment">
        The archive is empty
      </p>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Add your first case file to begin
        building the archive.
      </p>


      <Link
        to="/upload"
        search={{
          case: undefined,
        }}
        className="focus-legal mt-5 inline-flex items-center gap-2 border border-brass/50 bg-brass/[0.05] px-4 py-2 text-xs text-brass transition-colors hover:bg-brass/10"
      >
        Add case file
        <ArrowUpRight className="h-3 w-3" />
      </Link>

    </div>
  );
}


function FilteredEmpty({
  onClear,
}: {
  onClear: () => void;
}) {
  return (
    <div className="px-5 py-14 text-center">

      <Search className="mx-auto h-6 w-6 text-muted-foreground/40" />

      <p className="mt-4 font-display text-base text-parchment">
        No matching matters
      </p>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Adjust your filters or clear them
        to return to the full docket.
      </p>


      <button
        type="button"
        onClick={
          onClear
        }
        className="focus-legal mt-5 border border-brass/40 px-4 py-2 font-mono text-[9px] tracking-[0.1em] text-brass uppercase hover:bg-brass/10"
      >
        Clear filters
      </button>

    </div>
  );
}


function EmptySelection() {
  return (
    <div className="flex min-h-[560px] items-center justify-center border border-dashed border-border px-6 text-center">

      <div>

        <Gavel className="mx-auto h-7 w-7 text-muted-foreground/40" />

        <p className="mt-4 font-display text-xl text-parchment">
          Select a matter
        </p>

        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Choose a matter from the docket
          to inspect its case file, parties,
          preserved documents and history.
        </p>

      </div>

    </div>
  );
}


/* ==========================================================================
   CASE WORKSPACE COMPONENTS
   ========================================================================== */

function CompactPanel({
  icon,
  label,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="border border-border">

      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">

        <div className="flex min-w-0 items-start gap-3">

          <div className="mt-0.5 shrink-0">
            {icon}
          </div>

          <div>

            <h3 className="font-mono text-[10px] font-medium tracking-[0.12em] text-parchment uppercase">
              {label}
            </h3>

            <p className="mt-1 text-[10px] text-muted-foreground">
              {description}
            </p>

          </div>

        </div>


        {action}

      </div>


      <div className="p-5">
        {children}
      </div>

    </article>
  );
}


function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border px-6 py-4 sm:px-7">

      <div className="mt-0.5">
        {icon}
      </div>

      <div>

        <h3 className="font-mono text-[10px] font-medium tracking-[0.12em] text-parchment uppercase">
          {title}
        </h3>

        <p className="mt-1 text-[11px] text-muted-foreground">
          {subtitle}
        </p>

      </div>

    </div>
  );
}


function MetaField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 px-5 py-5 sm:px-6">
      <dt className="font-mono text-[8px] font-medium tracking-[0.12em] text-muted-foreground uppercase leading-tight">
        {label}
      </dt>

      {children ? (
        children
      ) : (
        <dd className="mt-2 truncate text-sm text-parchment">
          {value}
        </dd>
      )}
    </div>
  );
}

function InsightBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="p-6 sm:p-7">

      <p className="label-legal">
        {label}
      </p>

      <div className="mt-4">
        {children}
      </div>

    </div>
  );
}


function InlineStatus({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">

      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brass motion-reduce:animate-none" />

      {children}

    </div>
  );
}