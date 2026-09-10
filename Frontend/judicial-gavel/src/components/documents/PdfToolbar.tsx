import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Maximize,
  Minus,
  Move,
  Pencil,
  Plus,
  SquareDashed,
  TextSelect,
  Type,
  Undo2,
  Redo2,
  Highlighter,
} from "lucide-react";
import { ANNOTATION_COLORS, type AnnotationTool } from "@/hooks/useAnnotationStore";

interface PdfToolbarProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
  onFullscreen: () => void;
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;

  eraserSize: number;
  onEraserSizeChange: (size: number) => void;

  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearPage: () => void;
}

interface ToolButtonProps {
  icon: typeof Pencil;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolButton({ icon: Icon, label, active, disabled, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active ? "true" : undefined}
      title={label}
      aria-label={label}
      className={`focus-legal flex h-7.5 w-7.5 items-center justify-center border transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "border-brass/80 bg-brass/20 text-brass"
          : "border-transparent text-muted-foreground hover:border-border hover:bg-surface/70 hover:text-parchment"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

const STROKE_SIZES = [1, 2, 4, 6, 8, 12, 16];

/**
 * Viewer + annotation toolbar, mounted directly above the document.
 *
 * Left cluster: page navigation and zoom (standard document controls).
 * Right cluster: the annotation bench — visually set apart by the brass
 * hairline divider and the "ANNOTATE" micro-label so it reads as tools that
 * operate ON the document. The active tool takes a brass fill.
 *
 * Exactly one stroke-size selector exists: it appears for Pen and
 * Highlighter (shared width setting) or for Eraser (its own setting).
 */
export function PdfToolbar({
  page,
  pageCount,
  onPageChange,
  zoom,
  onZoomChange,
  onFit,
  onFullscreen,
  tool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  eraserSize,
  onEraserSizeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearPage,
}: PdfToolbarProps) {
  const [colorOpen, setColorOpen] = useState(false);

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/80 px-3 py-1.5"
      role="toolbar"
      aria-label="Document viewer and annotation tools"
    >
      {/* Page navigation */}
      <div className="flex items-center">
        <ToolButton
          icon={ChevronLeft}
          label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        />
        <span className="mx-1 flex items-baseline gap-1 border-x border-border px-2.5 py-1 font-mono text-[11px] tracking-wider">
          <span className="text-parchment">{String(page).padStart(2, "0")}</span>
          <span className="text-muted-foreground/70">/ {pageCount}</span>
        </span>
        <ToolButton
          icon={ChevronRight}
          label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        />
      </div>

      <span className="h-5 w-px bg-border" aria-hidden="true" />

      {/* Zoom */}
      <div className="flex items-center">
        <ToolButton
          icon={Minus}
          label="Zoom out"
          disabled={zoom <= 0.5}
          onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}
        />
        <button
          type="button"
          onClick={onFit}
          title="Fit page"
          className="focus-legal border-x border-border px-2.5 py-1 font-mono text-[11px] tracking-wider text-parchment transition-colors hover:text-brass"
        >
          {Math.round(zoom * 100)}%
        </button>
        <ToolButton
          icon={Plus}
          label="Zoom in"
          disabled={zoom >= 2.5}
          onClick={() => onZoomChange(Math.min(2.5, zoom + 0.1))}
        />
      </div>

      <span className="h-5 w-px bg-border" aria-hidden="true" />

      <ToolButton icon={SquareDashed} label="Fit to page" onClick={onFit} />
      <ToolButton icon={Maximize} label="Fullscreen" onClick={onFullscreen} />

      {/* Annotation bench — distinct section of the same toolbar */}
      <span className="ml-1 hidden h-5 w-px bg-brass-dim/50 sm:block" aria-hidden="true" />
      <span className="label-legal hidden px-1 text-[9px] !text-brass-dim sm:block">Annotate</span>

      <div className="flex items-center gap-0.5">
        <ToolButton
          icon={Move}
          label="Pan"
          active={tool === "pan"}
          onClick={() => onToolChange("pan")}
        />
        <ToolButton
          icon={TextSelect}
          label="Select text"
          active={tool === "select"}
          onClick={() => onToolChange("select")}
        />
        <ToolButton
          icon={Pencil}
          label="Pen"
          active={tool === "pen"}
          onClick={() => onToolChange("pen")}
        />
        <ToolButton
          icon={Highlighter}
          label="Highlighter — highlight the selected text"
          active={tool === "highlighter"}
          onClick={() => onToolChange("highlighter")}
        />
        <ToolButton
          icon={Type}
          label="Text"
          active={tool === "text"}
          onClick={() => onToolChange("text")}
        />
        <ToolButton
          icon={Eraser}
          label="Eraser — remove an annotation"
          active={tool === "eraser"}
          onClick={() => onToolChange("eraser")}
        />
      </div>

      {/* Size selector: exactly one, shared by pen/highlighter; eraser has
          its own. Sizes are only relevant to these tools. */}
      {(tool === "pen" || tool === "highlighter" || tool === "eraser") &&
        (tool === "eraser" ? (
          <select
            value={eraserSize}
            onChange={(event) => onEraserSizeChange(Number(event.target.value))}
            aria-label="Eraser size"
            title="Eraser size"
            className="h-7.5 border border-border bg-surface px-2 font-mono text-[10px] text-parchment outline-none"
          >
            {[8, 16, 24, 32, 48].map((size) => (
              <option key={size} value={size}>
                {size} px
              </option>
            ))}
          </select>
        ) : (
          <select
            value={strokeWidth}
            onChange={(event) => onStrokeWidthChange(Number(event.target.value))}
            aria-label="Stroke size"
            title="Stroke size"
            className="h-7.5 border border-border bg-surface px-2 font-mono text-[10px] text-parchment outline-none"
          >
            {STROKE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} px
              </option>
            ))}
          </select>
        ))}

      {/* Color selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setColorOpen((v) => !v)}
          aria-expanded={colorOpen}
          aria-haspopup="menu"
          title="Annotation colour"
          className="focus-legal flex h-7.5 items-center gap-1.5 border border-transparent px-1.5 transition-colors hover:border-border hover:bg-surface/70"
        >
          <span
            className="h-3.5 w-3.5 border border-black/40"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        </button>

        {colorOpen && (
          <div
            role="menu"
            aria-label="Annotation colour"
            className="chamber-panel absolute left-0 top-full z-30 mt-1.5 flex gap-1.5 border border-border p-2"
          >
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="menuitemradio"
                aria-checked={color === c.value}
                title={c.label}
                onClick={() => {
                  onColorChange(c.value);
                  setColorOpen(false);
                }}
                className={`focus-legal h-5 w-5 border transition-transform hover:scale-110 ${
                  color === c.value ? "border-brass" : "border-black/40"
                }`}
                style={{ backgroundColor: c.value }}
              >
                <span className="sr-only">{c.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="h-5 w-px bg-border" aria-hidden="true" />

      {/* History */}
      <ToolButton icon={Undo2} label="Undo" disabled={!canUndo} onClick={onUndo} />
      <ToolButton icon={Redo2} label="Redo" disabled={!canRedo} onClick={onRedo} />

      <span className="ml-auto hidden text-[10px] tracking-[0.14em] text-muted-foreground/60 uppercase md:block">
        Annotations layer · original untouched
      </span>
    </div>
  );
}
