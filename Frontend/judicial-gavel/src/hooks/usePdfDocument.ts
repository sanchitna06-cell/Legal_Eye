import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getDocument } from "@/lib/api";

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

    setLoading(true);
    setPdf(null);
    setError(null);

    async function load() {
      try {
        // Get a short-lived signed Supabase URL from the backend.
        const access = await getDocument(documentId);

        if (cancelled) return;

        if (!access.url) {
          throw new Error("The server did not provide a document access URL.");
        }

        // PDF.js loads the private PDF directly from Supabase Storage.
        loadingTask = pdfjsLib.getDocument({
          url: access.url,
        });

        const loadedDocument = await loadingTask.promise;

        if (cancelled) {
          await loadedDocument.destroy();
          return;
        }

        setPdf(loadedDocument);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : String(err);

          console.error("[JURY HASH] PDF load failed:", err);
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;

      if (loadingTask) {
        void loadingTask.destroy();
      }
    };
  }, [documentId]);

  return { pdf, loading, error };
}