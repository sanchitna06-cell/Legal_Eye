import type { LocalAnnotation } from "@/hooks/useAnnotationStore";

/* ============================================================
   TEXT-LAYER SELECTION → HIGHLIGHT GEOMETRY

   Turns the browser's live Range over the PDF.js text layer into
   normalized page-space rectangles — one per selected line band.

   The PDF.js text layer provides the selectable text; its client
   rects are converted to page-relative coordinates using the page
   container's own bounding rect, then normalized to 0..1 so the
   highlight survives zoom and device-pixel changes exactly like
   every other annotation. Bands are merged per text line, so a
   multi-line selection yields multiple tight rectangles — never
   one giant rectangle over unselected text.
   ============================================================ */

/** Normalized page-space rectangle (0..1 of the rendered page). */
export interface HighlightRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Viewer-level inline text editor state (one open at a time). */
export interface TextEditorState {
  page: number;
  /** Existing annotation id being edited, or null for a fresh box. */
  annotationId: string | null;
  /** Anchor in normalized page space for a fresh box. */
  anchor: { x: number; y: number } | null;
}

/** Default text size as a fraction of page width (scales with zoom). */
export const DEFAULT_TEXT_FONT_SIZE_FRACTION = 0.024;

/** Click radius (screen px) for grabbing an existing text annotation. */
export const TEXT_HIT_RADIUS = 16;

interface ClientBand {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function findPageElementForPoint(
  x: number,
  y: number,
  fallback: HTMLElement | null,
): HTMLElement | null {
  const probe = document.elementFromPoint(x, y);
  const pageEl = probe?.closest<HTMLElement>("[data-page-number]");
  if (pageEl) return pageEl;
  return fallback?.closest<HTMLElement>("[data-page-number]") ?? null;
}

/**
 * Convert the current window selection into per-page highlight geometry.
 *
 * Returns entries only for pages that own part of the selection. Each
 * entry's geometry carries one rect per selected text line.
 */
export function getSelectionHighlightGeometry(
  root: HTMLElement,
): Array<{ page: number; geometry: { rects: HighlightRect[] } }> {
  void root;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return [];
  }

  const results: Array<{
    page: number;
    geometry: { rects: HighlightRect[] };
  }> = [];

  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);

    // Fallback page resolution from the range itself (used when a rect's
    // center lies outside the viewport and elementFromPoint misses).
    const rangeOwner =
      range.startContainer instanceof HTMLElement
        ? range.startContainer
        : range.startContainer.parentElement;

    const clientRects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width > 0.5 && rect.height > 0.5,
    );
    if (clientRects.length === 0) continue;

    // Group the range's rects by the page container they belong to.
    const pageGroups = new Map<HTMLElement, ClientBand[]>();

    for (const rect of clientRects) {
      const pageEl = findPageElementForPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rangeOwner,
      );
      if (!pageEl) continue;

      const bands = pageGroups.get(pageEl) ?? [];
      bands.push({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      });
      pageGroups.set(pageEl, bands);
    }

    for (const [pageEl, bands] of pageGroups) {
      const pageNumber = Number(pageEl.dataset["pageNumber"]);
      if (!Number.isFinite(pageNumber)) continue;

      const pageRect = pageEl.getBoundingClientRect();
      if (pageRect.width <= 0 || pageRect.height <= 0) continue;

      const rects = mergeIntoLineBands(bands).map((band) => ({
        x0: clamp01((band.left - pageRect.left) / pageRect.width),
        y0: clamp01((band.top - pageRect.top) / pageRect.height),
        x1: clamp01((band.right - pageRect.left) / pageRect.width),
        y1: clamp01((band.bottom - pageRect.top) / pageRect.height),
      }));

      if (rects.length > 0) {
        results.push({ page: pageNumber, geometry: { rects } });
      }
    }
  }

  return results;
}

/**
 * Merge raw client rects into per-line bands: rects whose vertical overlap
 * exceeds half the shorter rect's height share a band.
 */
function mergeIntoLineBands(rects: ClientBand[]): ClientBand[] {
  const sorted = [...rects].sort((a, b) => a.top - b.top);
  const bands: ClientBand[] = [];

  for (const rect of sorted) {
    const band = bands.find((candidate) => {
      const overlapHeight =
        Math.min(candidate.bottom, rect.bottom) - Math.max(candidate.top, rect.top);
      const shorter = Math.min(candidate.bottom - candidate.top, rect.bottom - rect.top);
      return shorter > 0 && overlapHeight / shorter > 0.5;
    });

    if (band) {
      band.top = Math.min(band.top, rect.top);
      band.bottom = Math.max(band.bottom, rect.bottom);
      band.left = Math.min(band.left, rect.left);
      band.right = Math.max(band.right, rect.right);
    } else {
      bands.push({ ...rect });
    }
  }

  return bands;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Nearest text annotation whose anchor sits within `radiusPx` of the point.
 * Shared by the overlay's click-to-create (must not shadow an existing
 * annotation) and click-to-edit flows.
 */
export function findTextAnnotationAt(
  shapes: LocalAnnotation[],
  point: { x: number; y: number },
  radiusPx: number,
  pageWidth: number,
  pageHeight: number,
): LocalAnnotation | null {
  if (pageWidth <= 0 || pageHeight <= 0) return null;

  const paddingX = radiusPx / pageWidth;
  const paddingY = radiusPx / pageHeight;

  let best: LocalAnnotation | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const shape of shapes) {
    if (shape.type !== "text") continue;

    const { x, y, fontSize } = shape.geometry;

    if (x === undefined || y === undefined || !shape.content) {
      continue;
    }

    /*
     * Text is rendered using:
     *
     *   fontSize = fontSizeFraction * pageWidth
     *
     * and approximately 0.6em per character for the monospace font.
     */
    const fontSizePx = (fontSize ?? DEFAULT_TEXT_FONT_SIZE_FRACTION) * pageWidth;

    const textWidthPx = Math.max(fontSizePx, shape.content.length * fontSizePx * 0.6);

    const textHeightPx = fontSizePx * 1.5;

    const textWidth = textWidthPx / pageWidth;
    const textHeight = textHeightPx / pageHeight;

    const left = x - paddingX;
    const right = x + textWidth + paddingX;

    const top = y - textHeight / 2 - paddingY;
    const bottom = y + textHeight / 2 + paddingY;

    if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
      const centerX = x + textWidth / 2;
      const centerY = y;

      const distance = Math.hypot(point.x - centerX, point.y - centerY);

      if (distance < bestDistance) {
        best = shape;
        bestDistance = distance;
      }
    }
  }

  return best;
}
