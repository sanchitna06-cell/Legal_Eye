import { useEffect, useState } from "react";

import type { CaseRecord } from "@/data/cases";
import { createCase, getCases, type BackendCase } from "@/lib/api";

function mapBackendCase(record: BackendCase): CaseRecord {
  return {
    id: record.id,
    title: record.title,
    court: record.department ?? "Not recorded",
    bench: "To be assigned",
    status: "Active",
    classification:
      record.classification.toLowerCase() === "confidential" ? "confidential" : "general",
    filed: new Date(record.created_at).toLocaleDateString(),
    updated: new Date(record.created_at).toLocaleDateString(),
    subject: "General",
    parties: [
      {
        role: "Petitioner",
        name: "Not recorded",
      },
      {
        role: "Respondent",
        name: "Not recorded",
      },
    ],
    history: [
      {
        date: new Date(record.created_at).toLocaleDateString(),
        title: "Record created",
        note: "Case created in JURY HASH.",
      },
    ],
    summary: record.description ?? "No summary recorded for this matter yet.",
    issues: [],
    authorities: [],
  };
}

export function useCases(): CaseRecord[] {
  const [cases, setCases] = useState<CaseRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadCases() {
      try {
        const backendCases = await getCases();

        if (!cancelled) {
          setCases(backendCases.map(mapBackendCase));
        }
      } catch (error) {
        console.error("Failed to load cases:", error);

        if (!cancelled) {
          setCases([]);
        }
      }
    }

    loadCases();

    return () => {
      cancelled = true;
    };
  }, []);

  return cases;
}

export function useCaseActions() {
  return {
    addCase: async (record: CaseRecord): Promise<BackendCase> => {
      const response = await createCase({
        title: record.title,
        description: record.summary,
        classification: record.classification,
      });

      return response.case;
    },

    togglePinned: (_id: string) => {
      throw new Error("Case pinning is not connected to the backend yet.");
    },

    updateCase: (_id: string, _patch: Partial<CaseRecord>) => {
      throw new Error("Case updates are not connected to the backend yet.");
    },
  };
}
export interface NewCaseInput {
  id: string;
  title: string;
  court: string;
  bench: string;
  status: CaseRecord["status"];
  classification: CaseRecord["classification"];
  filed: string;
  subject: string;
  petitioner: string;
  respondent: string;
  summary: string;
  fileName?: string;
}

export function toCaseRecord(input: NewCaseInput): CaseRecord {
  return {
    id: input.id.trim().toUpperCase(),
    title: input.title.trim(),
    court: input.court.trim(),
    bench: input.bench.trim() || "To be assigned",
    status: input.status,
    classification: input.classification,
    filed: input.filed.trim() || "Not recorded",
    updated: "just now",
    subject: input.subject.trim() || "General",
    parties: [
      {
        role: "Petitioner",
        name: input.petitioner.trim() || "Not recorded",
      },
      {
        role: "Respondent",
        name: input.respondent.trim() || "Not recorded",
      },
    ],
    history: [
      {
        date: input.filed.trim() || "Today",
        title: "Record created",
        note: input.fileName
          ? `Case file attached: ${input.fileName}`
          : "Entered into the archive.",
      },
    ],
    summary: input.summary.trim() || "No summary recorded for this matter yet.",
    issues: [],
    authorities: [],
  };
}
