import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  ShieldAlert,
  ShieldBan,
  UserX,
  X,
} from "lucide-react";

import {
  AdminPage,
  AdminCard,
} from "@/components/admin/AdminPage";

import {
  getAdminSecurityEvents,
  type AdminSecurityEvent,
} from "@/lib/api";


export const Route = createFileRoute(
  "/admin/security-events",
)({
  component: SecurityEventsPage,

  head: () => ({
    meta: [
      {
        title: "Security Events — Jury Hash Admin",
      },
      {
        name: "description",
        content:
          "Live security events recorded by the Jury Hash backend.",
      },
    ],
  }),
});


/* ================================================================
   EVENT FILTERS
   ================================================================ */

type EventFilter =
  | "all"
  | "attention"
  | "authentication"
  | "account"
  | "access"
  | "integrity"
  | "administrative";


/* ================================================================
   EVENT CATEGORY
   ================================================================ */

function getEventCategory(
  eventType: string,
): Exclude<EventFilter, "all" | "attention"> {
  if (
    eventType === "AUTH_SUCCESS" ||
    eventType === "AUTH_FAILURE"
  ) {
    return "authentication";
  }

  if (eventType === "ACCOUNT_DISABLED") {
    return "account";
  }

  if (
    eventType === "ACCESS_DENIED" ||
    eventType === "TOKEN_INVALID"
  ) {
    return "access";
  }

  if (eventType === "INTEGRITY_FAILURE") {
    return "integrity";
  }

  return "administrative";
}


/* ================================================================
   EVENT ICON
   ================================================================ */

function getEventIcon(eventType: string) {
  if (eventType === "AUTH_SUCCESS") {
    return CheckCircle;
  }

  if (eventType === "ACCOUNT_DISABLED") {
    return UserX;
  }

  if (
    eventType === "AUTH_FAILURE" ||
    eventType === "ACCESS_DENIED" ||
    eventType === "TOKEN_INVALID"
  ) {
    return ShieldBan;
  }

  if (eventType === "INTEGRITY_FAILURE") {
    return AlertTriangle;
  }

  return ShieldAlert;
}


/* ================================================================
   HUMAN-READABLE EVENT TITLE
   ================================================================ */

function getEventTitle(eventType: string): string {
  switch (eventType) {
    case "AUTH_SUCCESS":
      return "Successful Authentication";

    case "AUTH_FAILURE":
      return "Authentication Failure";

    case "ACCOUNT_DISABLED":
      return "Disabled Account Login Attempt";

    case "ACCESS_DENIED":
      return "Access Denied";

    case "TOKEN_INVALID":
      return "Invalid Authentication Token";

    case "INTEGRITY_FAILURE":
      return "Integrity Verification Failure";

    case "ADMIN_ACTION":
      return "Administrative Security Action";

    default:
      return eventType
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase(),
        );
  }
}


/* ================================================================
   HUMAN-READABLE EVENT DESCRIPTION
   ================================================================ */

function getEventDescription(
  event: AdminSecurityEvent,
): string {
  switch (event.event_type) {
    case "AUTH_SUCCESS":
      return "A user successfully authenticated with Jury Hash.";

    case "AUTH_FAILURE":
      return "An authentication attempt was rejected.";

    case "ACCOUNT_DISABLED":
      return "A disabled account attempted to access Jury Hash.";

    case "ACCESS_DENIED":
      return "A request was blocked because the caller was not authorized.";

    case "TOKEN_INVALID":
      return "A request contained an invalid or unusable authentication token.";

    case "INTEGRITY_FAILURE":
      return "An integrity verification operation reported a failure.";

    case "ADMIN_ACTION":
      return "An administrative security-related action was recorded.";

    default:
      return "A security-related event was recorded by the backend.";
  }
}


/* ================================================================
   COMPACT EVENT DETAIL
   ================================================================ */



/* ================================================================
   DATE
   ================================================================ */

function formatTimestamp(
  timestamp: string,
): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString();
}


/* ================================================================
   FILTER LABEL
   ================================================================ */

