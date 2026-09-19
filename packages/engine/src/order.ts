/**
 * Draw order, as a list. The engine draws its items back to front, so "in front" is "later in the
 * array" and raising something is moving it to the end. That's the whole model: an ordered list of
 * what is drawn, which is what two overlapping windows need and nothing more.
 */

/**
 * Moves `item` to the end of `list` — the front of the draw order.
 *
 * @returns whether the order changed, so the caller can skip the repaint when it didn't (pressing
 * the front window is the common case, and it should cost nothing).
 */
export function moveToFront<T>(list: T[], item: T): boolean {
  const index = list.indexOf(item);
  if (index === -1 || index === list.length - 1) {
    return false;
  }
  list.splice(index, 1);
  list.push(item);
  return true;
}

/** Which way a cycle walks the order: to the next item, or back to the previous one. */
export type CycleDirection = "backward" | "forward";

/**
 * Moves the order on by one, the way a window switcher does: **forward** brings the back-most item
 * to the front, **backward** sends the front item to the back.
 *
 * They are exact inverses, and either one repeated visits every item and returns the list to
 * itself — which "raise the one behind the front" does not do, because that only ever swaps the top
 * two.
 *
 * @returns whether the order changed, so a list of one (or none) costs no repaint.
 */
export function cycleOrder<T>(list: T[], direction: CycleDirection): boolean {
  if (list.length < 2) {
    return false;
  }
  if (direction === "forward") {
    list.push(...list.splice(0, 1));
  } else {
    list.unshift(...list.splice(-1, 1));
  }
  return true;
}
