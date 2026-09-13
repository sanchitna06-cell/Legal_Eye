import React from "react";
import {
  Activity,
  AlertTriangle,
  FileCheck2,
  FileText,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  getAdminOverview,
  getAdminSecurityEvents,
  getAdminSystemHealth,
  getAdminUsers,
  type AdminOverviewResponse,
  type AdminSecurityEvent,
  type AdminSystemHealth,
  type AdminUser,
} from "@/lib/api";

import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui";


const linkGhostClass = "admin-dashboard-link";


export function AdminDashboard() {
  const [overview, setOverview] =
    React.useState<AdminOverviewResponse | null>(null);

  const [systemHealth, setSystemHealth] =
    React.useState<AdminSystemHealth | null>(null);

  const [users, setUsers] =
    React.useState<AdminUser[]>([]);

  const [securityEvents, setSecurityEvents] =
    React.useState<AdminSecurityEvent[]>([]);

  const [loading, setLoading] =
    React.useState(true);

  const [error, setError] =
    React.useState<string | null>(null);


  const loadDashboard = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        overviewData,
        healthData,
        securityEventsData,
        usersData,
      ] = await Promise.all([
        getAdminOverview(),
        getAdminSystemHealth(),
        getAdminSecurityEvents(),
        getAdminUsers(0, 5),
      ]);

      setOverview(overviewData);
      setSystemHealth(healthData);
      setSecurityEvents(securityEventsData);
      setUsers(usersData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load admin dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, []);


  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);


  const highSeverityEvents =
    securityEvents.filter(
      (event) => event.severity === "high",
    ).length;

  const mediumSeverityEvents =
    securityEvents.filter(
      (event) => event.severity === "medium",
    ).length;

  const recentSecurityEvents =
    securityEvents.length;


  return (
    <div>
      {/* ============================================================
          HEADER
          ============================================================ */}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#8ea3bb]">
            JURY HASH · ADMIN CONSOLE
          </p>

          <h1 className="mt-1 font-display text-3xl leading-tight text-white">
            Admin Dashboard
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-[#8ea3bb]">
            Monitor system activity, security posture, and the
            integrity of Jury Hash.
          </p>
        </div>

        <div className="flex items-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="admin-dashboard-refresh"
          >
            <RefreshCw
              className={`mr-2 h-3.5 w-3.5 ${
                loading ? "animate-spin" : ""
              }`}
            />

            Refresh
          </Button>
        </div>
      </div>


      {/* ============================================================
          ERROR
          ============================================================ */}

      {error && (
        <div className="admin-alert admin-alert--danger mb-6 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

          <div>
            <p className="text-sm font-medium">
              Failed to load dashboard
            </p>

            <p className="mt-1 text-xs">
              {error}
            </p>
          </div>
        </div>
      )}


      {/* ============================================================
          ATTENTION REQUIRED
          ============================================================ */}

      {!loading && (
        <div className="admin-attention">
          <div className="admin-attention__header">
            <div className="admin-attention__title">
              <AlertTriangle className="admin-attention__icon" />

              <div>
                <p className="admin-attention__heading">
                  Attention Required
                </p>

                <p className="admin-attention__description">
                  Security events that may require administrator review.
                </p>
              </div>
            </div>

            <Link
              to="/admin/security-events"
              className="admin-attention__link"
            >
              Review Events →
            </Link>
          </div>

          <div className="admin-attention__stats">
            <div className="admin-attention-stat admin-attention-stat--danger">
              <span className="admin-attention-stat__value">
                {highSeverityEvents}
              </span>

              <span className="admin-attention-stat__label">
                High Severity
              </span>
            </div>

            <div className="admin-attention-stat admin-attention-stat--warning">
              <span className="admin-attention-stat__value">
                {mediumSeverityEvents}
              </span>

              <span className="admin-attention-stat__label">
                Medium Severity
              </span>
            </div>

            <div className="admin-attention-stat admin-attention-stat--neutral">
              <span className="admin-attention-stat__value">
                {recentSecurityEvents}
              </span>

              <span className="admin-attention-stat__label">
                Recent Events
              </span>
            </div>
          </div>
        </div>
      )}


      {/* ============================================================
          OVERVIEW METRICS
          ============================================================ */}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminMetric
          label="Active Users"
          value={overview?.users.active}
          icon={Users}
          tone="green"
          loading={loading}
        />

        <AdminMetric
          label="Total Cases"
          value={overview?.cases.total}
          icon={FileText}
          tone="cyan"
          loading={loading}
        />

        <AdminMetric
          label="Evidence Files"
          value={overview?.documents.total}
          icon={FileCheck2}
          tone="purple"
          loading={loading}
        />

        <AdminMetric
          label="Audit Entries"
          value={overview?.audit.total_logs}
          icon={Activity}
          tone="amber"
          loading={loading}
        />
      </div>


      {/* ============================================================
          SYSTEM HEALTH + PROCESSING
          ============================================================ */}

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* System Health */}

        <div className="admin-dashboard-panel">
          <div className="admin-dashboard-panel__header">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  System Health
                </h3>

                <p className="mt-1 text-[10px] text-[#8ea3bb]">
                  Live component status reported by the backend.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <HealthIndicator
                  status={systemHealth?.status}
                  loading={loading}
                />

                <Link
                  to="/admin/system-health"
                  className={linkGhostClass}
                >
                  View All
                </Link>
              </div>
            </div>
          </div>

          <div className="admin-dashboard-panel__body">
            <HealthStatusRow
              label="Database"
              status={systemHealth?.database}
              loading={loading}
            />

            <HealthStatusRow
              label="Blockchain"
              status={systemHealth?.blockchain}
              loading={loading}
            />

            <HealthStatusRow
              label="Event Pipeline"
              status={systemHealth?.event_pipeline}
              loading={loading}
            />
          </div>
        </div>


        {/* Processing */}

        <div className="admin-dashboard-panel">
          <div className="admin-dashboard-panel__header">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Processing
                </h3>

                <p className="mt-1 text-[10px] text-[#8ea3bb]">
                  File-processing jobs recorded by the backend.
                </p>
              </div>

              <Link
                to="/admin/system-health"
                className={linkGhostClass}
              >
                View All
              </Link>
            </div>
          </div>

          <div className="admin-dashboard-panel__body">
            {loading ? (
              <LoadingRow />
            ) : systemHealth?.processing &&
              Object.keys(systemHealth.processing).length > 0 ? (
              Object.entries(systemHealth.processing).map(
                ([status, count]) => (
                  <div
                    key={status}
                    className="admin-processing-row"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`admin-processing-dot admin-processing-dot--${status.toLowerCase()}`}
                      />

                      <span className="text-sm text-white">
                        {formatProcessingStatus(status)}
                      </span>
                    </div>

                    <span className="admin-processing-row__count">
                      {count.toLocaleString()}
                    </span>
                  </div>
                ),
              )
            ) : (
              <p className="px-2 py-3 text-xs text-[#8ea3bb]">
                No processing jobs recorded.
              </p>
            )}
          </div>
        </div>
      </div>


      {/* ============================================================
          INTEGRITY / BLOCKCHAIN SUMMARY
          ============================================================ */}

      <div className="mb-8">
        <div className="admin-dashboard-panel">
          <div className="admin-dashboard-panel__header">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Integrity &amp; Blockchain
                </h3>

                <p className="mt-1 text-[10px] text-[#8ea3bb]">
                  Evidence integrity records and tamper-evident chain status.
                </p>
              </div>

              <ShieldCheck className="h-5 w-5 text-[#38bdf8]" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <SummaryCard
              label="Integrity Records"
              value={overview?.document_integrity.total_records}
              loading={loading}
            />

            <SummaryCard
              label="Blockchain Blocks"
              value={overview?.blockchain.total_blocks}
              loading={loading}
            />
          </div>

          <div className="flex flex-wrap gap-2 px-4 pb-4">
            <Link
              to="/admin/document-integrity"
              className="admin-dashboard-link admin-dashboard-link--primary"
            >
              View Integrity Records
            </Link>

            <Link
              to="/admin/event-pipeline"
              className="admin-dashboard-link"
            >
              View Event Pipeline
            </Link>
          </div>
        </div>
      </div>


      {/* ============================================================
          RECENT USERS
          ============================================================ */}

      <div>
        <div className="admin-dashboard-panel">
          <div className="admin-dashboard-panel__header">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Recent Users
                </h3>

                <p className="mt-0.5 text-[10px] text-[#8ea3bb]">
                  Recent accounts returned by the backend.
                </p>
              </div>

              <Link
                to="/admin/users"
                className="admin-dashboard-link admin-dashboard-link--primary"
              >
                Manage Users →
              </Link>
            </div>
          </div>


          {/* Table */}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="admin-table-head">
                  <th className="admin-table-heading">
                    Username
                  </th>

                  <th className="admin-table-heading">
                    Full Name
                  </th>

                  <th className="admin-table-heading">
                    Role
                  </th>

                  <th className="admin-table-heading">
                    Status
                  </th>

                  <th className="admin-table-heading">
                    Last Login
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="admin-table-empty"
                    >
                      Loading users...
                    </td>
                  </tr>
                ) : users.length > 0 ? (
                  users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                    />
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="admin-table-empty"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>


          {/* Footer */}

          <div className="flex items-center justify-between border-t border-[#1a2737] px-4 py-3">
            <p className="text-[10px] text-[#8ea3bb]">
              Showing {users.length} recent users
            </p>

            <Link
              to="/admin/users"
              className={linkGhostClass}
            >
              Full User Management →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ================================================================
   METRIC CARD
   ================================================================ */

function AdminMetric({
  label,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  tone: "cyan" | "green" | "purple" | "amber";
  loading: boolean;
}) {
  return (
    <div
      className={`admin-dashboard-metric admin-dashboard-metric--${tone}`}
    >
      <div className="admin-dashboard-metric__icon">
        <Icon className="admin-dashboard-metric__icon-svg" />
      </div>

      <div className="admin-dashboard-metric__content">
        <p className="admin-dashboard-metric__value">
          {loading
            ? "—"
            : (value ?? 0).toLocaleString()}
        </p>

        <p className="admin-dashboard-metric__label">
          {label}
        </p>
      </div>
    </div>
  );
}


/* ================================================================
   HEALTH INDICATOR
   ================================================================ */

function HealthIndicator({
  status,
  loading,
}: {
  status: AdminSystemHealth["status"] | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <span className="admin-dashboard-health admin-dashboard-health--loading">
        <span className="admin-dashboard-health__dot" />
        Checking
      </span>
    );
  }

  if (status === "healthy") {
    return (
      <span className="admin-dashboard-health admin-dashboard-health--healthy">
        <span className="admin-dashboard-health__dot" />
        All Operational
      </span>
    );
  }

  if (status === "degraded") {
    return (
      <span className="admin-dashboard-health admin-dashboard-health--degraded">
        <span className="admin-dashboard-health__dot" />
        Degraded
      </span>
    );
  }

  return (
    <span className="admin-dashboard-health admin-dashboard-health--critical">
      <span className="admin-dashboard-health__dot" />
      Critical
    </span>
  );
}


