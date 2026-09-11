import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AnnotationTool,
  type LocalAnnotation,
  type ShapeGeometry,
  type StrokePoint,
} from "@/hooks/useAnnotationStore";
import { findTextAnnotationAt, TEXT_HIT_RADIUS } from "@/components/documents/annotationSelection";
import { TextAnnotationEditor } from "@/components/documents/TextAnnotationEditor";

interface AnnotationOverlayProps {
  page: number;
  width: number;
  height: number;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  eraserSize: number;
  shapes: LocalAnnotation[];
  onAddShape: (shape: {
    page: number;
    type: LocalAnnotation["type"];
    color: string;
    strokeWidth: number;
    geometry: ShapeGeometry;
    content?: string | null;
  }) => string;
  onErase: (page: number, shapeId: string) => void;
  onEraseSegment?: (page: number, shapeId: string, remainingShapes: LocalAnnotation[]) => void;
  onReplaceShape?: (page: number, shapeId: string, updated: LocalAnnotation) => void;
  /** Viewer-owned inline text editor state (one open at a time). */
  textEditor?: {
    page: number;
    annotationId: string | null;
    anchor: { x: number; y: number } | null;
  } | null;
  onOpenTextEditor?: (editor: {
    page: number;
    annotationId: string | null;
    anchor: { x: number; y: number } | null;
  }) => void;
  onCloseTextEditor?: () => void;
  disabled?: boolean;
}

function distance(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(
  point: StrokePoint,
  start: StrokePoint,
  end: StrokePoint,
  width: number,
  height: number,
): number {
  const px = point.x * width;
  const py = point.y * height;

  const sx = start.x * width;
  const sy = start.y * height;

  const ex = end.x * width;
  const ey = end.y * height;

  const dx = ex - sx;
  const dy = ey - sy;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - sx, py - sy);
  }

  const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy)));

  const closestX = sx + t * dx;
  const closestY = sy + t * dy;

  return Math.hypot(px - closestX, py - closestY);
}

function strokeIntersectsEraser(
  points: StrokePoint[],
  center: StrokePoint,
  eraserSize: number,
  width: number,
  height: number,
): boolean {
  const centerX = center.x * width;
  const centerY = center.y * height;
  const radius = eraserSize / 2;

  let previous: StrokePoint | undefined;

  for (const point of points) {
    const pointX = point.x * width;
    const pointY = point.y * height;

    if (Math.hypot(pointX - centerX, pointY - centerY) <= radius) {
      return true;
    }

    if (previous && distanceToSegment(center, previous, point, width, height) <= radius) {
      return true;
    }

    previous = point;
  }

  return false;
}

function splitStrokeAtEraser(
  points: StrokePoint[],
  center: StrokePoint,
  eraserSize: number,
  width: number,
  height: number,
): StrokePoint[][] {
  const segments: StrokePoint[][] = [];
  let current: StrokePoint[] = [];
  let previous: StrokePoint | undefined;

  const centerX = center.x * width;
  const centerY = center.y * height;
  const radius = eraserSize / 2;

  for (const point of points) {
    const pointX = point.x * width;
    const pointY = point.y * height;

    const pointHit = Math.hypot(pointX - centerX, pointY - centerY) <= radius;

    const segmentHit =
      !!previous && distanceToSegment(center, previous, point, width, height) <= radius;

    const hit = pointHit || segmentHit;

    if (hit) {
      if (current.length >= 2) {
        segments.push(current);
      }

      current = [];
      previous = point;
      continue;
    }

    current.push(point);
    previous = point;
  }

  if (current.length >= 2) {
    segments.push(current);
  }

  return segments;
}

function rectangleIntersectsEraser(
  geometry: ShapeGeometry,
  center: StrokePoint,
  radius: number,
): boolean {
  if (
    geometry.x0 === undefined ||
    geometry.y0 === undefined ||
    geometry.x1 === undefined ||
    geometry.y1 === undefined
  ) {
    return false;
  }

  const left = Math.min(geometry.x0, geometry.x1);
  const right = Math.max(geometry.x0, geometry.x1);
  const top = Math.min(geometry.y0, geometry.y1);
  const bottom = Math.max(geometry.y0, geometry.y1);

  const closestX = Math.max(left, Math.min(center.x, right));
  const closestY = Math.max(top, Math.min(center.y, bottom));

  return Math.hypot(center.x - closestX, center.y - closestY) <= radius;
}

