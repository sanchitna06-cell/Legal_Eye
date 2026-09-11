import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
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
import { useCaseActions, toCaseRecord } from "@/lib/case-store";
import { getSession } from "@/lib/user-store";
import { getDocumentStatus, uploadDocument, type DocumentProcessingStage } from "@/lib/api";

export const Route = createFileRoute("/upload")({
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Upload Case File — JURY HASH" },
      {
        name: "description",
        content:
          "Add a legal case file to the JURY HASH archive — select the document, confirm the matter and file it under your case records.",
      },
    ],
  }),
  component: UploadCase,
});

interface ChosenFile {
  file: File;
  name: string;
  size: number;
}

/**
 * One filing attempt.
 *
 * `documentId` is null until the backend has accepted the upload.
 * Once a case has been created it is pinned here so that retries
 * reuse the SAME case and can never create duplicates.
 */
interface FilingOperation {
  caseId: string;
  documentId: string | null;
  file: ChosenFile;
}

/**
 * Upload state machine.
 *
 * IDLE → SUBMITTING → PROCESSING → COMPLETED
 *                    ↘ FAILED (retry or start over)
 *
 * Pre-submit validation errors stay in IDLE and surface as the
 * inline form error; every post-submission failure lands in
 * FAILED so retry can never create a second case.
 */
type UploadPhase = "IDLE" | "SUBMITTING" | "PROCESSING" | "COMPLETED" | "FAILED";

function humanSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPT = ".pdf";

/* ============================================================
   Document status polling
   ============================================================ */

const POLL_INTERVAL_MS = 1500;

/** Consecutive status failures tolerated before giving up. */
const MAX_POLL_ERRORS = 5;

/* ============================================================
   Processing stepper (public stages from the status contract)
   ============================================================ */

const STAGE_ORDER: DocumentProcessingStage[] = ["DOCUMENT_ANALYSIS", "CASE_RECORD", "INTEGRITY"];

const STEPS: Array<{
  stage: DocumentProcessingStage;
  label: string;
  description: string;
}> = [
  {
    stage: "DOCUMENT_ANALYSIS",
    label: "Analyzing document",
    description: "Reading pages, extracting text, running OCR where needed.",
  },
  {
    stage: "CASE_RECORD",
    label: "Preparing case record",
    description: "Identifying parties, dates and details for the case file.",
  },
  {
    stage: "INTEGRITY",
    label: "Securing document integrity",
    description: "Anchoring the original document into the JURY HASH chain.",
  },
];

type StepVisual = "pending" | "active" | "completed" | "failed";

