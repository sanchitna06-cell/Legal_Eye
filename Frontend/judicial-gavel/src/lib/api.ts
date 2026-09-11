import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/user-store";

const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8000";
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  // Prevent multiple simultaneous refresh requests.
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        clearTokens();
        return null;
      }

      const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
        token_type: string;
      };

      setTokens(data.access_token, data.refresh_token);

      return data.access_token;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication required.");
  }

  const makeRequest = (accessToken: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);

    return fetch(input, {
      ...init,
      headers,
    });
  };

  let response = await makeRequest(token);

  // Anything other than 401 is handled by the calling API function.
  if (response.status !== 401) {
    return response;
  }

  const newToken = await refreshAccessToken();

  if (!newToken) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  response = await makeRequest(newToken);

  // Refresh succeeded but the retried request is still unauthorized.
  if (response.status === 401) {
    clearTokens();
    throw new Error("Your session has expired. Please sign in again.");
  }

  return response;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: string;
    username: string;
    full_name: string;
    role: string;
  };
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Authentication failed.");
  }

  return response.json();
}

export interface BackendCase {
  id: string;
  case_number: string;
  title: string;
  description: string | null;
  classification: string;
  department: string | null;
  created_at: string;
}

export async function getCases(): Promise<BackendCase[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/cases`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to load cases.");
  }

  const data = await response.json();

  return data.cases;
}
export interface BackendDocument {
  id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  status: string;
  uploaded_at: string;
}

export async function getCaseDocuments(caseId: string): Promise<BackendDocument[]> {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication required.");
  }

  const response = await authenticatedFetch(
    `${API_BASE_URL}/documents/case/${encodeURIComponent(caseId)}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to load case documents.");
  }

  const data = await response.json();

  return data.documents;
}
export interface CreateCaseInput {
  title: string;
  description: string;
  classification: "general" | "confidential";
}

export interface CreateCaseResponse {
  message: string;
  case: BackendCase;
}

export async function createCase(data: CreateCaseInput): Promise<CreateCaseResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication required.");
  }

  const response = await authenticatedFetch(`${API_BASE_URL}/cases`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to create case.");
  }

  return response.json();
}
export interface DocumentUploadResponse {
  document_id: string;
  case_id: string;
  file_name: string;
  sha256_hash: string;
  blockchain_block_id: string | null;
  status: string;
  message: string;
}

export async function uploadDocument(caseId: string, file: File): Promise<DocumentUploadResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error("You are not authenticated.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await authenticatedFetch(
    `${API_BASE_URL}/documents/upload/${encodeURIComponent(caseId)}`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    let message = "Failed to upload document.";

    try {
      const data = await response.json();
      if (typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Keep the generic error message.
    }

    throw new Error(message);
  }

  return response.json();
}
export async function getDocument(documentId: string): Promise<Blob> {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication required.");
  }

  const response = await authenticatedFetch(
    `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to load document.");
  }

  return response.blob();
}

/* ============================================================
   DOCUMENT PROCESSING STATUS
   ============================================================

   Public contract served by the backend for one document.
   Deliberately minimal: the backend derives this from its
   internal processing state and exposes nothing about jobs,
   storage, or infrastructure. Types live here only. */

export type DocumentProcessingStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export type DocumentProcessingStage =
  "DOCUMENT_ANALYSIS" | "CASE_RECORD" | "INTEGRITY" | "COMPLETE";

export interface DocumentStatusResponse {
  status: DocumentProcessingStatus;
  stage: DocumentProcessingStage;
  message: string;
}

/**
 * Fetch the public processing status for one document.
 *
 * Note: for foreign or unknown documents the backend responds 404
 * without revealing which; this function surfaces the backend's
 * detail message for that case.
 */
export async function getDocumentStatus(documentId: string): Promise<DocumentStatusResponse> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/status`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to load document status.");
  }

  return response.json();
}

/* ============================================================
   DOCUMENT ANALYSIS
   ============================================================

   Case timeline and inconsistency reports come from the
   backend's document-analysis pipeline, which already stores
   Annotation and AnnotationHistory rows. Until the analysis
   endpoints are published, `getDocumentAnalysis` degrades
   gracefully so the workspace renders its structural shell.
   ============================================================ */

export interface DocumentTimelineEvent {
  /** ISO timestamp, e.g. "2026-09-08T10:42:00Z". */
  at: string;
  title: string;
  detail: string;
}

export interface DocumentInconsistency {
  id: string;
  kind: string;
  /** Human-readable location, e.g. "Page 2 · Line 14". */
  location: string;
  description: string;
  severity: "high" | "medium" | "low";
}

export interface DocumentAnalysis {
  timeline: DocumentTimelineEvent[];
  inconsistencies: DocumentInconsistency[];
}

export async function getDocumentAnalysis(documentId: string): Promise<DocumentAnalysis> {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication required.");
  }

  const response = await authenticatedFetch(
    `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/analysis`,
    {
      method: "GET",
    },
  );

  // No published analysis yet (404) — the workspace shell still renders.
  if (response.status === 404) {
    return { timeline: [], inconsistencies: [] };
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to load document analysis.");
  }

  return response.json();
}

export interface DocumentAnalysisSummary {
  inconsistencies: DocumentInconsistency[];
}

/* ============================================================
   DOCUMENT PAGES + ANNOTATIONS
   ============================================================ */

export interface DocumentPage {
  id: string;
  page_number: number;
  extracted_text: string | null;
  extraction_method: string | null;
  ocr_confidence: number | null;
  extraction_status: string | null;
}

export async function getDocumentPages(documentId: string): Promise<DocumentPage[]> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/pages`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to load document pages.");
  }

  const data = (await response.json()) as {
    pages: DocumentPage[];
  };

  return data.pages;
}

/** Free-form geometry/state payload persisted by the backend as JSON. */
export type AnnotationPosition = Record<string, unknown>;

export type AnnotationType = "highlight" | "pen" | "rectangle" | "text" | "note";

export interface Annotation {
  id: string;
  page_id: string;
  created_by: string;
  annotation_type: AnnotationType | string;
  content?: string | null;
  position: AnnotationPosition;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnotationRequest {
  annotation_type: AnnotationType;
  content?: string | null;
  position: AnnotationPosition;
}

export interface UpdateAnnotationRequest {
  annotation_type?: AnnotationType;
  content?: string | null;
  position?: AnnotationPosition;
}

export async function getAnnotations(pageId: string): Promise<Annotation[]> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/annotations/${encodeURIComponent(pageId)}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to fetch annotations.");
  }

  return response.json();
}

export async function createAnnotation(
  pageId: string,
  annotation: CreateAnnotationRequest,
): Promise<Annotation> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/annotations/${encodeURIComponent(pageId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(annotation),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to create annotation.");
  }

  return response.json();
}

export async function updateAnnotation(
  annotationId: string,
  annotation: UpdateAnnotationRequest,
): Promise<Annotation> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/annotations/${encodeURIComponent(annotationId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(annotation),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to update annotation.");
  }

  return response.json();
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/annotations/${encodeURIComponent(annotationId)}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to delete annotation.");
  }
}
