import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { FileWarning } from "lucide-react";

import type { PDFDocumentProxy } from "@/hooks/usePdfDocument";
import { usePdfPage } from "@/hooks/usePdfPage";
import { PdfPageCanvas, type TextSelectionRect } from "@/components/documents/PdfPageCanvas";
import { PageThumbnail } from "@/components/documents/PageThumbnail";
import { PdfToolbar } from "@/components/documents/PdfToolbar";
import { AnnotationOverlay } from "@/components/documents/AnnotationOverlay";

import type { AnnotationTool, LocalAnnotation, ShapeGeometry } from "@/hooks/useAnnotationStore";

interface PdfViewerProps {
  pdf: PDFDocumentProxy;
  page: number;
  onPageChange: (page: number) => void;

  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;

  color: string;
  onColorChange: (color: string) => void;

  eraserSize: number;
  onEraserSizeChange: (size: number) => void;

  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;

  shapesForPage: (page: number) => LocalAnnotation[];

  onAddShape: (shape: {
    page: number;
    type: LocalAnnotation["type"];
    color: string;
    strokeWidth: number;
    geometry: ShapeGeometry;
    content?: string | null;
  }) => string;

  onErase: (page: number, shapeId: string) => void;

  onEraseSegment: (page: number, shapeId: string, remainingShapes: LocalAnnotation[]) => void;

  onReplaceShape: (page: number, shapeId: string, updated: LocalAnnotation) => void;

  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearPage: () => void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

const PAGE_GAP = 24;
const VIEWPORT_PADDING = 24;

type TextEditorState = {
  page: number;
  annotationId: string | null;
  anchor: {
    x: number;
    y: number;
  } | null;
};

/* -------------------------------------------------------------------------- */
/* Individual PDF page                                                       */
/* -------------------------------------------------------------------------- */

interface PdfDocumentPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  effectiveScale: number;
  tool: AnnotationTool;

  shapesForPage: (page: number) => LocalAnnotation[];

  color: string;
  strokeWidth: number;
  eraserSize: number;

  onAddShape: PdfViewerProps["onAddShape"];
  onErase: PdfViewerProps["onErase"];
  onEraseSegment: PdfViewerProps["onEraseSegment"];
  onReplaceShape: PdfViewerProps["onReplaceShape"];

  textEditor: TextEditorState | null;
  onOpenTextEditor: (state: TextEditorState) => void;
  onCloseTextEditor: () => void;

  setPageRef: (pageNumber: number, node: HTMLDivElement | null) => void;
}

