import { useMemo } from "react";
import { Archive, FolderOpen, Lock, Scale } from "lucide-react";
import type { CaseRecord } from "@/data/cases";
import { isOpenMatter } from "@/data/cases";

interface CaseStatsProps {
  cases: CaseRecord[];
}

export function CaseStats({ cases }: CaseStatsProps) {
  const stats = useMemo(() => {
    const open = cases.filter(isOpenMatter);
    return {
      total: cases.length,
      open: open.length,
      reserved: open.filter((c) => c.status === "Reserved").length,
      confidential: open.filter((c) => c.classification === "confidential").length,
      archived: cases.filter((c) => c.archived || c.status === "Disposed").length,
    };
  }, [cases]);

  const blocks: Array<{
    label: string;
    value: number;
    note: string;
    icon: typeof FolderOpen;
    tone: string;
  }> = [
    {
      label: "Open matters",
      value: stats.open,
      note: "currently on file",
      icon: FolderOpen,
      tone: "text-parchment",
    },
    {
      label: "Reserved",
      value: stats.reserved,
      note: "awaiting judgment",
      icon: Scale,
      tone: "text-brass",
    },
    {
      label: "Confidential",
      value: stats.confidential,
      note: "restricted records",
      icon: Lock,
      tone: "text-[color:color-mix(in_oklab,var(--burgundy)_80%,var(--parchment))]",
    },
    {
      label: "Completed",
      value: stats.archived,
      note: "kept for reference",
      icon: Archive,
      tone: "text-muted-foreground",
    },
  ];

  return (
    <section
      aria-label="Case overview"
      className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4"
    >
      {blocks.map((block) => {
        const Icon = block.icon;
        return (
          <div key={block.label} className="bg-surface/60 px-5 py-4">
            <div className="flex items-center gap-2">
              <Icon className={`h-3.5 w-3.5 ${block.tone}`} />
              <span className="label-legal">{block.label}</span>
            </div>
            <p
              className={`mt-2 font-display font-medium text-3xl font-medium leading-none ${block.tone}`}
            >
              {block.value}
            </p>
            <p className="mt-2 text-xs text-muted-foreground/80">{block.note}</p>
          </div>
        );
      })}
    </section>
  );
}
