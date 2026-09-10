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

  onRendered?: (width: number, height: number) => void;

  /**
   * Enables native browser text selection.
   *
   * This is used by both the Select and Highlighter tools.
   */
  enableTextSelection?: boolean;

  /**
   * Called when the user finishes selecting text.
   *
   * The rectangles are normalized to the PDF page:
   * x0/y0/x1/y1 are all in the range 0..1.
   *
   * The parent decides whether the current tool should turn
   * this selection into a persistent annotation.
   */
  onTextSelection?: (rects: TextSelectionRect[], selectedText: string) => void;
}

/**
 * Renders a single PDF page:
 *
 *   canvas
 *      ↓
 *   transparent text layer
 *
 * The canvas contains the original PDF rendering.
 * The text layer provides native browser text selection.
 *
 * When text is selected, the browser Range is converted into
 * normalized page-space rectangles and reported through
 * onTextSelection().
 */
export function PdfPageCanvas({
  page,
  scale,
  className,
  onRendered,
  enableTextSelection = false,
  onTextSelection,
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

    if (canvasElement === null || currentPage === null) {
      return;
    }

    const canvas: HTMLCanvasElement = canvasElement;
    const pdfPage: PDFPageProxy = currentPage;

    const contextElement = canvas.getContext("2d");

    if (contextElement === null) {
      return;
    }

    const context: CanvasRenderingContext2D = contextElement;

    let cancelled = false;

    async function renderPage() {
      /*
       * IMPORTANT:
       * If this canvas is still associated with an earlier PDF.js
       * render task, wait for that task to finish cancelling before
       * starting another render on the same canvas.
       */
      const previousTask = renderTaskRef.current;

      if (previousTask !== null) {
        try {
          await previousTask.promise;
        } catch {
          // Expected when the previous render was cancelled.
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
         * PDF.js throws RenderCancelledException when a render
         * is cancelled because the page/scale changed.
         *
         * That is expected and should not reach the console.
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
  }, [page, scale, onRendered]);

  /* ---------------------------------------------------------------------- */
  /* Text selection                                                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const layer = textLayerRef.current;

    if (layer === null) {
      return;
    }

    if (!enableTextSelection) {
      return;
    }

    /**
     * Convert the browser's client-space selection rectangles into
     * normalized page coordinates.
     *
     * Browser coordinates:
     *
     *   viewport / screen pixels
     *
     * Annotation coordinates:
     *
     *   0..1 normalized page space
     */
    const handleSelection = () => {
      if (!onTextSelection) {
        return;
      }

      const selection = window.getSelection();

      if (selection === null || selection.isCollapsed || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);

      /*
       * Ignore selections that do not belong to this page's
       * text layer.
       */
      if (!layer.contains(range.commonAncestorContainer)) {
        return;
      }

      const layerRect = layer.getBoundingClientRect();

      if (layerRect.width <= 0 || layerRect.height <= 0) {
        return;
      }

      const clientRects = Array.from(range.getClientRects());

      const rects: TextSelectionRect[] = [];

      for (const rect of clientRects) {
        /*
         * Browser selections can contain tiny/empty rectangles.
         * Ignore those because they cannot produce a useful highlight.
         */
        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }

        /*
         * Convert viewport coordinates to coordinates relative
         * to this PDF page.
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

      const selectedText = selection.toString();

      if (!selectedText.trim()) {
        return;
      }

      /*
       * Report the selection to the parent.
       *
       * The parent decides whether this becomes a persistent
       * "highlight" annotation.
       */
      onTextSelection(rects, selectedText);
    };

    /*
     * selectionchange fires while the user is dragging.
     *
     * We deliberately wait for pointerup below so that we only
     * create a highlight once the selection is complete.
     */
    const handlePointerUp = () => {
      /*
       * requestAnimationFrame gives the browser one frame to
       * finalize the native selection before we inspect it.
       */
      window.requestAnimationFrame(() => {
        handleSelection();
      });
    };

    layer.addEventListener("pointerup", handlePointerUp);

    return () => {
      layer.removeEventListener("pointerup", handlePointerUp);
    };
  }, [enableTextSelection, onTextSelection]);

  /* ---------------------------------------------------------------------- */
  /* Text layer                                                             */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const textLayerElement = textLayerRef.current;

    if (textLayerElement === null) {
      return;
    }

    const layer: HTMLDivElement = textLayerElement;

    const currentPage = page;

    if (currentPage === null) {
      layer.innerHTML = "";
      return;
    }

    const pdfPage: PDFPageProxy = currentPage;

    let cancelled = false;

    async function renderTextLayer() {
      layer.innerHTML = "";

      const viewport = pdfPage.getViewport({
        scale,
      });

      const textContent = await pdfPage.getTextContent();

      if (cancelled) {
        return;
      }

      for (const item of textContent.items) {
        if (!("str" in item) || !item.str) {
          continue;
        }

        const span = document.createElement("span");

        const tx = item.transform;

        const userX = tx[4];
        const userY = tx[5];

        const fontSize = Math.abs(tx[3]);

        const x = userX * scale;

        const y = viewport.height - userY * scale;

        span.textContent = item.str;

        span.style.position = "absolute";

        span.style.left = `${x}px`;

        span.style.top = `${y - fontSize * scale}px`;

        span.style.fontSize = `${fontSize * scale}px`;

        span.style.lineHeight = "1";

        span.style.whiteSpace = "pre";

        span.style.transformOrigin = "0 0";

        /*
         * The PDF itself is rendered by the canvas.
         * These spans are only used for text selection.
         */
        span.style.color = "transparent";

        span.style.backgroundColor = "transparent";

        span.style.webkitTextFillColor = "transparent";

        /*
         * Native browser text selection.
         */
        span.style.userSelect = enableTextSelection ? "text" : "none";

        span.style.webkitUserSelect = enableTextSelection ? "text" : "none";

        span.style.pointerEvents = enableTextSelection ? "auto" : "none";

        span.style.cursor = enableTextSelection ? "text" : "default";

        /*
         * Metadata used by the annotation system.
         */
        span.dataset["scale"] = String(scale);

        span.dataset["originX"] = String(x);

        span.dataset["originY"] = String(y - fontSize * scale);

        span.dataset["userX"] = String(userX);

        span.dataset["userY"] = String(userY);

        layer.appendChild(span);
      }
    }

    void renderTextLayer();

    return () => {
      cancelled = true;
      layer.innerHTML = "";
    };
  }, [page, scale, enableTextSelection]);

  /* ---------------------------------------------------------------------- */
  /* Page dimensions                                                        */
  /* ---------------------------------------------------------------------- */

  const pageWidth = page
    ? page.getViewport({
        scale,
      }).width
    : undefined;

  const pageHeight = page
    ? page.getViewport({
        scale,
      }).height
    : undefined;

  /* ---------------------------------------------------------------------- */
  /* Page container                                                         */
  /* ---------------------------------------------------------------------- */

  return (
    <div
      className="relative"
      style={{
        width: pageWidth ? `${pageWidth}px` : undefined,

        height: pageHeight ? `${pageHeight}px` : undefined,
      }}
    >
      {/* -------------------------------------------------------------- */}
      {/* PDF canvas                                                     */}
      {/* -------------------------------------------------------------- */}

      <canvas
        ref={canvasRef}
        className={className}
        aria-label="Original document page"
        role="img"
      />

      {/* -------------------------------------------------------------- */}
      {/* PDF text layer                                                 */}
      {/* -------------------------------------------------------------- */}

      <div
        ref={textLayerRef}
        className="absolute inset-0 overflow-hidden"
        style={{
          pointerEvents: enableTextSelection ? "auto" : "none",

          userSelect: enableTextSelection ? "text" : "none",

          WebkitUserSelect: enableTextSelection ? "text" : "none",

          /*
           * Text layer sits above the canvas
           * but below annotation UI.
           */
          zIndex: 2,
        }}
        aria-hidden={!enableTextSelection}
      />
    </div>
  );
}
