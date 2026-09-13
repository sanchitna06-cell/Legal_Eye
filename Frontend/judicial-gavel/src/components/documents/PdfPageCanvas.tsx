import { useEffect, useRef } from "react";
import type { PDFPageProxy } from "@/hooks/usePdfDocument";

export interface TextSelectionRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface PdfPageCanvasProps {
  page: PDFPageProxy | null;
  scale: number;

  /** Rendered at device resolution, laid out at CSS scale. */
  className?: string;

  /**
   * Controls whether PDF.js work is active for this page.
   * The viewer keeps the page shell mounted for stable scrolling,
   * but only renders pages inside the viewport window.
   */
  shouldRender?: boolean;

  onRendered?: (width: number, height: number) => void;

  /**
   * Enables native browser text selection.
   *
   * Used by both the Select and Highlighter tools.
   */
  enableTextSelection?: boolean;

  /**
   * Called when the user finishes selecting text.
   *
   * Rectangles are normalized to 0..1 page coordinates.
   */
  onTextSelection?: (rects: TextSelectionRect[], selectedText: string) => void;
}

/**
 * Renders one PDF page.
 *
 * Layer order:
 *
 *   1. PDF canvas
 *   2. Transparent native text-selection layer
 *
 * The annotation system remains outside this component.
 *
 * The text layer is intentionally transparent because the actual
 * document pixels come from the PDF canvas underneath it.
 */

/*
 * Text extraction is relatively expensive. Cache the promise per PDF page so
 * toggling Select/Highlighter or briefly leaving/re-entering the render window
 * does not ask PDF.js to extract the same page text again.
 */
type TextContent = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;

const textContentCache = new WeakMap<PDFPageProxy, Promise<TextContent>>();

function getCachedTextContent(pdfPage: PDFPageProxy): Promise<TextContent> {
  const cached = textContentCache.get(pdfPage);

  if (cached) {
    return cached;
  }

  const promise = pdfPage.getTextContent().catch((error) => {
    textContentCache.delete(pdfPage);
    throw error;
  });

  textContentCache.set(pdfPage, promise);
  return promise;
}

