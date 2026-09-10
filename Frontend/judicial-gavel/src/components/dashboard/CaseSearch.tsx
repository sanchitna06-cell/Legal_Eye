import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { EMPTY_CASE_SEARCH, type CaseSearchFields } from "@/data/cases";

interface CaseSearchProps {
  value: string;
  onChange: (value: string) => void;
  filters: CaseSearchFields;
  onFiltersChange: (filters: CaseSearchFields) => void;
}

const FILTER_FIELDS: Array<{
  key: keyof CaseSearchFields;
  label: string;
  placeholder: string;
}> = [
  { key: "name", label: "Case name", placeholder: "Marwah v. Union Bank" },
  { key: "caseNo", label: "Case no. / year", placeholder: "CIV-2024-0417" },
  { key: "plaintiff", label: "Plaintiff / complainant", placeholder: "State of Karnataka" },
  { key: "defendant", label: "Defendant", placeholder: "A. Rehman" },
  { key: "fir", label: "FIR no.", placeholder: "428/2023" },
  { key: "policeStation", label: "Police station", placeholder: "K.R. Puram" },
  { key: "cnr", label: "CNR number", placeholder: "KAHC01/001188/2023" },
];

export function CaseSearch({ value, onChange, filters, onFiltersChange }: CaseSearchProps) {
  const active = filters ?? EMPTY_CASE_SEARCH;
  const activeCount = Object.values(active).filter((v) => v.trim()).length;
  const [refineOpen, setRefineOpen] = useState(false);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-brass-dim" />
        <label htmlFor="case-search" className="sr-only">
          Search your legal records
        </label>
        <input
          id="case-search"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by case name, case no., party, FIR, police station or CNR…"
          autoComplete="off"
          spellCheck={false}
          className={`focus-legal h-16 w-full border border-border bg-surface/45 py-4 pl-13 font-display text-[15px] tracking-wide text-parchment outline-none transition-all duration-300 placeholder:font-sans placeholder:text-sm placeholder:font-light placeholder:text-muted-foreground/60 hover:border-brass-dim focus:border-brass focus:bg-surface/70 focus:shadow-[0_0_0_1px_color-mix(in_oklab,var(--brass)_35%,transparent),0_18px_44px_-24px_oklch(0_0_0/0.85)] ${
            value ? "pr-24" : "pr-14"
          }`}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="focus-legal absolute right-14 top-1/2 -translate-y-1/2 px-1 py-1 text-[10px] tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:text-brass"
          >
            Clear
          </button>
        )}
        {/* Refine search — trigger lives inside the search field */}
        <button
          type="button"
          onClick={() => setRefineOpen((o) => !o)}
          aria-expanded={refineOpen}
          aria-controls="refine-search-panel"
          aria-label={refineOpen ? "Close refine search" : "Open refine search"}
          title="Refine search by field"
          className={`focus-legal absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center border transition-colors ${
            refineOpen || activeCount > 0
              ? "border-brass/50 bg-surface/70 text-brass"
              : "border-border text-muted-foreground hover:border-brass-dim hover:text-parchment"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center border border-brass/40 bg-background px-0.5 font-mono text-[9px] leading-none tracking-[0.08em] text-brass">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Refine by field */}
      <div
        id="refine-search-panel"
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          refineOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden" inert={!refineOpen}>
          <div className="mt-4 border border-border bg-surface/30 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-brass-dim" />
                <span className="label-legal">Refine search</span>
                {activeCount > 0 && (
                  <span className="border border-brass/40 px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-[0.12em] text-brass">
                    {activeCount}
                  </span>
                )}
              </div>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => onFiltersChange(EMPTY_CASE_SEARCH)}
                  className="focus-legal text-[10px] tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:text-brass"
                >
                  Clear all filters
                </button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {FILTER_FIELDS.map((field) => (
                <div key={field.key}>
                  <label htmlFor={`case-filter-${field.key}`} className="label-legal">
                    {field.label}
                  </label>
                  <input
                    id={`case-filter-${field.key}`}
                    value={active[field.key]}
                    onChange={(e) => onFiltersChange({ ...active, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    className="focus-legal mt-1.5 w-full border-b border-input bg-transparent pb-2 text-sm text-parchment outline-none transition-colors placeholder:text-muted-foreground/50 hover:border-brass-dim focus:border-brass"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
