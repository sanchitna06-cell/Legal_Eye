import { useCallback, useEffect, useRef, useState } from "react";
import type { Annotation, AnnotationPosition, AnnotationType } from "@/lib/api";

/* ============================================================
   ANNOTATION TOOL DEFINITIONS
   ============================================================ */ export type AnnotationTool =
  "pan" | "select" | "pen" | "highlighter" | "eraser" | "text";

export const ANNOTATION_COLORS = [
  { value: "#c8963e", label: "Brass" },
  { value: "#c0392b", label: "Burgundy" },
  { value: "#6b8e4e", label: "Olive" },
  { value: "#3d6b8e", label: "Steel" },
  { value: "#1a1a1a", label: "Ink" },
] as const;

export const DEFAULT_ANNOTATION_COLOR = ANNOTATION_COLORS[0].value;

/* ============================================================
   ANNOTATION SHAPES
   ============================================================
   Freehand strokes are arrays of page-space points (a line is a
   two-point stroke); rectangles carry two corners; text carries
   an anchor plus content. Everything lives in normalized page
   space (0..1 of the rendered page) so annotations survive zoom
   and device-pixel changes. Persisted verbatim as the backend's
   annotation position JSON.
   ============================================================ */

export interface StrokePoint {
  x: number;
  y: number;
}

export interface ShapeGeometry {
  /** Freehand / line stroke points (also the eraser hit-test path). */
  points?: StrokePoint[];
  /**
   * Highlight bands — one rectangle per selected text line, normalized to
   * the rendered page. Produced from the PDF.js text-layer selection so the
   * highlight follows the actual selected text (multi-line safe).
   */
  rects?: Array<{ x0: number; y0: number; x1: number; y1: number }>;
  /** Text font size normalized to page width so annotations scale with zoom. */
  fontSize?: number;
  /** Bounding corners for rectangle. */
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  /** Text annotation anchor. */
  x?: number;
  y?: number;
}

export interface LocalAnnotation {
  id: string;
  page: number;
  type: AnnotationType;
  color: string;
  strokeWidth: number;
  geometry: ShapeGeometry;
  content?: string | null;
  /** Backend annotation id once accepted; null while session-local. */
  serverId?: string | null;
}

function localId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Stable empty list so callers always get a referentially-stable value. */
const EMPTY_SHAPES: LocalAnnotation[] = [];

/** Payload persisted as the backend's annotation position JSON. */
export function toPositionPayload(
  annotation: Omit<LocalAnnotation, "id" | "serverId">,
): AnnotationPosition {
  return {
    color: annotation.color,
    strokeWidth: annotation.strokeWidth,
    geometry: annotation.geometry,
  };
}

export interface AddShapeInput {
  page: number;
  type: AnnotationType;
  color: string;
  strokeWidth: number;
  geometry: ShapeGeometry;
  content?: string | null;
}

/** Undo/redo entry: what changed and in which direction. */
interface HistoryEntry {
  action: "add" | "remove" | "replace";
  shapes?: LocalAnnotation[];
  original?: LocalAnnotation;
  replacements?: LocalAnnotation[];
}
interface AnnotationStoreOptions {
  documentId: string;
  /** Annotations loaded from the backend for this document. */
  serverAnnotations: Annotation[];
  /**
   * Backend create call. Optional so the workspace stays usable while the
   * annotations endpoint is being wired; unsynced strokes remain in session
   * state only.
   */
  createOnServer?: (input: {
    page: number;
    type: AnnotationType;
    position: AnnotationPosition;
    content?: string | null;
  }) => Promise<Annotation>;
  /** Backend delete call; undefined while the endpoint is being wired. */
  deleteOnServer?: (annotationId: string) => Promise<void>;
}

/**
 * Session-scoped annotation store for one document.
 *
 * State lives in a ref (bumped by a version counter) so every mutation is a
 * plain event-handler operation — no state updates inside state updaters,
 * which keeps StrictMode double-invocation harmless.
 *
 * - Shapes are page-specific, stored per page number in normalized space.
 * - Undo pops the last operation and inverts it; redo re-applies it.
 * - Erasing removes a shape and remembers it for redo.
 * - When `createOnServer` is provided, finished strokes are pushed to the
 *   backend's Annotation model and reconciled by id; failures degrade to
 *   session-local strokes without blocking the workspace.
 */
