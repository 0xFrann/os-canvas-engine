# ADR 004: Window chrome belongs to the desktop; apps get a content slot

- **Status:** Accepted
- **Date:** 2026-09-18
- **Topic:** Who renders a window, and what an app is allowed to do with it
- **Feature:** [a window with a draggable header](../features/window-drag.md)

## Context

The first drag was wired by making the counter's Base UI `DialogHeader` the handle
([feature note](../features/window-drag.md)). It worked, and it was wrong twice over: the grab area
was a line of text with the popup's padding as dead margin around it, and the *app* was the thing
that decided it could be dragged — it imported the hook and picked the element. Every OS works the
other way round: the window is the system's, the app is what's inside it.

That question had to be answered before more than one window, a dock, or focus exists, because all three
assume a window that the desktop owns.

## Options

1. **Keep the app in charge of its own chrome** (today's Dialog + `useDragHandle`). No new
   component; but every app re-implements a header, any app can make anything draggable, and the
   desktop can't guarantee two windows look alike or behave alike.
2. **A `Window` component in the shell.** The desktop renders `<Window title initialPosition>` and
   the app is `children`. `Window` owns the `<Drawable>`, the header, the drag handle and the
   controls; the app never sees them. Chrome-only APIs stay chrome-only by construction: the app
   has no header element to attach anything to.
3. **A window in the engine** (`engine.addWindow(...)` drawing its own chrome). Rejected for the
   same reason as option 3 of [ADR 003](./003-engine-is-a-library-plugged-into-react.md): the engine
   is a library that draws DOM elements at positions and knows nothing about windows, and putting
   chrome in it would take the desktop's own UI out of React.

## Decision

Option 2. `apps/shell/src/components/Window/` renders the window; apps under
`apps/shell/src/apps/<Name>/` render content and import nothing from the engine or the binding.
`useDragHandle` stays exported from `@os-canvas/react` but is documented as chrome-only, with
`Window` as its only caller.

**Header layout is macOS-style, deliberately unlike the reference.** The top-left zone of the strip
is reserved for the window's action controls (close now; minimize and zoom when features need them);
the rest is the app's area and carries the window title by default; any empty space in the strip
drags. The reference desktop pins its single close button to the right instead. The *look* — colors,
2px border, radius, shadow, header padding, title styling — is ported from `apps-window.scss`
unchanged; only the arrangement differs.

## Why

A window is the OS's promise to the user: it always drags the same way, always closes the same way,
wherever the app came from. That promise can't be kept if apps assemble their own chrome. Reserving
a fixed zone for controls also gives minimize and zoom somewhere to land later without moving the
app's area, and gives the app a strip it can put its own things in (a toolbar) without ever touching
the drag.

## Consequences

**Easier now**

- The app shrank to what it actually is: `CounterModal` is a number and a button, with no
  engine imports at all.
- A second window is `<Window>` a second time, and anything the desktop decides about windows
  (focus ring, raise on press, a dock's close) has one place to live.
- With the whole strip as the handle, any control inside it would swallow drags — so the engine now
  ignores presses on interactive targets, which future toolbars need anyway.

**Harder now**

- An app that wants something in its header (a toolbar, a status) needs `Window` to offer a slot for
  it. Not built until an app asks for one.
- The binding still exports a hook that only chrome may use. Documentation, not enforcement; a
  package boundary that could enforce it (a `@os-canvas/desktop`) would be an abstraction without a
  second consumer.

**Revisit trigger:** a window whose chrome has to differ per app (a borderless or full-screen app),
or a second desktop host wanting the same window.

## References

- [ADR 003: the engine is a library plugged into React](./003-engine-is-a-library-plugged-into-react.md)
- [Feature note: a window with a draggable header](../features/window-drag.md)
- Reference desktop, the window this one is ported from:
  [`AppsWindow.tsx`](https://github.com/0xFrann/desktop-os-react-next/blob/main/src/components/index/AppsWindow.tsx),
  [`apps-window.scss`](https://github.com/0xFrann/desktop-os-react-next/blob/main/src/styles/index/apps-window.scss)