/* ================================================================
   HEALTH ROW
   ================================================================ */

function HealthStatusRow({
  label,
  status,
  loading,
}: {
  label: string;
  status:
    | "healthy"
    | "degraded"
    | "critical"
    | undefined;
  loading: boolean;
}) {
  const state =
    status === "healthy"
      ? "healthy"
      : status === "degraded"
        ? "degraded"
        : status === "critical"
          ? "critical"
          : "loading";

  return (
    <div
      className={`admin-dashboard-health-row admin-dashboard-health-row--${state}`}
    >
      <div className="admin-dashboard-health-row__label">
        <span className="admin-dashboard-health-row__dot" />
        <span>{label}</span>
      </div>

      <span className="admin-dashboard-health-row__status">
        {loading
          ? "Checking"
          : status ?? "Unknown"}
      </span>
    </div>
  );
}


/* ================================================================
   PROCESSING STATUS
   ================================================================ */

function formatProcessingStatus(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}


/* ================================================================
   SUMMARY CARD
   ================================================================ */

function SummaryCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <div className="admin-panel admin-dashboard-summary">
      <p className="admin-dashboard-summary__value">
        {loading
          ? "—"
          : (value ?? 0).toLocaleString()}
      </p>

      <p className="admin-dashboard-summary__label">
        {label}
      </p>
    </div>
  );
}


