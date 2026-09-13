import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle2,
  GitBranch,
  RefreshCw,
  Workflow,
} from "lucide-react";

import {
  getAdminEventPipeline,
  type AdminEventPipeline,
} from "@/lib/api";

import {
  AdminPage,
  AdminCard,
} from "@/components/admin/AdminPage";

import {
  Badge,
  Button,
} from "@/components/ui";


export const Route = createFileRoute(
  "/admin/event-pipeline",
)({
  component: EventPipelinePage,

  head: () => ({
    meta: [
      {
        title: "Event Pipeline — Jury Hash Admin",
      },
      {
        name: "description",
        content:
          "Registered EventBus event types and handlers reported by the Jury Hash backend.",
      },
    ],
  }),
});


/* ================================================================
   EVENT NAME
   ================================================================ */

function formatEventName(
  event: string,
) {
  return event
    .replaceAll("_", ".")
    .replace(/\s+/g, ".")
    .toUpperCase();
}


/* ================================================================
   HANDLER NAME
   ================================================================ */

function formatHandlerName(
  handler: string,
) {
  const parts = handler.split(".");

  const handlerMethod =
    parts.at(-1) ?? handler;

  const moduleName =
    parts.at(-2) ?? "";

  const cleanModule =
    moduleName
      .replace(
        /^(blockchain|text|entity)_?/i,
        "",
      )
      .replace(/_subscriber$/i, "")
      .replace(/_extractor$/i, "")
      .replace(/_processor$/i, "")
      .replace(/_handler$/i, "");

  let title = "";

  if (
    /blockchain/i.test(
      handler,
    )
  ) {
    title = "Blockchain Subscriber";
  } else if (
    /text_extractor/i.test(
      handler,
    )
  ) {
    title = "Text Extractor";
  } else if (
    /entity_extractor/i.test(
      handler,
    )
  ) {
    title = "Entity Extractor";
  } else if (cleanModule) {
    title = cleanModule
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase(),
      );
  } else {
    title = handlerMethod
      .replace(/^handle_/i, "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase(),
      );
  }

  return title;
}


/* ================================================================
   HANDLER CATEGORY
   ================================================================ */

function getHandlerCategory(
  handler: string,
) {
  if (/blockchain/i.test(handler)) {
    return "BLOCKCHAIN";
  }

  if (/text_extractor/i.test(handler)) {
    return "TEXT EXTRACTION";
  }

  if (/entity_extractor/i.test(handler)) {
    return "ENTITY EXTRACTION";
  }

  return "HANDLER";
}


/* ================================================================
   PAGE
   ================================================================ */

