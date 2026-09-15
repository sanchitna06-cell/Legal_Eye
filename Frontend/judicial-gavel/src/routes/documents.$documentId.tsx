import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { DocumentSidebar } from "@/components/documents/DocumentSidebar";
import { DocumentHeader } from "@/components/documents/DocumentHeader";
import { PdfViewer, PdfViewerError, PdfViewerLoading } from "@/components/documents/PdfViewer";
import { CaseTimeline, InconsistencyIdentifier } from "@/components/documents/AnalysisPanel";
import { usePdfDocument } from "@/hooks/usePdfDocument";
import { DEFAULT_ANNOTATION_COLOR } from "@/hooks/useAnnotationStore";
import { useAnnotationStore, type AnnotationTool } from "@/hooks/useAnnotationStore";
import { getSession } from "@/lib/user-store";

import type { AnnotationType } from "@/lib/api";
import { useDocumentAnalysis } from "@/hooks/useDocumentAnalysis";
import { useCases } from "@/lib/case-store";
import {
  createAnnotation,
  deleteAnnotation,
  getAnnotations,
  getCaseDocuments,
  getDocumentPages,
  getDocumentStatus,
  retryDocumentProcessing,
  updateAnnotation,
  type Annotation,
  type AnnotationPosition,
  type BackendDocument,
  type DocumentProcessingStatus,
} from "@/lib/api";

export const Route = createFileRoute("/documents/$documentId")({
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: "/" });
  },
  validateSearch: (search: Record<string, unknown>) => {
    const caseId = search["case"];
    return { case: typeof caseId === "string" && caseId.trim() ? caseId : undefined };
  },
  head: () => ({
    meta: [{ title: "Document Analysis — JURY HASH" }],
  }),
  component: DocumentWorkspace,
});

/* ============================================================
   Fallback timeline when the analysis endpoint has no data yet
   ============================================================ */

function buildFallbackTimeline(documents: BackendDocument[]) {
  return documents.map((doc) => ({
    at: doc.uploaded_at,
    title: "Document uploaded",
    detail: `${doc.file_name} (${(doc.file_size_bytes / (1024 * 1024)).toFixed(1)} MB)`,
  }));
}

/**
 * Document analysis workspace.
 *
 * Opens when a lawyer opens a case document from the docket. The original
 * PDF — retrieved through the existing authenticated `getDocument` flow —
 * is the authoritative visual document at the center; annotations are a
 * separate layer; the right panel carries the analytical record; the AI
 * assistant lives inside the left sidebar.
 */
