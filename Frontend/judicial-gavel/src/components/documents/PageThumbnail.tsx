import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "@/hooks/usePdfDocument";
import { usePdfPage } from "@/hooks/usePdfPage";

interface PageThumbnailProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  active: boolean;
  onSelect: (page: number) => void;
}

const THUMB_WIDTH = 92;
const THUMB_RENDER_MARGIN = "600px 0px 600px 0px";

/**
 * Single page thumbnail rendered from the original PDF page.
 *
 * Only thumbnails near the visible thumbnail rail are asked to load a PDF
 * page and render a bitmap. The button itself remains mounted so navigation
 * and the rail layout stay stable.
 */
export function PageThumbnail({ pdf, pageNumber, active, onSelect }: PageThumbnailProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nearViewport, setNearViewport] = useState(active);
  const [aspect, setAspect] = useState<number | null>(null);

  const shouldRender = active || nearViewport;
  const page = usePdfPage(pdf, pageNumber, shouldRender);

  useEffect(() => {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setNearViewport(entry?.isIntersecting ?? false);
      },
      {
        root: null,
        rootMargin: THUMB_RENDER_MARGIN,
        threshold: 0,
      },
    );

    observer.observe(button);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!page || !canvas) {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      return;
    }

    const base = page.getViewport({ scale: 1 });

    setAspect(base.height / base.width);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({
      scale: (THUMB_WIDTH * dpr) / base.width,
    });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${THUMB_WIDTH}px`;
    canvas.style.height = `${Math.floor(THUMB_WIDTH * (base.height / base.width))}px`;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const task = page.render({
      canvasContext: context,
      viewport,
    });

    void task.promise.catch(() => {
      // Cancellation is expected when a thumbnail leaves the render window.
    });

    return () => {
      task.cancel();
    };
  }, [page]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => onSelect(pageNumber)}
      aria-current={active ? "true" : undefined}
      aria-label={`Go to page ${pageNumber}`}
      className={`focus-legal group flex w-full flex-col items-center gap-1.5 border p-1.5 transition-colors ${
        active
          ? "border-brass/70 bg-brass/[0.07]"
          : "border-transparent hover:border-border hover:bg-surface/60"
      }`}
    >
      <span
        className={`relative block overflow-hidden border bg-white shadow-md shadow-black/40 ${
          active ? "border-brass" : "border-border/70"
        }`}
        style={{
          width: THUMB_WIDTH,
          height: aspect ? THUMB_WIDTH * aspect : 120,
        }}
      >
        <canvas ref={canvasRef} className="block" aria-hidden="true" />
        {!page && <span className="absolute inset-0 animate-pulse bg-surface" aria-hidden="true" />}
      </span>

      <span
        className={`font-mono text-[9px] tracking-[0.14em] uppercase ${
          active ? "text-brass" : "text-muted-foreground"
        }`}
      >
        Page {pageNumber}
      </span>
    </button>
  );
}