function formatFilterLabel(
  value: EventFilter,
): string {
  if (value === "attention") {
    return "Needs Attention";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function formatEventDetail(
  event: AdminSecurityEvent,
): string {
  const parts: string[] = [];

  if (event.user_id) {
    parts.push(
      `User ID: ${event.user_id.slice(0, 12)}…`,
    );
  }

  // Do not expose IP addresses for successful authentication.
  if (
    event.event_type !== "AUTH_SUCCESS" &&
    event.ip_address
  ) {
    parts.push(
      `IP: ${event.ip_address}`,
    );
  }

  if (event.endpoint) {
    parts.push(
      `Endpoint: ${event.endpoint}`,
    );
  }

  if (event.details) {
    const detailEntries = Object.entries(
      event.details,
    );

    for (const [key, value] of detailEntries) {
      if (
        value === null ||
        value === undefined
      ) {
        continue;
      }

      parts.push(
        `${key.replaceAll("_", " ")}: ${String(value)}`,
      );
    }
  }

  return parts.length > 0
    ? parts.join(" · ")
    : "No additional event details recorded.";
}

/* ================================================================
   PAGE
   ================================================================ */

function SecurityEventsPage() {
  const [events, setEvents] =
    useState<AdminSecurityEvent[]>([]);

  const [filter, setFilter] =
    useState<EventFilter>("all");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [selectedEvent, setSelectedEvent] =
    useState<AdminSecurityEvent | null>(null);


  /* ==============================================================
     LOAD
     ============================================================== */

  async function loadEvents() {
    try {
      setLoading(true);
      setError(null);

      const data =
        await getAdminSecurityEvents();

      setEvents(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load security events.",
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadEvents();
  }, []);


  /* ==============================================================
     ESCAPE CLOSE
     ============================================================== */

  useEffect(() => {
    if (!selectedEvent) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setSelectedEvent(null);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [selectedEvent]);


  /* ==============================================================
     FILTERED EVENTS
     ============================================================== */

  const filtered = useMemo(() => {
    if (filter === "all") {
      return events;
    }

    if (filter === "attention") {
      return events.filter(
        (event) =>
          event.severity === "high" ||
          event.severity === "medium",
      );
    }

    return events.filter(
      (event) =>
        getEventCategory(
          event.event_type,
        ) === filter,
    );
  }, [events, filter]);


  /* ==============================================================
     STATS
     ============================================================== */

  const stats = useMemo(
    () => ({
      total: events.length,

      high: events.filter(
        (event) =>
          event.severity === "high",
      ).length,

      medium: events.filter(
        (event) =>
          event.severity === "medium",
      ).length,

      failures: events.filter(
        (event) =>
          event.event_type ===
          "AUTH_FAILURE",
      ).length,
    }),
    [events],
  );


  return (
    <AdminPage
      kicker="JURY HASH · ADMIN CONSOLE"
      title="Security Events"
      description="Live security events recorded by the Jury Hash backend."
      actions={
        <button
          type="button"
          onClick={() => void loadEvents()}
          disabled={loading}
          className="admin-button"
        >
          {loading
            ? "Refreshing…"
            : "Refresh"}
        </button>
      }
    >
      {/* ============================================================
          ERROR
          ============================================================ */}

      {error && (
        <div className="admin-alert admin-alert--danger">
          {error}
        </div>
      )}


      {/* ============================================================
          SUMMARY
          ============================================================ */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SecurityMetric
          icon={ShieldAlert}
          label="Recent Events"
          value={stats.total}
          tone="cyan"
        />

        <SecurityMetric
          icon={AlertTriangle}
          label="High Severity"
          value={stats.high}
          tone="danger"
        />

        <SecurityMetric
          icon={ShieldBan}
          label="Authentication Failures"
          value={stats.failures}
          tone="warning"
        />
      </div>


      {/* ============================================================
          ATTENTION SUMMARY
          ============================================================ */}

      {!loading &&
        (stats.high > 0 ||
          stats.medium > 0) && (
          <div className="admin-security-attention">
            <div className="admin-security-attention__icon">
              <AlertTriangle className="h-4 w-4" />
            </div>

            <div className="admin-security-attention__content">
              <p className="admin-security-attention__title">
                Security attention required
              </p>

              <p className="admin-security-attention__description">
                {stats.high > 0
                  ? `${stats.high} high-severity event${
                      stats.high === 1
                        ? ""
                        : "s"
                    }`
                  : "No high-severity events"}{" "}
                and{" "}
                {stats.medium} medium-severity event
                {stats.medium === 1
                  ? ""
                  : "s"}{" "}
                currently require review.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setFilter("attention")
              }
              className="admin-security-attention__action"
            >
              Review Attention →
            </button>
          </div>
        )}


      {/* ============================================================
          EVENT FEED
          ============================================================ */}

      <AdminCard
        title="Security Event Feed"
        subtitle="Newest first · backend recorded"
      >
        <div className="admin-security-filters">
          {(
            [
              "all",
              "attention",
              "authentication",
              "account",
              "access",
              "integrity",
              "administrative",
            ] as const
          ).map((value) => {
            const active =
              filter === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setFilter(value)
                }
                className={`admin-security-filter ${
                  active
                    ? "admin-security-filter--active"
                    : ""
                } ${
                  value === "attention"
                    ? "admin-security-filter--attention"
                    : ""
                }`}
              >
                {formatFilterLabel(value)}

                {value === "attention" &&
                  stats.high +
                    stats.medium >
                    0 && (
                    <span className="admin-security-filter__count">
                      {stats.high +
                        stats.medium}
                    </span>
                  )}
              </button>
            );
          })}
        </div>


        {loading ? (
          <div className="admin-table-empty">
            Loading security events…
          </div>
        ) : error ? (
          <div className="admin-alert admin-alert--danger admin-security-error">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">
            {filter === "attention"
              ? "No security events currently require attention."
              : "No security events recorded for this filter."}
          </div>
        ) : (
          <div className="admin-security-feed">
            {filtered.map((event) => {
              const Icon =
                getEventIcon(
                  event.event_type,
                );

              return (
                <SecurityEventRow
                  key={event.id}
                  event={event}
                  Icon={Icon}
                  onInspect={
                    setSelectedEvent
                  }
                />
              );
            })}
          </div>
        )}
      </AdminCard>


      {/* ============================================================
          INSPECTION DRAWER
          ============================================================ */}

      {selectedEvent && (
        <SecurityEventDrawer
          event={selectedEvent}
          onClose={() =>
            setSelectedEvent(null)
          }
        />
      )}
    </AdminPage>
  );
}


/* ================================================================
   SECURITY METRIC
   ================================================================ */

function SecurityMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  label: string;
  value: number;
  tone:
    | "cyan"
    | "warning"
    | "danger";
}) {
  return (
    <div
      className={`admin-security-metric admin-security-metric--${tone}`}
    >
      <div className="admin-security-metric__icon">
        <Icon className="admin-security-metric__icon-svg" />
      </div>

      <div>
        <p className="admin-security-metric__value">
          {value.toLocaleString()}
        </p>

        <p className="admin-security-metric__label">
          {label}
        </p>
      </div>
    </div>
  );
}


