import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getDocument as fetchDocumentBlob } from "@/lib/api";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export type PDFDocumentProxy = pdfjsLib.PDFDocumentProxy;
export type PDFPageProxy = pdfjsLib.PDFPageProxy;

export interface PdfDocumentState {
  pdf: PDFDocumentProxy | null;
  loading: boolean;
  error: string | null;
}

export function usePdfDocument(documentId: string): PdfDocumentState {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    let objectUrl: string | null = null;

    setLoading(true);
    setPdf(null);
    setError(null);

    async function load() {
      try {
        const blob = await fetchDocumentBlob(documentId);
        if (cancelled) return;

        if (blob.size === 0) {
          throw new Error("The server returned an empty PDF file.");
        }

        objectUrl = URL.createObjectURL(blob);
        loadingTask = pdfjsLib.getDocument({ url: objectUrl });

        const loadedDocument = await loadingTask.promise;
        if (cancelled) {
          await loadedDocument.destroy();
          return;
        }

        setPdf(loadedDocument);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[JURY HASH] PDF load failed:", err);
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;

      if (loadingTask) {
        void loadingTask.destroy();
      }

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [documentId]);

  return { pdf, loading, error };
}