/* ================================================================
   USER ROW
   ================================================================ */

function UserRow({
  user,
}: {
  user: AdminUser;
}) {
  return (
    <tr className="admin-table-row">
      <td className="admin-table-cell admin-table-cell--username">
        {user.username}
      </td>

      <td className="admin-table-cell">
        {user.full_name}
      </td>

      <td className="admin-table-cell">
        <span
          className={`admin-role-badge admin-role-badge--${
            user.role === "ADMIN"
              ? "admin"
              : "lawyer"
          }`}
        >
          {user.role}
        </span>
      </td>

      <td className="admin-table-cell">
        <span
          className={`admin-user-status ${
            user.is_active
              ? "admin-user-status--active"
              : "admin-user-status--inactive"
          }`}
        >
          <span className="admin-user-status__dot" />

          {user.is_active
            ? "Active"
            : "Inactive"}
        </span>
      </td>

      <td className="admin-table-cell admin-table-cell--muted">
        {user.last_login
          ? new Date(
              user.last_login,
            ).toLocaleString()
          : "Never"}
      </td>
    </tr>
  );
}


/* ================================================================
   LOADING ROW
   ================================================================ */

function LoadingRow() {
  return (
    <div className="admin-processing-row">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#38bdf8]" />

        <span className="text-sm text-[#8ea3bb]">
          Loading processing status...
        </span>
      </div>
    </div>
  );
}