import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronRight,
  Copy,
  Download,
  RefreshCw,
  X,
} from "lucide-react";

import { AdminPage, AdminCard } from "@/components/admin/AdminPage";
import { Button, Input } from "@/components/ui";
import {
  getAdminAuditLogs,
  type AdminAuditLog,
} from "@/lib/api";


export const Route = createFileRoute("/admin/audit-logs")({
  component: AuditLogsPage,
  head: () => ({
    meta: [
      { title: "Audit Logs — Jury Hash Admin" },
      {
        name: "description",
        content:
          "Complete audit trail of every action taken in the Jury Hash console.",
      },
    ],
  }),
});


function AuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLog, setSelectedLog] =
    useState<AdminAuditLog | null>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getAdminAuditLogs();

      setLogs(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load audit logs.",
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    void loadLogs();
  }, []);


  useEffect(() => {
    if (!selectedLog) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedLog(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [selectedLog]);


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return logs;
    }

    return logs.filter((log) =>
      [
        log.id,
        log.user_id,
        log.case_id,
        log.document_id,
        log.action,
        log.ip_address,
        log.request_id,
        JSON.stringify(log.details ?? {}),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [logs, query]);


  return (
    <AdminPage
      kicker="JURY HASH · ADMIN CONSOLE"
      title="Audit Logs"
      description="Immutable trail of actions recorded by the Jury Hash backend."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadLogs()}
            disabled={loading}
            className="admin-dashboard-refresh"
          >
            <RefreshCw
              className={`mr-1 h-3.5 w-3.5 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled
            title="CSV export is not currently exposed by the backend."
            className="admin-dashboard-refresh opacity-60"
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      }
    >
      {/* ============================================================
          SUMMARY
          ============================================================ */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label="Total Audit Entries"
          value={loading ? "—" : String(logs.length)}
        />

        <StatTile
          label="Visible Entries"
          value={loading ? "—" : String(filtered.length)}
        />
      </div>


      {/* ============================================================
          AUDIT TRAIL
          ============================================================ */}

      <AdminCard
        title="Audit Trail"
        subtitle="Newest first · backend records"
      >
        <div className="admin-audit-search">
          <Input
            type="search"
            placeholder="Search user, action, case, document, IP or request ID..."
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            className="admin-input"
          />
        </div>


        {error && (
          <div className="admin-alert admin-alert--danger">
            {error}
          </div>
        )}


        <div className="overflow-x-auto">
          <table className="admin-audit-table">
            <thead>
              <tr className="admin-table-head">
                {[
                  "Timestamp",
                  "User ID",
                  "Action",
                  "Case ID",
                  "Document ID",
                  "Source IP",
                  "Request ID",
                  "Details",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="admin-table-heading"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <>
                  <LoadingRow />
                  <LoadingRow />
                  <LoadingRow />
                  <LoadingRow />
                </>
              ) : (
                filtered.map((log) => (
                  <AuditLogRow
                    key={log.id}
                    log={log}
                    onInspect={setSelectedLog}
                  />
                ))
              )}

              {!loading &&
                filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="admin-table-empty"
                    >
                      {query
                        ? "No audit entries match the current search."
                        : "No audit entries were returned by the backend."}
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>


        {!loading && filtered.length > 0 && (
          <div className="admin-audit-footer">
            <span>
              Showing {filtered.length} of {logs.length} entries
            </span>

            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="admin-audit-clear"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </AdminCard>


      {/* ============================================================
          INSPECTION DRAWER
          ============================================================ */}

      {selectedLog && (
        <AuditDetailsDrawer
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </AdminPage>
  );
}


/* ================================================================
   AUDIT TABLE ROW
   ================================================================ */

function AuditLogRow({
  log,
  onInspect,
}: {
  log: AdminAuditLog;
  onInspect: (log: AdminAuditLog) => void;
}) {
  return (
    <tr className="admin-table-row">
      <td className="admin-table-cell admin-table-cell--muted">
        {formatDate(log.created_at)}
      </td>

      <td className="admin-table-cell admin-table-cell--mono">
        {shortId(log.user_id)}
      </td>

      <td className="admin-table-cell admin-audit-action">
        {log.action}
      </td>

      <td className="admin-table-cell admin-table-cell--mono">
        {log.case_id ? shortId(log.case_id) : "—"}
      </td>

      <td className="admin-table-cell admin-table-cell--mono">
        {log.document_id
          ? shortId(log.document_id)
          : "—"}
      </td>

      <td className="admin-table-cell admin-table-cell--mono admin-table-cell--muted">
        {log.ip_address ?? "—"}
      </td>

      <td className="admin-table-cell admin-table-cell--mono admin-table-cell--muted">
        {log.request_id
          ? shortId(log.request_id)
          : "—"}
      </td>

      <td className="admin-table-cell admin-audit-details-cell">
        <button
          type="button"
          onClick={() => onInspect(log)}
          className="admin-audit-inspect"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          Inspect
        </button>
      </td>
    </tr>
  );
}


/* ================================================================
   AUDIT DETAILS DRAWER
   ================================================================ */

function AuditDetailsDrawer({
  log,
  onClose,
}: {
  log: AdminAuditLog;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);


  async function handleCopyDetails() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(log.details ?? {}, null, 2),
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  }


  return (
    <>
      {/* Backdrop */}

      <button
        type="button"
        aria-label="Close audit details"
        onClick={onClose}
        className="admin-drawer-backdrop"
      />


      {/* Drawer */}

      <aside className="admin-drawer" aria-label="Audit entry details">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-drawer__kicker">
              AUDIT ENTRY
            </p>

            <h2 className="admin-drawer__title">
              {formatActionLabel(log.action)}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="admin-drawer__close"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>


        <div className="admin-drawer__body">
          {/* Action */}

          <div className="admin-drawer__action">
            <span className="admin-drawer__action-label">
              Action
            </span>

            <span className="admin-drawer__action-value">
              {log.action}
            </span>
          </div>


          {/* Timestamp */}

          <AuditDetailField
            label="Timestamp"
            value={formatDate(log.created_at)}
          />


          {/* Actor */}

          <AuditDetailField
            label="Actor"
            value={log.user_id}
            mono
          />


          {/* Case */}

          <AuditDetailField
            label="Case ID"
            value={log.case_id ?? "—"}
            mono
          />


          {/* Document */}

          <AuditDetailField
            label="Document ID"
            value={log.document_id ?? "—"}
            mono
          />


          {/* Source IP */}

          <AuditDetailField
            label="Source IP"
            value={log.ip_address ?? "—"}
            mono
          />


          {/* Request */}

          <AuditDetailField
            label="Request ID"
            value={log.request_id ?? "—"}
            mono
          />


          {/* Details */}

          <div className="admin-drawer__section">
            <div className="admin-drawer__section-header">
              <div>
                <p className="admin-drawer__section-label">
                  Details
                </p>

                <p className="admin-drawer__section-description">
                  Backend metadata recorded with this event.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleCopyDetails()}
                className="admin-drawer__copy"
              >
                <Copy className="h-3.5 w-3.5" />

                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <pre className="admin-drawer__json">
              {JSON.stringify(
                log.details ?? {},
                null,
                2,
              )}
            </pre>
          </div>
        </div>
      </aside>
    </>
  );
}


/* ================================================================
   DETAIL FIELD
   ================================================================ */

function AuditDetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="admin-drawer__field">
      <span className="admin-drawer__field-label">
        {label}
      </span>

      <span
        className={`admin-drawer__field-value ${
          mono
            ? "admin-drawer__field-value--mono"
            : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}


/* ================================================================
   LOADING ROW
   ================================================================ */

function LoadingRow() {
  return (
    <tr className="admin-table-row">
      <td
        colSpan={8}
        className="admin-table-empty"
      >
        Loading audit records...
      </td>
    </tr>
  );
}


/* ================================================================
   STAT TILE
   ================================================================ */

function StatTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="admin-panel admin-audit-stat">
      <p className="admin-audit-stat__value">
        {value}
      </p>

      <p className="admin-audit-stat__label">
        {label}
      </p>
    </div>
  );
}


/* ================================================================
   HELPERS
   ================================================================ */

function shortId(value: string) {
  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}


function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}


function formatActionLabel(action: string) {
  return action
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}