/* ================================================================
   SECURITY EVENT ROW
   ================================================================ */

function SecurityEventRow({
  event,
  Icon,
  onInspect,
}: {
  event: AdminSecurityEvent;

  Icon: React.ComponentType<{
    className?: string;
  }>;

  onInspect: (
    event: AdminSecurityEvent,
  ) => void;
}) {
  const severity =
    event.severity === "high"
      ? "high"
      : event.severity === "medium"
        ? "medium"
        : "low";


  const typeLabel =
    event.event_type
      .replaceAll("_", " ")
      .toUpperCase();


  return (
    <article
      className={`admin-security-event admin-security-event--${severity}`}
    >
      <div className="admin-security-event__main">
        <div
          className={`admin-security-event__icon admin-security-event__icon--${severity}`}
        >
          <Icon />
        </div>

        <div className="admin-security-event__content">
          <div className="admin-security-event__title-row">
            <h4 className="admin-security-event__title">
              {getEventTitle(
                event.event_type,
              )}
            </h4>

            <span
              className={`admin-security-severity admin-security-severity--${severity}`}
            >
              {event.severity}
            </span>
          </div>

          <p className="admin-security-event__description">
            {getEventDescription(event)}
          </p>

          <p className="admin-security-event__details">
            {formatEventDetail(event)}
          </p>

          <p className="admin-security-event__timestamp">
            {formatTimestamp(
              event.created_at,
            )}
          </p>
        </div>
      </div>

      <div className="admin-security-event__actions">
        <span
          className={`admin-security-event__type admin-security-event__type--${severity}`}
        >
          {typeLabel}
        </span>

        <button
          type="button"
          onClick={() =>
            onInspect(event)
          }
          className="admin-security-event__inspect"
        >
          Inspect
        </button>
      </div>
    </article>
  );
}


