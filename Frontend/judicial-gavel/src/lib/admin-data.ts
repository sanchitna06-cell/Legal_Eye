/**
 * Admin sample data and widget helpers for Legal Eye admin console.
 *
 * This is frontend-only prototype data. The dashboard UI is wired to render
 * from these shapes so the feature is self-contained, and a few actions here
 * are interactive (copy, verify, audit expand, user filters) so the admin
 * screen feels live during demo use.
 */

import * as React from "react";
import {
  Users,
  FolderKanban,
  Shield,
  ShieldCheck,
  FileText,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Lock,
  Clock,
} from "lucide-react";
import { generateTemporaryPassword } from "./admin-users";

export interface MetricCard {
  id: string;
  label: string;
  value: string;
  delta: string;
  deltaUp: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconBoxColor: string;
}

export interface ActivityHour {
  hour: string;
  api: number;
  audit: number;
  security: number;
}

export interface SecurityEvent {
  id: string;
  type: "denied" | "blocked" | "success";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  time: string;
  badge: string;
}

export interface HealthService {
  name: string;
  latency: string;
  healthy: boolean;
}

export interface UserRow {
  id: string;
  username: string;
  fullName: string;
  role: string;
  status: string;
  lastLogin: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  result: "success" | "failure" | "warning";
  ip: string;
}

export interface SecurityEventFeedItem {
  id: string;
  type: "denied" | "blocked" | "success";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  time: string;
  badge: string;
}

export interface IntegrityDocument {
  id: string;
  fileName: string;
  caseRef: string;
  uploaded: string;
  size: string;
  sha256: string;
  blockNumber: string;
  verifiedBy: string;
  status: "Verified" | "Pending";
}

export interface PipelineEvent {
  id: string;
  time: string;
  service: string;
  event: string;
  status: "delivered" | "processing" | "failed" | "queued";
  latency: string;
}

export interface SampleDocument {
  fileName: string;
  caseRef: string;
  uploaded: string;
  sha256: string;
  blockHash: string;
  blockNumber: string;
  status: string;
  modification: string;
  deletion: string;
  annotations: string;
  verifiedBy: string;
  timestamp: string;
}

export const ACTIVITY_COLORS = {
  api: "#38bdf8",
  audit: "#a78bfa",
  security: "#f87171",
} as const;

export const METRICS: MetricCard[] = [
  {
    id: "active-users",
    label: "Active Users",
    value: "12",
    delta: "↑ 2 from last week",
    deltaUp: true,
    icon: Users,
    iconBoxColor: "bg-[#2a3f5e]",
  },
  {
    id: "total-cases",
    label: "Total Cases",
    value: "47",
    delta: "↑ 12 from last week",
    deltaUp: true,
    icon: FolderKanban,
    iconBoxColor: "bg-[#1f4d3a]",
  },
  {
    id: "evidence-files",
    label: "Total Evidence Files",
    value: "128",
    delta: "↑ 18 from last week",
    deltaUp: true,
    icon: FileText,
    iconBoxColor: "bg-[#3a2a5e]",
  },
  {
    id: "security-events",
    label: "Security Events",
    value: "9",
    delta: "↓ 40% from last week",
    deltaUp: false,
    icon: ShieldCheck,
    iconBoxColor: "bg-[#1f4d3a]",
  },
];

export const ACTIVITY_24H: ActivityHour[] = [
  { hour: "00:00", api: 6, audit: 2, security: 0 },
  { hour: "02:00", api: 9, audit: 3, security: 1 },
  { hour: "04:00", api: 14, audit: 5, security: 2 },
  { hour: "06:00", api: 21, audit: 7, security: 3 },
  { hour: "08:00", api: 34, audit: 11, security: 5 },
  { hour: "10:00", api: 48, audit: 16, security: 7 },
  { hour: "12:00", api: 58, audit: 19, security: 8 },
  { hour: "14:00", api: 51, audit: 17, security: 7 },
  { hour: "16:00", api: 43, audit: 14, security: 6 },
  { hour: "18:00", api: 32, audit: 11, security: 5 },
  { hour: "20:00", api: 21, audit: 8, security: 4 },
];

