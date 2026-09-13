import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle2,
  Database,
  Link2,
  RefreshCw,
  Server,
  Workflow,
  XCircle,
} from "lucide-react";

import {
  getAdminSystemHealth,
  type AdminSystemHealth,
} from "@/lib/api";

import {
  AdminPage,
  AdminCard,
} from "@/components/admin/AdminPage";

import { Button } from "@/components/ui";


export const Route = createFileRoute(
  "/admin/system-health",
)({
  component: SystemHealthPage,

  head: () => ({
    meta: [
      {
        title: "System Health — Jury Hash Admin",
      },
      {
        name: "description",
        content:
          "Live component health and processing status reported by the Jury Hash backend.",
      },
    ],
  }),
});


/* ================================================================
   HEALTH STATUS
   ================================================================ */

type HealthStatus =
  | "healthy"
  | "degraded"
  | "critical";


function statusLabel(
  status: HealthStatus,
) {
  switch (status) {
    case "healthy":
      return "Operational";

    case "degraded":
      return "Degraded";

    case "critical":
      return "Critical";
  }
}


/* ================================================================
   STATUS META
   ================================================================ */

function statusMeta(
  status: HealthStatus,
) {
  switch (status) {
    case "healthy":
      return {
        tone: "healthy",
        description:
          "Component is responding normally.",
      };

    case "degraded":
      return {
        tone: "degraded",
        description:
          "Component is available but operating below normal conditions.",
      };

    case "critical":
      return {
        tone: "critical",
        description:
          "Component reported a critical condition.",
      };
  }
}


/* ================================================================
   DATE-SAFE / STATUS-SAFE HELPERS
   ================================================================ */

function normalizeHealthStatus(
  status: string,
): HealthStatus {
  if (
    status === "degraded" ||
    status === "critical"
  ) {
    return status;
  }

  return "healthy";
}


function formatProcessingStatus(
  status: string,
) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}


/* ================================================================
   PAGE
   ================================================================ */

