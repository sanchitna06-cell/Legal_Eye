import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { LocalAnnotation } from "@/hooks/useAnnotationStore";
import { DEFAULT_TEXT_FONT_SIZE_FRACTION } from "@/components/documents/annotationSelection";

/* ============================================================
   INLINE TEXT ANNOTATION EDITOR

   A lightweight Canva/Paint-style text box positioned in the same
   normalized page space as every other annotation: click → type →
   Enter/blur commits a real annotation; Escape cancels; re-click
   with the text tool edits again. Zoom-safe by construction.
   (Selection → highlight geometry lives in annotationSelection.ts.)
   ============================================================ */

interface TextAnnotationEditorProps {
  page: number;
  width: number;
  height: number;
  /** Existing annotation being edited, or null for a fresh box. */
  annotation: LocalAnnotation | null;
  /** Anchor in normalized page space for a fresh box. */
  anchor: { x: number; y: number } | null;
  color: string;
  strokeWidth: number;
  onCommit: (input: {
    geometry: { x: number; y: number; fontSize?: number };
    content: string;
    color: string;
    strokeWidth: number;
  }) => void;
  onCancel: () => void;
}

const MIN_EDITOR_WIDTH = 160;
const MAX_EDITOR_WIDTH_FRACTION = 0.9;

export function TextAnnotationEditor({
  page,
  width,
  height,
  annotation,
  anchor,
  color,
  strokeWidth,
  onCommit,
  onCancel,
}: TextAnnotationEditorProps) {
  void page;
  void height;

  const [value, setValue] = useState(annotation?.content ?? "");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);

  // Fresh boxes anchor at the click point; edits stay at the annotation's
  // stored position.
  const left = annotation?.geometry.x ?? anchor?.x ?? 0.02;
  const top = annotation?.geometry.y ?? anchor?.y ?? 0.02;

  const fontSizeFraction = annotation?.geometry.fontSize ?? DEFAULT_TEXT_FONT_SIZE_FRACTION;
  const fontSizePx = fontSizeFraction * width;
  console.log("TEXT EDITOR RENDER", {
    page,
    width,
    height,
    annotation,
    anchor,
    left,
    top,
    fontSizePx,
  });

  useEffect(() => {
    const node = textAreaRef.current;
    if (!node) return;
    node.focus();
    // Place the caret at the end of existing text when re-editing.
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);

  const commit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;

    const trimmed = value.trim();
    if (!trimmed) {
      if (annotation) {
        // An emptied edit deletes the annotation (undoable via replace).
        onCommit({
          geometry: { x: left, y: top },
          content: "",
          color,
          strokeWidth,
        });
      } else {
        onCancel();
      }
      return;
    }

    onCommit({
      geometry: {
        x: left,
        y: top,
        fontSize: fontSizeFraction,
      },
      content: trimmed,
      color,
      strokeWidth,
    });
  }, [annotation, color, fontSizeFraction, left, onCancel, onCommit, strokeWidth, top, value]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        committedRef.current = true; // keep the original annotation intact
        onCancel();
      }
    },
    [commit, onCancel],
  );

  const style: CSSProperties = {
    position: "absolute",
    zIndex: 1000,
    pointerEvents: "auto",
    left: `${left * 100}%`,
    top: `${top * 100}%`,
    width: Math.max(MIN_EDITOR_WIDTH, Math.min(MAX_EDITOR_WIDTH_FRACTION * width, 280)),
    minHeight: fontSizePx * 1.8,
    fontSize: `${fontSizePx}px`,
    lineHeight: 1.45,
    color,
    background: "rgba(255,253,247,0.94)",
    border: "1px solid rgba(200,150,62,0.55)",
    boxShadow: "0 6px 18px -6px rgba(0,0,0,0.4)",
    padding: "2px 4px",
    margin: 0,
    resize: "none",
    overflow: "hidden",
    outline: "none",
    fontFamily: "IBM Plex Mono, monospace",
  };

  return (
    <textarea
      ref={textAreaRef}
      data-text-editor="true"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
      aria-label={annotation ? "Edit text annotation" : "New text annotation"}
      style={style}
      rows={1}
    />
  );
}