export function useAnnotationStore({
  documentId,
  serverAnnotations,
  createOnServer,
  deleteOnServer,
}: AnnotationStoreOptions) {
  const shapesRef = useRef<Map<number, LocalAnnotation[]>>(new Map());
  const [version, setVersion] = useState(0);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const serverSeen = useRef<Set<string>>(new Set());

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const setShapes = useCallback(
    (page: number, list: LocalAnnotation[]) => {
      if (list.length === 0) {
        shapesRef.current.delete(page);
      } else {
        shapesRef.current.set(page, list);
      }
      bump();
    },
    [bump],
  );

  // Hydrate from the backend when the document's server annotations arrive.
  useEffect(() => {
    if (serverAnnotations.length === 0) return;

    let added = false;
    for (const ann of serverAnnotations) {
      if (serverSeen.current.has(ann.id)) continue;
      serverSeen.current.add(ann.id);

      const geometry = (ann.position?.["geometry"] ?? {}) as ShapeGeometry;
      const shape: LocalAnnotation = {
        id: ann.id,
        page: ann.page,
        type: (ann.type as AnnotationType) ?? "pen",
        color:
          typeof ann.position?.["color"] === "string"
            ? (ann.position["color"] as string)
            : DEFAULT_ANNOTATION_COLOR,
        strokeWidth:
          typeof ann.position?.["strokeWidth"] === "number"
            ? (ann.position["strokeWidth"] as number)
            : 2,
        geometry,
        content: ann.content ?? null,
        serverId: ann.id,
      };
      // Copy before mutating (see addShapes — identity is the render signal).
      const list = [...(shapesRef.current.get(shape.page) ?? [])];
      list.push(shape);
      shapesRef.current.set(shape.page, list);
      added = true;
    }
    if (added) bump();
  }, [serverAnnotations, bump]);

  const addShapes = useCallback(
    (shapes: LocalAnnotation[]) => {
      for (const shape of shapes) {
        // Copy before mutating: consumers compare list identity to skip
        // re-rendering pages whose annotations did not change.
        const list = [...(shapesRef.current.get(shape.page) ?? [])];
        list.push(shape);
        shapesRef.current.set(shape.page, list);
      }
      bump();
    },
    [bump],
  );

  const removeShapes = useCallback(
    (shapes: LocalAnnotation[]) => {
      for (const shape of shapes) {
        const list = (shapesRef.current.get(shape.page) ?? []).filter((s) => s.id !== shape.id);
        if (list.length === 0) {
          shapesRef.current.delete(shape.page);
        } else {
          shapesRef.current.set(shape.page, list);
        }
      }
      bump();
    },
    [bump],
  );

  const addShape = useCallback(
    (input: AddShapeInput): string => {
      const shape: LocalAnnotation = {
        ...input,
        id: localId(),
        serverId: null,
      };
      addShapes([shape]);
      setUndoStack((prev) => [...prev, { action: "add", shapes: [shape] }]);
      setRedoStack([]);

      if (createOnServer) {
        createOnServer({
          page: shape.page,
          type: shape.type,
          position: toPositionPayload(shape),
          content: shape.content ?? null,
        })
          .then((created) => {
            serverSeen.current.add(created.id);
            const list = shapesRef.current.get(shape.page) ?? [];
            setShapes(
              shape.page,
              list.map((s) =>
                s.id === shape.id ? { ...s, id: created.id, serverId: created.id } : s,
              ),
            );
          })
          .catch(() => {
            // Keep the stroke session-local; the evidence workspace stays usable.
          });
      }

      return shape.id;
    },
    [addShapes, createOnServer, setShapes],
  );

  const removeShape = useCallback(
    (page: number, shapeId: string) => {
      const list = shapesRef.current.get(page) ?? [];
      const removed = list.find((s) => s.id === shapeId);
      if (!removed) return;

      removeShapes([removed]);
      setUndoStack((prev) => [...prev, { action: "remove", shapes: [removed] }]);
      setRedoStack([]);

      if (deleteOnServer && removed.serverId) {
        deleteOnServer(removed.serverId).catch(() => {
          // Server deletion failure is non-fatal for the visual layer.
        });
      }
    },
    [deleteOnServer, removeShapes],
  );
  const eraseStrokeSegment = useCallback(
    (page: number, shapeId: string, replacementShapes: LocalAnnotation[]) => {
      const list = shapesRef.current.get(page) ?? [];
      const original = list.find((shape) => shape.id === shapeId);

      if (!original) return;

      const next = list.filter((shape) => shape.id !== shapeId).concat(replacementShapes);

      setShapes(page, next);

      setUndoStack((prev) => [
        ...prev,
        {
          action: "replace",
          original,
          replacements: replacementShapes,
        },
      ]);

      setRedoStack([]);
    },
    [setShapes],
  );

  /** Replace one shape in place (text edits, text moves) as an undoable step. */
  const replaceShape = useCallback(
    (page: number, shapeId: string, updated: LocalAnnotation) => {
      eraseStrokeSegment(page, shapeId, [updated]);
    },
    [eraseStrokeSegment],
  );

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      const entry = prev[prev.length - 1];
      if (!entry) return prev;

      if (entry.action === "add") {
        removeShapes(entry.shapes ?? []);
      } else if (entry.action === "remove") {
        addShapes(entry.shapes ?? []);
      } else if (entry.action === "replace") {
        if (entry.replacements) {
          removeShapes(entry.replacements);
        }

        if (entry.original) {
          addShapes([entry.original]);
        }
      }
      setRedoStack((redo) => [...redo, entry]);
      return prev.slice(0, -1);
    });
  }, [addShapes, removeShapes]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      const entry = prev[prev.length - 1];
      if (!entry) return prev;

      if (entry.action === "add") {
        addShapes(entry.shapes ?? []);
      } else if (entry.action === "remove") {
        removeShapes(entry.shapes ?? []);
      } else if (entry.action === "replace") {
        if (entry.original) {
          removeShapes([entry.original]);
        }

        if (entry.replacements) {
          addShapes(entry.replacements);
        }
      }

      setUndoStack((undo) => [...undo, entry]);
      return prev.slice(0, -1);
    });
  }, [addShapes, removeShapes]);

  // A new function identity per version keeps consumers re-rendering on
  // changes; the ref is read fresh on every render.
  const shapesForPage = useCallback(
    (page: number): LocalAnnotation[] => shapesRef.current.get(page) ?? EMPTY_SHAPES,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the intentional render signal
    [version],
  );

  return {
    shapesForPage,
    addShape,
    removeShape,
    replaceShape,
    eraseStrokeSegment,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
