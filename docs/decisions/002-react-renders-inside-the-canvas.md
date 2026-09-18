# ADR 002: React renders content directly inside the canvas; portals target the drawable mount

- **Status:** Partly superseded by [ADR 003](./003-engine-is-a-library-plugged-into-react.md) — React still renders the canvas and its drawable children, but the draw and geometry logic moved out of components into `@os-canvas/engine`
- **Date:** 2026-09-18
- **Topic:** Who owns the DOM node that `drawElementImage` draws
- **Feature:** [counter modal](../features/counter-modal.md)

## Context

HTML-in-Canvas draws a real DOM element that must be a descendant of the `<canvas>`. ADR 001
chose React + shadcn/ui for that content and left open where the boundary sits between "the thing
that calls `drawElementImage`" and "the thing that renders React": "decided when the first drawn
element exists". The first attempt at this project (before the reset) answered it with a renderer
package that created a `<div drawable>` per node and handed it to the host through an `onMount`
callback, into which the host mounted a separate React root. That package is gone; the question
came back with the counter modal.

Two facts observed while building it constrain the answer:

- Base UI 1.8 refuses to render a `Dialog.Popup` without a `Dialog.Portal`, and a Portal defaults
  to `<body>` — outside the canvas, where there is nothing to draw.
- React 19 drops a boolean `true` on attributes it doesn't know, so `drawable` / `layoutsubtree`
  must be passed as `""` for the browser to see them.

## Options

1. **A renderer creates the mounts, the host mounts a React root into each** (the pre-reset
   design). Clean separation on paper; in practice two React roots per window, an `onMount` /
   `onUnmount` protocol to keep in sync, and the renderer has to know DOM APIs anyway.
2. **React renders the canvas and its drawable children in one tree.** `CanvasSurface` is a
   component that renders `<canvas layoutsubtree="" content="drawable">` with a `<div drawable="">`
   child, and the content is ordinary JSX inside it. The surface exposes the mount through context
   (`useCanvasSurface().mountRef`) so anything that portals — dialogs, menus, tooltips — can set
   `container={mountRef}` and stay inside the canvas.
3. **Let primitives portal to `<body>` and draw from there.** Not possible: `drawElementImage`
   only accepts canvas descendants.

## Decision

Option 2. React owns the whole tree, canvas included; the surface owns the mount and the draw;
content that portals must portal into the mount.

## Why

It's the smallest thing that works, it's one React tree (state, context, and StrictMode behave
normally), and it removes a protocol that existed only to bridge two owners. The one rule it
imposes — "portal into the mount" — is a direct consequence of the API, not of this design, and
it would apply to option 1 as well.

## Consequences

**Easier now**

- Content is plain JSX; no `onMount` bookkeeping, no second root, no lifecycle to test with fakes.
- The mount is reachable from any content through `useCanvasSurface()`, so shadcn primitives keep
  working with one prop.

**Harder now**

- The surface is React-specific. If the engine is ever extracted into a framework-agnostic
  package, the draw loop can move but the mount/portal wiring stays React-side. That's fine: the
  reset's rule is to extract when a feature needs it, not before.
- `layoutsubtree=""` / `drawable=""` are typed as `string` in `html-in-canvas.d.ts` to encode the
  React attribute quirk; a `true` will type-check as an error, on purpose.

**Also decided, to be revisited when the modal is dragged:** the surface requests a paint only
after mount and on resize. Chrome 153 fires the canvas `paint` event by itself when a drawable
child's rendering changes (verified: a state change inside the modal repainted with no
`requestPaint()` call), so content never asks for a repaint. Dragging is the first feature that
changes position every frame; if the paint event isn't enough there, that's where a frame loop
gets designed.

**Revisit trigger:** a second drawable element (the multiple-windows feature), when "one mount" stops
being true and the surface has to manage several.

## References

- [ADR 001](./001-shell-app-react-shadcn-base-ui.md) — where the question was deferred
- [Feature note: counter modal](../features/counter-modal.md) — what was seen on screen
- [Engineering note](../engineering-notes/2026-09-18-counter-modal.md) — the Portal and attribute surprises
- [Base UI Dialog — Portal `container`](https://base-ui.com/react/components/dialog)
