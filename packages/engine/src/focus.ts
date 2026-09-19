/**
 * Keyboard focus inside one drawn item. A desktop's Tab never leaves the window it is in, so the
 * engine moves focus itself rather than letting the browser walk the page: the windows are siblings
 * in the canvas and whatever the page has next to them (a dock) is not part of any window.
 */

/**
 * What Tab may land on. The standard tabbable set; `tabIndex >= 0` is what actually decides, so a
 * `tabindex="-1"` element — an item's own mount, which the engine makes focusable to *give* a window
 * the keyboard — is collected by the selector and then dropped.
 */
const TABBABLE = "a[href], button, input, select, textarea, [contenteditable], [tabindex]";

/** The controls of `root`, in the order Tab would visit them. */
function tabbable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (element) => element.tabIndex >= 0 && !element.hasAttribute("disabled") && !element.hidden,
  );
}

/**
 * Moves focus to the next control inside `root`, or the previous one when `backwards`, wrapping at
 * both ends. Focus that is not inside `root` — the page's own chrome, another window, nothing at
 * all — counts as before the first one, so this always lands somewhere inside `root`.
 *
 * Does nothing if `root` has no controls; the caller has already swallowed the key, so the keyboard
 * stays where it is rather than escaping into the page.
 */
export function focusNextIn(root: HTMLElement, backwards: boolean): void {
  const controls = tabbable(root);
  if (controls.length === 0) {
    return;
  }
  const active = root.ownerDocument.activeElement;
  let index = -1;
  if (active instanceof HTMLElement) {
    index = controls.indexOf(active);
  }
  let step = 1;
  if (backwards) {
    step = -1;
    if (index === -1) {
      // Nowhere counts as before the first control, so stepping back from it lands on the last.
      index = 0;
    }
  }
  controls[(index + step + controls.length) % controls.length]?.focus();
}