export function PdfPageCanvas({
  page,
  scale,
  className,
  onRendered,
  enableTextSelection = false,
  onTextSelection,
  shouldRender = true,
}: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const renderTaskRef = useRef<{
    cancel: () => void;
    promise: Promise<unknown>;
  } | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Canvas rendering                                                       */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const canvasElement = canvasRef.current;
    const currentPage = page;

    if (canvasElement === null || currentPage === null || !shouldRender) {
      return;
    }

    const canvas = canvasElement;
    const pdfPage = currentPage;

    const contextElement = canvas.getContext("2d");

    if (contextElement === null) {
      return;
    }

    const context = contextElement;

    let cancelled = false;

    async function renderPage() {
      /*
       * PDF.js cannot safely start another render on the same canvas
       * while the previous render task is still cancelling.
       */
      const previousTask = renderTaskRef.current;

      if (previousTask !== null) {
        try {
          await previousTask.promise;
        } catch {
          // Cancellation is expected when changing page/scale.
        }

        if (renderTaskRef.current === previousTask) {
          renderTaskRef.current = null;
        }
      }

      if (cancelled) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;

      const viewport = pdfPage.getViewport({
        scale: scale * dpr,
      });

      const cssViewport = pdfPage.getViewport({
        scale,
      });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      canvas.style.width = `${cssViewport.width}px`;
      canvas.style.height = `${cssViewport.height}px`;

      context.setTransform(1, 0, 0, 1, 0, 0);

      context.clearRect(0, 0, canvas.width, canvas.height);

      if (cancelled) {
        return;
      }

      const renderTask = pdfPage.render({
        canvasContext: context,
        viewport,
      });

      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;

        if (cancelled) {
          return;
        }

        onRendered?.(cssViewport.width, cssViewport.height);
      } catch {
        /*
         * RenderCancelledException is expected when the page or
         * scale changes while PDF.js is rendering.
         */
      } finally {
        if (renderTaskRef.current === renderTask) {
          renderTaskRef.current = null;
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;

      const activeTask = renderTaskRef.current;

      if (activeTask !== null) {
        activeTask.cancel();
      }
    };
  }, [page, scale, onRendered, shouldRender]);

  /* ---------------------------------------------------------------------- */
  /* Native text selection                                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const layer = textLayerRef.current;

    if (layer === null || !enableTextSelection || !shouldRender) {
      return;
    }

    let frameId: number | null = null;

    const processSelection = () => {
      frameId = null;

      if (!onTextSelection) {
        return;
      }

      const selection = window.getSelection();

      if (selection === null || selection.isCollapsed || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);

      /*
       * Only process selections that actually belong to
       * this PDF page's text layer.
       */
      if (!layer.contains(range.commonAncestorContainer)) {
        return;
      }

      const selectedText = selection.toString();

      if (!selectedText.trim()) {
        return;
      }

      const layerRect = layer.getBoundingClientRect();

      if (layerRect.width <= 0 || layerRect.height <= 0) {
        return;
      }

      const clientRects = Array.from(range.getClientRects());

      const rects: TextSelectionRect[] = [];

      for (const rect of clientRects) {
        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }

        /*
         * Convert browser viewport coordinates into
         * coordinates relative to this PDF page.
         */
        const left = rect.left - layerRect.left;
        const top = rect.top - layerRect.top;
        const right = rect.right - layerRect.left;
        const bottom = rect.bottom - layerRect.top;

        /*
         * Normalize into 0..1 page coordinates.
         */
        const x0 = Math.max(0, Math.min(1, left / layerRect.width));

        const y0 = Math.max(0, Math.min(1, top / layerRect.height));

        const x1 = Math.max(0, Math.min(1, right / layerRect.width));

        const y1 = Math.max(0, Math.min(1, bottom / layerRect.height));

        if (x1 <= x0 || y1 <= y0) {
          continue;
        }

        rects.push({
          x0,
          y0,
          x1,
          y1,
        });
      }

      if (rects.length === 0) {
        return;
      }

      onTextSelection(rects, selectedText);
    };

    /*
     * Wait until the browser has completely finished the
     * native selection before reading its geometry.
     *
     * IMPORTANT:
     * We deliberately do NOT listen to selectionchange here.
     * selectionchange fires continuously while the user is
     * dragging and would cause the highlighter to commit
     * partial selections.
     */
    const handlePointerUp = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(processSelection);
    };

    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("pointerup", handlePointerUp);

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [enableTextSelection, onTextSelection, shouldRender]);

  /* ---------------------------------------------------------------------- */
  /* PDF text layer                                                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const textLayerElement = textLayerRef.current;

    if (textLayerElement === null) {
      return;
    }

    const layer = textLayerElement;
    const currentPage = page;

    if (currentPage === null || !shouldRender) {
      layer.replaceChildren();
      return;
    }

    const pdfPage = currentPage;

    let cancelled = false;

    async function renderTextLayer() {
      /*
       * Clear the old text layer before rendering the new page.
       */
      layer.replaceChildren();

      const viewport = pdfPage.getViewport({
        scale,
      });

      const textContent = await getCachedTextContent(pdfPage);

      if (cancelled) {
        return;
      }

      /*
       * Build transparent text spans from PDF.js text items.
       *
       * Important difference from the old implementation:
       *
       * We use the COMPLETE text transformation matrix instead
       * of only tx[4], tx[5] and tx[3].
       *
       * This makes positioning work much better with rotated,
       * scaled and transformed PDF text.
       */
      const fragment = document.createDocumentFragment();

      for (const item of textContent.items) {
        if (!("str" in item) || !item.str) {
          continue;
        }

        const span = document.createElement("span");

        const tx = item.transform;

        /*
         * PDF.js text transform:
         *
         * [a, b, c, d, e, f]
         *
         * Combine it with the page viewport transform.
         */
        const viewportTransform = viewport.transform;

        const v0 = viewportTransform[0] ?? 1;
        const v1 = viewportTransform[1] ?? 0;
        const v2 = viewportTransform[2] ?? 0;
        const v3 = viewportTransform[3] ?? 1;
        const v4 = viewportTransform[4] ?? 0;
        const v5 = viewportTransform[5] ?? 0;

        const t0 = tx[0] ?? 1;
        const t1 = tx[1] ?? 0;
        const t2 = tx[2] ?? 0;
        const t3 = tx[3] ?? 1;
        const t4 = tx[4] ?? 0;
        const t5 = tx[5] ?? 0;

        const a = v0 * t0 + v2 * t1;

        const b = v1 * t0 + v3 * t1;

        const c = v0 * t2 + v2 * t3;

        const d = v1 * t2 + v3 * t3;

        const e = v0 * t4 + v2 * t5 + v4;

        const f = v1 * t4 + v3 * t5 + v5;
        /*
         * Font height comes from the transformed Y axis.
         */
        const fontHeight = Math.sqrt(c * c + d * d);

        if (!Number.isFinite(fontHeight) || fontHeight <= 0) {
          continue;
        }

        /*
         * Text angle.
         */
        const angle = Math.atan2(b, a);

        /*
         * Width of the original PDF text run.
         *
         * PDF.js provides item.width in PDF user units.
         */

        span.textContent = item.str;

        /*
         * Position the span using the transformed PDF
         * coordinates.
         */
        span.style.position = "absolute";

        span.style.left = `${e}px`;

        /*
         * The PDF transform places the text baseline.
         * Move upward by the font height so the DOM text box
         * occupies the same visual region.
         */
        span.style.top = `${f - fontHeight}px`;

        span.style.fontSize = `${fontHeight}px`;

        span.style.lineHeight = "1";

        span.style.whiteSpace = "pre";

        span.style.margin = "0";

        span.style.padding = "0";

        span.style.transformOrigin = "0 0";

        /*
         * Preserve rotation from the PDF.
         */
        if (Math.abs(angle) > 0.0001) {
          span.style.transform = `rotate(${angle}rad)`;
        }

        /*
         * Transparent text is intentional.
         *
         * The PDF canvas is the visible document.
         * This span exists only so the browser can perform
         * real native text selection.
         */
        span.style.color = "transparent";

        span.style.backgroundColor = "transparent";

        span.style.webkitTextFillColor = "transparent";

        /*
         * Native selection.
         */
        span.style.userSelect = enableTextSelection ? "text" : "none";

        span.style.webkitUserSelect = enableTextSelection ? "text" : "none";

        span.style.pointerEvents = enableTextSelection ? "auto" : "none";

        span.style.cursor = enableTextSelection ? "text" : "default";

        /*
         * Prevent the browser from adding visual layout
         * differences around the transparent text.
         */
        span.style.display = "inline-block";

        /*
         * Metadata retained for the annotation system.
         */

        fragment.appendChild(span);
      }

      if (!cancelled) {
        layer.appendChild(fragment);
      }
    }

    void renderTextLayer();

    return () => {
      cancelled = true;
      layer.replaceChildren();
    };
  }, [page, scale, enableTextSelection, shouldRender]);

  /* ---------------------------------------------------------------------- */
  /* Page dimensions                                                        */
  /* ---------------------------------------------------------------------- */

  const pageViewport = page
    ? page.getViewport({
        scale,
      })
    : null;

  const pageWidth = pageViewport?.width;
  const pageHeight = pageViewport?.height;

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div
      className="relative"
      style={{
        width: pageWidth !== undefined ? `${pageWidth}px` : undefined,
        height: pageHeight !== undefined ? `${pageHeight}px` : undefined,
      }}
    >
      {/* ---------------------------------------------------------------- */}
      {/* Original PDF                                                     */}
      {/* ---------------------------------------------------------------- */}

      <canvas
        ref={canvasRef}
        className={className}
        aria-label="Original document page"
        role="img"
        style={{
          display: "block",
        }}
      />

      {/* ---------------------------------------------------------------- */}
      {/* Native text-selection layer                                      */}
      {/* ---------------------------------------------------------------- */}

      <div
        ref={textLayerRef}
        className="absolute inset-0 overflow-hidden"
        style={{
          pointerEvents: enableTextSelection ? "auto" : "none",
          userSelect: enableTextSelection ? "text" : "none",
          WebkitUserSelect: enableTextSelection ? "text" : "none",
          zIndex: 2,
        }}
        aria-hidden={!enableTextSelection}
      />
    </div>
  );
}
