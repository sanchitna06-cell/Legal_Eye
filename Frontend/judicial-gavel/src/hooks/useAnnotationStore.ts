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
  /** Annotations loaded from the backend, with their PDF page number resolved by the workspace. */
  serverAnnotations: Array<Annotation & { page: number }>;
  createOnServer?: (input: {
    page: number;
    type: AnnotationType;
    position: AnnotationPosition;
    content?: string | null;
  }) => Promise<Annotation>;
  updateOnServer?: (input: {
    annotationId: string;
    type: AnnotationType;
    position: AnnotationPosition;
    content?: string | null;
  }) => Promise<Annotation>;
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
  documentId: _documentId,
  serverAnnotations,
  createOnServer,
  updateOnServer,
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
        type: (ann.annotation_type as AnnotationType) ?? "pen",
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

  const persistCreate = useCallback(
    (shape: LocalAnnotation) => {
      if (!createOnServer) return;

      createOnServer({
        page: shape.page,
        type: shape.type,
        position: toPositionPayload(shape),
        content: shape.content ?? null,
      })
        .then((created) => {
          const list = shapesRef.current.get(shape.page) ?? [];
          const stillPresent = list.some((s) => s.id === shape.id);

          if (!stillPresent) {
            // The annotation was removed/undone before the POST completed.
            // Clean up the now-created server row instead of resurrecting it locally.
            if (deleteOnServer) {
              void deleteOnServer(created.id).catch(() => undefined);
            }
            return;
          }

          serverSeen.current.add(created.id);
          setShapes(
            shape.page,
            list.map((s) =>
              s.id === shape.id ? { ...s, id: created.id, serverId: created.id } : s,
            ),
          );
        })
        .catch(() => {
          // Keep the annotation session-local if persistence fails.
        });
    },
    [createOnServer, deleteOnServer, setShapes],
  );

  const persistDelete = useCallback(
    (shape: LocalAnnotation) => {
      if (deleteOnServer && shape.serverId) {
        deleteOnServer(shape.serverId).catch(() => {
          // Keep the visual layer responsive if persistence fails.
        });
      }
    },
    [deleteOnServer],
  );

  const persistUpdate = useCallback(
    (shape: LocalAnnotation) => {
      if (!updateOnServer || !shape.serverId) return;

      updateOnServer({
        annotationId: shape.serverId,
        type: shape.type,
        position: toPositionPayload(shape),
        content: shape.content ?? null,
      }).catch(() => {
        // Keep the local edit if persistence fails.
      });
    },
    [updateOnServer],
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

      persistCreate(shape);

      return shape.id;
    },
    [addShapes, persistCreate],
  );

  const removeShape = useCallback(
    (page: number, shapeId: string) => {
      const list = shapesRef.current.get(page) ?? [];
      const removed = list.find((s) => s.id === shapeId);
      if (!removed) return;

      removeShapes([removed]);
      setUndoStack((prev) => [...prev, { action: "remove", shapes: [removed] }]);
      setRedoStack([]);

      persistDelete(removed);
    },
    [persistDelete, removeShapes],
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

      if (original.serverId) {
        persistDelete(original);
      }
      for (const replacement of replacementShapes) {
        persistCreate(replacement);
      }
    },
    [persistCreate, persistDelete, setShapes],
  );

  /** Replace one shape in place (text edits, text moves) as an undoable step. */
  const replaceShape = useCallback(
    (page: number, shapeId: string, updated: LocalAnnotation) => {
      const list = shapesRef.current.get(page) ?? [];
      const original = list.find((shape) => shape.id === shapeId);
      if (!original) return;

      const next = list.map((shape) => (shape.id === shapeId ? updated : shape));
      setShapes(page, next);
      setUndoStack((prev) => [...prev, { action: "replace", original, replacements: [updated] }]);
      setRedoStack([]);

      if (updated.serverId) {
        persistUpdate(updated);
      } else if (original.serverId) {
        // A replacement without a server id supersedes a persisted annotation.
        persistDelete(original);
        persistCreate(updated);
      } else {
        // Purely local replacement.
      }
    },
    [persistCreate, persistDelete, persistUpdate, setShapes],
  );

  const undo = useCallback(() => {
    const entry = undoStack[undoStack.length - 1];

    if (!entry) return;

    if (entry.action === "add") {
      const shapes = entry.shapes ?? [];

      removeShapes(shapes);

      for (const shape of shapes) {
        persistDelete(shape);
      }
    } else if (entry.action === "remove") {
      const shapes = entry.shapes ?? [];

      addShapes(shapes);

      for (const shape of shapes) {
        if (shape.serverId) {
          persistUpdate(shape);
        } else {
          persistCreate(shape);
        }
      }
    } else if (entry.action === "replace") {
      const replacements = entry.replacements ?? [];

      for (const shape of replacements) {
        removeShapes([shape]);
        persistDelete(shape);
      }

      if (entry.original) {
        addShapes([entry.original]);

        if (entry.original.serverId) {
          persistUpdate(entry.original);
        } else {
          persistCreate(entry.original);
        }
      }
    }

    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, entry]);
  }, [undoStack, addShapes, removeShapes, persistCreate, persistDelete, persistUpdate]);

  const redo = useCallback(() => {
    const entry = redoStack[redoStack.length - 1];

    if (!entry) return;

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

    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, entry]);
  }, [redoStack, addShapes, removeShapes]);
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