function DocumentWorkspace() {
  const { documentId } = Route.useParams();
  const { case: caseParam } = Route.useSearch();

  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [processingStatus, setProcessingStatus] =
    useState<DocumentProcessingStatus | null>(null);

  const [processingMessage, setProcessingMessage] =
    useState("Checking document processing status...");
  const [retryingProcessing, setRetryingProcessing] = useState(false);
  const [processingPollKey, setProcessingPollKey] = useState(0);  

  const [pageNumber, setPageNumber] = useState(1);
  const [tool, setTool] = useState<AnnotationTool>("pan");
  const [color, setColor] = useState<string>(DEFAULT_ANNOTATION_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [eraserSize, setEraserSize] = useState(24);

  const { pdf, loading, error } = usePdfDocument(documentId);
  const { analysis, analysisLoading, analysisError } = useDocumentAnalysis(documentId);
  useEffect(() => {
  let cancelled = false;
  let intervalId: number | undefined;

  const checkProcessingStatus = async () => {
    try {
      const result = await getDocumentStatus(documentId);

      if (cancelled) return;

      setProcessingStatus(result.status);
      setProcessingMessage(result.message);

      if (
        result.status === "COMPLETED" ||
        result.status === "FAILED"
      ) {
        if (intervalId !== undefined) {
          window.clearInterval(intervalId);
        }
      }
    } catch {
      if (cancelled) return;

      setProcessingStatus(null);
      setProcessingMessage(
        "Unable to check document processing status.",
      );
    }
  };

  void checkProcessingStatus();

  intervalId = window.setInterval(
    checkProcessingStatus,
    3000,
  );

  return () => {
    cancelled = true;

    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
    }
  };
}, [documentId, processingPollKey]);
const handleRetryProcessing = useCallback(async () => {
  if (retryingProcessing) return;

  setRetryingProcessing(true);

  try {
    const result = await retryDocumentProcessing(documentId);

    setProcessingStatus(result.status);
    setProcessingMessage(result.message);

    // Restart the polling effect.
    setProcessingPollKey((value) => value + 1);
  } catch (error) {
    setProcessingMessage(
      error instanceof Error
        ? error.message
        : "Failed to retry document processing.",
    );
  } finally {
    setRetryingProcessing(false);
  }
}, [documentId, retryingProcessing]);

  /* ============================================================
     ANNOTATION PERSISTENCE
     The backend stores annotations against CaseFilePage.id, while the
     PDF viewer works in human-facing page numbers. Resolve that mapping
     once, then load annotation rows only for pages the viewer reaches.
     ============================================================ */
  const [documentPages, setDocumentPages] = useState<Awaited<ReturnType<typeof getDocumentPages>>>(
    [],
  );
  const [annotationsByPage, setAnnotationsByPage] = useState<
    Map<number, Array<Annotation & { page: number }>>
  >(new Map());
  const annotationPagesRef = useRef(new Map<number, Array<Annotation & { page: number }>>());

  useEffect(() => {
    let cancelled = false;

    setDocumentPages([]);
    annotationPagesRef.current = new Map();
    setAnnotationsByPage(new Map());

    getDocumentPages(documentId)
      .then((pages) => {
        if (!cancelled) setDocumentPages(pages);
      })
      .catch(() => {
        if (!cancelled) setDocumentPages([]);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const pageIdByNumber = useMemo(
    () => new Map(documentPages.map((page) => [page.page_number, page.id])),
    [documentPages],
  );

  useEffect(() => {
    const pageId = pageIdByNumber.get(pageNumber);

    if (!pageId) return;

    let cancelled = false;

    getAnnotations(pageId)
      .then((pageAnnotations) => {
        if (cancelled) return;

        const resolved = pageAnnotations.map((annotation) => ({
          ...annotation,
          page: pageNumber,
        }));

        annotationPagesRef.current.set(pageNumber, resolved);

        setAnnotationsByPage(new Map(annotationPagesRef.current));
      })
      .catch(() => {
        // An annotation fetch failure must not block the PDF workspace.
      });

    return () => {
      cancelled = true;
    };
  }, [pageIdByNumber, pageNumber]);

  const serverAnnotations = useMemo(
    () => Array.from(annotationsByPage.values()).flat(),
    [annotationsByPage],
  );

  const createOnServer = useCallback(
    async ({
      page,
      type,
      position,
      content,
    }: {
      page: number;
      type: AnnotationType;
      position: AnnotationPosition;
      content?: string | null;
    }) => {
      const pageId = pageIdByNumber.get(page);
      if (!pageId) throw new Error(`No backend page id for PDF page ${page}.`);

      return createAnnotation(pageId, {
        annotation_type: type,
        position,
        content: content ?? null,
      });
    },
    [pageIdByNumber],
  );

  const updateOnServer = useCallback(
    async ({
      annotationId,
      type,
      position,
      content,
    }: {
      annotationId: string;
      type: AnnotationType;
      position: AnnotationPosition;
      content?: string | null;
    }) => {
      return updateAnnotation(annotationId, {
        annotation_type: type,
        position,
        content: content ?? null,
      });
    },
    [],
  );

  const deleteOnServer = useCallback((annotationId: string) => deleteAnnotation(annotationId), []);

  const annotationStore = useAnnotationStore({
    documentId,
    serverAnnotations,
    createOnServer,
    updateOnServer,
    deleteOnServer,
  });

  // Document metadata comes from the existing case-documents API.
  const cases = useCases();
  const [documents, setDocuments] = useState<BackendDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDocumentsLoading(true);
    setDocumentsError(null);

    if (!caseParam) {
      setDocuments([]);
      setDocumentsLoading(false);
      return;
    }

    getCaseDocuments(caseParam)
      .then((result) => {
        if (!cancelled) setDocuments(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setDocumentsError(
            err instanceof Error ? err.message : "Failed to load document metadata.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDocumentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caseParam]);

  const documentMeta = useMemo(
    () => documents.find((d) => d.id === documentId),
    [documents, documentId],
  );

  const caseTitle = useMemo(() => {
    if (!caseParam) return undefined;
    return cases.find((c) => c.id === caseParam)?.title;
  }, [caseParam, cases]);

  const fallbackTimeline = useMemo(() => buildFallbackTimeline(documents), [documents]);
  const timelineEvents = analysis?.timeline?.length ? analysis.timeline : fallbackTimeline;
  const timelineLoading = analysisLoading || (documentsLoading && !analysisError);

  const issues = analysis?.inconsistencies ?? [];
  const issueCount = issues.length;

  function openAssistant() {
    setAssistantOpen((v) => !v);
  }

  function jumpToSection(sectionId: string) {
    if (sectionId === "annotations-layer") {
      document
        .querySelector("[data-annotation-toolbar]")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleClearPage() {
    for (const shape of annotationStore.shapesForPage(pageNumber)) {
      annotationStore.removeShape(pageNumber, shape.id);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ============ TOP BAR ============ */}
      <header
        className={`sticky top-0 z-30 border-b border-border bg-[var(--document-header)] backdrop-blur transition-[padding-left] duration-300 ease-out ${
          sidebarExpanded ? "md:pl-[260px]" : "md:pl-16"
        }`}
      >
        <div className="flex items-center gap-4 px-5 py-3.5">
          {/* Breadcrumb — the brand lives in the sidebar, never here. */}
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-[11px] tracking-[0.1em] uppercase"
          >
            <Link
              to="/records"
              search={{ case: caseParam }}
              className="focus-legal whitespace-nowrap text-muted-foreground transition-colors hover:text-parchment"
            >
              Case Records
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0 text-brass-dim" aria-hidden="true" />
            <span className="truncate text-parchment/90">
              {documentMeta?.file_name ?? "Document"}
            </span>
          </nav>

          {caseTitle && (
            <span className="hidden min-w-0 truncate text-[11px] text-muted-foreground lg:block">
              {caseTitle}
            </span>
          )}

          <div className="ml-auto flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search matters, courts, case numbers"
                placeholder="Search matters, courts, case numbers..."
                className="focus-legal w-56 border-b border-input bg-transparent py-1.5 pl-6 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-brass-dim focus:border-brass lg:w-72"
              />
            </div>
            <ThemeToggle />
            <UserProfileMenu />
          </div>
        </div>
      </header>

      <div
        className={`flex  min-h-0  flex-1 transition-[padding-left] duration-300 ease-out ${
          sidebarExpanded ? "md:pl-[260px]" : "md:pl-16"
        }`}
      >
        {/* ============ LEFT SIDEBAR ============ */}
        <DocumentSidebar
          expanded={sidebarExpanded}
          mobileOpen={mobileDrawerOpen}
          onToggle={() => setSidebarExpanded((v) => !v)}
          onMobileClose={() => setMobileDrawerOpen(false)}
          assistantOpen={assistantOpen}
          onAssistantToggle={openAssistant}
          onJumpToSection={jumpToSection}
          caseId={caseParam}
          documentId={documentId}
          processingStatus={processingStatus}
          processingMessage={processingMessage}
        />

        {/* ============ DOCUMENT WORKSPACE ============ */}
        <main className="min-w-0 min-h-0 flex flex-1 flex-col">
          {" "}
          {documentMeta ? (
            <DocumentHeader document={documentMeta} processingStatus={processingStatus} />
          ) : documentsLoading ? (
            <div className="border-b border-border px-5 py-5">
              <div className="h-11 w-11 animate-pulse bg-surface" aria-hidden="true" />
            </div>
          ) : null}
          {processingStatus === "FAILED" && (
          <div className="flex items-center justify-between gap-4 border-b border-burgundy/40 bg-burgundy/[0.05] px-5 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-burgundy" />
                <div className="min-w-0">
                <p className="text-xs font-medium text-burgundy">
                  AI analysis failed
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                {processingMessage}
              </p>
          </div>
        </div>

    <button
      type="button"
      onClick={() => void handleRetryProcessing()}
      disabled={retryingProcessing}
      className="focus-legal inline-flex shrink-0 items-center gap-2 border border-brass/50 bg-surface px-3 py-2 text-[10px] font-medium tracking-[0.12em] text-brass uppercase transition-colors hover:border-brass hover:bg-surface/80 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw
        className={`h-3 w-3 ${retryingProcessing ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {retryingProcessing ? "RETRYING..." : "RETRY AI ANALYSIS"}
    </button>
  </div>
)}
          <div className="min-h-0 flex-1">
            {loading ? (
              <PdfViewerLoading />
            ) : error || !pdf ? (
              <div className="p-6">
                <PdfViewerError message={error ?? "Document unavailable."} />
              </div>
            ) : (
              <PdfViewer
                pdf={pdf}
                page={pageNumber}
                onPageChange={setPageNumber}
                tool={tool}
                onToolChange={setTool}
                color={color}
                onColorChange={setColor}
                strokeWidth={strokeWidth}
                onStrokeWidthChange={setStrokeWidth}
                shapesForPage={annotationStore.shapesForPage}
                onAddShape={annotationStore.addShape}
                onErase={annotationStore.removeShape}
                onEraseSegment={annotationStore.eraseStrokeSegment}
                onReplaceShape={annotationStore.replaceShape}
                eraserSize={eraserSize}
                onEraserSizeChange={setEraserSize}
                canUndo={annotationStore.canUndo}
                canRedo={annotationStore.canRedo}
                onUndo={annotationStore.undo}
                onRedo={annotationStore.redo}
                onClearPage={handleClearPage}
              />
            )}
          </div>
        </main>

        {/* ============ RIGHT ANALYSIS PANEL ============ */}
        <aside
          aria-label="Case timeline and inconsistency analysis"
          className="hidden w-[280px] shrink-0 space-y-3 overflow-y-auto border-l border-border bg-background px-3 py-4 lg:block xl:w-[280px]"
        >
          <CaseTimeline events={timelineEvents} loading={timelineLoading} error={analysisError} />

          <InconsistencyIdentifier
            issues={issues}
            loading={analysisLoading}
            error={analysisError}
            processingStatus={processingStatus}
          />

          {processingStatus !== "COMPLETED" &&
          !analysisLoading &&
          !analysisError &&
            issueCount === 0 && (
          <p className="border border-border bg-surface/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            The analysis pipeline has not published findings for this document yet.
          </p>
        )}
        </aside>
      </div>
    </div>
  );
}