export const RECENT_SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: "se-1",
    type: "denied",
    icon: AlertTriangle,
    title: "Unauthorized Document Access",
    detail: "User: lawyer_b | Document: 83ce...7a2d",
    time: "22:03:14",
    badge: "DENIED",
  },
  {
    id: "se-2",
    type: "blocked",
    icon: AlertTriangle,
    title: "Invalid API Token",
    detail: "IP: 192.168.1.45",
    time: "21:47:09",
    badge: "BLOCKED",
  },
  {
    id: "se-3",
    type: "blocked",
    icon: AlertTriangle,
    title: "Multiple Failed Logins",
    detail: "User: unknown",
    time: "21:12:33",
    badge: "BLOCKED",
  },
  {
    id: "se-4",
    type: "success",
    icon: CheckCircle,
    title: "User Account Created",
    detail: "User: lawyer_c",
    time: "20:51:22",
    badge: "SUCCESS",
  },
  {
    id: "se-5",
    type: "success",
    icon: CheckCircle,
    title: "Document Uploaded",
    detail: "User: lawyer_a | Case: LL-2026-01",
    time: "19:28:11",
    badge: "SUCCESS",
  },
];

export const SYSTEM_HEALTH: HealthService[] = [
  { name: "Database", latency: "34 ms", healthy: true },
  { name: "Event Bus", latency: "12 ms", healthy: true },
  { name: "File Storage", latency: "28 ms", healthy: true },
  { name: "Blockchain Service", latency: "41 ms", healthy: true },
  { name: "OCR Service", latency: "63 ms", healthy: true },
  { name: "NER Service", latency: "71 ms", healthy: true },
  { name: "API Server", latency: "19 ms", healthy: true },
  { name: "Search Index", latency: "22 ms", healthy: true },
  { name: "Notification Service", latency: "9 ms", healthy: true },
];

export const SECURITY_EVENTS_FEED: SecurityEventFeedItem[] = [
  {
    id: "sef-1",
    type: "denied",
    severity: "high",
    title: "Unauthorized Document Access",
    detail: "User: lawyer_b | Document: 83ce...7a2d | Case: LL-2026-01",
    time: "22:03:14",
    badge: "DENIED",
  },
  {
    id: "sef-2",
    type: "blocked",
    severity: "high",
    title: "Invalid API Token",
    detail: "IP: 192.168.1.45 | Endpoint: /api/v1/documents",
    time: "21:47:09",
    badge: "BLOCKED",
  },
  {
    id: "sef-3",
    type: "blocked",
    severity: "medium",
    title: "Multiple Failed Logins",
    detail: "User: unknown | 6 attempts from 10.0.4.22 — account lockout triggered",
    time: "21:12:33",
    badge: "BLOCKED",
  },
  {
    id: "sef-4",
    type: "success",
    severity: "low",
    title: "User Account Created",
    detail: "User: lawyer_c | Created by: System Administrator",
    time: "20:51:22",
    badge: "SUCCESS",
  },
  {
    id: "sef-5",
    type: "success",
    severity: "low",
    title: "Document Uploaded",
    detail: "User: lawyer_a | Case: LL-2026-01 | Evidence_01.pdf",
    time: "19:28:11",
    badge: "SUCCESS",
  },
  {
    id: "sef-6",
    type: "denied",
    severity: "medium",
    title: "Privilege Escalation Attempt",
    detail: "User: analyst_1 attempted ADMIN role assignment — denied by policy",
    time: "18:44:57",
    badge: "DENIED",
  },
  {
    id: "sef-7",
    type: "blocked",
    severity: "high",
    title: "Rate Limit Exceeded",
    detail: "IP: 203.0.113.87 | 240 req/min on /api/v1/search — throttled",
    time: "17:20:05",
    badge: "BLOCKED",
  },
  {
    id: "sef-8",
    type: "success",
    severity: "low",
    title: "Integrity Check Passed",
    detail: "Nightly sweep: 128 documents verified against blockchain",
    time: "16:00:00",
    badge: "SUCCESS",
  },
];

