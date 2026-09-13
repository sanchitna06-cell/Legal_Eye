/**
 * Case data types and frontend case utilities.
 *
 * Real case records are provided by the backend API.
 * This file contains only shared types, category/status definitions,
 * and search/filter helpers.
 */

export type CaseStatus = "Active" | "Reserved" | "Disposed" | "Appeal";

/**
 * Confidentiality classification — independent of lifecycle status.
 */
export type CaseClassification = "general" | "confidential";

/** Lifecycle choices offered by the status editor. */
export const STATUS_OPTIONS: CaseStatus[] = [
  "Reserved",
  "Active",
  "Appeal",
  "Disposed",
];

/** Confidentiality choices offered by the classification editor. */
export const CLASSIFICATION_OPTIONS: CaseClassification[] = [
  "general",
  "confidential",
];

export const CLASSIFICATION_LABEL: Record<CaseClassification, string> = {
  general: "General",
  confidential: "Confidential",
};

export function isConfidential(
  record: Pick<CaseRecord, "classification">,
): boolean {
  return record.classification === "confidential";
}

/**
 * Case-type categories available throughout the application.
 *
 * Keep this list as the single frontend source of truth for case categories.
 */
export type CaseCategory =
  | "Criminal"
  | "Civil"
  | "Constitutional";

export const CASE_CATEGORIES: CaseCategory[] = [
  "Criminal",
  "Civil",
  "Constitutional",
];

/** Tailwind tones for the status label. */
export const STATUS_TONE: Record<CaseStatus, string> = {
  Active: "text-success border-success/40",
  Reserved: "text-brass border-brass/40",
  Appeal: "text-foreground border-border",
  Disposed: "text-muted-foreground border-border",
};

/** Statuses considered open matters. */
export const OPEN_STATUSES: CaseStatus[] = [
  "Active",
  "Reserved",
  "Appeal",
];

export function isOpenMatter(
  record: Pick<CaseRecord, "archived" | "status">,
): boolean {
  return !record.archived && OPEN_STATUSES.includes(record.status);
}

export interface CaseParty {
  role: string;
  name: string;
}

export interface CaseEvent {
  date: string;
  title: string;
  note: string;
}

export interface CaseRecord {
  id: string;
  title: string;
  court: string;
  bench: string;
  status: CaseStatus;
  filed: string;
  updated: string;
  parties: CaseParty[];
  subject: string;
  history: CaseEvent[];
  summary: string;
  issues: string[];
  authorities: string[];

  /** National unique case number issued under the eCourts CNR scheme. */
  cnr?: string;

  /** First Information Report reference for criminal matters. */
  firNo?: string;

  /** Police station of record for the FIR. */
  policeStation?: string;

  /** Confidentiality classification. */
  classification: CaseClassification;

  /** Case-type category. */
  category?: CaseCategory;

  /** Quick-access matter surfaced in the sidebar. */
  pinned?: boolean;

  /** Completed matter retained for reference. */
  archived?: boolean;
}

/**
 * No frontend mock cases.
 *
 * Real cases must come from the backend API.
 *
 * This export is retained temporarily for compatibility with components
 * that may still import CASES. It should not be used as application data.
 */
export const CASES: CaseRecord[] = [];

/**
 * Structured search over the case archive.
 *
 * The dashboard exposes one free-text search bar plus per-field
 * refinement filters.
 */

const PLAINTIFF_ROLES = new Set([
  "Plaintiff",
  "Petitioner",
  "Applicant",
  "Claimant",
  "Appellant",
  "Prosecution",
  "Complainant",
]);

const DEFENDANT_ROLES = new Set([
  "Defendant",
  "Respondent",
  "Accused",
  "Caveator",
]);

export function plaintiffNames(record: CaseRecord): string[] {
  return record.parties
    .filter((party) => PLAINTIFF_ROLES.has(party.role))
    .map((party) => party.name);
}

export function defendantNames(record: CaseRecord): string[] {
  return record.parties
    .filter((party) => DEFENDANT_ROLES.has(party.role))
    .map((party) => party.name);
}

function yearOf(filed: string): string {
  const match = filed.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

export interface CaseSearchFields {
  /** Case name — matches the matter title. */
  name: string;

  /** Case number / year. */
  caseNo: string;

  /** Plaintiff / complainant side party names. */
  plaintiff: string;

  /** Defendant side party names. */
  defendant: string;

  /** FIR number for criminal matters. */
  fir: string;

  /** Police station of record. */
  policeStation: string;

  /** eCourts CNR number. */
  cnr: string;
}

export const EMPTY_CASE_SEARCH: CaseSearchFields = {
  name: "",
  caseNo: "",
  plaintiff: "",
  defendant: "",
  fir: "",
  policeStation: "",
  cnr: "",
};

/**
 * Builds the searchable text representation of a case.
 */
export function caseSearchText(record: CaseRecord): string {
  return [
    record.id,
    yearOf(record.filed),
    record.title,
    record.court,
    record.bench,
    record.subject,
    record.status,
    record.category ?? "",
    ...record.parties.flatMap((party) => [
      party.name,
      party.role,
    ]),
    record.cnr ?? "",
    record.firNo ?? "",
    record.policeStation ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function matchesAny(haystack: string[], needle: string): boolean {
  const query = needle.trim().toLowerCase();

  if (!query) {
    return true;
  }

  return haystack.some((value) =>
    value.toLowerCase().includes(query),
  );
}

/**
 * AND-combined per-field matching for the refinement panel.
 */
export function caseMatchesFilters(
  record: CaseRecord,
  filters: CaseSearchFields,
): boolean {
  return (
    matchesAny([record.title], filters.name) &&
    matchesAny(
      [record.id, yearOf(record.filed)],
      filters.caseNo,
    ) &&
    matchesAny(
      plaintiffNames(record),
      filters.plaintiff,
    ) &&
    matchesAny(
      defendantNames(record),
      filters.defendant,
    ) &&
    matchesAny(
      [record.firNo ?? ""],
      filters.fir,
    ) &&
    matchesAny(
      [record.policeStation ?? ""],
      filters.policeStation,
    ) &&
    matchesAny(
      [record.cnr ?? ""],
      filters.cnr,
    )
  );
}