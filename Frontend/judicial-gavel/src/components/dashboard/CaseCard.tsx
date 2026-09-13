import {
  Link,
  useNavigate,
} from "@tanstack/react-router";

import {
  ChevronRight,
  Clock,
  Fingerprint,
  Landmark,
  Lock,
  Pin,
  Plus,
  Users,
} from "lucide-react";

import type {
  KeyboardEvent,
} from "react";

import type {
  CaseRecord,
} from "@/data/cases";

import {
  STATUS_TONE,
  isConfidential,
} from "@/data/cases";

import {
  useCaseActions,
} from "@/lib/case-store";


function PartyLine({
  record,
}: {
  record: CaseRecord;
}) {
  const names =
    record.parties
      .slice(0, 2)
      .map(
        (party) =>
          party.name,
      )
      .filter(Boolean);

  if (
    names.length ===
    0
  ) {
    return (
      <span className="text-muted-foreground/70">
        Not specified
      </span>
    );
  }

  return (
    <span className="truncate">
      {names.join("  ·  ")}
    </span>
  );
}


function DisplayValue({
  value,
  fallback = "Not specified",
  mono = false,
}: {
  value?: string | null;
  fallback?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={
        mono
          ? "font-mono text-[11px]"
          : ""
      }
    >
      {value?.trim()
        ? value
        : fallback}
    </span>
  );
}


export function CaseCard({
  record,
}: {
  record: CaseRecord;
}) {
  const navigate =
    useNavigate();
  
  const {
    archiveCase,
    unarchiveCase,
  } =
    useCaseActions();

  const {
    togglePinned,
  } = useCaseActions();

  const confidential =
    isConfidential(
      record,
    );


  function openRecord() {
    navigate({
      to: "/records",
      search: {
        case: record.id,
      },
    });
  }


  function handleKeyDown(
    event: KeyboardEvent<HTMLElement>,
  ) {
    if (
      event.key ===
        "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openRecord();
    }
  }


  return (
    <article
      onClick={
        openRecord
      }
      onKeyDown={
        handleKeyDown
      }
      role="link"
      tabIndex={0}
      aria-label={`Open case ${record.id}: ${record.title}`}
      className={`focus-legal case-card group flex cursor-pointer flex-col p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 ${
        confidential
          ? "case-card-confidential"
          : ""
      }`}
    >

      {/* ==========================================================
          REFERENCE
          ========================================================== */}

      <div className="flex items-center justify-between gap-3">
        <span
          title={
            record.id
          }
          className="min-w-0 truncate font-mono text-[9px] tracking-[0.16em] text-brass-dim"
        >
          {record.id}
        </span>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();

            togglePinned(
              record.id,
            );
          }}
          aria-pressed={
            Boolean(
              record.pinned,
            )
          }
          aria-label={
            record.pinned
              ? `Unpin ${record.id}`
              : `Pin ${record.id}`
          }
          title={
            record.pinned
              ? "Pinned for quick access"
              : "Pin for quick access"
          }
          className={`focus-legal flex h-7 w-7 shrink-0 items-center justify-center border transition-colors ${
            record.pinned
              ? "border-brass/50 text-brass"
              : "border-transparent text-muted-foreground/45 hover:border-border hover:text-parchment"
          }`}
        >
          <Pin
            className={`h-3.5 w-3.5 ${
              record.pinned
                ? "fill-brass/25"
                : ""
            }`}
          />
        </button>
      </div>


      {/* ==========================================================
          TITLE
          ========================================================== */}

      <h3 className="mt-3 min-h-[3.1rem] font-display text-[18px] font-medium leading-snug text-parchment">
        {record.title}
      </h3>

      {record.subject && (
        <p className="label-legal mt-2">
          {record.subject}
        </p>
      )}


      {/* ==========================================================
          META
          ========================================================== */}

      <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-xs text-muted-foreground">

        <div className="flex min-w-0 items-center gap-2">
          <Landmark className="h-3.5 w-3.5 shrink-0 text-brass-dim" />

          <dt className="sr-only">
            Court
          </dt>

          <dd className="min-w-0 truncate">
            <DisplayValue
              value={
                record.court
              }
              fallback="Court not specified"
            />
          </dd>
        </div>


        {(record.cnr ||
          record.firNo ||
          record.policeStation) && (
          <div className="flex min-w-0 items-center gap-2">
            <Fingerprint className="h-3.5 w-3.5 shrink-0 text-brass-dim" />

            <dt className="sr-only">
              Case identifiers
            </dt>

            <dd className="min-w-0 truncate">
              {[
                record.cnr &&
                  `CNR ${record.cnr}`,

                record.firNo &&
                  `FIR ${record.firNo}`,

                record.policeStation,
              ]
                .filter(Boolean)
                .join(
                  "  ·  ",
                )}
            </dd>
          </div>
        )}


        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-3.5 w-3.5 shrink-0 text-brass-dim" />

          <dt className="sr-only">
            Parties
          </dt>

          <dd className="min-w-0 truncate">
            <PartyLine
              record={
                record
              }
            />
          </dd>
        </div>


        <div className="flex min-w-0 items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0 text-brass-dim" />

          <dt className="sr-only">
            Last updated
          </dt>

          <dd>
            Updated{" "}
            <span className="text-muted-foreground">
              {record.updated}
            </span>
          </dd>
        </div>

      </dl>


      {/* ==========================================================
          FOOTER
          ========================================================== */}

      <div className="mt-auto flex items-center gap-2 pt-5">
        <span className="flex min-w-0 flex-wrap items-center gap-2">

          <span
            className={`border px-2 py-0.5 text-[9px] font-medium tracking-[0.12em] uppercase ${STATUS_TONE[record.status]}`}
          >
            {record.status}
          </span>

          {confidential && (
            <span className="seal-confidential">
              <Lock className="h-2.5 w-2.5" />

              Confidential
            </span>
          )}

        </span>

        <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-medium tracking-[0.12em] text-brass uppercase transition-transform group-hover:translate-x-0.5">
          View case

          <ChevronRight className="h-3 w-3" />
        </span>
      </div>

    </article>
  );
}


/* ================================================================
   ADD CASE
   ================================================================ */

export function AddCaseTile() {
  return (
    <Link
      to="/upload"
      search={{ case: undefined }}
      aria-label="Create a new case"
      className="focus-legal case-card group flex min-h-[18rem] flex-col items-center justify-center gap-4 border-dashed bg-surface/20 p-8 text-center transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-surface/35"
    >
      <span className="flex h-12 w-12 items-center justify-center border border-brass/50 text-brass transition-all duration-300 group-hover:scale-105 group-hover:border-brass group-hover:bg-brass group-hover:text-primary-foreground">
        <Plus className="h-5 w-5" />
      </span>

      <span>
        <span className="block font-display text-lg text-parchment">
          Create New Case
        </span>

        <span className="mt-1 block text-xs text-muted-foreground">
          Upload a case file to begin intake
        </span>
      </span>

      <span className="text-[10px] tracking-[0.16em] text-brass-dim uppercase opacity-0 transition-opacity group-hover:opacity-100">
        Begin intake
      </span>
    </Link>
  );
}