function EventPipelinePage() {
  const [
    pipeline,
    setPipeline,
  ] = React.useState<
    AdminEventPipeline | null
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

  const loadPipeline =
    React.useCallback(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const data =
            await getAdminEventPipeline();

          setPipeline(data);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load event pipeline.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );


  React.useEffect(() => {
    void loadPipeline();
  }, [loadPipeline]);


  /* ==============================================================
     REGISTERED EVENTS
     ============================================================== */

  const registeredEvents =
    pipeline
      ? Object.entries(
          pipeline.events,
        )
      : [];


  /* ==============================================================
     LOADING
     ============================================================== */

  if (loading) {
    return (
      <AdminPage
        kicker="JURY HASH · ADMIN CONSOLE"
        title="Event Pipeline"
        description="Registered EventBus event types and handlers reported by the Jury Hash backend."
      >
        <div className="admin-table-empty">
          <RefreshCw className="mx-auto mb-2 h-4 w-4 animate-spin" />
          Loading EventBus topology…
        </div>
      </AdminPage>
    );
  }


  /* ==============================================================
     ERROR
     ============================================================== */

  if (error) {
    return (
      <AdminPage
        kicker="JURY HASH · ADMIN CONSOLE"
        title="Event Pipeline"
        description="Registered EventBus event types and handlers reported by the Jury Hash backend."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void loadPipeline()
            }
            className="admin-button"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        }
      >
        <div className="admin-alert admin-alert--danger">
          {error}
        </div>
      </AdminPage>
    );
  }


  if (!pipeline) {
    return null;
  }


  /* ==============================================================
     MAIN
     ============================================================== */

  return (
    <AdminPage
      kicker="JURY HASH · ADMIN CONSOLE"
      title="Event Pipeline"
      description="Registered EventBus event types and handlers reported by the Jury Hash backend."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void loadPipeline()
          }
          disabled={loading}
          className="admin-button"
        >
          <RefreshCw
            className={`mr-2 h-3.5 w-3.5 ${
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
          SUMMARY
          ============================================================ */}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="admin-pipeline-metric">
          <div className="admin-pipeline-metric__icon admin-pipeline-metric__icon--cyan">
            <Workflow className="h-4 w-4" />
          </div>

          <div>
            <p className="admin-pipeline-metric__value">
              {pipeline.total_events}
            </p>

            <p className="admin-pipeline-metric__label">
              Registered Event Types
            </p>
          </div>
        </div>


        <div className="admin-pipeline-metric">
          <div className="admin-pipeline-metric__icon admin-pipeline-metric__icon--green">
            <Activity className="h-4 w-4" />
          </div>

          <div>
            <p className="admin-pipeline-metric__value">
              {pipeline.total_handlers}
            </p>

            <p className="admin-pipeline-metric__label">
              Registered Handlers
            </p>
          </div>
        </div>
      </div>


      {/* ============================================================
          TOPOLOGY STATUS
          ============================================================ */}

      <div className="admin-pipeline-status">
        <div className="admin-pipeline-status__icon">
          <CheckCircle2 className="h-4 w-4" />
        </div>

        <div className="admin-pipeline-status__content">
          <p className="admin-pipeline-status__title">
            EventBus topology loaded
          </p>

          <p className="admin-pipeline-status__description">
            The backend currently reports{" "}
            {pipeline.total_events}{" "}
            registered event type
            {pipeline.total_events === 1
              ? ""
              : "s"}{" "}
            and{" "}
            {pipeline.total_handlers}{" "}
            registered handler
            {pipeline.total_handlers === 1
              ? ""
              : "s"}.
          </p>
        </div>

        <span className="admin-pipeline-status__state">
          CONFIGURATION LOADED
        </span>
      </div>


      {/* ============================================================
          EVENTBUS TOPOLOGY
          ============================================================ */}

      <AdminCard
        title="EventBus Topology"
        subtitle="Event types → registered handlers"
      >
        {registeredEvents.length === 0 ? (
          <div className="admin-table-empty">
            No event handlers are currently registered.
          </div>
        ) : (
          <div className="admin-pipeline-events">
            {registeredEvents.map(
              ([eventName, handlers]) => {
                const hasHandlers =
                  handlers.length > 0;

                return (
                  <section
                    key={eventName}
                    className="admin-pipeline-event"
                  >
                    {/* ==================================================
                        EVENT HEADER
                        ================================================== */}

                    <div className="admin-pipeline-event__header">
                      <div className="admin-pipeline-event__event">
                        <div className="admin-pipeline-event__icon">
                          <GitBranch className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="admin-pipeline-event__name">
                            {formatEventName(
                              eventName,
                            )}
                          </p>

                          <p className="admin-pipeline-event__count">
                            {handlers.length}{" "}
                            registered handler
                            {handlers.length === 1
                              ? ""
                              : "s"}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant={
                          hasHandlers
                            ? "default"
                            : "secondary"
                        }
                        className={
                          hasHandlers
                            ? "admin-pipeline-badge admin-pipeline-badge--registered"
                            : "admin-pipeline-badge admin-pipeline-badge--empty"
                        }
                      >
                        {hasHandlers
                          ? "REGISTERED"
                          : "NO HANDLER"}
                      </Badge>
                    </div>


                    {/* ==================================================
                        HANDLERS
                        ================================================== */}

                    {hasHandlers && (
                      <div className="admin-pipeline-handlers">
                        {handlers.map(
                          (
                            handler,
                            index,
                          ) => (
                            <div
                              key={`${eventName}-${handler}-${index}`}
                              className="admin-pipeline-handler"
                            >
                              <div className="admin-pipeline-handler__status">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </div>

                              <div className="admin-pipeline-handler__content">
                                <div className="admin-pipeline-handler__heading">
                                  <p className="admin-pipeline-handler__name">
                                    {formatHandlerName(
                                      handler,
                                    )}
                                  </p>

                                  <span className="admin-pipeline-handler__category">
                                    {getHandlerCategory(
                                      handler,
                                    )}
                                  </span>
                                </div>

                                <p className="admin-pipeline-handler__path">
                                  {handler}
                                </p>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </section>
                );
              },
            )}
          </div>
        )}
      </AdminCard>


      {/* ============================================================
          BACKEND SOURCE
          ============================================================ */}

      <div className="admin-pipeline-source">
        <div className="admin-pipeline-source__icon">
          <Workflow className="h-4 w-4" />
        </div>

        <div>
          <p className="admin-pipeline-source__label">
            BACKEND SOURCE · REGISTERED TOPOLOGY
          </p>

          <p className="admin-pipeline-source__text">
            This view reflects the EventBus
            configuration currently registered
            by the Jury Hash backend. It does
            not represent historical event
            volume, execution latency, queue
            depth, or handler failure rates.
          </p>
        </div>
      </div>
    </AdminPage>
  );
}