export const AUDIT_LOGS: AuditLogEntry[] = [
  { id: "al-01", timestamp: "05 Sep 2026, 22:10:41", actor: "admin", action: "SESSION_LOGIN", target: "Admin Console", result: "success", ip: "10.0.0.1" },
  { id: "al-02", timestamp: "05 Sep 2026, 21:58:07", actor: "lawyer_a", action: "DOCUMENT_UPLOAD", target: "Evidence_01.pdf → LL-2026-01", result: "success", ip: "10.0.4.18" },
  { id: "al-03", timestamp: "05 Sep 2026, 21:47:09", actor: "unknown", action: "API_AUTH_FAILURE", target: "/api/v1/documents", result: "failure", ip: "192.168.1.45" },
  { id: "al-04", timestamp: "05 Sep 2026, 21:12:33", actor: "unknown", action: "LOGIN_LOCKOUT", target: "account lockout after 6 failed attempts", result: "warning", ip: "10.0.4.22" },
  { id: "al-05", timestamp: "05 Sep 2026, 20:51:22", actor: "admin", action: "USER_CREATE", target: "lawyer_c (LAWYER)", result: "success", ip: "10.0.0.1" },
  { id: "al-06", timestamp: "05 Sep 2026, 20:03:55", actor: "lawyer_b", action: "CASE_VIEW", target: "LL-2026-01", result: "success", ip: "10.0.4.31" },
  { id: "al-07", timestamp: "05 Sep 2026, 19:28:11", actor: "lawyer_a", action: "CASE_OPEN", target: "LL-2026-01", result: "success", ip: "10.0.4.18" },
  { id: "al-08", timestamp: "05 Sep 2026, 18:44:57", actor: "analyst_1", action: "ROLE_CHANGE_DENIED", target: "attempted ADMIN promotion", result: "failure", ip: "10.0.6.09" },
  { id: "al-09", timestamp: "05 Sep 2026, 17:20:05", actor: "system", action: "RATE_LIMIT", target: "203.0.113.87 throttled on /api/v1/search", result: "warning", ip: "203.0.113.87" },
  { id: "al-10", timestamp: "05 Sep 2026, 16:00:00", actor: "system", action: "INTEGRITY_SWEEP", target: "128 documents verified", result: "success", ip: "127.0.0.1" },
  { id: "al-11", timestamp: "04 Sep 2026, 23:41:18", actor: "admin", action: "SETTINGS_UPDATE", target: "security.emailAlerts → on", result: "success", ip: "10.0.0.1" },
  { id: "al-12", timestamp: "04 Sep 2026, 22:15:02", actor: "lawyer_b", action: "DOCUMENT_DOWNLOAD", target: "FIR_Copy_114.pdf → LL-2026-01", result: "success", ip: "10.0.4.31" },
];

export const INTEGRITY_DOCUMENTS: IntegrityDocument[] = [
  {
    id: "doc-01",
    fileName: "Evidence_01.pdf",
    caseRef: "LL-2026-01",
    uploaded: "05 Sep 2026, 15:29",
    size: "2.4 MB",
    sha256: "a8f4e3c2d1b9f0a7c6e5d4b3a2f1c9e8d7b6a5f4e3c2d1b9a8f7e6d5c4b3a291c2",
    blockNumber: "#42",
    verifiedBy: "System Administrator",
    status: "Verified",
  },
  {
    id: "doc-02",
    fileName: "FIR_Copy_114.pdf",
    caseRef: "LL-2026-01",
    uploaded: "04 Sep 2026, 18:02",
    size: "1.1 MB",
    sha256: "3d7c1f9b2e6a4d8c0f5b1a7e3c9d2f6a8b4e0c7d1f3a5b9e2c6d8f0a4b7e1c3d5",
    blockNumber: "#39",
    verifiedBy: "Blockchain Service",
    status: "Verified",
  },
  {
    id: "doc-03",
    fileName: "Witness_Statement_S3.docx",
    caseRef: "LL-2026-02",
    uploaded: "04 Sep 2026, 11:47",
    size: "340 KB",
    sha256: "9e2b7f4a1c8d3e6b0a5f2c9d7e1b4a8f3c6d0e2b5a8f1c4d7e0b3a6f9c2d5e8b1",
    blockNumber: "#37",
    verifiedBy: "Blockchain Service",
    status: "Verified",
  },
  {
    id: "doc-04",
    fileName: "Court_Order_2026_09.pdf",
    caseRef: "LL-2026-02",
    uploaded: "03 Sep 2026, 16:33",
    size: "780 KB",
    sha256: "5b8f2e7c1a4d9f3b6e0c2a7d5f1b8e4c9a3d6f0b2e7c4a1d8f3b6e9c0a2d5f7b4",
    blockNumber: "#33",
    verifiedBy: "System Administrator",
    status: "Verified",
  },
  {
    id: "doc-05",
    fileName: "Forensic_Report_FX22.pdf",
    caseRef: "LL-2026-03",
    uploaded: "03 Sep 2026, 09:15",
    size: "4.9 MB",
    sha256: "c1f7a3e9b5d2f8c4a0e6b3d9f5a1c7e2b8d4f0a6c3e9b5d1f7a3c8e4b0d6f2a9",
    blockNumber: "#31",
    verifiedBy: "—",
    status: "Pending",
  },
  {
    id: "doc-06",
    fileName: "Property_Deed_Scan.png",
    caseRef: "LL-2026-03",
    uploaded: "02 Sep 2026, 14:58",
    size: "5.6 MB",
    sha256: "f4a9c2e7b1d6f3a8c0e5b2d7f4a9c1e6b3d8f0a5c2e7b4d9f1a6c3e8b0d5f2a7",
    blockNumber: "#28",
    verifiedBy: "Blockchain Service",
    status: "Verified",
  },
];

