import {
  useEffect,
  useSyncExternalStore,
} from "react";

import { useUser } from "@/lib/user-store";

import type {
  CaseCategory,
  CaseRecord,
} from "@/data/cases";

import {
  createCase,
  getCases,
  type BackendCase,
} from "@/lib/api";


/* ==========================================================================
   SHARED CASE STORE
   ========================================================================== */

type CaseStoreState = {
  cases: CaseRecord[];
  loading: boolean;
};

const PINNED_STORAGE_KEY =
  "jury-hash:pinned-cases";

const ARCHIVED_STORAGE_KEY =
  "jury-hash:archived-cases";

let state: CaseStoreState = {
  cases: [],
  loading: false,
};

let loadedForUserId: string | null = null;
let loadStarted = false;
let loadPromise: Promise<void> | null = null;
let loadGeneration = 0;

const listeners = new Set<
  () => void
>();


function formatCaseDate(
  iso: string,
): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}


function emit() {
  listeners.forEach(
    (listener) => {
      listener();
    },
  );
}


function subscribe(
  listener: () => void,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}


function getSnapshot() {
  return state;
}


/*
 * TanStack/React may render on the server.
 * The initial server snapshot must therefore
 * remain deterministic and browser-independent.
 */
function getServerSnapshot() {
  return state;
}


/* ==========================================================================
   PINNED CASE PERSISTENCE
   ========================================================================== */

function getPinnedIds(): Set<string> {
  if (
    typeof window ===
    "undefined"
  ) {
    return new Set();
  }

  try {
    const raw =
      window.localStorage.getItem(
        PINNED_STORAGE_KEY,
      );

    if (!raw) {
      return new Set();
    }

    const parsed =
      JSON.parse(raw);

    if (
      !Array.isArray(
        parsed,
      )
    ) {
      return new Set();
    }

    return new Set(
      parsed.filter(
        (
          value,
        ): value is string =>
          typeof value ===
          "string",
      ),
    );
  } catch {
    return new Set();
  }
}


function getArchivedIds(): Set<string> {
  if (
    typeof window ===
    "undefined"
  ) {
    return new Set();
  }

  try {
    const raw =
      window.localStorage.getItem(
        ARCHIVED_STORAGE_KEY,
      );

    if (!raw) {
      return new Set();
    }

    const parsed =
      JSON.parse(raw);

    if (
      !Array.isArray(
        parsed,
      )
    ) {
      return new Set();
    }

    return new Set(
      parsed.filter(
        (
          value,
        ): value is string =>
          typeof value ===
          "string",
      ),
    );
  } catch {
    return new Set();
  }
}


function saveArchivedIds(
  ids: Set<string>,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      ARCHIVED_STORAGE_KEY,
      JSON.stringify(
        Array.from(ids),
      ),
    );
  } catch {
    // Session-only fallback.
  }
}


function savePinnedIds(
  ids: Set<string>,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      PINNED_STORAGE_KEY,
      JSON.stringify(
        Array.from(ids),
      ),
    );
  } catch {
    /*
     * Pinning should still work for
     * the current session if storage
     * is unavailable.
     */
  }
}


/* ==========================================================================
   CATEGORY MAPPING
   ========================================================================== */

function toCaseCategory(
  value: string | null | undefined,
): CaseCategory | undefined {
  const normalized =
    value?.trim().toLowerCase();

  switch (normalized) {
    case "criminal":
      return "Criminal";

    case "civil":
      return "Civil";

    case "constitutional":
      return "Constitutional";

    default:
      return undefined;
  }
}


/* ==========================================================================
   BACKEND → FRONTEND MAPPING
   ========================================================================== */

function mapBackendCase(
  record: BackendCase,
): CaseRecord {
  const pinnedIds =
    getPinnedIds();

  return {
    id: record.id,

    title:
      record.title,

    court:
      "Not recorded",

    category:
      toCaseCategory(record.category) ??
      "Criminal",

    bench:
      "To be assigned",

    status:
      "Active",

    classification:
      record.classification
        .toLowerCase() ===
      "confidential"
        ? "confidential"
        : "general",

    filed:
      formatCaseDate(
        record.created_at,
      ),

    updated:
      formatCaseDate(
        record.created_at,
      ),

    subject:
      "General",

    pinned:
      pinnedIds.has(
        record.id,
      ),

    parties: [
      {
        role: "Petitioner",
        name:
          "Not recorded",
      },
      {
        role: "Respondent",
        name:
          "Not recorded",
      },
    ],

    history: [
      {
        date:
          formatCaseDate(
            record.created_at,
          ),

        title:
          "Record created",

        note:
          "Case created in JURY HASH.",
      },
    ],

    summary:
      record.description ??
      "No summary recorded for this matter yet.",

    issues: [],

    authorities: [],
  };
}