function pointAnnotationIntersectsEraser(
  geometry: ShapeGeometry,
  center: StrokePoint,
  radius: number,
): boolean {
  if (geometry.x === undefined || geometry.y === undefined) {
    return false;
  }

  return distance({ x: geometry.x, y: geometry.y }, center) <= radius;
}

/**
 * Does the eraser circle touch any band of a text-selection highlight?
 * `radius` is in normalized page units (band coordinates are 0..1).
 */
function highlightIntersectsEraser(
  geometry: ShapeGeometry,
  center: StrokePoint,
  radius: number,
): boolean {
  if (!geometry.rects || geometry.rects.length === 0) {
    return false;
  }

  for (const rect of geometry.rects) {
    const closestX = Math.max(rect.x0, Math.min(center.x, rect.x1));
    const closestY = Math.max(rect.y0, Math.min(center.y, rect.y1));

    if (Math.hypot(center.x - closestX, center.y - closestY) <= radius) {
      return true;
    }
  }

  return false;
}

/**
 * SVG annotation layer positioned above the read-only PDF canvas.
 *
 * The original PDF is never modified. All marks live in this layer.
 * Coordinates are normalized to 0..1 so annotations survive zoom changes.
 *
 * Tool behaviours:
 * - pen: freehand stroke (unchanged)
 * - highlighter: renders persistent selection-derived rect bands; the
 *   highlight itself is created by the viewer from the PDF.js text-layer
 *   selection, so this overlay only draws it
 * - text: click opens the inline editor (no window.prompt)
 * - select: passes through to the PDF.js text layer for native selection
 * - eraser: removes strokes (with splitting), rects, text and highlights
 */