function SystemHealthPage() {
  const [
    health,
    setHealth,
  ] = React.useState<
    AdminSystemHealth | null
  >(null);

  const [
    loading,
    setLoading,
  ] = React.useState(true);

  const [
    error,
    setError,
  ] = React.useState<string | null>(
    null,
  );


  /* ==============================================================
     LOAD
     ============================================================== */

  const loadHealth =
    React.useCallback(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const data =
            await getAdminSystemHealth();

          setHealth(data);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load system health.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );


  React.useEffect(() => {
    void loadHealth();
  }, [loadHealth]);


  /* ==============================================================
     LOADING
     ============================================================== */

  if (loading) {
    return (
      <AdminPage
        kicker="JURY HASH · ADMIN CONSOLE"
        title="System Health"
        description="Live component health and processing status reported by the Jury Hash backend."
      >
        <div className="admin-health-state">
          <RefreshCw className="h-4 w-4 animate-spin" />

          <span>
            Checking system health…
          </span>
        </div>
      </AdminPage>
    );
  }


  /* ==============================================================
     ERROR
     ============================================================== */

  if (error || !health) {
    return (
      <AdminPage
        kicker="JURY HASH · ADMIN CONSOLE"
        title="System Health"
        description="Live component health and processing status reported by the Jury Hash backend."
        actions={
          <Button
            type="button"
            onClick={() =>
              void loadHealth()
            }
            className="admin-button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        }
      >
        <div className="admin-health-error">
          <XCircle className="h-4 w-4 shrink-0" />

          <span>
            {error ??
              "System health data is unavailable."}
          </span>
        </div>
      </AdminPage>
    );
  }


  /* ==============================================================
     NORMALIZED STATUS
     ============================================================== */

  const overallStatus =
    normalizeHealthStatus(
      health.status,
    );

  const databaseStatus =
    normalizeHealthStatus(
      health.database,
    );

  const blockchainStatus =
    normalizeHealthStatus(
      health.blockchain,
    );

  const eventPipelineStatus =
    normalizeHealthStatus(
      health.event_pipeline,
    );


  const processingEntries =
    Object.entries(
      health.processing,
    );


  const operationalComponents = [
    databaseStatus,
    blockchainStatus,
    eventPipelineStatus,
  ].filter(
    (status) =>
      status === "healthy",
  ).length;


  /* ================================================================
     MAIN
     ================================================================ */

  return (
    <AdminPage
      kicker="JURY HASH · ADMIN CONSOLE"
      title="System Health"
      description="Live component health and processing status reported by the Jury Hash backend."
      actions={
        <Button
          type="button"
          onClick={() =>
            void loadHealth()
          }
          disabled={loading}
          className="admin-button"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${
              loading
                ? "animate-spin"
                : ""
            }`}
          />

          Refresh
        </Button>
      }
    >

      {/* ============================================================
          OVERALL STATUS
          ============================================================ */}

      <section
        className={`admin-health-overall admin-health-overall--${overallStatus}`}
      >
        <div className="admin-health-overall__icon">
          {overallStatus === "healthy" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : overallStatus === "degraded" ? (
            <Activity className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
        </div>

        <div className="admin-health-overall__content">
          <p className="admin-health-overall__eyebrow">
            OVERALL SYSTEM STATUS
          </p>

          <h2 className="admin-health-overall__title">
            {statusLabel(
              overallStatus,
            )}
          </h2>

          <p className="admin-health-overall__description">
            {statusMeta(
              overallStatus,
            ).description}
          </p>
        </div>

        <div className="admin-health-overall__summary">
          <span className="admin-health-overall__summary-value">
            {operationalComponents}
            /3
          </span>

          <span className="admin-health-overall__summary-label">
            CORE COMPONENTS OPERATIONAL
          </span>
        </div>
      </section>


      {/* ============================================================
          COMPONENT SNAPSHOT
          ============================================================ */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

        <HealthMetric
          label="Database"
          status={
            databaseStatus
          }
          icon={Database}
        />

        <HealthMetric
          label="Blockchain"
          status={
            blockchainStatus
          }
          icon={Link2}
        />

        <HealthMetric
          label="Event Pipeline"
          status={
            eventPipelineStatus
          }
          icon={Workflow}
        />

      </div>


      {/* ============================================================
          COMPONENT STATUS + PROCESSING
          ============================================================ */}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* ----------------------------------------------------------
            COMPONENT STATUS
            ---------------------------------------------------------- */}

        <AdminCard
          title="Component Status"
          subtitle="Live status reported by backend checks"
        >
          <div className="admin-health-components">

            <HealthRow
              label="Database"
              description="Database connectivity check"
              status={
                databaseStatus
              }
              icon={Database}
            />

            <HealthRow
              label="Blockchain"
              description="Hash-chain integrity verification"
              status={
                blockchainStatus
              }
              icon={Link2}
            />

            <HealthRow
              label="Event Pipeline"
              description="Registered EventBus handlers"
              status={
                eventPipelineStatus
              }
              icon={Workflow}
            />

          </div>
        </AdminCard>


        {/* ----------------------------------------------------------
            PROCESSING
            ---------------------------------------------------------- */}

        <AdminCard
          title="Processing Jobs"
          subtitle="File-processing status counts"
        >
          {processingEntries.length ===
          0 ? (
            <div className="admin-health-empty">
              <Activity className="h-4 w-4" />

              <span>
                No processing jobs recorded.
              </span>
            </div>
          ) : (
            <div className="admin-health-processing">

              {processingEntries.map(
                ([
                  status,
                  count,
                ]) => (
                  <ProcessingRow
                    key={status}
                    status={status}
                    count={count}
                  />
                ),
              )}

            </div>
          )}
        </AdminCard>

      </div>


      {/* ============================================================
          BACKEND HEALTH ASSESSMENT
          ============================================================ */}

      <section
        className={`admin-health-assessment admin-health-assessment--${overallStatus}`}
      >
        <div className="admin-health-assessment__icon">
          {overallStatus === "healthy" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : overallStatus === "degraded" ? (
            <Activity className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
        </div>

        <div className="admin-health-assessment__content">
          <p className="admin-health-assessment__label">
            BACKEND HEALTH ASSESSMENT
          </p>

          <p className="admin-health-assessment__title">
            {overallStatus === "healthy"
              ? "Core backend services are operational."
              : overallStatus === "degraded"
                ? "One or more backend services require attention."
                : "A critical backend condition has been reported."}
          </p>

          <p className="admin-health-assessment__description">
            Overall health is derived from
            the database, blockchain, and
            EventBus checks exposed by the
            backend. Processing statistics are
            reported independently.
          </p>
        </div>

        <span className="admin-health-assessment__state">
          {statusLabel(
            overallStatus,
          ).toUpperCase()}
        </span>
      </section>

    </AdminPage>
  );
}


/* ================================================================
   HEALTH METRIC
   ================================================================ */

function HealthMetric({
  label,
  status,
  icon: Icon,
}: {
  label: string;
  status: HealthStatus;
  icon: React.ComponentType<{
    className?: string;
  }>;
}) {
  return (
    <div
      className={`admin-health-metric admin-health-metric--${status}`}
    >
      <div className="admin-health-metric__icon">
        <Icon className="h-4 w-4" />
      </div>

      <div className="admin-health-metric__content">
        <p className="admin-health-metric__value">
          {statusLabel(
            status,
          )}
        </p>

        <p className="admin-health-metric__label">
          {label}
        </p>
      </div>
    </div>
  );
}


/* ================================================================
   HEALTH ROW
   ================================================================ */

function HealthRow({
  label,
  description,
  status,
  icon: Icon,
}: {
  label: string;
  description: string;
  status: HealthStatus;
  icon: React.ComponentType<{
    className?: string;
  }>;
}) {
  return (
    <div className="admin-health-row">

      <div className="admin-health-row__main">
        <div
          className={`admin-health-row__icon admin-health-row__icon--${status}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>

        <div className="admin-health-row__content">
          <p className="admin-health-row__label">
            {label}
          </p>

          <p className="admin-health-row__description">
            {description}
          </p>
        </div>
      </div>

      <StatusBadge
        status={status}
      />

    </div>
  );
}


/* ================================================================
   STATUS BADGE
   ================================================================ */

function StatusBadge({
  status,
}: {
  status: HealthStatus;
}) {
  return (
    <span
      className={`admin-health-status admin-health-status--${status}`}
    >
      <span className="admin-health-status__dot" />

      {statusLabel(status)}
    </span>
  );
}


/* ================================================================
   PROCESSING ROW
   ================================================================ */

function ProcessingRow({
  status,
  count,
}: {
  status: string;
  count: number;
}) {
  const normalized =
    status.toUpperCase();

  const tone =
    normalized === "COMPLETED"
      ? "completed"
      : normalized === "FAILED"
        ? "failed"
        : normalized ===
            "PROCESSING"
          ? "processing"
          : normalized === "QUEUED"
            ? "queued"
            : "neutral";


  return (
    <div
      className={`admin-health-processing-row admin-health-processing-row--${tone}`}
    >
      <div className="admin-health-processing-row__main">

        <span className="admin-health-processing-row__dot" />

        <div>
          <p className="admin-health-processing-row__label">
            {formatProcessingStatus(
              status,
            )}
          </p>

          <p className="admin-health-processing-row__description">
            File-processing jobs
          </p>
        </div>

      </div>

      <span className="admin-health-processing-row__count">
        {count.toLocaleString()}
      </span>
    </div>
  );
}