/* ==========================================================================
   BACKEND CASE LOADING
   ========================================================================== */

async function refreshCases(
  userId?: string,
) {
  const requestGeneration =
    loadGeneration;

  try {
    state = {
      ...state,
      loading: true,
    };

    emit();

    const backendCases =
      await getCases();

    /*
     * The authenticated user may have changed while
     * the request was in flight.
     *
     * Never allow a response belonging to the previous
     * session to populate the current case store.
     */
    if (
      requestGeneration !==
        loadGeneration ||
      (
        userId !== undefined &&
        userId !== loadedForUserId
      )
    ) {
      return;
    }

    const pinnedIds =
      getPinnedIds();

    const archivedIds =
      getArchivedIds();

    const mappedCases =
      backendCases.map(
        mapBackendCase,
      );

    const nextCases =
      mappedCases.map(
        (record) => ({
          ...record,

          pinned:
            pinnedIds.has(
              record.id,
            ),

          archived:
            archivedIds.has(
              record.id,
            ),
        }),
      );

    state = {
      cases:
        nextCases,

      loading:
        false,
    };

    emit();
  } catch (error) {
    console.error(
      "Failed to load cases:",
      error,
    );

    /*
     * Do not let a stale request from a previous
     * authenticated session modify the current store.
     */
    if (
      requestGeneration !==
        loadGeneration ||
      (
        userId !== undefined &&
        userId !== loadedForUserId
      )
    ) {
      return;
    }

    state = {
      ...state,
      loading: false,
    };

    emit();
  }
}


function ensureCasesLoaded(
  userId: string,
) {
  if (!userId) {
    return Promise.resolve();
  }

  if (
    loadStarted &&
    loadedForUserId ===
      userId
  ) {
    return loadPromise;
  }

  loadStarted = true;

  loadedForUserId =
    userId;

  loadPromise =
    refreshCases(
      userId,
    ).finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}


/* ==========================================================================
   CASES HOOK
   ========================================================================== */

export function useCases(): CaseRecord[] {
  const snapshot =
    useSyncExternalStore(
      subscribe,
      getSnapshot,
      getServerSnapshot,
    );

  const user =
    useUser();

  const userId =
    user?.id ?? null;

  useEffect(() => {
    /*
     * No authenticated user:
     * immediately clear all case data from memory.
     */
    if (!userId) {
      loadGeneration += 1;

      loadedForUserId =
        null;

      loadStarted =
        false;

      loadPromise =
        null;

      state = {
        cases: [],
        loading: false,
      };

      emit();

      return;
    }

    /*
     * User changed:
     * invalidate the previous user's case state
     * before loading the new user's cases.
     */
    if (
      loadedForUserId !==
      userId
    ) {
      loadGeneration += 1;

      loadedForUserId =
        null;

      loadStarted =
        false;

      loadPromise =
        null;

      state = {
        cases: [],
        loading: true,
      };

      emit();
    }

    void ensureCasesLoaded(
      userId,
    );
  }, [userId]);

  return snapshot.cases;
}


/* ==========================================================================
   STORE ACTIONS
   ========================================================================== */

