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
    must_change_password: boolean;
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
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/auth/change-password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? "Failed to change password.",
    );
  }
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
export interface DocumentAccessResponse {
  document_id: string;
  file_name: string;
  mime_type: string;
  expires_in: number;
  url: string;
}

export async function getDocument(
  documentId: string
): Promise<DocumentAccessResponse> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}`,
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? "Failed to load document."
    );
  }

  return response.json();
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


export interface DocumentAnalysisSummary {
  inconsistencies: DocumentInconsistency[];
}

export async function getDocumentAnalysis(
  documentId: string
): Promise<DocumentAnalysis> {
  // Analysis endpoints are not available in the current backend yet.
  // Return an empty analysis so the workspace can render its structural shell.
  void documentId;

  return {
    timeline: [],
    inconsistencies: [],
  };
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
/* ============================================================
   CALENDAR
   ============================================================ */

export type CalendarEventType =
  | "HEARING"
  | "FILING_DEADLINE"
  | "CLIENT_MEETING"
  | "COURT_APPEARANCE"
  | "REMINDER"
  | "OTHER";

export interface CalendarEvent {
  id: string;
  lawyer_id: string;
  case_id: string | null;

  title: string;
  description: string | null;
  event_type: CalendarEventType;

  start_at: string;
  end_at: string | null;

  all_day: boolean;
  reminder_minutes: number | null;

  created_at: string;
  updated_at: string;
}

export interface CreateCalendarEventInput {
  title: string;
  description?: string | null;
  event_type?: CalendarEventType;

  start_at: string;
  end_at?: string | null;

  all_day?: boolean;
  reminder_minutes?: number | null;

  case_id?: string | null;
}

export interface UpdateCalendarEventInput {
  title?: string;
  description?: string | null;
  event_type?: CalendarEventType;

  start_at?: string;
  end_at?: string | null;

  all_day?: boolean;
  reminder_minutes?: number | null;

  case_id?: string | null;
}

export async function getCalendarEvents(
  start?: string,
  end?: string,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();

  if (start) {
    params.set("start", start);
  }

  if (end) {
    params.set("end", end);
  }

  const query = params.toString();

  const response = await authenticatedFetch(
    `${API_BASE_URL}/calendar/events${query ? `?${query}` : ""}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? "Failed to load calendar events.",
    );
  }

  return response.json();
}

export async function createCalendarEvent(
  data: CreateCalendarEventInput,
): Promise<CalendarEvent> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/calendar/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? "Failed to create calendar event.",
    );
  }

  return response.json();
}

export async function updateCalendarEvent(
  eventId: string,
  data: UpdateCalendarEventInput,
): Promise<CalendarEvent> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/calendar/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? "Failed to update calendar event.",
    );
  }

  return response.json();
}

export async function deleteCalendarEvent(
  eventId: string,
): Promise<void> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/calendar/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? "Failed to delete calendar event.",
    );
  }
}
/* ============================================================
   ADMIN API
   ============================================================ */

export interface AdminOverviewResponse {
  users: {
    total: number;
    active: number;
  };
  cases: {
    total: number;
  };
  documents: {
    total: number;
  };
  document_integrity: {
    total_records: number;
  };
  blockchain: {
    total_blocks: number;
  };
  processing: {
    total_jobs: number;
  };
  audit: {
    total_logs: number;
  };
}

export interface AdminAuditLog {
  id: string;
  user_id: string;
  case_id: string | null;
  document_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  request_id: string | null;
}

export interface AdminUsersResponse {
  users: AdminUser[];
}

export interface AdminUser {
  id: string;
  username: string;
  full_name: string;
  role: "ADMIN" | "LAWYER";
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login: string | null;
}
export interface CreateAdminUserInput {
  username: string;
  full_name: string;
  temporary_password: string;
  is_active: boolean;
}

export interface CreateAdminUserResponse {
  message: string;
  user: AdminUser;
}

export interface AdminDocumentIntegrity {
  id: string;
  case_file_id: string;
  sha256_hash: string;
  algorithm: string;
  blockchain_block_id: string | null;
  blockchain_hash: string | null;
  anchored_at: string | null;
  created_at: string;
}

