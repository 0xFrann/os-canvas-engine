import "./html-in-canvas";
import { attachDragHandle } from "./drag";
import { moveToFront } from "./order";

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
   * delta. The handle is usually part of the drawn content (a window header, edge to edge); a press
   * on a control inside it (button, link, field) reaches the control instead of dragging.
   *
   * @returns a function that ends any gesture in flight and detaches the handle.
   */
  addDragHandle(handle: HTMLElement): () => void;
  /**
   * Brings this item to the front of the draw order — drawn last, and hit-tested first where it
   * overlaps another one. A press anywhere inside the item already does this; call it for a raise
   * with no pointer behind it, like a dock reopening an app.
   */
  raise(): void;
  remove(): void;
}

export interface Engine {
  readonly canvas: HTMLCanvasElement;
  /**
   * Register a canvas descendant as drawn at `position`, in front of everything added so far. The
   * engine marks it `drawable` and takes over its geometry and its stacking.
   */
  add(element: HTMLElement, position: Position): DrawableItem;
  /** Ask the browser for fresh snapshots and a repaint. Rarely needed: Chrome repaints on its own when a drawable child changes. */
  requestPaint(): void;
  dispose(): void;
}

/**
 * Draws registered DOM elements through HTML-in-Canvas.
 *
 * The engine owns the render pass: it sizes the backing store to CSS × device pixel ratio, clears,
 * and on every `paint` event calls `drawElementImage` for each item, back to front. Chrome 153 keeps
 * hit-testing an element where layout put it, so the engine also writes the matrix the draw call
 * returns to the element's CSS transform (the documented origin-trial idiom) and the item's place in
 * the order to its z-index. Newer Chrome returns nothing and syncs geometry itself, so the transform
 * write becomes a no-op. Either way: the engine owns the drawn rect, the DOM rect, and the order of
 * both. Nothing else positions or stacks a drawable.
 */
export function createEngine(canvas: HTMLCanvasElement): Engine {
  canvas.setAttribute(LAYOUTSUBTREE_ATTRIBUTE, "");
  canvas.setAttribute(CONTENT_ATTRIBUTE, CONTENT_DRAWABLE);

  /** Draw order, back to front: the last one is drawn on top and hit-tested first. */
  const items: DrawableItem[] = [];

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

    /*
     * Back to front, so a later item covers an earlier one — and each one's z-index says the same
     * thing to the DOM, because the pixels come from this loop but the clicks come from the page,
     * where the mounts are siblings the engine must not reorder (React owns them).
     *
     * Every style write here is guarded: a write on a drawable child is itself a reason for Chrome
     * to fire another `paint`, so an unguarded one turns an idle canvas into a paint loop.
     */
    for (const [index, item] of items.entries()) {
      const { element, position } = item;
      const zIndex = String(index);
      if (element.style.zIndex !== zIndex) {
        element.style.zIndex = zIndex;
      }
      const transform = ctx.drawElementImage(element, position.x * dpr, position.y * dpr);
      if (transform) {
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
      /*
       * A static box ignores z-index, and the mounts are static siblings in the canvas's flow.
       * Making them relative changes no layout and lets the draw order reach hit-testing.
       */
      const madeRelative = getComputedStyle(element).position === "static";
      if (madeRelative) {
        element.style.position = "relative";
      }
      const current = { ...position };
      /*
       * Pressing a window brings it forward, whatever was pressed. Unlike the drag, this does not
       * spare controls: clicking a buried window's button has to raise it as well, or the window
       * you just interacted with stays behind the one you didn't.
       */
      function onPointerDown() {
        item.raise();
      }
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
        raise() {
          if (moveToFront(items, item)) {
            schedulePaint();
          }
        },
        remove() {
          const index = items.indexOf(item);
          if (index !== -1) {
            items.splice(index, 1);
          }
          element.removeEventListener("pointerdown", onPointerDown);
          element.removeAttribute(DRAWABLE_ATTRIBUTE);
          element.style.transform = "";
          element.style.zIndex = "";
          if (madeRelative) {
            element.style.position = "";
          }
          requestPaint();
        },
      };
      element.addEventListener("pointerdown", onPointerDown);
      items.push(item);
      requestPaint();
      return item;
    },
    canvas,
    dispose() {
      observer.disconnect();
      canvas.removeEventListener("paint", render);
      // Each one splices itself out of the list, so take the last until there is none.
      while (items.length > 0) {
        items.at(-1)?.remove();
      }
    },
    requestPaint,
  };
}
