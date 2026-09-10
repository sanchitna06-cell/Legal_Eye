import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "@/hooks/usePdfDocument";
import { usePdfPage } from "@/hooks/usePdfPage";
import { PdfPageCanvas } from "@/components/documents/PdfPageCanvas";

interface PageThumbnailProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  active: boolean;
  onSelect: (page: number) => void;
}

const THUMB_WIDTH = 92;

/**
 * Single page thumbnail rendered from the original PDF page (never OCR
 * text). The canvas scales to the rail width; the bitmap renders once at
 * 2x device pixels and stays sharp.
 */
export function PageThumbnail({ pdf, pageNumber, active, onSelect }: PageThumbnailProps) {
  const page = usePdfPage(pdf, pageNumber);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState<number | null>(null);

  useEffect(() => {
    if (!page || !canvasRef.current) return;

    let cancelled = false;
    const taskRef: { current: { cancel: () => void } | null } = { current: null };

    async function render() {
      const canvas = canvasRef.current;
      if (!page || !canvas) return;

      const base = page.getViewport({ scale: 1 });
      setAspect(base.height / base.width);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (THUMB_WIDTH * dpr) / base.width });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${THUMB_WIDTH}px`;
      canvas.style.height = `${Math.floor(THUMB_WIDTH * (base.height / base.width))}px`;

      const context = canvas.getContext("2d");
      if (!context) return;

      const task = page.render({ canvasContext: context, viewport });
      taskRef.current = task;
      try {
        await task.promise;
      } catch {
        // Cancelled on page change — expected.
      }
    }

    void render();
    return () => {
      cancelled = true;
      taskRef.current?.cancel();
    };
  }, [page]);

  return (
    <button
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
        style={{ width: THUMB_WIDTH, height: aspect ? THUMB_WIDTH * aspect : 120 }}
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
