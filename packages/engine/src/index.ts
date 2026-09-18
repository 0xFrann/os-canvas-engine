import "./html-in-canvas";
import { attachDragHandle } from "./drag";

/** Shipped Chrome (153) wants this boolean attribute on the canvas. */
export const LAYOUTSUBTREE_ATTRIBUTE = "layoutsubtree";
/** Chromium main reads `content="drawable"` instead; set both while the rename lands. */
export const CONTENT_ATTRIBUTE = "content";
export const CONTENT_DRAWABLE = "drawable";
/** Marks a canvas descendant as something `drawElementImage` may draw. */
export const DRAWABLE_ATTRIBUTE = "drawable";

export interface Position {
  x: number;
  y: number;
}

/** A DOM element the engine draws on the canvas, at a position it owns. */
export interface DrawableItem {
  readonly element: HTMLElement;
  readonly position: Readonly<Position>;
  moveTo(position: Position): void;
  /**
   * Makes `handle` drag this item: pressing it and moving the pointer moves the item by the same
   * delta. The handle is usually part of the drawn content (a window header).
   *
   * @returns a function that ends any gesture in flight and detaches the handle.
   */
  addDragHandle(handle: HTMLElement): () => void;
  remove(): void;
}

export interface Engine {
  readonly canvas: HTMLCanvasElement;
  /** Register a canvas descendant as drawn at `position`. The engine marks it `drawable`. */
  add(element: HTMLElement, position: Position): DrawableItem;
  /** Ask the browser for fresh snapshots and a repaint. Rarely needed: Chrome repaints on its own when a drawable child changes. */
  requestPaint(): void;
  dispose(): void;
}

/**
 * Draws registered DOM elements through HTML-in-Canvas.
 *
 * The engine owns the render pass: it sizes the backing store to CSS × device pixel ratio, clears,
 * and on every `paint` event calls `drawElementImage` for each item. Chrome 153 keeps hit-testing an
 * element where layout put it, so the engine also writes the matrix the draw call returns to the
 * element's CSS transform (the documented origin-trial idiom). Newer Chrome returns nothing and syncs
 * geometry itself, so that write becomes a no-op. Either way: the engine owns both the drawn rect
 * and the DOM rect. Nothing else positions a drawable.
 */
export function createEngine(canvas: HTMLCanvasElement): Engine {
  canvas.setAttribute(LAYOUTSUBTREE_ATTRIBUTE, "");
  canvas.setAttribute(CONTENT_ATTRIBUTE, CONTENT_DRAWABLE);

  const items = new Map<HTMLElement, Position>();

  /*
   * How repaint is driven: the browser's paint cycle is the frame loop. The engine marks itself
   * dirty and asks for one paint; the `paint` handler clears the mark as it draws. A burst of
   * moves inside one frame therefore costs one `requestPaint()`, and the engine never runs a
   * requestAnimationFrame loop of its own.
   */
  let paintPending = false;
  const requestPaint = () => {
    paintPending = true;
    canvas.requestPaint();
  };
  /** Ask for a paint unless one is already on its way. Used by everything that changes the scene. */
  const schedulePaint = () => {
    if (!paintPending) {
      requestPaint();
    }
  };

  const render = () => {
    paintPending = false;
    const dpr = window.devicePixelRatio;
    const { width, height } = canvas.getBoundingClientRect();
    const backingWidth = Math.round(width * dpr);
    const backingHeight = Math.round(height * dpr);
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    /*
     * The API works in backing-store pixels and records each snapshot at device resolution
     * already, so the context stays at identity and positions are scaled by DPR here. Scaling the
     * context instead draws the snapshot DPR× too big and leaks that scale into the returned matrix.
     */
    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const [element, position] of items) {
      const transform = ctx.drawElementImage(element, position.x * dpr, position.y * dpr);
      if (transform) {
        // Only when it actually changed: a style write on a drawable child is itself a reason for
        // Chrome to fire another `paint`, which would turn an idle canvas into a paint loop.
        const next = transform.toString();
        if (element.style.transform !== next) {
          element.style.transform = next;
        }
      }
    }
  };

  canvas.addEventListener("paint", render);
  const observer = new ResizeObserver(requestPaint);
  observer.observe(canvas);

  return {
    add(element, position) {
      element.setAttribute(DRAWABLE_ATTRIBUTE, "");
      const current = { ...position };
      items.set(element, current);
      requestPaint();
      const item: DrawableItem = {
        addDragHandle(handle) {
          return attachDragHandle(handle, item);
        },
        element,
        moveTo(next) {
          current.x = next.x;
          current.y = next.y;
          schedulePaint();
        },
        get position() {
          return current;
        },
        remove() {
          items.delete(element);
          element.removeAttribute(DRAWABLE_ATTRIBUTE);
          element.style.transform = "";
          requestPaint();
        },
      };
      return item;
    },
    canvas,
    dispose() {
      observer.disconnect();
      canvas.removeEventListener("paint", render);
      items.clear();
    },
    requestPaint,
  };
}
