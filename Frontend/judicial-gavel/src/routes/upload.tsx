import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";

import {
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
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

import { uploadDocument } from "@/lib/api";

import {
  useCaseActions,
  toCaseRecord,
} from "@/lib/case-store";

import {
  CASE_CATEGORIES,
  type CaseCategory,
} from "@/data/cases";

import { getSession } from "@/lib/user-store";


/* ==========================================================================
   ROUTE
   ========================================================================== */

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
        typeof caseId === "string" &&
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
          "Securely preserve original legal documents in JURY HASH and create or update a case record.",
      },
    ],
  }),

  component:
    UploadCase,
});


/* ==========================================================================
   TYPES
   ========================================================================== */

interface ChosenFile {
  file: File;
  name: string;
  size: number;
}

interface UploadResult {
  file: ChosenFile;
  documentId: string | null;
  error: string | null;
}

type UploadPhase =
  | "IDLE"
  | "SUBMITTING"
  | "FAILED";


/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const ACCEPT = ".pdf";


/* ==========================================================================
   HELPERS
   ========================================================================== */

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


function isPdf(
  file: File,
) {
  return (
    file.type ===
      "application/pdf" ||
    file.name
      .toLowerCase()
      .endsWith(".pdf")
  );
}


function makeFileKey(
  file: File,
) {
  return [
    file.name,
    file.size,
    file.lastModified,
  ].join(":");
}


/* ==========================================================================
   MAIN COMPONENT
   ========================================================================== */