export const EVENT_PIPELINE: PipelineEvent[] = [
  { id: "ep-01", time: "22:10:41", service: "Auth Service", event: "login.success → audit.outbox", status: "delivered", latency: "8 ms" },
  { id: "ep-02", time: "21:58:09", service: "Upload Service", event: "document.stored → blockchain.queue", status: "delivered", latency: "12 ms" },
  { id: "ep-03", time: "21:58:12", service: "Blockchain Service", event: "block.anchor #42 confirmed", status: "delivered", latency: "41 ms" },
  { id: "ep-04", time: "21:47:09", service: "API Gateway", event: "auth.failure → security.feed", status: "delivered", latency: "4 ms" },
  { id: "ep-05", time: "21:12:33", service: "Auth Service", event: "lockout.triggered → notification.queue", status: "processing", latency: "—" },
  { id: "ep-06", time: "20:51:22", service: "User Service", event: "user.created → audit.outbox", status: "delivered", latency: "9 ms" },
  { id: "ep-07", time: "20:44:10", service: "OCR Service", event: "ocr.batch #118 → index.queue", status: "queued", latency: "—" },
  { id: "ep-08", time: "19:28:11", service: "Upload Service", event: "virus.scan passed → storage.commit", status: "delivered", latency: "27 ms" },
  { id: "ep-09", time: "18:44:57", service: "User Service", event: "role.change.denied → security.feed", status: "delivered", latency: "5 ms" },
  { id: "ep-10", time: "17:20:05", service: "API Gateway", event: "rate.limit → notification.queue (retry 2/5)", status: "failed", latency: "timeout" },
];

export const USER_MANAGEMENT: UserRow[] = [
  {
    id: "u-admin",
    username: "admin",
    fullName: "System Administrator",
    role: "ADMIN",
    status: "active",
    lastLogin: "05 Sep 2026, 22:10",
  },
  {
    id: "u-lawyer_a",
    username: "lawyer_a",
    fullName: "Aarav Mehta",
    role: "LAWYER",
    status: "active",
    lastLogin: "05 Sep 2026, 21:14",
  },
  {
    id: "u-lawyer_b",
    username: "lawyer_b",
    fullName: "Priya Sharma",
    role: "LAWYER",
    status: "active",
    lastLogin: "05 Sep 2026, 20:03",
  },
  {
    id: "u-lawyer_c",
    username: "lawyer_c",
    fullName: "Rohit Verma",
    role: "LAWYER",
    status: "pending",
    lastLogin: "-",
  },
  {
    id: "u-analyst_1",
    username: "analyst_1",
    fullName: "Data Analyst",
    role: "ANALYST",
    status: "inactive",
    lastLogin: "02 Sep 2026, 11:22",
  },
];

export const SAMPLE_DOCUMENT: SampleDocument = {
  fileName: "Evidence_01.pdf",
  caseRef: "LL-2026-01",
  uploaded: "05 Sep 2026, 15:29",
  sha256: "a8f4e3c2d1b9f0a7c6e5d4b3a2f1c9e8d7b6a5f4e3c2d1b9a8f7e6d5c4b3a291c2",
  blockHash: "7b21c9e8f4a3b6c2d9e1f5a8b6c9d2e7f4a1b8c3d6e9f2a5b8c1d4e7f3a6b9c2d5",
  blockNumber: "#42",
  status: "Verified",
  modification: "Not Permitted",
  deletion: "Not Permitted",
  annotations: "Separate Layer",
  verifiedBy: "System Administrator",
  timestamp: "05 Sep 2026, 15:31",
};

export function createTemporaryPassword(): string {
  return generateTemporaryPassword(10);
}

export function getMetricDeltaIcon(metric: MetricCard): React.ReactNode {
  if (metric.deltaUp) {
    return React.createElement(TrendingUp, { className: "h-3 w-3 text-emerald-400" });
  }
  return React.createElement(TrendingDown, { className: "h-3 w-3 text-rose-400" });
}

export function formatLastLogin(value: string): string {
  if (!value || value === "-") return "-";
  return value;
}

export function statusColorFor(status: string): string {
  if (status === "active") return "text-emerald-400";
  if (status === "pending") return "text-amber-400";
  return "text-red-400";
}

export function statusBgFor(status: string): string {
  if (status === "active") return "#34d399";
  if (status === "pending") return "#fbbf24";
  return "#f87171";
}

export function roleVariantFor(role: string): "default" | "secondary" | "outline" {
  if (role === "ADMIN") return "default";
  if (role === "LAWYER") return "secondary";
  return "outline";
}

export function createUserPayload(
  fullName: string,
  username: string,
  role: "LAWYER" | "ANALYST" = "LAWYER"
): { fullName: string; username: string; role: "LAWYER" | "ANALYST"; status: "pending" | "active" } {
  return {
    fullName,
    username,
    role,
    status: "pending",
  };
}