/* ================================================================
   SECURITY EVENT DRAWER
   ================================================================ */

function SecurityEventDrawer({
  event,
  onClose,
}: {
  event: AdminSecurityEvent;
  onClose: () => void;
}) {
  const [copied, setCopied] =
    useState(false);


  const severity =
    event.severity === "high"
      ? "high"
      : event.severity === "medium"
        ? "medium"
        : "low";


  const Icon =
    getEventIcon(event.event_type);


  async function handleCopyDetails() {
  try {
    const eventForCopy =
      event.event_type === "AUTH_SUCCESS"
        ? {
            ...event,
            ip_address: undefined,
          }
        : event;

    await navigator.clipboard.writeText(
      JSON.stringify(
        eventForCopy,
        null,
        2,
      ),
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
        aria-label="Close security event details"
        onClick={onClose}
        className="admin-drawer-backdrop"
      />


      {/* Drawer */}

      <aside
        className="admin-drawer"
        aria-label="Security event details"
      >
        <div className="admin-drawer__header">
          <div>
            <p className="admin-drawer__kicker">
              SECURITY EVENT
            </p>

            <h2 className="admin-drawer__title">
              {getEventTitle(
                event.event_type,
              )}
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
          {/* Severity */}

          <div
            className={`admin-security-drawer-severity admin-security-drawer-severity--${severity}`}
          >
            <Icon className="h-4 w-4" />

            <div>
              <span className="admin-security-drawer-severity__label">
                Severity
              </span>

              <span className="admin-security-drawer-severity__value">
                {event.severity}
              </span>
            </div>
          </div>


          {/* Event Type */}

          <AuditSecurityField
            label="Event Type"
            value={event.event_type}
            mono
          />


          {/* Description */}

          <div className="admin-security-drawer-description">
            <p className="admin-security-drawer-description__label">
              What happened
            </p>

            <p className="admin-security-drawer-description__value">
              {getEventDescription(event)}
            </p>
          </div>


          {/* Timestamp */}

          <AuditSecurityField
            label="Timestamp"
            value={formatTimestamp(
              event.created_at,
            )}
          />


          {/* User */}

          <AuditSecurityField
            label="User ID"
            value={event.user_id ?? "—"}
            mono
          />


          {/* IP */}

          {event.event_type !== "AUTH_SUCCESS" && (
          <AuditSecurityField
            label="IP Address"
            value={event.ip_address ?? "—"}
            mono
            />
          )}


          {/* Endpoint */}

          <AuditSecurityField
            label="Endpoint"
            value={
              event.endpoint ?? "—"
            }
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
                onClick={() =>
                  void handleCopyDetails()
                }
                className="admin-drawer__copy"
              >
                <Copy className="h-3.5 w-3.5" />

                {copied
                  ? "Copied"
                  : "Copy"}
              </button>
            </div>

            <pre className="admin-drawer__json">
              {JSON.stringify(
                event.details ?? {},
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
   DRAWER FIELD
   ================================================================ */

function AuditSecurityField({
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