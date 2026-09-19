import "./html-in-canvas";
import { attachDragHandle } from "./drag";
import { cycleOrder, moveToFront, type CycleDirection } from "./order";
import { focusNextIn } from "./focus";

/** Shipped Chrome (153) wants this boolean attribute on the canvas. */
export const LAYOUTSUBTREE_ATTRIBUTE = "layoutsubtree";
/** Chromium main reads `content="drawable"` instead; set both while the rename lands. */
export const CONTENT_ATTRIBUTE = "content";
export const CONTENT_DRAWABLE = "drawable";
/** Marks a canvas descendant as something `drawElementImage` may draw. */
export const DRAWABLE_ATTRIBUTE = "drawable";

export type { CycleDirection } from "./order";

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

/**
 * The pixel size of an image source, which is what a cover fit needs and what `drawImage` itself
 * does not tell you. An `<img>` reports its own; everything else `drawImage` takes is already a
 * pixel buffer with a width and a height.
 */
function sourceSize(source: CanvasImageSource): { height: number; width: number } {
  if (source instanceof HTMLImageElement) {
    return { height: source.naturalHeight, width: source.naturalWidth };
  }
  if (source instanceof HTMLVideoElement) {
    return { height: source.videoHeight, width: source.videoWidth };
  }
  if (source instanceof SVGImageElement) {
    return { height: source.height.baseVal.value, width: source.width.baseVal.value };
  }
  if ("displayWidth" in source) {
    return { height: source.displayHeight, width: source.displayWidth };
  }
  return { height: source.height, width: source.width };
}

export interface Engine {
  readonly canvas: HTMLCanvasElement;
  /**
   * Register a canvas descendant as drawn at `position`, in front of everything added so far. The
   * engine marks it `drawable` and takes over its geometry and its stacking.
   */
  add(element: HTMLElement, position: Position): DrawableItem;
  /**
   * Moves the draw order on by one item, the way a window switcher does: `"forward"` brings the
   * back-most item to the front, `"backward"` sends the front one to the back. Repeating either
   * visits every item and comes back to the order it started in.
   *
   * *Which key* does this is the host's call — it's OS policy, and the engine has no keyboard
   * shortcuts of its own.
   */
  cycleFront(direction: CycleDirection): void;
  /** Ask the browser for fresh snapshots and a repaint. Rarely needed: Chrome repaints on its own when a drawable child changes. */
  requestPaint(): void;
  /**
   * What the canvas is covered with before any item is drawn — the desktop's wallpaper. A CSS color
   * (anything `fillStyle` takes), or an image, which is drawn to **cover** the canvas: scaled up to
   * fill it, aspect ratio kept, centred, and whatever hangs over the edge is cropped. `null` leaves
   * the canvas transparent, which is what it was before there was a wallpaper.
   *
   * The engine does not load anything. An image must already be decoded when it arrives — the host
   * owns the network, and a half-loaded image drawn here is a frame of nothing.
   *
   * It is not an item: it has no element, no place in the draw order, and nothing can raise, pick
   * or remove it. Setting the value it already has does nothing.
   */
  setBackground(background: string | CanvasImageSource | null): void;
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
 *
 * It owns the keyboard inside the scene too: the front item is the active one, Tab stays inside it,
 * and focus follows it when it changes. And it fills the canvas under the items with whatever
 * background the host set, so every pixel of the surface comes from this render pass.
 */
export function createEngine(canvas: HTMLCanvasElement): Engine {
  canvas.setAttribute(LAYOUTSUBTREE_ATTRIBUTE, "");
  canvas.setAttribute(CONTENT_ATTRIBUTE, CONTENT_DRAWABLE);

  /** Draw order, back to front: the last one is drawn on top and hit-tested first. */
  const items: DrawableItem[] = [];

  /** What goes under everything. Null until the host sets one: an unpainted canvas is transparent. */
  let background: string | CanvasImageSource | null = null;

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

  /**
   * The wallpaper: the one thing the engine draws that is not a DOM element, under every item and
   * across the whole backing store, which is what makes a screenshot of the canvas a screenshot of
   * the desktop (ADR 008).
   *
   * Its own step of the render pass, so that something which has to change it per frame — a
   * wallpaper that moves — has one place to drive.
   */
  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    if (background === null) {
      return;
    }
    const { height, width } = canvas;
    if (typeof background === "string") {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      return;
    }
    /*
     * Cover, not stretch: the larger of the two scales fills the canvas, and the overflow is
     * centred so it is cropped evenly on both sides. In backing-store pixels like the rest of the
     * pass, so a 2x display crops the same box out of a twice-as-sharp image.
     */
    const source = sourceSize(background);
    const scale = Math.max(width / source.width, height / source.height);
    const drawnWidth = source.width * scale;
    const drawnHeight = source.height * scale;
    ctx.drawImage(
      background,
      (width - drawnWidth) / 2,
      (height - drawnHeight) / 2,
      drawnWidth,
      drawnHeight,
    );
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

    drawBackground(ctx);

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

  /** Whether the keyboard is somewhere inside `element`. */
  const holdsFocus = (element: HTMLElement) => element.contains(canvas.ownerDocument.activeElement);

  /**
   * Hands the keyboard to the front item — to the mount, not to a control inside it. Every window's
   * first control is its close button, and bringing a window forward must not arm it; "the window
   * has the keyboard, nothing in it does" is also exactly where Tab starts from.
   */
  const focusFront = () => {
    items.at(-1)?.element.focus({ preventScroll: true });
  };

  /**
   * After the order changed: focus follows the front item, but only when it is stranded in an item
   * that is no longer in front. Focus outside the scene — the dock icon someone just clicked — is
   * left where it is, and so is a press on a control: the browser focuses what was pressed right
   * after this runs, so the pressed control still wins.
   */
  const followFront = () => {
    const front = items.at(-1);
    if (!front || holdsFocus(front.element)) {
      return;
    }
    if (items.some((item) => holdsFocus(item.element))) {
      focusFront();
    }
  };

  /*
   * Tab never leaves the front item: on a desktop the keyboard doesn't cross from one window into
   * another, or out into the chrome around them. On the document rather than the canvas, because a
   * key goes to whatever has focus, and while a window is open that may well be the page's own
   * chrome — which is precisely the case this has to catch.
   */
  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.key !== "Tab" ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    const front = items.at(-1);
    if (!front) {
      // Nothing is drawn, so there is no window to stay inside: the page's own Tab order is right.
      return;
    }
    // Always, not only at the ends — at every position the browser's next stop is outside the item.
    event.preventDefault();
    focusNextIn(front.element, event.shiftKey);
  };

