import { getAccessToken } from "@/lib/user-store";

const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8000";

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
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication required.");
  }

  const response = await fetch(`${API_BASE_URL}/cases`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
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

  const response = await fetch(`${API_BASE_URL}/documents/case/${encodeURIComponent(caseId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

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

  const response = await fetch(`${API_BASE_URL}/cases`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to create case.");
  }

  return response.json();
}
export async function uploadDocument(caseId: string, file: File) {
  const token = getAccessToken();

  if (!token) {
    throw new Error("You are not authenticated.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/documents/upload/${encodeURIComponent(caseId)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

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

  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.detail ?? "Failed to load document.");
  }

  return response.blob();
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

  const response = await fetch(
    `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/analysis`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
   ANNOTATIONS
   ============================================================

   The backend already models evidence annotations as

     Annotation        (id, document_id, page, type, position JSONB,
                        content, created_by, created_at)
     AnnotationHistory (audit trail of every annotation revision)

   These functions stay inside the authenticated API flow:
   every request carries the session's bearer token and the
   backend remains responsible for authorization. The frontend
   never touches storage keys or the database directly.
   ============================================================ */

/** Free-form geometry/state payload persisted by the backend as JSON. */
export type AnnotationPosition = Record<string, unknown>;

export type AnnotationType = "highlight" | "pen" | "rectangle" | "text" | "note";

export interface Annotation {
  id: string;
  document_id: string;
  page: number;
  type: AnnotationType | string;
  /** Backend persists this verbatim as the annotation position JSON. */
  position: AnnotationPosition;
  content?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface CreateAnnotationInput {
  documentId: string;
  page: number;
  type: AnnotationType;
  position: AnnotationPosition;
  content?: string | null;
}

function authedJsonInit(token: string, method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

async function parseDetail(response: Response, fallback: string): Promise<never> {
  const error = await response.json().catch(() => null);
  throw new Error(error?.detail ?? fallback);
}

export async function getAnnotations(documentId: string): Promise<Annotation[]> {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication required.");
  }

  const response = await fetch(
    `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/annotations`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (response.status === 404) {
    // No annotations exist for this document yet — that is not an error.
    return [];
  }

  if (!response.ok) {
    return parseDetail(response, "Failed to load annotations.");
  }

  const data = await response.json();
  return data.annotations ?? data;
}

export async function createAnnotation(input: CreateAnnotationInput): Promise<Annotation> {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication required.");
  }

  const { documentId, ...payload } = input;

  const response = await fetch(
    `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/annotations`,
    authedJsonInit(token, "POST", payload),
  );

  if (!response.ok) {
    return parseDetail(response, "Failed to save annotation.");
  }

  return response.json();
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication required.");
  }

  const response = await fetch(
    `${API_BASE_URL}/annotations/${encodeURIComponent(annotationId)}`,
    authedJsonInit(token, "DELETE"),
  );

  if (!response.ok) {
    return parseDetail(response, "Failed to delete annotation.");
  }
}
