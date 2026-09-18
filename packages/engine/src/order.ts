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