  canvas.addEventListener("paint", render);
  canvas.ownerDocument.addEventListener("keydown", onKeyDown);
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
      /*
       * Where the keyboard goes when this item comes to the front. `-1` keeps the mount itself out
       * of the page's Tab order — Tab inside an item is the engine's to run — and written once here
       * rather than toggled per paint, which would be a reason for Chrome to fire another one.
       */
      const madeFocusable = !element.hasAttribute("tabindex");
      if (madeFocusable) {
        element.setAttribute("tabindex", "-1");
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
            followFront();
          }
        },
        remove() {
          /*
           * Asked before the splice: afterwards this item is not in the scene to be stranded in.
           * The second half is for the ordinary case — a window closed by its own close button.
           * React detaches the DOM before it runs the effect cleanup that calls this, so the
           * focused control is already gone and the document is left with nothing focused; an
           * element that is no longer connected is how that is told apart from a removal that
           * never had the keyboard. It can't steal focus either way, because there is none.
           */
          const { activeElement, body } = canvas.ownerDocument;
          const nothingFocused = !activeElement || activeElement === body;
          const strandsFocus = holdsFocus(element) || (!element.isConnected && nothingFocused);
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
          if (madeFocusable) {
            element.removeAttribute("tabindex");
          }
          if (strandsFocus) {
            // Closing the front window makes the next one active, and the keyboard goes with it.
            focusFront();
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
    cycleFront(direction) {
      if (cycleOrder(items, direction)) {
        schedulePaint();
        followFront();
      }
    },
    dispose() {
      observer.disconnect();
      canvas.removeEventListener("paint", render);
      canvas.ownerDocument.removeEventListener("keydown", onKeyDown);
      // Each one splices itself out of the list, so take the last until there is none.
      while (items.length > 0) {
        items.at(-1)?.remove();
      }
    },
    requestPaint,
    setBackground(next) {
      if (next === background) {
        return;
      }
      background = next;
      schedulePaint();
    },
  };
}
