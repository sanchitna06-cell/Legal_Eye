import { createFileRoute, Link, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Scale, FileText, Clock, Users, ChevronRight, Lock } from "lucide-react";
import { useCaseActions, useCases } from "@/lib/case-store";
import {
  CLASSIFICATION_LABEL,
  CLASSIFICATION_OPTIONS,
  STATUS_OPTIONS,
  STATUS_TONE,
  caseSearchText,
  isConfidential,
  type CaseClassification,
  type CaseRecord,
  type CaseStatus,
} from "@/data/cases";
import { JuryHashMark } from "@/components/brand/JURYHashMark";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import { getCaseDocuments, type BackendDocument } from "@/lib/api";
import { getSession } from "@/lib/user-store";

export const Route = createFileRoute("/records")({
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: "/" });
  },
  validateSearch: (search: Record<string, unknown>) => {
    const caseId = search["case"];
    return { case: typeof caseId === "string" && caseId.trim() ? caseId : undefined };
  },
  head: () => ({
    meta: [
      { title: "Case Records — JURY HASH" },
      {
        name: "description",
        content:
          "Browse the JURY HASH case archive: court records, parties, case histories and structured case intelligence for every matter.",
      },
      { property: "og:title", content: "Case Records — JURY HASH" },
      {
        property: "og:description",
        content: "Court records, parties, histories and case intelligence in one legal archive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Records,
});

function Records() {
  const navigate = useNavigate();
  const { case: caseParam } = useSearch({ from: "/records" });
  const records = useCases();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "All">("All");
  const [classFilter, setClassFilter] = useState<CaseClassification | "All">("All");
  const [selectedId, setSelectedId] = useState<string | undefined>(() => {
    const first = records[0];
    if (!first) return undefined;
    if (caseParam && records.some((c) => c.id === caseParam)) return caseParam;
    return first.id;
  });

  // Keep the URL in sync so records can be deep-linked (dashboard cards, drawer).
  useEffect(() => {
    if (caseParam && records.some((c) => c.id === caseParam)) setSelectedId(caseParam);
  }, [caseParam, records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((c) => {
      if (q && !caseSearchText(c).includes(q)) return false;
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (classFilter !== "All" && c.classification !== classFilter) return false;
      return true;
    });
  }, [query, records, statusFilter, classFilter]);

  const selected = selectedId ? records.find((c) => c.id === selectedId) : undefined;

  function selectCase(id: string) {
    setSelectedId(id);
    navigate({ to: "/records", search: { case: id }, replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4">
          <Link to="/dashboard" className="focus-legal flex items-center gap-2.5">
            <JuryHashMark className="h-6 w-6 text-brass" />
            <span className="font-display text-base tracking-wide">
              JURY <span className="text-brass">HASH</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search case records"
                placeholder="Search matters, courts, case numbers"
                className="focus-legal w-56 border-b border-input bg-transparent py-1.5 pl-6 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-brass-dim focus:border-brass lg:w-72"
              />
            </div>
            <UserProfileMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Docket list */}
        <section aria-label="Case docket">
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-2xl">Case Records</h1>
            <span className="label-legal">{filtered.length} matters</span>
          </div>
          <div className="mt-5 h-px w-full rule-brass" />

          {/* Lifecycle + classification filters */}
          <div className="mt-5 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-legal mr-1">Status</span>
              {(["All", ...STATUS_OPTIONS] as Array<CaseStatus | "All">).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  aria-pressed={statusFilter === s}
                  className={`focus-legal border px-2 py-1 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors ${
                    statusFilter === s
                      ? "border-brass/60 bg-brass/10 text-brass"
                      : "border-border text-muted-foreground hover:border-brass-dim hover:text-parchment"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-legal mr-1">Classification</span>
              {(["All", ...CLASSIFICATION_OPTIONS] as Array<CaseClassification | "All">).map(
                (cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setClassFilter(cls)}
                    aria-pressed={classFilter === cls}
                    className={`focus-legal border px-2 py-1 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors ${
                      classFilter === cls
                        ? cls === "confidential"
                          ? "border-burgundy/60 bg-burgundy/[0.08] text-burgundy"
                          : "border-brass/60 bg-brass/10 text-brass"
                        : "border-border text-muted-foreground hover:border-brass-dim hover:text-parchment"
                    }`}
                  >
                    {cls === "All" ? "All" : CLASSIFICATION_LABEL[cls]}
                  </button>
                ),
              )}
            </div>
          </div>

          {records.length === 0 ? (
            <div className="mt-5 border border-dashed border-border px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                The archive is empty. Add your first case from the dashboard.
              </p>
              <Link
                to="/upload"
                className="focus-legal mt-4 inline-block border border-brass/60 bg-brass/10 px-4 py-2 text-xs text-parchment transition-colors hover:bg-brass hover:text-primary-foreground"
              >
                Upload a case file
              </Link>
            </div>
          ) : (
            <ul className="mt-5 space-y-px">
              {filtered.map((c) => {
                const active = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => selectCase(c.id)}
                      aria-current={active ? "true" : undefined}
                      className={`focus-legal group block w-full border-l-2 px-4 py-4 text-left transition-colors ${
                        active
                          ? isConfidential(c)
                            ? "border-burgundy bg-surface"
                            : "border-brass bg-surface"
                          : "border-transparent hover:border-brass-dim hover:bg-surface/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5">
                          {isConfidential(c) && (
                            <Lock
                              className="h-3 w-3 shrink-0 text-burgundy"
                              aria-label="Confidential matter"
                            />
                          )}
                          <span className="font-mono text-[10px] tracking-[0.14em] text-brass-dim">
                            {c.id}
                          </span>
                        </span>
                        <span
                          className={`border px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase ${STATUS_TONE[c.status]}`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <p className="mt-2.5 font-display text-[15px] leading-snug text-parchment">
                        {c.title}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">{c.court}</p>
                      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                        <Clock className="h-3 w-3" /> Updated {c.updated}
                      </p>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-4 py-10 text-sm text-muted-foreground">
                  No matter answers that search.
                </li>
              )}
            </ul>
          )}
        </section>

        {selected ? (
          <CaseFile record={selected} />
        ) : records.length > 0 ? (
          <p className="text-sm text-muted-foreground">Select a matter from the docket.</p>
        ) : null}
      </div>
    </div>
  );
}

function CaseFile({ record }: { record: CaseRecord }) {
  const { updateCase } = useCaseActions();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<BackendDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      setDocumentsLoading(true);
      setDocumentsError(null);

      try {
        const result = await getCaseDocuments(record.id);

        if (!cancelled) {
          setDocuments(result);
        }
      } catch (error) {
        if (!cancelled) {
          setDocumentsError(
            error instanceof Error ? error.message : "Failed to load case documents.",
          );
        }
      } finally {
        if (!cancelled) {
          setDocumentsLoading(false);
        }
      }
    }

    loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [record.id]);
  async function openDocument(documentId: string) {
    setOpeningDocumentId(documentId);

    try {
      await navigate({
        to: "/documents/$documentId",
        params: { documentId },
        search: { case: record.id },
      });
    } finally {
      setOpeningDocumentId(null);
    }
  }

  return (
    <section key={record.id} className="animate-rise-in space-y-10" aria-label="Case file">
      <header className="chamber-panel grain p-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-mono text-[11px] tracking-[0.16em] text-brass">{record.id}</span>
          <span className="h-3 w-px bg-border" />
          <span className="label-legal">{record.subject}</span>
          {isConfidential(record) && (
            <span className="seal-confidential ml-auto">
              <Lock className="h-3 w-3" />
              Confidential
            </span>
          )}
        </div>
        <h2 className="mt-4 max-w-2xl font-display text-[clamp(1.6rem,2.6vw,2.35rem)] leading-tight text-parchment">
          {record.title}
        </h2>
        <div className="mt-7 h-px w-full rule-brass" />
        <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          {(
            [
              ["Court", record.court],
              ["Bench", record.bench],
              ["Filed", record.filed],
              ...(record.cnr ? [["CNR", record.cnr] as const] : []),
              ...(record.firNo ? [["FIR No.", record.firNo] as const] : []),
              ...(record.policeStation ? [["Police Station", record.policeStation] as const] : []),
            ] as Array<[string, string]>
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="label-legal">{label}</dt>
              <dd className="mt-2 text-sm text-parchment">{value}</dd>
            </div>
          ))}

          {/* Confidentiality classification — editable */}
          <div>
            <dt className="label-legal">Classification</dt>
            <dd className="mt-2">
              <select
                value={record.classification}
                onChange={(e) =>
                  updateCase(record.id, { classification: e.target.value as CaseClassification })
                }
                aria-label={`Classification of ${record.id}`}
                className="focus-legal w-full cursor-pointer border-b border-input bg-transparent pb-1.5 text-sm text-parchment outline-none transition-colors [color-scheme:dark] hover:border-brass-dim focus:border-brass"
              >
                {CLASSIFICATION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {CLASSIFICATION_LABEL[option]}
                  </option>
                ))}
              </select>
            </dd>
          </div>

          {/* Lifecycle status — editable */}
          <div>
            <dt className="label-legal">Status</dt>
            <dd className="mt-2">
              <select
                value={record.status}
                onChange={(e) => updateCase(record.id, { status: e.target.value as CaseStatus })}
                aria-label={`Lifecycle status of ${record.id}`}
                className="focus-legal w-full cursor-pointer border-b border-input bg-transparent pb-1.5 text-sm text-parchment outline-none transition-colors [color-scheme:dark] hover:border-brass-dim focus:border-brass"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="space-y-10">
          {/* Case intelligence */}
          <article className="border border-border">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2.5">
                <Scale className="h-4 w-4 text-brass" />
                <h3 className="text-sm tracking-[0.12em] uppercase">Case Intelligence</h3>
              </div>
              <span className="label-legal">Derived from record</span>
            </div>
            <div className="space-y-8 p-6">
              <div>
                <p className="label-legal">Summary of the matter</p>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-parchment/90">
                  {record.summary}
                </p>
              </div>
              <div className="h-px w-full bg-border" />
              <div>
                <p className="label-legal">Issues before the court</p>
                <ol className="mt-4 space-y-3">
                  {record.issues.length > 0 ? (
                    record.issues.map((issue, i) => (
                      <li
                        key={issue}
                        className="flex gap-4 text-sm leading-relaxed text-parchment/85"
                      >
                        <span className="font-mono text-[11px] leading-6 text-brass-dim">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>{issue}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm leading-relaxed text-muted-foreground">
                      No issues recorded yet — add them as the matter develops.
                    </li>
                  )}
                </ol>
              </div>
              <div className="h-px w-full bg-border" />
              <div>
                <p className="label-legal">Authorities referred</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {record.authorities.length > 0 ? (
                    record.authorities.map((a) => (
                      <li
                        key={a}
                        className="border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brass-dim hover:text-parchment"
                      >
                        {a}
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-muted-foreground">None recorded yet.</li>
                  )}
                </ul>
              </div>
            </div>
          </article>

          {/* History */}
          <article>
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-brass" />
              <h3 className="text-sm tracking-[0.12em] uppercase">Case History</h3>
            </div>
            <ol className="mt-6 border-l border-border pl-6">
              {record.history.map((e) => (
                <li key={`${e.date}-${e.title}`} className="relative pb-8 last:pb-0">
                  <span className="absolute -left-[1.6rem] top-1.5 h-1.5 w-1.5 rounded-full bg-brass-dim" />
                  <p className="font-mono text-[11px] tracking-[0.12em] text-brass-dim">{e.date}</p>
                  <p className="mt-1.5 font-display text-base text-parchment">{e.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{e.note}</p>
                </li>
              ))}
            </ol>
          </article>
        </div>

        {/* Parties */}
        <aside className="space-y-8">
          <div className="border border-border p-6">
            <div className="flex items-center gap-2.5">
              <Users className="h-4 w-4 text-brass" />
              <h3 className="text-sm tracking-[0.12em] uppercase">Parties</h3>
            </div>
            <ul className="mt-5 space-y-5">
              {record.parties.map((p) => (
                <li key={`${p.role}-${p.name}`}>
                  <p className="label-legal">{p.role}</p>
                  <p className="mt-1.5 text-sm text-parchment">{p.name}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-border p-6">
            <p className="label-legal">Case files</p>

            {documentsLoading ? (
              <p className="mt-4 text-xs text-muted-foreground">Loading case files...</p>
            ) : documentsError ? (
              <p className="mt-4 text-xs text-burgundy">{documentsError}</p>
            ) : documents.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">
                No files attached to this matter.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {documents.map((document) => (
                  <li key={document.id} className="border border-border px-3 py-3">
                    <button
                      type="button"
                      onClick={() => openDocument(document.id)}
                      disabled={openingDocumentId === document.id}
                      className="focus-legal text-left text-sm text-parchment hover:text-brass disabled:cursor-wait disabled:opacity-60"
                    >
                      {openingDocumentId === document.id
                        ? "Opening analysis workspace..."
                        : document.file_name}
                    </button>

                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {document.id}
                    </p>

                    <p className="mt-1 text-[11px] text-muted-foreground">{document.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border border-border p-6">
            <p className="label-legal">Record actions</p>
            <ul className="mt-4 space-y-1">
              {["Open full docket", "Export case brief", "Add note to file"].map((action) => (
                <li key={action}>
                  <button className="focus-legal group flex w-full items-center justify-between py-2 text-sm text-muted-foreground transition-colors hover:text-brass">
                    {action}
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
