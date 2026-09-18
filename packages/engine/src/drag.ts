import type { Position } from "./index";

/** What a drag needs from a drawable item: where it is, and how to move it. */
export interface DragTarget {
  readonly position: Readonly<Position>;
  moveTo(position: Position): void;
}

/**
 * Controls a press must reach instead of starting a drag. A window header is a handle with things
 * in it — a close button today, a toolbar later — and those have to keep working.
 */
const INTERACTIVE_TARGETS = "button, a, input, textarea, select, [contenteditable]";

/**
 * Makes `handle` drag `target`: a primary-button press on the handle starts a gesture that moves
 * the target by the pointer's delta, until the pointer is released or cancelled. A press that lands
 * on an interactive element inside the handle is left alone.
 *
 * The handle is any DOM element, usually a header inside the drawn content itself — the content is
 * real DOM and the engine keeps its DOM rect on top of its drawn rect, so the browser does the
 * picking and the engine does the math. Positions are in the canvas's CSS pixels; a pointer delta
 * is the same in page space and canvas space as long as nothing scales the canvas, so it goes
 * straight through (a camera would have to unproject it here).
 *
 * @returns a function that ends any gesture in flight and detaches the handle.
 */
export function attachDragHandle(handle: HTMLElement, target: DragTarget): () => void {
  // Without this, dragging the handle on a touch screen scrolls the page instead.
  const previousTouchAction = handle.style.touchAction;
  handle.style.touchAction = "none";

  /** Ends the gesture in flight, if there is one. */
  let endGesture: (() => void) | null = null;

  const onPointerDown = (event: PointerEvent) => {
    if (endGesture || !event.isPrimary || event.button !== 0) {
      return;
    }
    if (event.target instanceof Element && event.target.closest(INTERACTIVE_TARGETS)) {
      return;
    }
    // Stops the press from starting a text selection or a native drag of the content.
    event.preventDefault();

    const { pointerId } = event;
    const origin = { x: event.clientX, y: event.clientY };
    const start = { x: target.position.x, y: target.position.y };

    const onPointerMove = (move: PointerEvent) => {
      if (move.pointerId === pointerId) {
        target.moveTo({
          x: start.x + move.clientX - origin.x,
          y: start.y + move.clientY - origin.y,
        });
      }
    };

    const onPointerEnd = (end: PointerEvent) => {
      if (end.pointerId === pointerId) {
        endGesture?.();
      }
    };

    endGesture = () => {
      endGesture = null;
      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerEnd);
      handle.removeEventListener("pointercancel", onPointerEnd);
    };

    /*
     * The handle keeps up with the pointer but never exactly: capture makes sure the moves keep
     * arriving even when the pointer is momentarily off it, and that the gesture ends on this
     * element even if the release happens over something else.
     */
    handle.setPointerCapture(pointerId);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
  };

  handle.addEventListener("pointerdown", onPointerDown);

  return () => {
    endGesture?.();
    handle.removeEventListener("pointerdown", onPointerDown);
    handle.style.touchAction = previousTouchAction;
  };
}