export function AnnotationOverlay({
  page,
  width,
  height,
  tool,
  color,
  strokeWidth,
  eraserSize,
  shapes,
  onAddShape,
  onErase,
  onEraseSegment,
  onReplaceShape,
  textEditor = null,
  onOpenTextEditor,
  onCloseTextEditor = () => {},
  disabled = false,
}: AnnotationOverlayProps) {
  /** True when this page owns the viewer-level text editor. */
  const editorActiveHere = textEditor !== null && textEditor.page === page;
  const surfaceRef = useRef<SVGSVGElement>(null);
  const drawingRef = useRef<{
    points: StrokePoint[];
    startX: number;
    startY: number;
  } | null>(null);
  const erasingRef = useRef(false);
  const [live, setLive] = useState<ShapeGeometry | null>(null);

  const eraserCursor = useMemo(() => {
    const radius = Math.max(4, Math.min(28, eraserSize / 2));

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
        <circle
          cx="32"
          cy="32"
          r="${radius}"
          fill="rgba(200,150,62,0.08)"
          stroke="#c8963e"
          stroke-width="2"
        />
        <circle
          cx="32"
          cy="32"
          r="2"
          fill="#c8963e"
        />
      </svg>
    `;

    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 32 32, auto`;
  }, [eraserSize]);

  const cursor =
    tool === "pan" || disabled
      ? "default"
      : tool === "eraser"
        ? eraserCursor
        : tool === "text" || tool === "select" || tool === "highlighter"
          ? "text"
          : "crosshair";

  const toPageSpace = useCallback((event: PointerEvent | React.PointerEvent): StrokePoint => {
    const surface = surfaceRef.current;
    if (!surface) {
      return { x: 0, y: 0 };
    }

    const rect = surface.getBoundingClientRect();

    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }, []);

  const eraseAtPoint = useCallback(
    (point: StrokePoint) => {
      if (!erasingRef.current) {
        return;
      }

      // Normalized eraser radius for geometry stored in 0..1 units.
      const normalizedRadius = eraserSize / 2 / Math.min(width, height);

      for (const shape of [...shapes].reverse()) {
        const points = shape.geometry.points;

        if (points && points.length >= 2) {
          if (!strokeIntersectsEraser(points, point, eraserSize, width, height)) {
            continue;
          }

          const segments = splitStrokeAtEraser(points, point, eraserSize, width, height);

          if (segments.length === 0) {
            onErase(page, shape.id);
            continue;
          }

          if (!onEraseSegment) {
            onErase(page, shape.id);
            continue;
          }

          const replacementShapes: LocalAnnotation[] = segments.map((segment) => ({
            ...shape,
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            serverId: null,
            geometry: {
              points: segment,
            },
          }));

          onEraseSegment(page, shape.id, replacementShapes);

          continue;
        }

        if (
          rectangleIntersectsEraser(shape.geometry, point, normalizedRadius) ||
          pointAnnotationIntersectsEraser(shape.geometry, point, normalizedRadius) ||
          highlightIntersectsEraser(shape.geometry, point, normalizedRadius)
        ) {
          onErase(page, shape.id);
        }
      }
    },
    [eraserSize, height, onErase, onEraseSegment, page, shapes, width],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (disabled || tool === "pan" || editorActiveHere) {
        return;
      }

      if (event.button !== 0) {
        return;
      }

      const point = toPageSpace(event);
      console.log("ANNOTATION POINTER DOWN", {
        tool,
        point,
        width,
        height,
      });

      if (tool === "eraser") {
        erasingRef.current = true;

        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture is optional.
        }

        eraseAtPoint(point);
        return;
      }

      if (tool === "text") {
        const hit = findTextAnnotationAt(shapes, point, TEXT_HIT_RADIUS, width, height);

        console.log("TEXT EDIT HIT TEST", {
          clickPoint: point,
          textAnnotations: shapes.filter((shape) => shape.type === "text"),
          hit,
          hitRadius: TEXT_HIT_RADIUS,
        });

        onOpenTextEditor?.({
          page,
          annotationId: hit?.id ?? null,
          anchor: hit ? null : point,
        });

        return;
      }

      if (tool === "select") {
        // Let pointer events reach the PDF.js text layer for native
        // selection; the overlay itself does nothing here.
        return;
      }

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Drawing still works without pointer capture.
      }

      drawingRef.current = {
        points: [point],
        startX: point.x,
        startY: point.y,
      };

      setLive({ points: [point] });
    },
    [
      disabled,
      editorActiveHere,
      eraseAtPoint,
      onOpenTextEditor,
      page,
      shapes,
      toPageSpace,
      tool,
      width,
      height,
    ],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (disabled) {
        return;
      }

      const point = toPageSpace(event);

      if (tool === "eraser") {
        if (erasingRef.current) {
          eraseAtPoint(point);
        }

        return;
      }

      const drawingState = drawingRef.current;

      if (!drawingState) {
        return;
      }

      if (tool === "pen") {
        drawingState.points.push(point);
        setLive({ points: [...drawingState.points] });
      }
    },
    [disabled, eraseAtPoint, toPageSpace, tool],
  );

  const handlePointerUp = useCallback(
    (event?: React.PointerEvent<SVGSVGElement>) => {
      if (tool === "eraser") {
        erasingRef.current = false;

        if (event) {
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            // Pointer capture may already have been released.
          }
        }

        return;
      }

      const drawingState = drawingRef.current;
      drawingRef.current = null;
      setLive(null);

      if (!drawingState || disabled) {
        return;
      }

      if (tool === "pen") {
        if (drawingState.points.length >= 2) {
          onAddShape({
            page,
            type: "pen",
            color,
            strokeWidth: strokeWidth,
            geometry: { points: drawingState.points },
          });
        }
      }
    },
    [color, disabled, onAddShape, page, strokeWidth, tool],
  );

  const handleEditorCancel = useCallback(() => {
    onCloseTextEditor();
  }, [onCloseTextEditor]);

  const handleEditorCommit = useCallback(
    (input: {
      geometry: { x: number; y: number; fontSize?: number };
      content: string;
      color: string;
      strokeWidth: number;
    }) => {
      const state = textEditor;
      onCloseTextEditor();
      if (!state) return;

      const trimmed = input.content.trim();

      if (state.annotationId) {
        const existing = shapes.find((s) => s.id === state.annotationId);
        if (!existing) return;

        if (!trimmed) {
          // An emptied edit deletes the annotation (undoable).
          onErase(page, existing.id);
          return;
        }

        onReplaceShape?.(page, existing.id, {
          ...existing,
          geometry: input.geometry,
          content: trimmed,
        });
        return;
      }

      if (!trimmed) return;

      onAddShape({
        page,
        type: "text",
        color: input.color,
        strokeWidth: input.strokeWidth,
        geometry: input.geometry,
        content: trimmed,
      });
    },
    [onAddShape, onCloseTextEditor, onErase, onReplaceShape, page, shapes, textEditor],
  );

  // Leaving the text tool abandons an unsaved fresh editor.
  useEffect(() => {
    if (tool !== "text") {
      onCloseTextEditor();
    }
  }, [tool, onCloseTextEditor]);

  if (width === 0 || height === 0) {
    return null;
  }

  const editingAnnotation =
    editorActiveHere && textEditor?.annotationId
      ? (shapes.find((s) => s.id === textEditor.annotationId) ?? null)
      : null;

  return (
    <div
      className="absolute inset-0"
      style={{
        width: "100%",
        height: "100%",
        zIndex: 1,
        pointerEvents: "none",
      }}
    >
      <svg
        ref={surfaceRef}
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full touch-none"
        style={{
          cursor,
          pointerEvents:
            editorActiveHere || tool === "select" || tool === "highlighter" ? "none" : "auto",
        }}
        data-annotation-layer="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <g>
          {shapes.map((shape) => (
            <ShapeElement key={shape.id} shape={shape} />
          ))}

          {live && (
            <ShapeElement
              shape={{
                id: "__live__",
                page,
                type: "pen",
                color,
                strokeWidth,
                geometry: live,
              }}
              live
            />
          )}
        </g>
      </svg>

      {editorActiveHere && (
        <TextAnnotationEditor
          page={page}
          width={width}
          height={height}
          annotation={editingAnnotation}
          anchor={textEditor?.anchor ?? null}
          color={color}
          strokeWidth={strokeWidth}
          onCommit={handleEditorCommit}
          onCancel={handleEditorCancel}
        />
      )}
    </div>
  );
}
function ShapeElement({ shape, live = false }: { shape: LocalAnnotation; live?: boolean }) {
  const geometry = shape.geometry;

  // Selection-derived text highlight: one translucent band per text line.
  if (geometry.rects && geometry.rects.length > 0) {
    return (
      <g>
        {geometry.rects.map((rect, index) => (
          <rect
            key={index}
            x={rect.x0}
            y={rect.y0}
            width={Math.max(0, rect.x1 - rect.x0)}
            height={Math.max(0, rect.y1 - rect.y0)}
            fill={shape.color}
            fillOpacity={0.35}
            stroke="none"
          />
        ))}
      </g>
    );
  }

  if (geometry.points && geometry.points.length > 0) {
    const d = geometry.points
      .map(
        (point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(4)},${point.y.toFixed(4)}`,
      )
      .join(" ");

    return (
      <path
        d={d}
        fill="none"
        stroke={shape.color}
        strokeWidth={shape.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={shape.type === "highlight" ? 0.35 : shape.type === "pen" ? 0.9 : 0.85}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  if (
    geometry.x0 !== undefined &&
    geometry.y0 !== undefined &&
    geometry.x1 !== undefined &&
    geometry.y1 !== undefined
  ) {
    return (
      <rect
        x={Math.min(geometry.x0, geometry.x1)}
        y={Math.min(geometry.y0, geometry.y1)}
        width={Math.abs(geometry.x1 - geometry.x0)}
        height={Math.abs(geometry.y1 - geometry.y0)}
        fill={live ? "none" : shape.color}
        fillOpacity={live ? 0 : 0.12}
        stroke={shape.color}
        strokeWidth={shape.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  if (geometry.x !== undefined && geometry.y !== undefined && shape.content) {
    return (
      <text
        x={geometry.x}
        y={geometry.y}
        fill={shape.color}
        fontSize={geometry.fontSize ?? 0.028}
        fontFamily="IBM Plex Mono, monospace"
        fontWeight="500"
        dominantBaseline="middle"
        pointerEvents="none"
      >
        {shape.content}
      </text>
    );
  }

  if (geometry.x !== undefined && geometry.y !== undefined) {
    return <circle cx={geometry.x} cy={geometry.y} r={0.004} fill={shape.color} />;
  }

  return null;
}
