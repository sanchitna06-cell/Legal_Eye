import { useState } from "react";
import { ChevronRight, ListChecks, TriangleAlert } from "lucide-react";
import type {
  DocumentInconsistency,
  DocumentProcessingStatus,
  DocumentTimelineEvent,
} from "@/lib/api";

/* ============================================================
   Shared panel chrome
   ============================================================ */

function PanelSection({
  title,
  icon: Icon,
  action,
  id,
  children,
}: {
  title: string;
  icon: typeof ListChecks;
  action?: { label: string; onClick?: () => void };
  /** Anchor id so sidebar tool links can scroll this section into view. */
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 border border-border bg-surface/40">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-parchment uppercase">
          <Icon className="h-3.5 w-3.5 text-brass" />
          {title}
        </h2>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="focus-legal text-[10px] tracking-[0.14em] text-brass-dim uppercase transition-colors hover:text-brass"
          >
            {action.label}
          </button>
        )}
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

/* ============================================================
   CASE TIMELINE
   ============================================================ */

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (
    date.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" }) +
    " " +
    date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

export function CaseTimeline({
  events,
  loading,
  error,
}: {
  events: DocumentTimelineEvent[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <PanelSection
      id="case-timeline"
      title="Case Timeline"
      icon={TriangleAlert}
      action={{ label: "View all" }}
    >
      {loading ? (
        <p className="text-xs text-muted-foreground">Reconstructing the record...</p>
      ) : error ? (
        <p className="text-xs text-burgundy">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          No recorded activity for this document yet. Processing events will appear here.
        </p>
      ) : (
        <ol className="relative space-y-6 border-l border-border pl-5">
          {events.map((event, i) => (
            <li key={`${event.at}-${i}`} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[1.55rem] top-1.5 h-1.5 w-1.5 rounded-full bg-brass"
              />
              <p className="font-mono text-[10px] tracking-[0.12em] text-brass-dim">
                {formatTimestamp(event.at)}
              </p>
              <p className="mt-1.5 text-[13px] font-medium text-parchment">{event.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{event.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </PanelSection>
  );
}

/* ============================================================
   INCONSISTENCY IDENTIFIER
   ============================================================ */

const SEVERITY_TONE: Record<DocumentInconsistency["severity"], string> = {
  high: "border-burgundy/60 bg-burgundy/10 text-burgundy",
  medium: "border-brass/60 bg-brass/10 text-brass",
  low: "border-border bg-surface text-muted-foreground",
};

function InconsistencyCard({ index, issue }: { index: number; issue: DocumentInconsistency }) {
  return (
    <li>
      <button
        type="button"
        className="focus-legal group w-full border border-border bg-background/40 px-4 py-3.5 text-left transition-colors hover:border-brass-dim hover:bg-surface/70"
      >
        <div className="flex items-center gap-2.5">
          <span className="border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-brass-dim">
            {String(index).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-parchment">
            {issue.kind}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brass" />
        </div>
        <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-brass-dim">
          {issue.location}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{issue.description}</p>
        <span
          className={`mt-3 inline-block border px-2 py-0.5 text-[9px] tracking-[0.14em] uppercase ${SEVERITY_TONE[issue.severity]}`}
        >
          {issue.severity}
        </span>
      </button>
    </li>
  );
}

export function InconsistencyIdentifier({
  issues,
  loading,
  error,
  processingStatus,
}: {
  issues: DocumentInconsistency[];
  loading: boolean;
  error: string | null;
  processingStatus: DocumentProcessingStatus | null;
}) {  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? issues : issues.slice(0, 3);

  return (
    <PanelSection
      id="inconsistency-identifier"
      title="Inconsistency Identifier"
      icon={ListChecks}
      action={
        issues.length > 3
          ? { label: expanded ? "Show less" : "View all", onClick: () => setExpanded((v) => !v) }
          : { label: "View all" }
      }
    >
      {processingStatus === "COMPLETED" && (
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-5 min-w-5 items-center justify-center border border-burgundy/60 bg-burgundy/15 px-1 font-mono text-[10px] text-burgundy">
          {issues.length}
          </span>
          <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            potential issues
          </span>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Analyzing the document...</p>
      ) : error ? (
        <p className="text-xs text-burgundy">{error}</p>
      ) : processingStatus !== "COMPLETED" ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Analysis results will appear when document processing completes.
          </p>
        ) : visible.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          No inconsistencies detected in this document.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((issue, i) => (
            <InconsistencyCard key={issue.id} index={i + 1} issue={issue} />
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