function UploadCase() {
  const { addCase } = useCaseActions();

  const [file, setFile] = useState<ChosenFile | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [confidential, setConfidential] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state machine — the ONLY source of what the page shows.
  const [phase, setPhase] = useState<UploadPhase>("IDLE");
  const [stage, setStage] = useState<DocumentProcessingStage | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [operation, setOperation] = useState<FilingOperation | null>(null);

  // Synchronous guards: prevent double submissions before React
  // state commits, and keep exactly one polling loop alive.
  const inFlightRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollActiveRef = useRef(false);
  const pollErrorsRef = useRef(0);

  const busy = phase === "SUBMITTING" || phase === "PROCESSING";

  const stopPolling = useCallback(() => {
    pollActiveRef.current = false;

    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  /**
   * Poll the backend status endpoint until the document reaches a
   * terminal state. Exactly one loop exists: every call first stops
   * any previous loop. Timers are cleared on unmount.
   */
  const startStatusPolling = useCallback(
    (documentId: string) => {
      stopPolling();
      pollActiveRef.current = true;
      pollErrorsRef.current = 0;

      const poll = async () => {
        if (!pollActiveRef.current) return;

        try {
          const status = await getDocumentStatus(documentId);

          if (!pollActiveRef.current) return;

          pollErrorsRef.current = 0;
          setStatusMessage(status.message);

          if (status.status === "COMPLETED") {
            stopPolling();
            inFlightRef.current = false;
            setPhase("COMPLETED");
            return;
          }

          if (status.status === "FAILED") {
            stopPolling();
            inFlightRef.current = false;
            setStage(status.stage);
            setError(status.message);
            setPhase("FAILED");
            return;
          }

          // QUEUED / PROCESSING: advance the visible stage only from
          // real backend data — never from timers or guesses.
          setStage(status.stage);
        } catch {
          // Transient network errors: keep polling quietly, but give
          // up after repeated failures instead of hanging forever.
          if (!pollActiveRef.current) return;

          pollErrorsRef.current += 1;

          if (pollErrorsRef.current >= MAX_POLL_ERRORS) {
            stopPolling();
            inFlightRef.current = false;
            setStage(null);
            setError("Lost contact with the archive while processing. Please retry.");
            setPhase("FAILED");
            return;
          }
        }

        if (pollActiveRef.current) {
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      };

      void poll();
    },
    [stopPolling],
  );

  function pickFile(next: File | undefined) {
    if (!next) return;
    if (busy) return;

    setFile({
      file: next,
      name: next.name,
      size: next.size,
    });

    setError(null);
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (busy) return;

    setDragActive(false);
    pickFile(event.dataTransfer.files?.[0]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (busy) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      document.getElementById("case-file-input")?.click();
    }
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Duplicate submission guard: one filing at a time, ever.
    if (busy || inFlightRef.current) return;

    if (!file) {
      setError("Select a PDF before filing the matter.");
      return;
    }

    inFlightRef.current = true;
    setError(null);
    setStatusMessage(null);
    setStage(null);
    setPhase("SUBMITTING");

    const chosenFile = file;
    const provisionalTitle = chosenFile.name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim();

    const record = toCaseRecord({
      id: "",
      title: provisionalTitle || "Untitled case",
      court: "",
      bench: "To be assigned",
      status: "Active",
      classification: confidential ? "confidential" : "general",
      filed: format(new Date(), "dd MMM yyyy"),
      subject: "",
      petitioner: "",
      respondent: "",
      summary: "Case metadata pending document analysis.",
      fileName: chosenFile.name,
    });

    let createdCaseId: string | null = null;

    try {
      const createdCase = await addCase(record);
      createdCaseId = createdCase.id;

      // Pin the case immediately: if the upload fails, retry will
      // reuse this case instead of creating a new one.
      setOperation({ caseId: createdCase.id, documentId: null, file: chosenFile });

      const uploadResponse = await uploadDocument(createdCase.id, chosenFile.file);

      setOperation({
        caseId: createdCase.id,
        documentId: uploadResponse.document_id,
        file: chosenFile,
      });
      setPhase("PROCESSING");
      startStatusPolling(uploadResponse.document_id);
    } catch (submitError) {
      console.error("Failed to create case or upload document:", submitError);

      const message =
        submitError instanceof Error && submitError.message
          ? submitError.message
          : "Failed to create case or upload document.";

      setStatusMessage(null);
      setStage(null);
      setError(message);

      if (createdCaseId) {
        // The case exists — never resubmit into a second case.
        inFlightRef.current = false;
        setPhase("FAILED");
      } else {
        // Nothing was created: return to the form.
        setOperation(null);
        setPhase("IDLE");
        inFlightRef.current = false;
      }
    }
  }

  /**
   * Resume a failed filing without ever creating a second case.
   *
   * The backend arbitrates what actually happened:
   * - document still queued/processing → resume observing it;
   * - document already COMPLETED       → show success;
   * - terminally FAILED, or never uploaded → (re-)upload the same
   *   file into the SAME case as a new attempt.
   */
  async function retryFiling() {
    const current = operation;

    if (!current || phase !== "FAILED" || inFlightRef.current) return;

    inFlightRef.current = true;
    setError(null);
    setStatusMessage(null);
    setStage(null);

    if (current.documentId) {
      try {
        const status = await getDocumentStatus(current.documentId);

        if (status.status === "COMPLETED") {
          inFlightRef.current = false;
          setPhase("COMPLETED");
          return;
        }

        if (status.status !== "FAILED") {
          // The earlier failure signal was spurious — keep observing.
          setPhase("PROCESSING");
          startStatusPolling(current.documentId);
          return;
        }

        // Confirmed terminal failure: fall through and re-file the
        // document into the SAME case.
      } catch {
        // Cannot confirm backend state — keep observing instead of
        // risking a duplicate filing.
        setPhase("PROCESSING");
        startStatusPolling(current.documentId);
        return;
      }
    }

    setPhase("SUBMITTING");

    try {
      const uploadResponse = await uploadDocument(current.caseId, current.file.file);

      setOperation({
        caseId: current.caseId,
        documentId: uploadResponse.document_id,
        file: current.file,
      });
      setPhase("PROCESSING");
      startStatusPolling(uploadResponse.document_id);
    } catch (retryError) {
      console.error("Failed to upload document:", retryError);

      setError(
        retryError instanceof Error && retryError.message
          ? retryError.message
          : "Failed to upload document.",
      );
      setPhase("FAILED");
      inFlightRef.current = false;
    }
  }

  function reset() {
    stopPolling();
    inFlightRef.current = false;

    setFile(null);
    setConfidential(false);
    setOperation(null);
    setStage(null);
    setStatusMessage(null);
    setError(null);
    setPhase("IDLE");
  }

  function stepVisual(stepStage: DocumentProcessingStage): StepVisual {
    if (phase === "FAILED") {
      return stage === stepStage ? "failed" : "pending";
    }

    if (stage === null || phase === "SUBMITTING") return "pending";
    if (stage === "COMPLETE") return "completed";

    const stepIndex = STAGE_ORDER.indexOf(stepStage);
    const currentIndex = STAGE_ORDER.indexOf(stage);

    if (currentIndex < 0) return "pending";
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "active";

    return "pending";
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <div className="pt-10 sm:pt-14">
          <p className="label-legal">Record Intake</p>

          <div className="mt-4 flex items-baseline justify-between gap-4">
            <h1 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-none tracking-[-0.01em] text-parchment">
              Upload Case File
            </h1>

            <span className="font-mono text-[11px] tracking-[0.14em] text-brass-dim">
              Intake · 01
            </span>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Upload the original legal document you want to preserve in JURY HASH. Case information
            will be extracted and organized from the document during processing.
          </p>

          <div className="mt-6 h-px w-full rule-brass" />
        </div>

        {phase === "COMPLETED" && operation ? (
          /* ============================================================
             SUCCESS — only after the backend confirms completion
             ============================================================ */
          <section
            aria-label="File secured"
            className="chamber-panel grain mt-10 p-8 text-center sm:p-12"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-success/50 text-success">
              <Check className="h-6 w-6" />
            </span>

            <h2 className="mt-6 font-display text-2xl text-parchment">File secured</h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              The original document has been added to the JURY HASH archive.
            </p>

            <p className="mx-auto mt-4 max-w-md truncate font-mono text-xs tracking-[0.14em] text-brass">
              {operation.file.name}
            </p>

            <p className="mx-auto mt-1 text-xs text-muted-foreground/80">
              {humanSize(operation.file.size)}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/records"
                search={{ case: operation.caseId }}
                className="focus-legal inline-flex items-center gap-2 border border-brass/60 bg-brass/10 px-5 py-2.5 text-sm text-parchment transition-colors hover:bg-brass hover:text-primary-foreground"
              >
                Open case
              </Link>

              <button
                type="button"
                onClick={reset}
                className="focus-legal inline-flex items-center gap-2 border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-brass-dim hover:text-parchment"
              >
                <FileUp className="h-4 w-4" />
                File another
              </button>
            </div>
          </section>
        ) : phase === "FAILED" && operation ? (
          /* ============================================================
             FAILURE — clear, restrained, retryable
             ============================================================ */
          <section
            aria-label="Document processing failed"
            className="chamber-panel grain mt-10 p-8 text-center sm:p-12"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-burgundy/50 text-burgundy">
              <ShieldAlert className="h-6 w-6" />
            </span>

            <h2 className="mt-6 font-display text-2xl text-parchment">
              Document processing failed
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-burgundy" role="alert">
              {error ?? "The document could not be processed. Please try again."}
            </p>

            <p className="mx-auto mt-4 max-w-md truncate font-mono text-xs tracking-[0.14em] text-brass">
              {operation.file.name}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={retryFiling}
                className="focus-legal inline-flex items-center gap-2 border border-brass/60 bg-brass/10 px-5 py-2.5 text-sm text-parchment transition-colors hover:bg-brass hover:text-primary-foreground"
              >
                Retry
              </button>

              <button
                type="button"
                onClick={reset}
                className="focus-legal inline-flex items-center gap-2 border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-brass-dim hover:text-parchment"
              >
                <FileUp className="h-4 w-4" />
                Start a new filing
              </button>
            </div>
          </section>
        ) : phase === "SUBMITTING" || phase === "PROCESSING" ? (
          /* ============================================================
             PROCESSING — real backend stages via the status endpoint
             ============================================================ */
          <section
            aria-live="polite"
            aria-busy="true"
            aria-label="Case file processing"
            className="chamber-panel grain mt-10 p-8 sm:p-12"
          >
            <p className="label-legal">
              {phase === "SUBMITTING" ? "Filing case file" : "Preserving case file"}
            </p>

            <h2 className="mt-3 font-display text-[clamp(1.5rem,3vw,2rem)] leading-tight text-parchment">
              Preserving case file
            </h2>

            {operation && (
              <div className="mt-6 flex items-center gap-3 border border-border bg-surface/60 px-4 py-3">
                <FileText className="h-5 w-5 shrink-0 text-brass" aria-hidden="true" />

                <div className="min-w-0">
                  <p className="truncate text-sm text-parchment">{operation.file.name}</p>

                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {humanSize(operation.file.size)} · document received
                  </p>
                </div>
              </div>
            )}

            <ol className="mt-8 space-y-2">
              {STEPS.map((step) => {
                const visual = stepVisual(step.stage);

                return (
                  <li
                    key={step.stage}
                    aria-current={visual === "active" ? "step" : undefined}
                    className={`flex items-start gap-4 border-l-2 px-4 py-3 transition-colors ${
                      visual === "active" ? "border-brass bg-surface/70" : "border-transparent"
                    }`}
                  >
                    {visual === "active" ? (
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brass/60 text-brass"
                        aria-hidden="true"
                      >
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                      </span>
                    ) : visual === "completed" ? (
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-success/40 text-success"
                        aria-hidden="true"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : visual === "failed" ? (
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-burgundy/60 text-burgundy"
                        aria-hidden="true"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground/50"
                        aria-hidden="true"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      </span>
                    )}

                    <div>
                      <p
                        className={`text-sm ${
                          visual === "active"
                            ? "text-parchment"
                            : visual === "failed"
                              ? "text-burgundy"
                              : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </p>

                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground/70">
                        {step.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-8 flex items-center gap-2.5 border-t border-border pt-6">
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-brass motion-reduce:animate-none"
                aria-hidden="true"
              />

              <p role="status" className="text-sm text-muted-foreground">
                {statusMessage ??
                  (phase === "SUBMITTING" ? "Submitting case file…" : "Processing document…")}
              </p>
            </div>
          </section>
        ) : (
          <form onSubmit={submitForm}>
            {/* Dropzone */}
            <section aria-label="Case file drop area" className="mt-10">
              <div
                role="button"
                tabIndex={0}
                aria-label="Choose a case file — drag and drop or press Enter to browse"
                aria-disabled={busy}
                onClick={() => {
                  if (busy) return;
                  document.getElementById("case-file-input")?.click();
                }}
                onKeyDown={handleKeyDown}
                onDragOver={(e) => {
                  e.preventDefault();

                  if (busy) return;
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={`focus-legal chamber-panel grain relative flex cursor-pointer flex-col items-center justify-center border px-6 py-14 text-center transition-all duration-300 sm:py-16 ${
                  dragActive
                    ? "border-brass bg-brass/[0.05] shadow-[0_0_0_1px_color-mix(in_oklab,var(--brass)_45%,transparent)]"
                    : "border-dashed"
                } ${busy ? "pointer-events-none opacity-60" : ""}`}
              >
                <input
                  id="case-file-input"
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />

                <span className="flex h-14 w-14 items-center justify-center border border-brass/50 text-brass">
                  <FileUp className="h-6 w-6" />
                </span>

                <p className="mt-6 font-display text-lg text-parchment">
                  {dragActive ? "Release to attach the file" : "Drag & drop the case file here"}
                </p>

                <p className="mt-2 text-sm text-muted-foreground">or</p>

                <span className="mt-3 inline-flex items-center gap-2 border border-brass/60 bg-brass/10 px-5 py-2 text-sm text-parchment transition-colors hover:bg-brass hover:text-primary-foreground">
                  Browse files
                </span>

                <p className="mt-6 text-[11px] tracking-wide text-muted-foreground/80">
                  PDF — original evidence document
                </p>
              </div>

              <div className="mt-4 flex items-start gap-2.5 px-1 text-[11px] leading-relaxed text-muted-foreground/80">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass-dim" />

                <p>
                  Secure intake: the original PDF is uploaded to protected storage. Case information
                  will be derived from the document during processing.
                </p>
              </div>
            </section>

            {/* Selected file */}
            {file && (
              <section aria-label="Review uploaded file" className="mt-10">
                <div className="flex items-center justify-between border border-border bg-surface/60 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-5 w-5 shrink-0 text-brass" />

                    <div className="min-w-0">
                      <p className="truncate text-sm text-parchment">{file.name}</p>

                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {humanSize(file.size)} · ready to upload
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (busy) return;
                      setFile(null);
                      setError(null);
                    }}
                    disabled={busy}
                    aria-label="Remove selected file"
                    className="focus-legal flex h-8 w-8 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-burgundy hover:text-burgundy disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Confidentiality */}
                <div
                  className={`mt-4 flex items-start justify-between gap-4 border px-5 py-4 transition-colors ${
                    confidential
                      ? "border-burgundy/60 bg-burgundy/[0.06]"
                      : "border-border bg-surface/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Lock
                      className={`mt-0.5 h-4 w-4 ${
                        confidential ? "text-burgundy" : "text-brass-dim"
                      }`}
                    />

                    <div>
                      <p className="text-sm text-parchment">Confidential matter</p>

                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Restricts access to this record according to its confidential
                        classification.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={confidential}
                    disabled={busy}
                    onClick={() => setConfidential((v) => !v)}
                    className={`focus-legal relative h-6 w-11 shrink-0 border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      confidential
                        ? "border-burgundy bg-burgundy/70"
                        : "border-input bg-transparent"
                    }`}
                  >
                    <span
                      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 bg-parchment transition-all duration-200 ${
                        confidential ? "left-[calc(100%-1.25rem)]" : "left-1"
                      }`}
                    />

                    <span className="sr-only">Mark matter confidential</span>
                  </button>
                </div>

                {error && (
                  <div className="mt-4 border border-burgundy/50 bg-burgundy/[0.06] px-4 py-3 text-sm text-burgundy">
                    {error}
                  </div>
                )}

                <div className="mt-6 flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={busy}
                    aria-busy={busy}
                    className="focus-legal inline-flex items-center gap-2 border border-primary/60 bg-primary px-5 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-secondary-brown disabled:cursor-progress disabled:opacity-70 disabled:hover:bg-primary"
                  >
                    {busy && (
                      <LoaderCircle
                        className="h-4 w-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    )}
                    File case in the archive
                  </button>

                  <Link
                    to="/dashboard"
                    className="focus-legal text-sm text-muted-foreground transition-colors hover:text-parchment"
                  >
                    Cancel and return to dashboard
                  </Link>
                </div>
              </section>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