export function useCaseActions() {
  return {
    /* ----------------------------------------------------------------------
       CREATE CASE
       ---------------------------------------------------------------------- */

    addCase: async (
      record: CaseRecord,
    ): Promise<BackendCase> => {
      const response =
        await createCase({
          title:
            record.title,

          description:
            record.summary,

          classification:
            record.classification,

          category:
            record.category ??
            "Civil",
        });

      /*
       * Refresh the shared store so every
       * consumer sees the newly-created case.
       */
      await refreshCases();

      return response.case;
    },


    /* ----------------------------------------------------------------------
       PIN / UNPIN
       ---------------------------------------------------------------------- */

    togglePinned: (
      id: string,
    ) => {
      const currentCases =
        state.cases;

      const target =
        currentCases.find(
          (record) =>
            record.id ===
            id,
        );

      if (!target) {
        return;
      }

      const nextPinned =
        !Boolean(
          target.pinned,
        );

      const nextCases =
        currentCases.map(
          (record) =>
            record.id === id
              ? {
                  ...record,
                  pinned:
                    nextPinned,
                }
              : record,
        );

      state = {
        ...state,
        cases:
          nextCases,
      };

      /*
       * Persist only the preference.
       * The legal case itself remains
       * backend-owned data.
       */
      const pinnedIds =
        new Set(
          getPinnedIds(),
        );

      if (nextPinned) {
        pinnedIds.add(id);
      } else {
        pinnedIds.delete(id);
      }

      savePinnedIds(
        pinnedIds,
      );

      /*
       * This is the important part:
       * notify every component using
       * useCases().
       */
      emit();
    },


    /* ----------------------------------------------------------------------
       ARCHIVE
       ---------------------------------------------------------------------- */

    archiveCase: (
      id: string,
    ) => {
      const target =
        state.cases.find(
          (record) =>
            record.id ===
            id,
        );

      if (!target) {
        return;
      }

      const archivedIds =
        getArchivedIds();

      archivedIds.add(id);

      saveArchivedIds(
        archivedIds,
      );

      state = {
        ...state,

        cases:
          state.cases.map(
            (record) =>
              record.id === id
                ? {
                    ...record,

                    archived:
                      true,

                    pinned:
                      false,
                  }
                : record,
          ),
      };

      /*
       * An archived matter should no longer
       * remain in the pinned quick-access list.
       */
      const pinnedIds =
        getPinnedIds();

      pinnedIds.delete(id);

      savePinnedIds(
        pinnedIds,
      );

      emit();
    },


    /* ----------------------------------------------------------------------
       UNARCHIVE
       ---------------------------------------------------------------------- */

    unarchiveCase: (
      id: string,
    ) => {
      const target =
        state.cases.find(
          (record) =>
            record.id ===
            id,
        );

      if (!target) {
        return;
      }

      const archivedIds =
        getArchivedIds();

      archivedIds.delete(id);

      saveArchivedIds(
        archivedIds,
      );

      state = {
        ...state,

        cases:
          state.cases.map(
            (record) =>
              record.id === id
                ? {
                    ...record,

                    archived:
                      false,
                  }
                : record,
          ),
      };

      emit();
    },


    /* ----------------------------------------------------------------------
       UPDATE CASE
       ---------------------------------------------------------------------- */

    updateCase: (
      _id: string,
      _patch: Partial<CaseRecord>,
    ) => {
      throw new Error(
        "Case updates are not connected to the backend yet.",
      );
    },


    /* ----------------------------------------------------------------------
       REFRESH
       ---------------------------------------------------------------------- */

    refreshCases: async () => {
      await refreshCases();
    },
  };
}


/* ==========================================================================
   NEW CASE INPUT
   ========================================================================== */

export interface NewCaseInput {
  id: string;

  title: string;

  category: string;

  court: string;

  bench: string;

  status:
    CaseRecord["status"];

  classification:
    CaseRecord["classification"];

  filed: string;

  subject: string;

  petitioner: string;

  respondent: string;

  summary: string;

  fileName?: string;
}


/* ==========================================================================
   LOCAL CASE RECORD BUILDER
   ========================================================================== */

export function toCaseRecord(
  input: NewCaseInput,
): CaseRecord {
  return {
    id:
      input.id
        .trim()
        .toUpperCase(),

    title:
      input.title.trim(),

    category:
      toCaseCategory(input.category) ??
      "Criminal",

    court:
      input.court.trim(),

    bench:
      input.bench.trim() ||
      "To be assigned",

    status:
      input.status,

    classification:
      input.classification,

    filed:
      input.filed.trim() ||
      "Not recorded",

    updated:
      "just now",

    subject:
      input.subject.trim() ||
      "General",

    pinned:
      false,

    parties: [
      {
        role: "Petitioner",

        name:
          input.petitioner.trim() ||
          "Not recorded",
      },

      {
        role: "Respondent",

        name:
          input.respondent.trim() ||
          "Not recorded",
      },
    ],

    history: [
      {
        date:
          input.filed.trim() ||
          "Today",

        title:
          "Record created",

        note:
          input.fileName
            ? `Case file attached: ${input.fileName}`
            : "Entered into the archive.",
      },
    ],

    summary:
      input.summary.trim() ||
      "No summary recorded for this matter yet.",

    issues: [],

    authorities: [],
  };
}