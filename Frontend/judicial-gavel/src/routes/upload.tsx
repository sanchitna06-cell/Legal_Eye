import {
  createFileRoute,
  Link,
  redirect,
  useSearch,
} from "@tanstack/react-router";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  Check,
  FileText,
  FileUp,
  LoaderCircle,
  Lock,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import { format } from "date-fns";

import { AppHeader } from "@/components/layout/AppHeader";
import { SidebarDrawer } from "@/components/dashboard/SidebarDrawer";

import {
  getDocumentStatus,
  uploadDocument,
  type DocumentProcessingStage,
} from "@/lib/api";

import {
  useCaseActions,
  toCaseRecord,
} from "@/lib/case-store";

import { getSession } from "@/lib/user-store";


/* ========================================================================== */
/* ROUTE                                                                      */
/* ========================================================================== */

export const Route = createFileRoute(
  "/upload",
)({
  beforeLoad: () => {
    if (!getSession()) {
      throw redirect({
        to: "/",
      });
    }
  },

  validateSearch: (
    search: Record<string, unknown>,
  ) => {
    const caseId =
      search["case"];

    return {
      case:
        typeof caseId ===
          "string" &&
        caseId.trim()
          ? caseId
          : undefined,
    };
  },

  head: () => ({
    meta: [
      {
        title:
          "Upload Case File — JURY HASH",
      },
      {
        name: "description",
        content:
          "Securely preserve an original legal document in JURY HASH and create or update its case record.",
      },
    ],
  }),

  component:
    UploadCase,
});


/* ========================================================================== */
/* TYPES                                                                      */
/* ========================================================================== */

interface ChosenFile {
  file: File;
  name: string;
  size: number;
}


interface FilingOperation {
  caseId: string;
  documentId: string | null;
  file: ChosenFile;
}


type UploadPhase =
  | "IDLE"
  | "SUBMITTING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";


type StepVisual =
  | "pending"
  | "active"
  | "completed"
  | "failed";


/* ========================================================================== */
/* CONSTANTS                                                                  */
/* ========================================================================== */

const ACCEPT =
  ".pdf";


const POLL_INTERVAL_MS =
  1500;


const MAX_POLL_ERRORS =
  5;


const STAGE_ORDER:
  DocumentProcessingStage[] =
  [
    "DOCUMENT_ANALYSIS",
    "CASE_RECORD",
    "INTEGRITY",
  ];


const STEPS: Array<{
  stage: DocumentProcessingStage;
  number: string;
  label: string;
  description: string;
}> = [
  {
    stage:
      "DOCUMENT_ANALYSIS",
    number: "01",
    label:
      "Analyze document",
    description:
      "Read pages, extract text and identify document structure.",
  },
  {
    stage:
      "CASE_RECORD",
    number: "02",
    label:
      "Prepare case record",
    description:
      "Extract parties, dates and case details for the matter.",
  },
  {
    stage:
      "INTEGRITY",
    number: "03",
    label:
      "Preserve integrity",
    description:
      "Hash and anchor the original document in the JURY HASH chain.",
  },
];


/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */

function humanSize(
  bytes: number,
) {
  if (
    bytes <
    1024 * 1024
  ) {
    return `${Math.max(
      1,
      Math.round(
        bytes / 1024,
      ),
    )} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}


function stageNumber(
  stage:
    | DocumentProcessingStage
    | null,
) {
  if (!stage) {
    return "—";
  }

  const index =
    STAGE_ORDER.indexOf(
      stage,
    );

  return index >= 0
    ? String(
        index + 1,
      ).padStart(2, "0")
    : "—";
}


/* ========================================================================== */
/* MAIN COMPONENT                                                             */
/* ========================================================================== */

function UploadCase() {
  const {
    addCase,
  } =
    useCaseActions();

  const {
    case: existingCaseId,
  } = useSearch({
    from: "/upload",
  });


  /* ------------------------------------------------------------------------ */
  /* Layout                                                                   */
  /* ------------------------------------------------------------------------ */

  const [
    sidebarExpanded,
    setSidebarExpanded,
  ] = useState(true);

  const [
    mobileDrawerOpen,
    setMobileDrawerOpen,
  ] = useState(false);


  /* ------------------------------------------------------------------------ */
  /* File                                                                      */
  /* ------------------------------------------------------------------------ */

  const [
    file,
    setFile,
  ] =
    useState<ChosenFile | null>(
      null,
    );

  const [
    dragActive,
    setDragActive,
  ] = useState(false);

  const [
    confidential,
    setConfidential,
  ] = useState(false);


  /* ------------------------------------------------------------------------ */
  /* Upload state machine                                                      */
  /* ------------------------------------------------------------------------ */

  const [
    phase,
    setPhase,
  ] = useState<UploadPhase>(
    "IDLE",
  );

  const [
    stage,
    setStage,
  ] =
    useState<DocumentProcessingStage | null>(
      null,
    );

  const [
    statusMessage,
    setStatusMessage,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    operation,
    setOperation,
  ] =
    useState<FilingOperation | null>(
      null,
    );


  /* ------------------------------------------------------------------------ */
  /* Refs                                                                      */
  /* ------------------------------------------------------------------------ */

  const inFlightRef =
    useRef(false);

  const pollTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const pollActiveRef =
    useRef(false);

  const pollErrorsRef =
    useRef(0);


  const busy =
    phase ===
      "SUBMITTING" ||
    phase ===
      "PROCESSING";


  /* ========================================================================
     POLLING
     ======================================================================== */

  const stopPolling =
    useCallback(
      () => {
        pollActiveRef.current =
          false;

        if (
          pollTimerRef.current !==
          null
        ) {
          clearTimeout(
            pollTimerRef.current,
          );

          pollTimerRef.current =
            null;
        }
      },
      [],
    );


  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);


  const startStatusPolling =
    useCallback(
      (
        documentId: string,
      ) => {
        stopPolling();

        pollActiveRef.current =
          true;

        pollErrorsRef.current =
          0;


        const poll =
          async () => {
            if (
              !pollActiveRef.current
            ) {
              return;
            }


            try {
              const status =
                await getDocumentStatus(
                  documentId,
                );


              if (
                !pollActiveRef.current
              ) {
                return;
              }


              pollErrorsRef.current =
                0;

              setStatusMessage(
                status.message,
              );


              if (
                status.status ===
                "COMPLETED"
              ) {
                stopPolling();

                inFlightRef.current =
                  false;

                setStage(
                  "INTEGRITY",
                );

                setPhase(
                  "COMPLETED",
                );

                return;
              }


              if (
                status.status ===
                "FAILED"
              ) {
                stopPolling();

                inFlightRef.current =
                  false;

                setStage(
                  status.stage,
                );

                setError(
                  status.message,
                );

                setPhase(
                  "FAILED",
                );

                return;
              }


              setStage(
                status.stage,
              );
            } catch {
              if (
                !pollActiveRef.current
              ) {
                return;
              }


              pollErrorsRef.current +=
                1;


              if (
                pollErrorsRef.current >=
                MAX_POLL_ERRORS
              ) {
                stopPolling();

                inFlightRef.current =
                  false;

                setStage(null);

                setError(
                  "Lost contact with the archive while processing. Please retry.",
                );

                setPhase(
                  "FAILED",
                );

                return;
              }
            }


            if (
              pollActiveRef.current
            ) {
              pollTimerRef.current =
                setTimeout(
                  poll,
                  POLL_INTERVAL_MS,
                );
            }
          };


        void poll();
      },
      [stopPolling],
    );


  /* ========================================================================
     FILE HANDLING
     ======================================================================== */

  function pickFile(
    next:
      | File
      | undefined,
  ) {
    if (!next) {
      return;
    }

    if (busy) {
      return;
    }

    if (
      next.type !==
        "application/pdf" &&
      !next.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      setError(
        "Only PDF documents can be added to the case archive.",
      );

      return;
    }


    setFile({
      file: next,
      name: next.name,
      size: next.size,
    });

    setError(null);
  }


  function onDrop(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setDragActive(false);

    pickFile(
      event.dataTransfer.files?.[0],
    );
  }


  function handleDropzoneKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
  ) {
    if (busy) {
      return;
    }

    if (
      event.key ===
        "Enter" ||
      event.key ===
        " "
    ) {
      event.preventDefault();

      document
        .getElementById(
          "case-file-input",
        )
        ?.click();
    }
  }


  /* ========================================================================
     SUBMIT
     ======================================================================== */

  async function submitForm(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  if (
    busy ||
    inFlightRef.current
  ) {
    return;
  }

  if (!file) {
    setError(
      "Select a PDF before filing the matter.",
    );
    return;
  }

  inFlightRef.current = true;

  setError(null);
  setStatusMessage(null);
  setStage(null);
  setPhase("SUBMITTING");

  const chosenFile = file;

  let targetCaseId =
    existingCaseId ?? null;

  try {
    if (!targetCaseId) {
      const provisionalTitle =
        chosenFile.name
          .replace(/\.[^.]+$/, "")
          .replace(/[_-]+/g, " ")
          .trim();

      const record = toCaseRecord({
        id: "",
        title:
          provisionalTitle ||
          "Untitled case",
        court: "",
        bench: "To be assigned",
        status: "Active",
        classification:
          confidential
            ? "confidential"
            : "general",
        filed: format(
          new Date(),
          "dd MMM yyyy",
        ),
        subject: "",
        petitioner: "",
        respondent: "",
        summary:
          "Case metadata pending document analysis.",
        fileName:
          chosenFile.name,
      });

      const createdCase =
        await addCase(record);

      targetCaseId =
        createdCase.id;
    }

    setOperation({
      caseId: targetCaseId,
      documentId: null,
      file: chosenFile,
    });

    const uploadResponse =
      await uploadDocument(
        targetCaseId,
        chosenFile.file,
      );

    setOperation({
      caseId: targetCaseId,
      documentId:
        uploadResponse.document_id,
      file: chosenFile,
    });

    setPhase("PROCESSING");

    startStatusPolling(
      uploadResponse.document_id,
    );
  } catch (submitError) {
    console.error(
      "Failed to create case or upload document:",
      submitError,
    );

    const message =
      submitError instanceof Error &&
      submitError.message
        ? submitError.message
        : "Failed to create case or upload document.";

    setStatusMessage(null);
    setStage(null);
    setError(message);

    inFlightRef.current =
      false;

    setPhase("FAILED");
  }
}

  /* ========================================================================
     RETRY
     ======================================================================== */

  async function retryFiling() {
  const current =
    operation;

  if (
    !current ||
    phase !== "FAILED" ||
    inFlightRef.current
  ) {
    return;
  }

  inFlightRef.current = true;

  setError(null);
  setStatusMessage(null);
  setStage(null);

  if (current.documentId) {
    try {
      const status =
        await getDocumentStatus(
          current.documentId,
        );

      if (
        status.status ===
        "COMPLETED"
      ) {
        inFlightRef.current =
          false;

        setStage(
          "INTEGRITY",
        );

        setPhase(
          "COMPLETED",
        );

        return;
      }

      if (
        status.status !==
        "FAILED"
      ) {
        setPhase(
          "PROCESSING",
        );

        startStatusPolling(
          current.documentId,
        );

        return;
      }
    } catch {
      setPhase(
        "PROCESSING",
      );

      startStatusPolling(
        current.documentId,
      );

      return;
    }
  }

  setPhase("SUBMITTING");

  try {
    const uploadResponse =
      await uploadDocument(
        current.caseId,
        current.file.file,
      );

    setOperation({
      caseId:
        current.caseId,
      documentId:
        uploadResponse.document_id,
      file:
        current.file,
    });

    setPhase("PROCESSING");

    startStatusPolling(
      uploadResponse.document_id,
    );
  } catch (retryError) {
    console.error(
      "Failed to upload document:",
      retryError,
    );

    const message =
      retryError instanceof Error &&
      retryError.message
        ? retryError.message
        : "Failed to upload document.";

    setError(message);

    setPhase("FAILED");

    inFlightRef.current =
      false;
  }
}


  /* ========================================================================
     RESET
     ======================================================================== */

  function reset() {
    stopPolling();

    inFlightRef.current =
      false;

    setFile(null);
    setConfidential(false);
    setOperation(null);
    setStage(null);
    setStatusMessage(null);
    setError(null);
    setPhase(
      "IDLE",
    );
  }


  /* ========================================================================
     STEP STATE
     ======================================================================== */

  function stepVisual(
    stepStage:
      DocumentProcessingStage,
  ): StepVisual {
    if (
      phase ===
      "FAILED"
    ) {
      return stage ===
        stepStage
        ? "failed"
        : "pending";
    }


    if (
      phase ===
        "COMPLETED" &&
      stepStage ===
        "INTEGRITY"
    ) {
      return "completed";
    }


    if (
      stage ===
        null ||
      phase ===
        "SUBMITTING"
    ) {
      return "pending";
    }


    if (
      stage ===
      "COMPLETE"
    ) {
      return "completed";
    }


    const stepIndex =
      STAGE_ORDER.indexOf(
        stepStage,
      );

    const currentIndex =
      STAGE_ORDER.indexOf(
        stage,
      );


    if (
      currentIndex <
      0
    ) {
      return "pending";
    }


    if (
      stepIndex <
      currentIndex
    ) {
      return "completed";
    }


    if (
      stepIndex ===
      currentIndex
    ) {
      return "active";
    }


    return "pending";
  }


  /* ========================================================================
     RENDER
     ======================================================================== */

  return (
    <div className="min-h-screen bg-background">

      <SidebarDrawer
        expanded={
          sidebarExpanded
        }
        mobileOpen={
          mobileDrawerOpen
        }
        onToggle={() =>
          setSidebarExpanded(
            (value) =>
              !value,
          )
        }
        onMobileClose={() =>
          setMobileDrawerOpen(
            false,
          )
        }
        onSelectCategory={() => {}}
        activeCategory={
          null
        }
      />


      <AppHeader
        onMenu={() =>
          setMobileDrawerOpen(
            true,
          )
        }
        menuOpen={
          mobileDrawerOpen
        }
      />


      {/* ================================================================
          SIDEBAR OFFSET
          ================================================================ */}

      <div
        className={`transition-[padding-left] duration-300 ease-out ${
          sidebarExpanded
            ? "md:pl-80"
            : "md:pl-16"
        }`}
      >

        <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">

          {/* ============================================================
              PAGE HEADER
              ============================================================ */}

          <header className="pt-10 sm:pt-14">

            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

              <div>

                <p className="label-legal">
                  RECORD INTAKE
                </p>


                <h1 className="mt-3 font-display text-[clamp(2.1rem,4vw,3.2rem)] leading-[0.95] tracking-[-0.015em] text-parchment">
                  {existingCaseId
                    ? "Add Evidence"
                    : "Upload Case File"}
                </h1>


                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {existingCaseId
                    ? "Attach an original PDF to an existing matter. The document will be processed without changing the case's current access controls."
                    : "Begin a new matter by submitting the original legal document. JURY HASH will preserve the file and derive the initial case record during processing."}
                </p>

              </div>


              <div className="shrink-0 pb-1">

                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-brass-dim uppercase">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-brass"
                    aria-hidden="true"
                  />

                  Intake{" "}
                  <span className="text-brass">
                    ·
                  </span>{" "}
                  01
                </div>

              </div>

            </div>


            <div className="mt-7 h-px w-full rule-brass" />

          </header>


          {/* ============================================================
              PROCESS MAP
              ============================================================ */}

          <section
            aria-label="Document intake process"
            className="mt-6"
          >

            <div className="grid gap-px border border-border bg-border sm:grid-cols-3">

              {[
                {
                  number:
                    "01",
                  label:
                    "Select",
                  description:
                    "Choose the original PDF.",
                },
                {
                  number:
                    "02",
                  label:
                    "Review",
                  description:
                    "Confirm file and matter scope.",
                },
                {
                  number:
                    "03",
                  label:
                    "Preserve",
                  description:
                    "Process, hash and anchor.",
                },
              ].map(
                (
                  item,
                  index,
                ) => (
                  <div
                    key={
                      item.number
                    }
                    className={`bg-surface/35 px-4 py-3 ${
                      phase !==
                        "IDLE" &&
                      index === 2
                        ? "bg-brass/[0.05]"
                        : ""
                    }`}
                  >

                    <div className="flex items-center gap-3">

                      <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-brass">
                        {
                          item.number
                        }
                      </span>

                      <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-parchment uppercase">
                        {
                          item.label
                        }
                      </span>

                    </div>


                    <p className="mt-1 pl-7 text-[11px] text-muted-foreground">
                      {
                        item.description
                      }
                    </p>

                  </div>
                ),
              )}

            </div>

          </section>


          {/* ============================================================
              SUCCESS
              ============================================================ */}

          {phase ===
            "COMPLETED" &&
          operation ? (
            <section
              aria-label="File secured"
              className="chamber-panel grain mt-8 border border-border p-7 sm:p-10"
            >

              <div className="mx-auto max-w-2xl text-center">

                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-success/50 text-success">
                  <Check className="h-7 w-7" />
                </span>


                <p className="label-legal mt-6 text-success">
                  PRESERVATION COMPLETE
                </p>


                <h2 className="mt-3 font-display text-3xl text-parchment">
                  File secured
                </h2>


                <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  The backend has completed
                  document processing and
                  recorded the original file
                  in the JURY HASH integrity
                  chain.
                </p>


                <div className="mx-auto mt-6 max-w-xl border border-border bg-surface/60 px-4 py-4 text-left">

                  <div className="flex items-start gap-3">

                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brass" />

                    <div className="min-w-0">

                      <p className="truncate text-sm text-parchment">
                        {
                          operation
                            .file
                            .name
                        }
                      </p>

                      <p className="mt-1 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
                        {humanSize(
                          operation
                            .file
                            .size,
                        )}{" "}
                        · PDF{" "}
                        · PRESERVED
                      </p>

                    </div>

                  </div>

                </div>


                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">

                  <Link
                    to="/records"
                    search={{
                      case:
                        operation.caseId,
                    }}
                    className="focus-legal inline-flex items-center gap-2 border border-brass/60 bg-brass/10 px-5 py-2.5 text-sm text-parchment transition-colors hover:bg-brass hover:text-primary-foreground"
                  >
                    Open case
                  </Link>


                  <button
                    type="button"
                    onClick={
                      reset
                    }
                    className="focus-legal inline-flex items-center gap-2 border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-brass-dim hover:text-parchment"
                  >
                    <FileUp className="h-4 w-4" />

                    File another
                  </button>

                </div>

              </div>

            </section>


          /* ============================================================
             FAILURE
             ============================================================ */

          ) : phase ===
            "FAILED" &&
            operation ? (
            <section
              aria-label="Document processing failed"
              className="chamber-panel grain mt-8 border border-burgundy/50 p-7 sm:p-10"
            >

              <div className="mx-auto max-w-2xl text-center">

                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-burgundy/50 text-burgundy">
                  <ShieldAlert className="h-7 w-7" />
                </span>


                <p className="label-legal mt-6 text-burgundy">
                  PRESERVATION INTERRUPTED
                </p>


                <h2 className="mt-3 font-display text-3xl text-parchment">
                  Document processing failed
                </h2>


                <p
                  className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-burgundy"
                  role="alert"
                >
                  {error ??
                    "The document could not be processed. Please try again."}
                </p>


                <div className="mx-auto mt-6 max-w-xl border border-border bg-surface/60 px-4 py-4 text-left">

                  <div className="flex items-start gap-3">

                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brass" />

                    <div className="min-w-0">

                      <p className="truncate text-sm text-parchment">
                        {
                          operation
                            .file
                            .name
                        }
                      </p>

                      <p className="mt-1 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
                        {humanSize(
                          operation
                            .file
                            .size,
                        )}{" "}
                        · SAME MATTER
                      </p>

                    </div>

                  </div>

                </div>


                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">

                  <button
                    type="button"
                    onClick={
                      retryFiling
                    }
                    className="focus-legal inline-flex items-center gap-2 border border-brass/60 bg-brass/10 px-5 py-2.5 text-sm text-parchment transition-colors hover:bg-brass hover:text-primary-foreground"
                  >
                    Retry filing
                  </button>


                  <button
                    type="button"
                    onClick={
                      reset
                    }
                    className="focus-legal inline-flex items-center gap-2 border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-brass-dim hover:text-parchment"
                  >
                    <FileUp className="h-4 w-4" />

                    Start over
                  </button>

                </div>

              </div>

            </section>


          /* ============================================================
             PROCESSING
             ============================================================ */

          ) : phase ===
              "SUBMITTING" ||
            phase ===
              "PROCESSING" ? (
            <section
              aria-live="polite"
              aria-busy="true"
              aria-label="Case file processing"
              className="chamber-panel grain mt-8 border border-border p-6 sm:p-8"
            >

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

                <div>

                  <p className="label-legal">
                    {phase ===
                    "SUBMITTING"
                      ? "SUBMITTING"
                      : "PRESERVATION IN PROGRESS"}
                  </p>


                  <h2 className="mt-2 font-display text-2xl text-parchment sm:text-3xl">
                    Preserving case file
                  </h2>

                </div>


                <div className="font-mono text-[10px] tracking-[0.14em] text-brass-dim uppercase">
                  Stage{" "}
                  <span className="text-brass">
                    {stageNumber(
                      stage,
                    )}
                  </span>{" "}
                  / 03
                </div>

              </div>


              {operation && (
                <div className="mt-6 flex items-start gap-3 border border-border bg-surface/60 px-4 py-3.5">

                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brass" />

                  <div className="min-w-0 flex-1">

                    <p className="truncate text-sm text-parchment">
                      {
                        operation
                          .file
                          .name
                      }
                    </p>

                    <p className="mt-1 font-mono text-[10px] tracking-[0.06em] text-muted-foreground">
                      {humanSize(
                        operation
                          .file
                          .size,
                      )}{" "}
                      · ORIGINAL FILE
                    </p>

                  </div>

                  <span className="shrink-0 font-mono text-[9px] tracking-[0.12em] text-brass uppercase">
                    Received
                  </span>

                </div>
              )}


              <ol className="mt-8">

                {STEPS.map(
                  (
                    step,
                    index,
                  ) => {
                    const visual =
                      stepVisual(
                        step.stage,
                      );

                    return (
                      <li
                        key={
                          step.stage
                        }
                        className={`relative flex gap-4 px-1 py-4 ${
                          index <
                          STEPS.length -
                            1
                            ? "border-b border-border"
                            : ""
                        }`}
                      >

                        <div className="relative flex w-9 shrink-0 justify-center">

                          {index <
                            STEPS.length -
                              1 && (
                            <span
                              className={`absolute left-1/2 top-10 h-full w-px -translate-x-1/2 ${
                                visual ===
                                  "completed"
                                  ? "bg-success/35"
                                  : "bg-border"
                              }`}
                              aria-hidden="true"
                            />
                          )}


                          <span
                            className={`relative z-10 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border font-mono text-[10px] font-bold ${
                              visual ===
                              "active"
                                ? "border-brass bg-brass/10 text-brass"
                                : visual ===
                                    "completed"
                                  ? "border-success/50 bg-success/[0.06] text-success"
                                  : visual ===
                                      "failed"
                                    ? "border-burgundy/60 bg-burgundy/[0.06] text-burgundy"
                                    : "border-border bg-background text-muted-foreground/50"
                            }`}
                          >

                            {visual ===
                            "active" ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                            ) : visual ===
                              "completed" ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : visual ===
                              "failed" ? (
                              <ShieldAlert className="h-3.5 w-3.5" />
                            ) : (
                              step.number
                            )}

                          </span>

                        </div>


                        <div className="min-w-0 flex-1 pt-0.5">

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">

                            <p
                              className={`text-sm font-medium ${
                                visual ===
                                "active"
                                  ? "text-parchment"
                                  : visual ===
                                      "failed"
                                    ? "text-burgundy"
                                    : visual ===
                                        "completed"
                                      ? "text-success"
                                      : "text-muted-foreground"
                              }`}
                            >
                              {
                                step.label
                              }
                            </p>


                            {visual ===
                              "active" && (
                              <span className="font-mono text-[9px] tracking-[0.12em] text-brass uppercase">
                                Processing
                              </span>
                            )}

                            {visual ===
                              "completed" && (
                              <span className="font-mono text-[9px] tracking-[0.12em] text-success uppercase">
                                Complete
                              </span>
                            )}

                          </div>


                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground/75">
                            {
                              step.description
                            }
                          </p>

                        </div>

                      </li>
                    );
                  },
                )}

              </ol>


              <div className="mt-6 flex items-start gap-3 border-t border-border pt-5">

                <span
                  className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-brass motion-reduce:animate-none"
                  aria-hidden="true"
                />

                <div>

                  <p
                    role="status"
                    className="text-sm text-parchment"
                  >
                    {statusMessage ??
                      (phase ===
                      "SUBMITTING"
                        ? "Submitting case file…"
                        : "Processing document…")}
                  </p>

                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">
                    This page will update
                    automatically as the
                    backend completes each
                    stage.
                  </p>

                </div>

              </div>

            </section>


          /* ============================================================
             IDLE / INPUT
             ============================================================ */

          ) : (
            <form
              onSubmit={
                submitForm
              }
            >

              {/* ========================================================
                  DROPZONE
                  ======================================================== */}

              <section
                aria-label="Case file selection"
                className="mt-8"
              >

                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Choose a PDF case file"
                  aria-disabled={busy}
                  onClick={() => {
                    if (
                      busy
                    ) {
                      return;
                    }

                    document
                      .getElementById(
                        "case-file-input",
                      )
                      ?.click();
                  }}
                  onKeyDown={
                    handleDropzoneKeyDown
                  }
                  onDragOver={(
                    event,
                  ) => {
                    event.preventDefault();

                    if (
                      !busy
                    ) {
                      setDragActive(
                        true,
                      );
                    }
                  }}
                  onDragLeave={() =>
                    setDragActive(
                      false,
                    )
                  }
                  onDrop={
                    onDrop
                  }
                  className={`group focus-legal chamber-panel grain relative flex min-h-[360px] cursor-pointer flex-col items-center justify-center border px-6 py-12 text-center transition-all duration-300 sm:min-h-[390px] ${
                    dragActive
                      ? "border-brass bg-brass/[0.06] shadow-[0_0_0_1px_color-mix(in_oklab,var(--brass)_45%,transparent)]"
                      : "border-dashed border-border hover:border-brass-dim hover:bg-surface/[0.03]"
                  } ${
                    busy
                      ? "pointer-events-none opacity-60"
                      : ""
                  }`}
                >

                  <input
                    id="case-file-input"
                    type="file"
                    accept={
                      ACCEPT
                    }
                    className="sr-only"
                    disabled={
                      busy
                    }
                    onChange={(
                      event,
                    ) =>
                      pickFile(
                        event
                          .target
                          .files?.[0],
                      )
                    }
                  />


                  <span className={`flex h-16 w-16 items-center justify-center border transition-all duration-300 ${
                    dragActive
                      ? "border-brass bg-brass/10 text-brass"
                      : "border-brass/40 text-brass group-hover:border-brass group-hover:bg-brass/[0.05]"
                  }`}>
                    <FileUp className="h-7 w-7" />
                  </span>


                  <p className="mt-6 font-display text-2xl text-parchment">
                    {dragActive
                      ? "Release to attach"
                      : "Drop your PDF here"}
                  </p>


                  <p className="mt-2 text-sm text-muted-foreground">
                    or
                  </p>


                  <span className="mt-3 inline-flex items-center gap-2 border border-brass/60 bg-brass/10 px-5 py-2.5 text-sm text-parchment transition-colors group-hover:bg-brass group-hover:text-primary-foreground">
                    Browse files
                  </span>


                  <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-[9px] tracking-[0.12em] text-muted-foreground/70 uppercase">

                    <span>
                      PDF only
                    </span>

                    <span
                      className="h-1 w-1 rounded-full bg-border"
                      aria-hidden="true"
                    />

                    <span>
                      Original document
                    </span>

                    <span
                      className="h-1 w-1 rounded-full bg-border"
                      aria-hidden="true"
                    />

                    <span>
                      Protected intake
                    </span>

                  </div>

                </div>


                <div className="mt-4 flex items-start gap-2.5 px-1">

                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass-dim" />

                  <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground/80">
                    The original PDF is
                    submitted to protected
                    storage. Case information
                    is derived from the
                    document during backend
                    processing.
                  </p>

                </div>

              </section>


              {/* ========================================================
                  FILE REVIEW
                  ======================================================== */}

              {file && (
                <section
                  aria-label="Review selected file"
                  className="mt-8"
                >

                  <div className="border border-border bg-surface/35">

                    <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

                      <div className="flex min-w-0 items-start gap-3">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-brass/35 bg-brass/[0.04] text-brass">
                          <FileText className="h-5 w-5" />
                        </div>


                        <div className="min-w-0">

                          <p className="font-mono text-[9px] font-bold tracking-[0.14em] text-brass-dim uppercase">
                            Selected document
                          </p>

                          <p className="mt-1 truncate text-sm text-parchment">
                            {
                              file.name
                            }
                          </p>

                          <p className="mt-1 font-mono text-[10px] tracking-[0.06em] text-muted-foreground">
                            {humanSize(
                              file.size,
                            )}{" "}
                            · PDF{" "}
                            · READY
                          </p>

                        </div>

                      </div>


                      <button
                        type="button"
                        onClick={() => {
                          if (
                            busy
                          ) {
                            return;
                          }

                          setFile(
                            null,
                          );

                          setError(
                            null,
                          );
                        }}
                        disabled={
                          busy
                        }
                        className="focus-legal inline-flex w-fit items-center gap-1.5 text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-burgundy disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />

                        Remove
                      </button>

                    </div>


                    {/* Matter scope */}

                    <div className="p-5">

                      {existingCaseId ? (
                        <div className="flex items-start gap-3 border border-border bg-background/40 px-4 py-4">

                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brass-dim" />

                          <div>

                            <p className="text-sm text-parchment">
                              Adding to existing matter
                            </p>

                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              This document will
                              be attached to the
                              selected case. Existing
                              classification and
                              access controls remain
                              unchanged.
                            </p>

                          </div>

                        </div>
                      ) : (
                        <div className="border border-border bg-background/40">

                          <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">

                            <div className="flex items-start gap-3">

                              <Lock
                                className={`mt-0.5 h-4 w-4 shrink-0 ${
                                  confidential
                                    ? "text-burgundy"
                                    : "text-brass-dim"
                                }`}
                              />

                              <div>

                                <p className="text-sm text-parchment">
                                  Confidential matter
                                </p>

                                <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                                  Restricts access
                                  to this case
                                  according to its
                                  confidential
                                  classification.
                                </p>

                              </div>

                            </div>


                            <button
                              type="button"
                              role="switch"
                              aria-checked={
                                confidential
                              }
                              disabled={
                                busy
                              }
                              onClick={() =>
                                setConfidential(
                                  (
                                    value,
                                  ) =>
                                    !value,
                                )
                              }
                              className={`focus-legal relative h-6 w-11 shrink-0 border transition-colors ${
                                confidential
                                  ? "border-burgundy bg-burgundy/70"
                                  : "border-input bg-transparent"
                              }`}
                            >

                              <span
                                className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 bg-parchment transition-all duration-200 ${
                                  confidential
                                    ? "left-[calc(100%-1.25rem)]"
                                    : "left-1"
                                }`}
                              />

                              <span className="sr-only">
                                Mark matter confidential
                              </span>

                            </button>

                          </div>

                        </div>
                      )}


                      {error && (
                        <div
                          className="mt-4 border border-burgundy/50 bg-burgundy/[0.06] px-4 py-3 text-sm leading-relaxed text-burgundy"
                          role="alert"
                        >
                          {
                            error
                          }
                        </div>
                      )}


                      {/* Submit */}

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">

                        <button
                          type="submit"
                          disabled={
                            busy
                          }
                          aria-busy={
                            busy
                          }
                          className="focus-legal inline-flex items-center justify-center gap-2 border border-primary/70 bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-secondary-brown disabled:cursor-progress disabled:opacity-70 disabled:hover:translate-y-0"
                        >

                          {busy && (
                            <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                          )}

                          {existingCaseId
                            ? "Add file to case"
                            : "Create case & preserve file"}

                        </button>


                        <Link
                          to="/dashboard"
                          className="focus-legal px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-parchment"
                        >
                          Cancel and return to dashboard
                        </Link>

                      </div>

                    </div>

                  </div>

                </section>
              )}


              {!file && (
                <div className="mt-6 border-t border-border pt-5">

                  <div className="flex items-start gap-3 text-[11px] leading-relaxed text-muted-foreground/70">

                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass-dim" />

                    <p>
                      By continuing, the
                      submitted document will
                      enter the JURY HASH
                      preservation workflow.
                      Do not upload material
                      that should not be added
                      to the matter.
                    </p>

                  </div>

                </div>
              )}

            </form>
          )}

        </main>
      </div>

    </div>
  );
}