# ADR 005: Draw order lives in the engine, and pressing a drawable raises it

- **Status:** Accepted
- **Date:** 2026-09-18
- **Topic:** Who owns "which window is in front", and who decides when that changes
- **Feature:** [multiple windows, opened from a dock](../features/multiple-windows.md)

## Context

With one window, the order things are drawn in is invisible. With two that overlap, it is the
first thing anyone sees, and it changes every time the user presses a window. Something has to hold
that order and something has to change it, and the two answers don't have to be the same.

The engine already owns each item's position and its DOM rect
([ADR 003](./003-engine-is-a-library-plugged-into-react.md)) and the drag gesture
([window drag](../features/window-drag.md)). The desktop owns the window as a component
([ADR 004](./004-window-chrome-belongs-to-the-desktop.md)). Either could plausibly own the order.

## Options

1. **React holds the order** — an array of window ids in the shell's state, passed down as a
   `z` prop. Rejected on sight: it is the position problem again. Every raise re-renders the
   desktop, the engine and React both believe they know what is in front, and the rule the project
   already settled ("positions and ordering never live in React state") would have an exception two
   features after it was written.
2. **The engine holds the order; the desktop raises.** `items` is an ordered list in the engine and
   `item.raise()` moves an item to the front, but nothing calls it unless the host does — the
   `Window` component would put an `onPointerDown` on its root. The order is in one place, but the
   *rule* isn't: every host, and every new kind of drawable, reimplements "press brings forward",
   and a window that forgets it is a window that can't be brought forward.
3. **The engine holds the order and raises on `pointerdown` itself.** `add()` attaches one listener
   per item; the desktop never mentions order at all. `raise()` stays public for raises with no
   pointer behind them.

## Decision

Option 3. The engine keeps an ordered list of items, draws it back to front, raises the pressed item
on `pointerdown`, and exposes `raise()` for a caller with no pointer (the dock).

Raising deliberately does **not** skip interactive targets, unlike the drag, which does: pressing a
window's button raises the window *and* reaches the button.

## Why

The engine is already the thing that knows where everything is drawn, so it is the only thing that
can answer "what is in front" without a second copy of the truth. And press-to-raise is not desktop
policy, it is what "in front" means for something drawn: whatever you touch, you touched the top one
— the browser's own hit-test said so. Putting it in the engine means it holds for anything drawn,
including things that are not windows, and the desktop stays a plain React app with no order in it.

Sparing controls made sense for the drag (a press on a close button must not move the window) and
makes none here: a click on a buried window's control is the click that should bring it forward, and
in a stack of windows almost every press lands on *something* — a button, a field, a link.

## Consequences

**Easier now**

- The shell renders `<Window>` twice and gets overlap, click-to-raise and correct hit-testing with
  no code of its own, and `packages/react` needed no change for it. Raising with no pointer — the
  dock reopening an app — is what later asked the binding for a way to reach an item
  ([ADR 006's feature](../features/multiple-windows.md)).
- Ordering is a list and one `moveToFront`, which is pure and unit-tested. The "document" the
  roadmap expected here is that list — nothing larger earned its place.
- The engine writing `z-index` from the same list keeps the pixels and the clicks in one pass, the
  way the transform write did for position
  ([what Chrome does with overlapping drawables](../engineering-notes/2026-09-18-overlap-hit-order.md)).

**Harder now**

- The engine now sets three things on a drawable it did not create: `transform`, `z-index`, and
  `position: relative` on an otherwise static mount. That is a bigger claim on the host's DOM than
  before, and it is documented as the contract: the host gives the engine an element and does not
  style its geometry or its stacking.
- Press-to-raise is not optional. A drawable that should never come forward (a wallpaper, a
  desktop-icon layer) would need a way to say so. Not invented until something needs it.
- Raising is not focus. Nothing tracks which window is active, nothing shows it, and keyboard focus
  is still the browser's. A focus ring, if the desktop wants one, is a later feature that may well
  want to raise on focus too.

**Revisit trigger:** a drawable that must stay at the back whatever the user presses, or a desktop
that wants focus and order to be different things (a palette window that never comes forward, an
app raised without being focused).

## References

- [ADR 003: the engine is a library plugged into React](./003-engine-is-a-library-plugged-into-react.md)
- [ADR 004: window chrome belongs to the desktop](./004-window-chrome-belongs-to-the-desktop.md)
- [Feature note: multiple windows, opened from a dock](../features/multiple-windows.md)
- [Engineering note: draw order doesn't reach hit-testing](../engineering-notes/2026-09-18-overlap-hit-order.md)
