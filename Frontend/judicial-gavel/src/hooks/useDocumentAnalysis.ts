import { useEffect, useState } from "react";
import { getDocumentAnalysis, type DocumentAnalysis } from "@/lib/api";

export interface DocumentAnalysisState {
  analysis: DocumentAnalysis | null;
  analysisLoading: boolean;
  analysisError: string | null;
}

export function useDocumentAnalysis(documentId: string): DocumentAnalysisState {
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setAnalysis(null);
    setAnalysisLoading(true);
    setAnalysisError(null);

    async function loadAnalysis() {
      try {
        const result = await getDocumentAnalysis(documentId);

        if (!cancelled) {
          setAnalysis(result);
        }
      } catch (error) {
        if (!cancelled) {
          setAnalysisError(
            error instanceof Error ? error.message : "Failed to load case timeline.",
          );
        }
      } finally {
        if (!cancelled) {
          setAnalysisLoading(false);
        }
      }
    }

    loadAnalysis();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  return {
    analysis,
    analysisLoading,
    analysisError,
  };
}
