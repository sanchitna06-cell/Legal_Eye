/**
 * Admin sample data and widget helpers for JURY HASH admin console.
 *
 * This is frontend-only prototype data. The dashboard UI is wired to render
 * from these shapes so the feature is self-contained, and a few actions here
 * are interactive (copy, verify, audit expand, user filters) so the admin
 * screen feels live during demo use.
 */

import React from "react";
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

/**
 * Chart series colors. The hues match the status tokens (info / brass accent /
 * error) and read as CSS variables so the chart re-themes with light/dark.
 */
export const ACTIVITY_COLORS = {
  api: "var(--info)",
  audit: "var(--brass)",
  security: "var(--error)",
} as const;

export const METRICS: MetricCard[] = [
  {
    id: "active-users",
    label: "Active Users",
    value: "12",
    delta: "↑ 2 from last week",
    deltaUp: true,
    icon: Users,
    iconBoxColor: "bg-info/15 text-info",
  },
  {
    id: "total-cases",
    label: "Total Cases",
    value: "47",
    delta: "↑ 12 from last week",
    deltaUp: true,
    icon: FolderKanban,
    iconBoxColor: "bg-success/15 text-success",
  },
  {
    id: "evidence-files",
    label: "Total Evidence Files",
    value: "128",
    delta: "↑ 18 from last week",
    deltaUp: true,
    icon: FileText,
    iconBoxColor: "bg-accent/25 text-accent-foreground",
  },
  {
    id: "security-events",
    label: "Security Events",
    value: "9",
    delta: "↓ 40% from last week",
    deltaUp: false,
    icon: ShieldCheck,
    iconBoxColor: "bg-success/15 text-success",
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
    return React.createElement(TrendingUp, { className: "h-3 w-3 text-success" });
  }
  return React.createElement(TrendingDown, { className: "h-3 w-3 text-error" });
}

export function formatLastLogin(value: string): string {
  if (!value || value === "-") return "-";
  return value;
}

export function statusColorFor(status: string): string {
  if (status === "active") return "text-success";
  if (status === "pending") return "text-warning";
  return "text-error";
}

/** Dot fill for the status indicator — a status token, not a raw hex. */
export function statusBgFor(status: string): string {
  if (status === "active") return "var(--success)";
  if (status === "pending") return "var(--warning)";
  return "var(--error)";
}

export function roleVariantFor(role: string): "default" | "secondary" | "outline" {
  if (role === "ADMIN") return "default";
  if (role === "LAWYER") return "secondary";
  return "outline";
}

export function createUserPayload(
  fullName: string,
  username: string,
  role: "LAWYER" | "ANALYST" = "LAWYER",
): {
  fullName: string;
  username: string;
  role: "LAWYER" | "ANALYST";
  status: "pending" | "active";
} {
  return {
    fullName,
    username,
    role,
    status: "pending",
  };
}