function UploadCase() {
  const navigate =
    useNavigate();

  const {
    addCase,
  } =
    useCaseActions();

  const {
    case: existingCaseId,
  } = useSearch({
    from: "/upload",
  });


  /* ------------------------------------------------------------------------
     Layout
     ------------------------------------------------------------------------ */

  const [
    sidebarExpanded,
    setSidebarExpanded,
  ] = useState(true);

  const [
    mobileDrawerOpen,
    setMobileDrawerOpen,
  ] = useState(false);


  /* ------------------------------------------------------------------------
     Files
     ------------------------------------------------------------------------ */

  const [
    files,
    setFiles,
  ] = useState<ChosenFile[]>(
    [],
  );

  const [
    dragActive,
    setDragActive,
  ] = useState(false);


  /* ------------------------------------------------------------------------
     New-case metadata
     ------------------------------------------------------------------------ */

  const [
    petitioner,
    setPetitioner,
  ] = useState("");

  const [
    respondent,
    setRespondent,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState<CaseCategory>(
    CASE_CATEGORIES[0] ??
      "Criminal",
  );

  const [
    confidential,
    setConfidential,
  ] = useState(false);


  /* ------------------------------------------------------------------------
     Upload state
     ------------------------------------------------------------------------ */

  const [
    phase,
    setPhase,
  ] = useState<UploadPhase>(
    "IDLE",
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    uploadResults,
    setUploadResults,
  ] = useState<UploadResult[]>(
    [],
  );

  const [
    currentFileIndex,
    setCurrentFileIndex,
  ] = useState(0);


  /* ------------------------------------------------------------------------
     Refs
     ------------------------------------------------------------------------ */

  const inFlightRef =
    useRef(false);


  const busy =
    phase ===
    "SUBMITTING";


  /* ==========================================================================
     FILE HANDLING
     ========================================================================== */

  function addFiles(
    incoming:
      | FileList
      | File[]
      | undefined,
  ) {
    if (!incoming || busy) {
      return;
    }

    const incomingFiles =
      Array.from(incoming);

    if (
      incomingFiles.length ===
      0
    ) {
      return;
    }

    const invalidFile =
      incomingFiles.find(
        (item) =>
          !isPdf(item),
      );

    if (invalidFile) {
      setError(
        `"${invalidFile.name}" is not a PDF. Only PDF documents can be added to the case archive.`,
      );

      return;
    }

    const existingKeys =
      new Set(
        files.map(
          (item) =>
            makeFileKey(
              item.file,
            ),
        ),
      );

    const nextFiles =
      incomingFiles
        .filter((item) => {
          const key =
            makeFileKey(item);

          if (
            existingKeys.has(
              key,
            )
          ) {
            return false;
          }

          existingKeys.add(key);

          return true;
        })
        .map(
          (item) => ({
            file: item,
            name: item.name,
            size: item.size,
          }),
        );

    if (
      nextFiles.length ===
      0
    ) {
      setError(
        "Those documents are already selected.",
      );

      return;
    }

    setFiles(
      (current) => [
        ...current,
        ...nextFiles,
      ],
    );

    setError(null);
    setPhase("IDLE");
  }


  function removeFile(
    index: number,
  ) {
    if (busy) {
      return;
    }

    setFiles(
      (current) =>
        current.filter(
          (_, itemIndex) =>
            itemIndex !==
            index,
        ),
    );

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

    addFiles(
      event.dataTransfer.files,
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


  /* ==========================================================================
     VALIDATION
     ========================================================================== */

  function validateForm() {
    if (
      files.length ===
      0
    ) {
      return "Select at least one PDF before filing the matter.";
    }

    if (
      !existingCaseId
    ) {
      if (
        !petitioner.trim()
      ) {
        return "Enter the petitioner or first party name.";
      }

      if (
        !respondent.trim()
      ) {
        return "Enter the respondent or second party name.";
      }

      if (
        !category
      ) {
        return "Select a case category.";
      }
    }

    return null;
  }


  /* ==========================================================================
     SUBMIT
     ========================================================================== */

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

    const validationError =
      validateForm();

    if (validationError) {
      setError(
        validationError,
      );

      return;
    }

    inFlightRef.current = true;

    setError(null);
    setPhase("SUBMITTING");
    setCurrentFileIndex(0);
    setUploadResults([]);


    const selectedFiles =
      [...files];

    let targetCaseId =
      existingCaseId ??
      null;

    try {
      /*
       * ----------------------------------------------------------------------
       * CREATE NEW CASE
       * ----------------------------------------------------------------------
       */

      if (!targetCaseId) {
        const caseTitle =
          `${petitioner.trim()} vs ${respondent.trim()}`;

        const record =
          toCaseRecord({
            id: "",
            title:
              caseTitle,
            category:
              category,
            court: "",
            bench:
              "To be assigned",
            status:
              "Active",
            classification:
              confidential
                ? "confidential"
                : "general",
            filed: format(
              new Date(),
              "dd MMM yyyy",
            ),
            subject:
              category,
            petitioner:
              petitioner.trim(),
            respondent:
              respondent.trim(),
            summary:
              "Case metadata pending document analysis.",
          });

        const createdCase =
          await addCase(
            record,
          );

        targetCaseId =
          createdCase.id;
      }


      /*
       * ----------------------------------------------------------------------
       * UPLOAD EVERY FILE
       * ----------------------------------------------------------------------
       */

      const successfulUploads:
        UploadResult[] = [];

      for (
        let index = 0;
        index <
        selectedFiles.length;
        index += 1
      ) {
        const chosenFile =
          selectedFiles[index];

          if (!chosenFile) {
            continue;
        }

        setCurrentFileIndex(
          index,
        );

        try {
          const response =
            await uploadDocument(
              targetCaseId,
              chosenFile.file,
            );

          successfulUploads.push({
            file:
              chosenFile,
            documentId:
              response.document_id,
            error: null,
          });

          setUploadResults(
            [
              ...successfulUploads,
            ],
          );
        } catch (
          uploadError
        ) {
          const message =
            uploadError instanceof
              Error &&
            uploadError.message
              ? uploadError.message
              : "This document could not be uploaded.";

          setUploadResults([
            ...successfulUploads,
            {
              file:
                chosenFile,
              documentId:
                null,
              error:
                message,
            },
          ]);

          setError(
            `Upload failed for "${chosenFile.name}". ${message}`,
          );

          setPhase(
            "FAILED",
          );

          inFlightRef.current =
            false;

          return;
        }
      }


      /*
       * ----------------------------------------------------------------------
       * COMPLETE
       *
       * The upload page only navigates after every selected document has
       * successfully reached the backend.
       * ----------------------------------------------------------------------
       */

      const firstDocument =
        successfulUploads.find(
          (result) =>
            result.documentId,
        );

      inFlightRef.current =
        false;

      if (
        firstDocument?.documentId
      ) {
        await navigate({
          to:
            "/documents/$documentId",
          params: {
            documentId:
              firstDocument.documentId,
          },
          search: {
            case:
              targetCaseId,
          },
        });

        return;
      }

      throw new Error(
        "The documents were uploaded, but no document identifier was returned.",
      );
    } catch (submitError) {
      console.error(
        "Failed to create case or upload documents:",
        submitError,
      );

      const message =
        submitError instanceof
          Error &&
        submitError.message
          ? submitError.message
          : "Failed to create case or upload documents.";

      setError(message);

      inFlightRef.current =
        false;

      setPhase(
        "FAILED",
      );
    }
  }


  /* ==========================================================================
     RESET
     ========================================================================== */

  function reset() {
    inFlightRef.current =
      false;

    setFiles([]);
    setPetitioner("");
    setRespondent("");
    setCategory(
      CASE_CATEGORIES[0] ??
        "Criminal",
    );
    setConfidential(false);
    setUploadResults([]);
    setCurrentFileIndex(0);
    setError(null);
    setPhase("IDLE");
  }


  /* ==========================================================================
     RENDER
     ========================================================================== */

  const uploadedCount =
    uploadResults.filter(
      (result) =>
        Boolean(
          result.documentId,
        ),
    ).length;

  const totalFiles =
    files.length;

  const currentFile =
    files[currentFileIndex] ??
    null;


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


      {/* ====================================================================
          SIDEBAR OFFSET
          ==================================================================== */}

      <div
        className={`transition-[padding-left] duration-300 ease-out ${
          sidebarExpanded
            ? "md:pl-80"
            : "md:pl-16"
        }`}
      >

        <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">

          {/* ==================================================================
              PAGE HEADER
              ================================================================== */}

          <header className="pt-10 sm:pt-14">

            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

              <div>

                <p className="label-legal">
                  RECORD INTAKE
                </p>

                <h1 className="mt-3 font-display text-[clamp(2.1rem,4vw,3.2rem)] leading-[0.95] tracking-[-0.015em] text-parchment">
                  {existingCaseId
                    ? "Add Evidence"
                    : "Create New Case"}
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {existingCaseId
                    ? "Attach one or more original PDFs to an existing matter. Existing case classification and access controls remain unchanged."
                    : "Define the matter, assign its legal category, and submit one or more original PDFs for secure preservation."}
                </p>

              </div>


              <div className="shrink-0 pb-1">

                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-brass-dim uppercase">

                  <span
                    className="h-1.5 w-1.5 rounded-full bg-brass"
                    aria-hidden="true"
                  />

                  Intake

                  <span className="text-brass">
                    ·
                  </span>

                  01

                </div>

              </div>

            </div>


            <div className="mt-7 h-px w-full rule-brass" />

          </header>


          {/* ==================================================================
              PROCESS MAP
              ================================================================== */}

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
                    "Define",
                  description:
                    existingCaseId
                      ? "Confirm the target matter."
                      : "Name and classify the matter.",
                },
                {
                  number:
                    "02",
                  label:
                    "Select",
                  description:
                    "Choose one or more original PDFs.",
                },
                {
                  number:
                    "03",
                  label:
                    "Preserve",
                  description:
                    "Store every original securely.",
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
                      index ===
                        2
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


          {/* ==================================================================
              UPLOAD FAILURE
              ================================================================== */}

          {phase ===
            "FAILED" ? (

            <section
              aria-label="Document upload failed"
              className="chamber-panel grain mt-8 border border-burgundy/50 p-7 sm:p-10"
            >

              <div className="mx-auto max-w-2xl text-center">

                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-burgundy/50 text-burgundy">

                  <ShieldAlert className="h-7 w-7" />

                </span>


                <p className="label-legal mt-6 text-burgundy">
                  UPLOAD INTERRUPTED
                </p>


                <h2 className="mt-3 font-display text-3xl text-parchment">
                  Document could not be uploaded
                </h2>


                <p
                  className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-burgundy"
                  role="alert"
                >
                  {error ??
                    "One or more documents were not stored."}
                </p>


                {uploadResults.length >
                  0 && (

                  <div className="mx-auto mt-6 max-w-xl border border-border bg-surface/60 text-left">

                    <div className="border-b border-border px-4 py-3">

                      <p className="font-mono text-[9px] font-bold tracking-[0.14em] text-brass-dim uppercase">
                        Upload results
                      </p>

                    </div>


                    <div className="divide-y divide-border">

                      {uploadResults.map(
                        (
                          result,
                          index,
                        ) => (

                          <div
                            key={`${makeFileKey(result.file.file)}-${index}`}
                            className="flex items-start gap-3 px-4 py-3"
                          >

                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brass" />

                            <div className="min-w-0 flex-1">

                              <p className="truncate text-sm text-parchment">
                                {
                                  result.file.name
                                }
                              </p>

                              <p className="mt-1 font-mono text-[9px] tracking-[0.08em] uppercase">

                                {result.documentId
                                  ? (
                                    <span className="text-brass">
                                      STORED
                                    </span>
                                  )
                                  : (
                                    <span className="text-burgundy">
                                      FAILED
                                    </span>
                                  )}

                              </p>

                            </div>

                          </div>

                        ),
                      )}

                    </div>

                  </div>

                )}


                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">

                  <button
                    type="button"
                    onClick={
                      reset
                    }
                    className="focus-legal inline-flex items-center gap-2 border border-brass/60 bg-brass/10 px-5 py-2.5 text-sm text-parchment transition-colors hover:bg-brass hover:text-primary-foreground"
                  >

                    <FileUp className="h-4 w-4" />

                    Start over

                  </button>

                </div>

              </div>

            </section>

          ) : phase ===
            "SUBMITTING" ? (

            /* ==================================================================
                UPLOADING
                ================================================================== */

            <section
              aria-live="polite"
              aria-busy="true"
              aria-label="Uploading case documents"
              className="chamber-panel grain mt-8 border border-border p-6 sm:p-8"
            >

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

                <div>

                  <p className="label-legal">
                    PRESERVING
                  </p>

                  <h2 className="mt-2 font-display text-2xl text-parchment sm:text-3xl">
                    Storing case files
                  </h2>

                </div>


                <div className="font-mono text-[10px] tracking-[0.14em] text-brass-dim uppercase">
                  {uploadedCount} / {totalFiles} stored
                </div>

              </div>


              {currentFile && (

                <div className="mt-6 flex items-start gap-3 border border-border bg-surface/60 px-4 py-3.5">

                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brass" />

                  <div className="min-w-0 flex-1">

                    <p className="truncate text-sm text-parchment">
                      {
                        currentFile.name
                      }
                    </p>

                    <p className="mt-1 font-mono text-[10px] tracking-[0.06em] text-muted-foreground">
                      {humanSize(
                        currentFile.size,
                      )}{" "}
                      · DOCUMENT{" "}
                      {currentFileIndex +
                        1}{" "}
                      OF{" "}
                      {totalFiles}
                    </p>

                  </div>


                  <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-brass motion-reduce:animate-none" />

                </div>

              )}


              <div className="mt-8 h-1 overflow-hidden bg-border">

                <div
                  className="h-full bg-brass transition-all duration-300"
                  style={{
                    width:
                      `${Math.max(
                        4,
                        (
                          uploadedCount /
                          Math.max(
                            totalFiles,
                            1,
                          )
                        ) *
                          100,
                      )}%`,
                  }}
                />

              </div>


              <div className="mt-8 flex items-start gap-3 border-t border-border pt-5">

                <span
                  className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-brass motion-reduce:animate-none"
                  aria-hidden="true"
                />

                <div>

                  <p
                    role="status"
                    className="text-sm text-parchment"
                  >
                    Uploading original documents…
                  </p>

                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">
                    Every upload must reach protected storage and receive a document record before this page continues. Document analysis runs separately in the background.
                  </p>

                </div>

              </div>

            </section>

          ) : (

            /* ==================================================================
                IDLE / INPUT
                ================================================================== */

            <form
              onSubmit={
                submitForm
              }
            >

              {/* ================================================================
                  CASE METADATA
                  ================================================================ */}

              {!existingCaseId && (

                <section
                  aria-label="Case information"
                  className="mt-8"
                >

                  <div className="border border-border bg-surface/35">

                    <div className="border-b border-border px-5 py-4">

                      <p className="label-legal">
                        MATTER DETAILS
                      </p>

                      <h2 className="mt-2 font-display text-2xl text-parchment">
                        Define the case
                      </h2>

                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        These details become the initial case record. Document analysis can enrich the matter later.
                      </p>

                    </div>


                    <div className="grid gap-5 p-5 sm:grid-cols-2">

                      {/* --------------------------------------------------------
                          PETITIONER
                          -------------------------------------------------------- */}

                      <label className="block">

                        <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-brass-dim uppercase">
                          Petitioner / First Party
                        </span>

                        <input
                          type="text"
                          value={
                            petitioner
                          }
                          onChange={(
                            event,
                          ) =>
                            setPetitioner(
                              event
                                .target
                                .value,
                            )
                          }
                          disabled={
                            busy
                          }
                          placeholder="e.g. MUKESH"
                          className="focus-legal mt-2 w-full border border-border bg-background/60 px-4 py-3 text-sm text-parchment outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-brass disabled:cursor-not-allowed disabled:opacity-60"
                        />

                      </label>


                      {/* --------------------------------------------------------
                          RESPONDENT
                          -------------------------------------------------------- */}

                      <label className="block">

                        <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-brass-dim uppercase">
                          Respondent / Second Party
                        </span>

                        <input
                          type="text"
                          value={
                            respondent
                          }
                          onChange={(
                            event,
                          ) =>
                            setRespondent(
                              event
                                .target
                                .value,
                            )
                          }
                          disabled={
                            busy
                          }
                          placeholder="e.g. STATE"
                          className="focus-legal mt-2 w-full border border-border bg-background/60 px-4 py-3 text-sm text-parchment outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-brass disabled:cursor-not-allowed disabled:opacity-60"
                        />

                      </label>


                      {/* --------------------------------------------------------
                          GENERATED CASE NAME
                          -------------------------------------------------------- */}

                      <div className="sm:col-span-2">

                        <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-brass-dim uppercase">
                          Case name
                        </span>

                        <div className="mt-2 border border-brass/30 bg-brass/[0.03] px-4 py-3">

                          <p className="font-display text-xl text-parchment">

                            {petitioner.trim() ||
                              "_____"}{" "}

                            <span className="text-brass">
                              vs
                            </span>{" "}

                            {respondent.trim() ||
                              "_____"}

                          </p>

                        </div>

                      </div>


                      {/* --------------------------------------------------------
                          CATEGORY
                          -------------------------------------------------------- */}

                      <label className="block">

                        <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-brass-dim uppercase">
                          Case category
                        </span>

                        <select
                          value={
                            category
                          }
                          onChange={(
                            event,
                          ) =>
                            setCategory(
                              event
                                .target
                                .value as CaseCategory,
                            )
                          }
                          disabled={
                            busy
                          }
                          className="focus-legal mt-2 w-full appearance-none border border-border bg-background/60 px-4 py-3 text-sm text-parchment outline-none transition-colors focus:border-brass disabled:cursor-not-allowed disabled:opacity-60"
                        >

                          {CASE_CATEGORIES.map(
                            (
                              item,
                            ) => (

                              <option
                                key={
                                  item
                                }
                                value={
                                  item
                                }
                                className="bg-background text-parchment"
                              >
                                {
                                  item
                                }
                              </option>

                            ),
                          )}

                        </select>

                        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">
                          Used to classify the matter in the case archive.
                        </p>

                      </label>


                      {/* --------------------------------------------------------
                          CONFIDENTIALITY
                          -------------------------------------------------------- */}

                      <div className="border border-border bg-background/40">

                        <div className="flex h-full items-center justify-between gap-4 px-4 py-4">

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

                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                Restricts access according to the confidential classification.
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

                    </div>

                  </div>

                </section>

              )}


              {/* ================================================================
                  EXISTING CASE NOTICE
                  ================================================================ */}

              {existingCaseId && (

                <section
                  aria-label="Existing case"
                  className="mt-8"
                >

                  <div className="flex items-start gap-3 border border-border bg-surface/35 px-5 py-5">

                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brass" />

                    <div>

                      <p className="label-legal">
                        EXISTING MATTER
                      </p>

                      <p className="mt-2 text-sm text-parchment">
                        Adding documents to the selected case
                      </p>

                      <p className="mt-1 font-mono text-[10px] tracking-[0.06em] text-muted-foreground">
                        CASE ID ·{" "}
                        {
                          existingCaseId
                        }
                      </p>

                      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                        The existing case name, category, classification, and access controls will remain unchanged.
                      </p>

                    </div>

                  </div>

                </section>

              )}


              {/* ================================================================
                  DROPZONE
                  ================================================================ */}

              <section
                aria-label="Case file selection"
                className="mt-8"
              >

                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Choose PDF case files"
                  aria-disabled={
                    busy
                  }
                  onClick={() => {

                    if (busy) {
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

                    if (!busy) {
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
                  className={`group focus-legal chamber-panel grain relative flex min-h-[330px] cursor-pointer flex-col items-center justify-center border px-6 py-12 text-center transition-all duration-300 sm:min-h-[350px] ${
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
                    multiple
                    className="sr-only"
                    disabled={
                      busy
                    }
                    onChange={(
                      event,
                    ) => {

                      if (event.target.files) {
                        addFiles(event.target.files);
                      }
                      event.target.value =
                        "";

                    }}
                  />


                  <span
                    className={`flex h-16 w-16 items-center justify-center border transition-all duration-300 ${
                      dragActive
                        ? "border-brass bg-brass/10 text-brass"
                        : "border-brass/40 text-brass group-hover:border-brass group-hover:bg-brass/[0.05]"
                    }`}
                  >

                    <FileUp className="h-7 w-7" />

                  </span>


                  <p className="mt-6 font-display text-2xl text-parchment">

                    {dragActive
                      ? "Release to attach"
                      : "Drop your PDFs here"}

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
                      Multiple files
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
                    Original PDFs are submitted to protected storage. Each document receives its own preservation and processing lifecycle while remaining attached to the selected case.
                  </p>

                </div>

              </section>


              {/* ================================================================
                  FILE REVIEW
                  ================================================================ */}

              {files.length >
                0 && (

                <section
                  aria-label="Review selected files"
                  className="mt-8"
                >

                  <div className="border border-border bg-surface/35">

                    <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

                      <div>

                        <p className="label-legal">
                          DOCUMENTS
                        </p>

                        <p className="mt-2 text-sm text-parchment">
                          {files.length}{" "}
                          {files.length ===
                          1
                            ? "PDF selected"
                            : "PDFs selected"}
                        </p>

                      </div>


                      <button
                        type="button"
                        onClick={() =>
                          document
                            .getElementById(
                              "case-file-input",
                            )
                            ?.click()
                        }
                        disabled={
                          busy
                        }
                        className="focus-legal inline-flex w-fit items-center gap-2 border border-border px-3 py-2 font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:border-brass hover:text-brass disabled:cursor-not-allowed disabled:opacity-50"
                      >

                        <FileUp className="h-3.5 w-3.5" />

                        Add more

                      </button>

                    </div>


                    <div className="divide-y divide-border">

                      {files.map(
                        (
                          selectedFile,
                          index,
                        ) => (

                          <div
                            key={`${makeFileKey(selectedFile.file)}-${index}`}
                            className="flex items-center gap-3 px-5 py-4"
                          >

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-brass/35 bg-brass/[0.04] text-brass">

                              <FileText className="h-5 w-5" />

                            </div>


                            <div className="min-w-0 flex-1">

                              <p className="truncate text-sm text-parchment">
                                {
                                  selectedFile.name
                                }
                              </p>

                              <p className="mt-1 font-mono text-[10px] tracking-[0.06em] text-muted-foreground">
                                {humanSize(
                                  selectedFile.size,
                                )}{" "}
                                · PDF · READY
                              </p>

                            </div>


                            <button
                              type="button"
                              onClick={() =>
                                removeFile(
                                  index,
                                )
                              }
                              disabled={
                                busy
                              }
                              aria-label={`Remove ${selectedFile.name}`}
                              className="focus-legal inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-burgundy disabled:cursor-not-allowed disabled:opacity-40"
                            >

                              <X className="h-4 w-4" />

                            </button>

                          </div>

                        ),
                      )}

                    </div>


                    {/* ------------------------------------------------------------
                        Matter scope
                        ------------------------------------------------------------ */}

                    <div className="border-t border-border p-5">

                      {existingCaseId ? (

                        <div className="flex items-start gap-3 border border-border bg-background/40 px-4 py-4">

                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brass-dim" />

                          <div>

                            <p className="text-sm text-parchment">
                              Adding to existing matter
                            </p>

                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              All selected PDFs will be attached to the selected case. Existing classification and access controls remain unchanged.
                            </p>

                          </div>

                        </div>

                      ) : (

                        <div className="flex items-start gap-3 border border-border bg-background/40 px-4 py-4">

                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass-dim" />

                          <div>

                            <p className="text-sm text-parchment">
                              New case preservation
                            </p>

                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              One case record will be created for{" "}
                              <span className="text-parchment">
                                {petitioner.trim() ||
                                  "_____"}
                                {" "}
                                vs{" "}
                                {respondent.trim() ||
                                  "_____"}
                              </span>
                              {" "}and every selected PDF will be attached to it.
                            </p>

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


                      {/* ----------------------------------------------------------
                          SUBMIT
                          ---------------------------------------------------------- */}

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
                            ? `Add ${files.length} ${
                                files.length ===
                                1
                                  ? "file"
                                  : "files"
                              } to case`
                            : `Create case & preserve ${files.length} ${
                                files.length ===
                                1
                                  ? "file"
                                  : "files"
                              }`}

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


              {/* ================================================================
                  EMPTY STATE FOOTER
                  ================================================================ */}

              {files.length ===
                0 && (

                <div className="mt-6 border-t border-border pt-5">

                  <div className="flex items-start gap-3 text-[11px] leading-relaxed text-muted-foreground/70">

                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass-dim" />

                    <p>
                      By continuing, the submitted documents will enter the JURY HASH preservation workflow. Do not upload material that should not be added to the matter.
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