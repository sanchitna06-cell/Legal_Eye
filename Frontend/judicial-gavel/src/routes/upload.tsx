import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type DragEvent, type KeyboardEvent } from "react";
import { Check, FileText, FileUp, Lock, ShieldCheck, X } from "lucide-react";
import { format } from "date-fns";
import { AppHeader } from "@/components/layout/AppHeader";
import { useCaseActions, useCases, toCaseRecord } from "@/lib/case-store";
import { getSession } from "@/lib/user-store";
import { uploadDocument } from "@/lib/api";

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

function humanSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPT = ".pdf";

function UploadCase() {
  const navigate = useNavigate();
  const { addCase } = useCaseActions();
  const cases = useCases();

  const [file, setFile] = useState<ChosenFile | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [confidential, setConfidential] = useState(false);
  const [recordedId, setRecordedId] = useState<string | null>(null);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pickFile(next: File | undefined) {
    if (!next) return;

    setFile({
      file: next,
      name: next.name,
      size: next.size,
    });

    setError(null);
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    pickFile(event.dataTransfer.files?.[0]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      document.getElementById("case-file-input")?.click();
    }
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Select a PDF before filing the matter.");
      return;
    }

    const provisionalTitle = file.name
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
      fileName: file.name,
    });

    try {
      const createdCase = await addCase(record);

      await uploadDocument(createdCase.id, file.file);

      setCreatedCaseId(createdCase.id);
    } catch (error) {
      console.error("Failed to create case or upload document:", error);

      setError(
        error instanceof Error ? error.message : "Failed to create case or upload document.",
      );
    }
  }
  function reset() {
    setFile(null);
    setConfidential(false);
    setRecordedId(null);
    setCreatedCaseId(null);
    setError(null);
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

        {recordedId ? (
          <section
            aria-label="File uploaded"
            className="chamber-panel grain mt-10 p-8 text-center sm:p-12"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-olive/50 text-olive">
              <Check className="h-6 w-6" />
            </span>

            <h2 className="mt-6 font-display text-2xl text-parchment">
              File uploaded successfully
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              <span className="font-mono text-xs tracking-[0.14em] text-brass">{recordedId}</span>{" "}
              has been securely added to your JURY HASH archive.
            </p>

            {file && (
              <p className="mx-auto mt-2 max-w-md truncate text-xs text-muted-foreground/80">
                {file.name}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/records" search={{ case: createdCaseId ?? undefined }} className="...">
                Open file
              </Link>

              <button
                type="button"
                onClick={reset}
                className="focus-legal inline-flex items-center gap-2 border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-brass-dim hover:text-parchment"
              >
                <FileUp className="h-4 w-4" />
                Upload more files
              </button>
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
                onClick={() => document.getElementById("case-file-input")?.click()}
                onKeyDown={handleKeyDown}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={`focus-legal chamber-panel grain relative flex cursor-pointer flex-col items-center justify-center border px-6 py-14 text-center transition-all duration-300 sm:py-16 ${
                  dragActive
                    ? "border-brass bg-brass/[0.05] shadow-[0_0_0_1px_color-mix(in_oklab,var(--brass)_45%,transparent)]"
                    : "border-dashed"
                }`}
              >
                <input
                  id="case-file-input"
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
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
                      setFile(null);
                      setError(null);
                    }}
                    aria-label="Remove selected file"
                    className="focus-legal flex h-8 w-8 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-burgundy hover:text-burgundy"
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
                    onClick={() => setConfidential((v) => !v)}
                    className={`focus-legal relative h-6 w-11 shrink-0 border transition-colors ${
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
                    className="focus-legal inline-flex items-center gap-2 border border-brass/60 bg-brass px-5 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-brass/80"
                  >
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
