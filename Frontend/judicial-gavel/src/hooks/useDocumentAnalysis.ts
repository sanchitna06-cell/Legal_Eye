import { useEffect, useState } from "react";
import {
  getAnnotations,
  getDocumentAnalysis,
  type Annotation,
  type DocumentAnalysis,
} from "@/lib/api";

/**
 * Analysis state for the document workspace.
 *
 * The backend owns annotation and analysis data (Annotation /
 * AnnotationHistory rows, analysis pipeline). Until the analysis
 * endpoint is published, `analysis` stays null and the workspace
 * renders its structural shell — no fabricated evidence data.
 */
export interface DocumentAnalysisState {
  /** Null while loading; empty arrays when the backend has none yet. */
  analysis: DocumentAnalysis | null;
  analysisLoading: boolean;
  analysisError: string | null;

  annotations: Annotation[];
  annotationsLoading: boolean;
  annotationsError: string | null;
}

/**
 * Loads analysis + annotations for one document through the
 * authenticated API. Reruns when the document changes.
 */
export function useDocumentAnalysis(documentId: string): DocumentAnalysisState {
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationsLoading, setAnnotationsLoading] = useState(true);
  const [annotationsError, setAnnotationsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setAnalysis(null);
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnnotations([]);
    setAnnotationsLoading(true);
    setAnnotationsError(null);

    async function loadAnalysis() {
      try {
        const result = await getDocumentAnalysis(documentId);
        if (!cancelled) setAnalysis(result);
      } catch (error) {
        if (!cancelled) {
          setAnalysisError(
            error instanceof Error ? error.message : "Failed to load case timeline.",
          );
        }
      } finally {
        if (!cancelled) setAnalysisLoading(false);
      }
    }

    async function loadAnnotations() {
      try {
        const result = await getAnnotations(documentId);
        if (!cancelled) setAnnotations(result);
      } catch (error) {
        if (!cancelled) {
          setAnnotationsError(
            error instanceof Error ? error.message : "Failed to load annotations.",
          );
        }
      } finally {
        if (!cancelled) setAnnotationsLoading(false);
      }
    }

    loadAnalysis();
    loadAnnotations();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  return {
    analysis,
    analysisLoading,
    analysisError,
    annotations,
    annotationsLoading,
    annotationsError,
  };
}