export interface AdminBlockchainBlock {
  id: string;
  block_index: number;
  created_at: string;
  action: string;
  document_id: string | null;
  document_hash: string | null;
  previous_hash: string;
  hash: string;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AdminEventPipeline {
  total_events: number;
  total_handlers: number;
  events: Record<string, string[]>;
}

export interface AdminSystemHealth {
  status: "healthy" | "degraded" | "critical";
  database: "healthy" | "degraded" | "critical";
  blockchain: "healthy" | "degraded" | "critical";
  event_pipeline: "healthy" | "degraded" | "critical";
  processing: Record<string, number>;
}

export interface AdminSecurityControl {
  name: string;
  status: string;
  description: string;
}

export interface AdminSecurityControls {
  overall_status: string;
  controls: AdminSecurityControl[];
}
export interface AdminSecurityEvent {
  id: string;
  event_type: string;
  severity: "low" | "medium" | "high" | string;
  user_id: string | null;
  ip_address: string | null;
  endpoint: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}
export interface AdminSecurityEvent {
  id: string;
  event_type: string;
  severity: "low" | "medium" | "high" | string;
  user_id: string | null;
  ip_address: string | null;
  endpoint: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}
async function adminGet<T>(
  path: string,
  errorMessage: string,
): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? errorMessage);
  }

  return response.json() as Promise<T>;
}

export async function getAdminOverview(): Promise<AdminOverviewResponse> {
  return adminGet<AdminOverviewResponse>(
    "/admin/overview",
    "Failed to load admin overview.",
  );
}

export async function getAdminAuditLogs(): Promise<AdminAuditLog[]> {
  const data = await adminGet<{ logs: AdminAuditLog[] }>(
    "/admin/audit-logs",
    "Failed to load audit logs.",
  );

  return data.logs;
}


export async function getAdminUsers(
  skip = 0,
  limit = 100,
): Promise<AdminUser[]> {
  const data = await adminGet<{ users: AdminUser[] }>(
    `/admin/users?skip=${skip}&limit=${limit}`,
    "Failed to load users.",
  );

  return data.users;
}
export async function createAdminUser(
  data: CreateAdminUserInput,
): Promise<CreateAdminUserResponse> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/admin/users`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? "Failed to create user.",
    );
  }

  return response.json();
}
export async function deleteAdminUser(userId: string): Promise<void> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? "Failed to delete user.",
    );
  }
}
export async function deactivateAdminUser(userId: string): Promise<void> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/admin/users/${encodeURIComponent(userId)}/deactivate`,
    {
      method: "PATCH",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? "Failed to deactivate user.",
    );
  }
}
export async function activateAdminUser(userId: string): Promise<void> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/admin/users/${encodeURIComponent(userId)}/activate`,
    {
      method: "PATCH",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? "Failed to activate user.",
    );
  }
}

export async function getAdminDocumentIntegrity(
  skip = 0,
  limit = 100,
): Promise<AdminDocumentIntegrity[]> {
  const data = await adminGet<{ records: AdminDocumentIntegrity[] }>(
    `/admin/document-integrity?skip=${skip}&limit=${limit}`,
    "Failed to load document integrity records.",
  );

  return data.records;
}

export async function getAdminBlockchain(
  skip = 0,
  limit = 100,
): Promise<AdminBlockchainBlock[]> {
  const data = await adminGet<{ blocks: AdminBlockchainBlock[] }>(
    `/admin/blockchain?skip=${skip}&limit=${limit}`,
    "Failed to load blockchain records.",
  );

  return data.blocks;
}

export async function getAdminEventPipeline(): Promise<AdminEventPipeline> {
  return adminGet<AdminEventPipeline>(
    "/admin/event-pipeline",
    "Failed to load event pipeline.",
  );
}

export async function getAdminSystemHealth(): Promise<AdminSystemHealth> {
  return adminGet<AdminSystemHealth>(
    "/admin/system-health",
    "Failed to load system health.",
  );
}

export async function getAdminSecurityControls(): Promise<AdminSecurityControls> {
  return adminGet<AdminSecurityControls>(
    "/admin/security-controls",
    "Failed to load security controls.",
  );
}
export async function getAdminSecurityEvents(): Promise<AdminSecurityEvent[]> {
  const data = await adminGet<{ events: AdminSecurityEvent[] }>(
    "/admin/security-events",
    "Failed to load security events.",
  );

  return data.events;
}