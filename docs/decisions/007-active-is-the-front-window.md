# ADR 007: The active window is the front one, and the engine owns the keyboard inside the scene

- **Status:** Accepted
- **Date:** 2026-09-18
- **Topic:** What "active" means on this desktop, and who decides where the keyboard goes
- **Feature:** [an active window](../features/active-window.md)

## Context

[ADR 005](./005-draw-order-lives-in-the-engine.md) put the draw order in the engine and closed with
the question it could not answer yet: *"Raising is not focus. Nothing tracks which window is active,
nothing shows it, and keyboard focus is still the browser's."* Its revisit trigger was "a desktop
that wants focus and order to be different things".

Two windows on screen made that concrete. Tab walked the whole page in DOM order — one window's
close, its button, the next window's close, then the dock — because nothing in the desktop had an
opinion about the keyboard. A desktop needs one: Tab stays in the window you are in, a shortcut
switches windows, and the dock is not in any window's Tab order.

## Options

1. **A separate "active window", owned by the desktop.** React state holding an id, set on open, on
   press, on close, and read by whatever needs it. Rejected for the reason positions and order were
   rejected before it: the engine already knows who is in front, so this is a second copy of the
   truth that has to be kept in step with the first, and the two would disagree the first time a
   press raised a window without React hearing about it.
2. **The engine keeps the order; the desktop implements the keyboard.** `Window` would query its own
   tabbable controls and handle Tab. But a window cannot know whether it is the active one without
   being told the order, so this hands the order back to React through the side door — and it puts
   input logic in components, which [ADR 003](./003-engine-is-a-library-plugged-into-react.md)
   forbids. Every future host, and every drawable that is not a window, would reimplement it.
3. **Active *is* front, and the keyboard inside the scene is the engine's.** No new state at all:
   the active window is the last item in the list the engine already draws back to front. The engine
   confines Tab to that item, moves focus with it when it changes, and offers one operation for
   cycling the order. The desktop decides which key triggers the cycle.

## Decision

Option 3.

- **Active is the front item. There is no second concept**, nothing to keep in sync, and every
  existing way of changing the front is already a way of changing the active window: pressing one,
  raising it from the dock, opening one, closing the front one.
- **The engine handles `keydown` for Tab**, on the canvas's document, and moves focus within the
  front item, wrapping, `preventDefault`ing always. With no items it does nothing and the page's own
  Tab order stands.
- **Focus follows the front item** when the order changes, and only when it is stranded in an item
  that is no longer in front. It lands on the mount, which the engine makes focusable with
  `tabindex="-1"`, not on a control.
- **`engine.cycleFront(direction)`** moves the order on by one. *Which key* does that is the host's:
  the desktop binds Ctrl+` and Ctrl+Shift+`.

The obvious alternative implementation — `inert` on every window that is not in front — was tried on
screen first and [rejected on evidence](../engineering-notes/2026-09-18-inert-and-keyboard-confinement.md):
an inert mount vanishes from hit-testing, so pressing a buried window stops raising it, and the
pointer half of the desktop breaks to fix the keyboard half.

## Why

Because "which window is active" and "which window is in front" are the same sentence on a desktop,
and the engine is the only thing that can answer it without a copy. The moment they are two things,
they can disagree, and the user sees a window that looks active and doesn't take the keys.

And because keyboard confinement is the same kind of rule as press-to-raise, which ADR 005 already
put in the engine for the same reason: it is not desktop policy, it is what "the front thing" means
for something drawn. Putting it in the engine makes it hold for anything drawn and keeps the desktop
a plain React app with no order and no focus logic in it.

The line is drawn at the key itself. A shortcut is OS policy — it differs per platform, it collides
with what the OS and the browser already take, and it is the kind of thing a user expects to
rebind. The shell is the OS here, so it owns that; the engine owns what "the next window" means.

## Consequences

**Easier now**

- Tab, Shift+Tab, focus-follows-window and the switcher are one small piece of engine each, and the
  desktop's whole share is one `keydown` listener that reads a key and calls one method.
- Every existing way of changing the front got the keyboard behaviour for free, including ones
  written before this feature existed (`item.raise()` from the dock, closing a window).
- Nothing was added to React state, and nothing re-renders when the active window changes.

**Harder now**

- The engine now listens on the **document**, not only on its canvas and its own items. While it
  has items, Tab in that document is the engine's. That is right for a desktop that fills the page
  and would surprise a host that embeds a canvas in a larger document — the first such host is the
  revisit trigger.
- It writes a fourth thing on a mount it did not create: `tabindex="-1"`, after `transform`,
  `z-index` and `position: relative`. And a focusable mount means the host has a look decision to
  make it did not have before — the UA focus ring frames the whole mount, so `Window` turns it off
  (this desktop marks the active window in no way at all, on purpose).
- **Active and front cannot be different.** A palette window that must float above everything
  without taking the keyboard, or an app raised without being focused, has no way to say so.
- There is still no public read of "who is in front" and no "front changed" subscription. The engine
  reads its own list; nothing outside needs it, because nothing displays the active window. The
  first thing that does will ask for both.

**Revisit trigger:** something that has to be in front without being active (an always-on-top
palette), the first UI that displays which window is active, or a host that embeds the canvas in a
page with its own Tab order.

## References

- [ADR 003: the engine is a library plugged into React](./003-engine-is-a-library-plugged-into-react.md)
- [ADR 005: draw order lives in the engine](./005-draw-order-lives-in-the-engine.md)
- [Feature note: an active window](../features/active-window.md)
- [Engineering note: `inert` can't confine the keyboard to the front window](../engineering-notes/2026-09-18-inert-and-keyboard-confinement.md)