function PdfDocumentPage({
  pdf,
  pageNumber,
  effectiveScale,
  tool,
  shapesForPage,
  color,
  strokeWidth,
  eraserSize,
  onAddShape,
  onErase,
  onEraseSegment,
  onReplaceShape,
  textEditor,
  onOpenTextEditor,
  onCloseTextEditor,
  setPageRef,
}: PdfDocumentPageProps) {
  const pageProxy = usePdfPage(pdf, pageNumber);

  const [pageSize, setPageSize] = useState({
    width: 0,
    height: 0,
  });

  const shapes = useMemo(() => shapesForPage(pageNumber), [shapesForPage, pageNumber]);

  const handleRendered = useCallback((width: number, height: number) => {
    setPageSize((previous) => {
      if (previous.width === width && previous.height === height) {
        return previous;
      }

      return {
        width,
        height,
      };
    });
  }, []);

  const handleTextSelection = useCallback(
    (rects: TextSelectionRect[], selectedText: string) => {
      /*
       * Native text selection is also used by the Select tool.
       * Only the Highlighter tool converts the selection into
       * a persistent annotation.
       */
      if (tool !== "highlighter") {
        return;
      }

      if (rects.length === 0) {
        return;
      }

      if (!selectedText.trim()) {
        return;
      }

      onAddShape({
        page: pageNumber,
        type: "highlight",
        color,
        strokeWidth,
        geometry: {
          rects,
        },
        content: selectedText,
      });

      /*
       * Remove the native browser selection after the persistent
       * annotation has been created.
       */
      window.getSelection()?.removeAllRanges();
    },
    [color, onAddShape, pageNumber, strokeWidth, tool],
  );
  /*
   * Keep the page wrapper mounted while PDF.js is loading.
   * This gives the viewer a stable DOM target for scrolling.
   */
  if (!pageProxy) {
    return (
      <div
        ref={(node) => setPageRef(pageNumber, node)}
        data-pdf-page={pageNumber}
        data-page-number={pageNumber}
        className="relative shrink-0 bg-white shadow-[0_18px_50px_-18px_rgba(0,0,0,0.85)] ring-1 ring-black/60"
        style={{
          width: "min(850px, calc(100vw - 220px))",
          minHeight: "200px",
        }}
      />
    );
  }

  return (
    <div
      ref={(node) => setPageRef(pageNumber, node)}
      data-pdf-page={pageNumber}
      data-page-number={pageNumber}
      className="relative shrink-0 bg-white shadow-[0_18px_50px_-18px_rgba(0,0,0,0.85)] ring-1 ring-black/60"
      style={{
        width: pageSize.width || undefined,
        height: pageSize.height || undefined,
      }}
    >
      <PdfPageCanvas
        page={pageProxy}
        scale={effectiveScale}
        enableTextSelection={tool === "select" || tool === "highlighter"}
        onTextSelection={handleTextSelection}
        onRendered={handleRendered}
      />

      <AnnotationOverlay
        page={pageNumber}
        width={pageSize.width}
        height={pageSize.height}
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        eraserSize={eraserSize}
        shapes={shapes}
        onAddShape={onAddShape}
        onErase={onErase}
        onEraseSegment={onEraseSegment}
        onReplaceShape={onReplaceShape}
        disabled={tool === "pan"}
        textEditor={textEditor?.page === pageNumber ? textEditor : null}
        onOpenTextEditor={onOpenTextEditor}
        onCloseTextEditor={onCloseTextEditor}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main viewer                                                                */
/* -------------------------------------------------------------------------- */

export function PdfViewer({
  pdf,
  page,
  onPageChange,
  tool,
  onToolChange,
  color,
  onColorChange,
  eraserSize,
  onEraserSizeChange,
  strokeWidth,
  onStrokeWidthChange,
  shapesForPage,
  onAddShape,
  onErase,
  onEraseSegment,
  onReplaceShape,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearPage,
}: PdfViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState(false);

  const [frameSize, setFrameSize] = useState({
    width: 0,
    height: 0,
  });

  /*
   * Base dimensions of PDF page 1 at scale = 1.
   *
   * This is deliberately independent of the rendered page size.
   * Using the already-scaled rendered page here can create a
   * resize -> scale -> render -> resize feedback loop.
   */
  const [basePageSize, setBasePageSize] = useState({
    width: 0,
    height: 0,
  });

  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);

  const frameRef = useRef<HTMLDivElement | null>(null);

  /*
   * Every page gets a DOM reference.
   *
   * Record<number, ...> means access must be:
   *
   *     pageRefs.current[pageNumber]
   *
   * NOT:
   *
   *     pageRefs.current.get(pageNumber)
   */
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  /*
   * Prevent automatic page detection from fighting a
   * thumbnail / toolbar initiated smooth scroll.
   */
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<number | null>(null);

  const panRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
  });

  /* ---------------------------------------------------------------------- */
  /* Page refs                                                              */
  /* ---------------------------------------------------------------------- */

  const setPageRef = useCallback((pageNumber: number, node: HTMLDivElement | null) => {
    pageRefs.current[pageNumber] = node;
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Text editor                                                            */
  /* ---------------------------------------------------------------------- */

  const handleOpenTextEditor = useCallback((state: TextEditorState) => {
    setTextEditor(state);
  }, []);

  const handleCloseTextEditor = useCallback(() => {
    setTextEditor(null);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Viewer height                                                          */
  /* ---------------------------------------------------------------------- */

  const updateFrameSize = useCallback(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    if (document.fullscreenElement === frame) {
      frame.style.height = "100dvh";
      frame.style.maxHeight = "100dvh";

      setFrameSize({
        width: frame.clientWidth,
        height: window.innerHeight,
      });

      return;
    }

    const top = frame.getBoundingClientRect().top;

    const availableHeight = Math.max(0, window.innerHeight - top);

    frame.style.height = `${availableHeight}px`;
    frame.style.maxHeight = `${availableHeight}px`;

    setFrameSize({
      width: frame.clientWidth,
      height: availableHeight,
    });
  }, []);

  const setFrameRef = useCallback(
    (node: HTMLDivElement | null) => {
      frameRef.current = node;

      if (!node) {
        return;
      }

      const update = () => {
        updateFrameSize();
      };

      update();

      const observer = new ResizeObserver(update);

      observer.observe(node);

      window.addEventListener("resize", update);

      document.addEventListener("fullscreenchange", update);

      return () => {
        observer.disconnect();

        window.removeEventListener("resize", update);

        document.removeEventListener("fullscreenchange", update);
      };
    },
    [updateFrameSize],
  );

  useEffect(() => {
    updateFrameSize();
  }, [updateFrameSize]);

  /* ---------------------------------------------------------------------- */
  /* Base PDF page dimensions                                               */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    void pdf.getPage(1).then((pageProxy) => {
      if (cancelled) {
        return;
      }

      const viewport = pageProxy.getViewport({
        scale: 1,
      });

      setBasePageSize({
        width: viewport.width,
        height: viewport.height,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [pdf]);

  /* ---------------------------------------------------------------------- */
  /* Fit-to-page scale                                                      */
  /* ---------------------------------------------------------------------- */

  const fitScale = useMemo(() => {
    if (
      basePageSize.width <= 0 ||
      basePageSize.height <= 0 ||
      frameSize.width <= 0 ||
      frameSize.height <= 0
    ) {
      return 1;
    }

    /*
     * The thumbnail rail occupies part of the viewport,
     * so leave a little extra horizontal room.
     */
    const availableWidth = Math.max(1, frameSize.width - 48);

    const availableHeight = Math.max(1, frameSize.height - 48);

    const widthScale = availableWidth / basePageSize.width;

    const heightScale = availableHeight / basePageSize.height;

    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(widthScale, heightScale)));
  }, [basePageSize, frameSize]);

  const effectiveScale = fitMode ? fitScale : zoom;

  /* ---------------------------------------------------------------------- */
  /* Zoom                                                                    */
  /* ---------------------------------------------------------------------- */

  const applyZoom = useCallback((next: number) => {
    setFitMode(false);

    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)));
  }, []);

  const handleFit = useCallback(() => {
    setFitMode(true);
    setZoom(fitScale);
  }, [fitScale]);

  /* ---------------------------------------------------------------------- */
  /* Fullscreen                                                              */
  /* ---------------------------------------------------------------------- */

  const fullscreen = useCallback(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    void frame.requestFullscreen();
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Page navigation                                                         */
  /* ---------------------------------------------------------------------- */

  const scrollToPage = useCallback(
    (requestedPage: number) => {
      const targetPage = Math.min(pdf.numPages, Math.max(1, requestedPage));

      const frame = frameRef.current;
      const node = pageRefs.current[targetPage];

      /*
       * If the page isn't mounted yet, at least update the
       * external page state.
       */
      if (!frame || !node) {
        onPageChange(targetPage);
        return;
      }

      programmaticScrollRef.current = true;

      if (programmaticScrollTimerRef.current !== null) {
        window.clearTimeout(programmaticScrollTimerRef.current);
      }

      const frameRect = frame.getBoundingClientRect();

      const nodeRect = node.getBoundingClientRect();

      /*
       * Convert the page's viewport position into
       * the scroll container's coordinate system.
       */
      const targetTop = frame.scrollTop + (nodeRect.top - frameRect.top) - VIEWPORT_PADDING;

      frame.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });

      onPageChange(targetPage);

      /*
       * Smooth scrolling does not provide a universally
       * reliable completion event, so use a short fallback.
       */
      programmaticScrollTimerRef.current = window.setTimeout(() => {
        programmaticScrollRef.current = false;
        programmaticScrollTimerRef.current = null;
      }, 800);
    },
    [onPageChange, pdf.numPages],
  );

  useEffect(() => {
    return () => {
      if (programmaticScrollTimerRef.current !== null) {
        window.clearTimeout(programmaticScrollTimerRef.current);
      }
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Automatic current-page detection                                       */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    let rafId: number | null = null;

    const updateCurrentPage = () => {
      rafId = null;

      if (programmaticScrollRef.current) {
        return;
      }

      const frameRect = frame.getBoundingClientRect();

      /*
       * Pick the page whose center is closest to the
       * vertical center of the visible document area.
       */
      const viewportCenter = frameRect.top + frameRect.height / 2;

      let closestPage = page;
      let closestDistance = Infinity;

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const element = pageRefs.current[pageNumber];

        if (!element) {
          continue;
        }

        const rect = element.getBoundingClientRect();

        const pageCenter = rect.top + rect.height / 2;

        const distance = Math.abs(pageCenter - viewportCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = pageNumber;
        }
      }

      if (closestPage !== page) {
        onPageChange(closestPage);
      }
    };

    const handleScroll = () => {
      if (rafId !== null) {
        return;
      }

      rafId = requestAnimationFrame(updateCurrentPage);
    };

    frame.addEventListener("scroll", handleScroll, { passive: true });

    /*
     * Calculate the initial page immediately.
     */
    updateCurrentPage();

    return () => {
      frame.removeEventListener("scroll", handleScroll);

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [page, pdf.numPages, onPageChange]);

  /* ---------------------------------------------------------------------- */
  /* Pan                                                                     */
  /* ---------------------------------------------------------------------- */

  const handlePanPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (tool !== "pan" || event.button !== 0) {
        return;
      }

      const frame = frameRef.current;

      if (!frame) {
        return;
      }

      panRef.current = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: frame.scrollLeft,
        startScrollTop: frame.scrollTop,
      };

      event.currentTarget.setPointerCapture(event.pointerId);

      event.preventDefault();
    },
    [tool],
  );

  const handlePanPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (tool !== "pan" || !panRef.current.active) {
        return;
      }

      const frame = frameRef.current;

      if (!frame) {
        return;
      }

      const dx = event.clientX - panRef.current.startX;

      const dy = event.clientY - panRef.current.startY;

      frame.scrollLeft = panRef.current.startScrollLeft - dx;

      frame.scrollTop = panRef.current.startScrollTop - dy;

      event.preventDefault();
    },
    [tool],
  );

  const handlePanPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!panRef.current.active) {
      return;
    }

    panRef.current.active = false;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /*
       * Pointer capture may already have been released.
       */
    }
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div id="annotations-layer" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PdfToolbar
        page={page}
        pageCount={pdf.numPages}
        onPageChange={scrollToPage}
        zoom={effectiveScale}
        onZoomChange={applyZoom}
        onFit={handleFit}
        onFullscreen={fullscreen}
        tool={tool}
        onToolChange={onToolChange}
        color={color}
        onColorChange={onColorChange}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={onStrokeWidthChange}
        eraserSize={eraserSize}
        onEraserSizeChange={onEraserSizeChange}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onClearPage={onClearPage}
      />

      <div
        ref={setFrameRef}
        className={`relative min-h-0 shrink-0 overflow-auto bg-[#0d0c0b] ${
          tool === "pan" ? "cursor-grab select-none" : ""
        }`}
        role="region"
        aria-label="Original document pages"
        style={{
          touchAction: tool === "pan" ? "none" : "auto",
        }}
        onPointerDownCapture={handlePanPointerDown}
        onPointerMoveCapture={handlePanPointerMove}
        onPointerUpCapture={handlePanPointerUp}
        onPointerCancelCapture={handlePanPointerUp}
      >
        <div
          className={`mx-auto flex min-w-max items-start gap-6 px-6 py-6 xl:px-10 ${
            tool === "pan" ? "pointer-events-none" : ""
          }`}
        >
          {/* -------------------------------------------------------------- */}
          {/* Thumbnails                                                      */}
          {/* -------------------------------------------------------------- */}

          <nav
            aria-label="Page thumbnails"
            className="sticky top-6 hidden h-fit w-[120px] shrink-0 flex-col gap-2 md:flex"
          >
            {Array.from(
              {
                length: pdf.numPages,
              },
              (_, index) => index + 1,
            ).map((pageNumber) => (
              <PageThumbnail
                key={pageNumber}
                pdf={pdf}
                pageNumber={pageNumber}
                active={pageNumber === page}
                onSelect={scrollToPage}
              />
            ))}
          </nav>

          {/* -------------------------------------------------------------- */}
          {/* Continuous PDF document                                        */}
          {/* -------------------------------------------------------------- */}

          <main className="flex min-w-0 flex-1 justify-center" aria-label="PDF document">
            <div className="flex flex-col items-center gap-6">
              {Array.from(
                {
                  length: pdf.numPages,
                },
                (_, index) => index + 1,
              ).map((pageNumber) => (
                <PdfDocumentPage
                  key={pageNumber}
                  pdf={pdf}
                  pageNumber={pageNumber}
                  effectiveScale={effectiveScale}
                  tool={tool}
                  shapesForPage={shapesForPage}
                  color={color}
                  strokeWidth={strokeWidth}
                  eraserSize={eraserSize}
                  onAddShape={onAddShape}
                  onErase={onErase}
                  onEraseSegment={onEraseSegment}
                  onReplaceShape={onReplaceShape}
                  textEditor={textEditor}
                  onOpenTextEditor={handleOpenTextEditor}
                  onCloseTextEditor={handleCloseTextEditor}
                  setPageRef={setPageRef}
                />
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Error state                                                                */
/* -------------------------------------------------------------------------- */

export function PdfViewerError({ message }: { message: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 border border-burgundy/40 bg-burgundy/[0.04] p-10 text-center">
      <FileWarning className="h-8 w-8 text-burgundy" />

      <p className="font-display text-lg text-parchment">Document could not be opened</p>

      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading state                                                              */
/* -------------------------------------------------------------------------- */

export function PdfViewerLoading({
  label = "Retrieving original document...",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <div className="flex items-center gap-3 border border-border bg-surface/50 px-6 py-4">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brass" aria-hidden="true" />

        <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </p>
      </div>
    </div>
  );
}
