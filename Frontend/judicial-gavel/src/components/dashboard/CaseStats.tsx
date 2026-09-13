import { useMemo } from "react";
import {
  Archive,
  FolderOpen,
  Lock,
  Scale,
} from "lucide-react";

import type { CaseRecord } from "@/data/cases";
import { isOpenMatter } from "@/data/cases";


interface CaseStatsProps {
  cases: CaseRecord[];
}


export function CaseStats({
  cases,
}: CaseStatsProps) {
  const stats = useMemo(() => {
    const open =
      cases.filter(
        isOpenMatter,
      );

    return {
      open: open.length,

      reserved:
        open.filter(
          (record) =>
            record.status ===
            "Reserved",
        ).length,

      confidential:
        open.filter(
          (record) =>
            record.classification ===
            "confidential",
        ).length,

      archived:
        cases.filter(
          (record) =>
            record.archived ||
            record.status ===
              "Disposed",
        ).length,
    };
  }, [cases]);


  const blocks = [
    {
      label: "Open matters",
      value: stats.open,
      note: "currently on file",
      icon: FolderOpen,
      tone: "text-parchment",
      emphasis:
        "bg-surface/75",
    },

    {
      label: "Reserved",
      value: stats.reserved,
      note: "awaiting judgment",
      icon: Scale,
      tone: "text-brass",
      emphasis:
        "bg-surface/50",
    },

    {
      label: "Confidential",
      value:
        stats.confidential,
      note: "restricted records",
      icon: Lock,
      tone:
        "text-[color:color-mix(in_oklab,var(--burgundy)_80%,var(--parchment))]",
      emphasis:
        "bg-surface/50",
    },

    {
      label: "Completed",
      value:
        stats.archived,
      note: "kept for reference",
      icon: Archive,
      tone:
        "text-muted-foreground",
      emphasis:
        "bg-surface/50",
    },
  ];


  return (
    <section
      aria-label="Case overview"
      className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4"
    >
      {blocks.map(
        (block, index) => {
          const Icon =
            block.icon;

          return (
            <div
              key={
                block.label
              }
              className={`px-5 py-4 ${block.emphasis}`}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={`h-3.5 w-3.5 ${block.tone}`}
                />

                <span className="label-legal">
                  {block.label}
                </span>
              </div>

              <p
                className={`mt-2 font-display text-[clamp(1.75rem,3vw,2rem)] font-medium leading-none ${block.tone}`}
              >
                {String(
                  block.value,
                ).padStart(
                  index === 0
                    ? 2
                    : 1,
                  "0",
                )}
              </p>

              <p className="mt-2 text-xs text-muted-foreground/80">
                {block.note}
              </p>
            </div>
          );
        },
      )}
    </section>
  );
}