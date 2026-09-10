import { useEffect, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "@/hooks/usePdfDocument";

export function usePdfPage(pdf: PDFDocumentProxy | null, pageNumber: number): PDFPageProxy | null {
  const [page, setPage] = useState<PDFPageProxy | null>(null);

  useEffect(() => {
    if (!pdf) {
      setPage(null);
      return;
    }

    let cancelled = false;
    const clamped = Math.min(Math.max(1, pageNumber), pdf.numPages);

    void pdf
      .getPage(clamped)
      .then((proxy) => {
        if (!cancelled) setPage(proxy);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(`[JURY HASH] PDF.js getPage(${clamped}) failed:`, err);
          setPage(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber]);

  return page;
}
