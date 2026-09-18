# ADR 003: The engine is a library React plugs in; React owns every element on screen

- **Status:** Accepted
- **Date:** 2026-09-18
- **Topic:** Where the engine ends and the React desktop begins
- **Supersedes:** [ADR 002](./002-react-renders-inside-the-canvas.md) on who owns draw and geometry logic (its "React renders the canvas and drawable children" part stands)
- **Feature:** [modal position](../features/modal-position.md)

## Context

Drawing the modal at a position ([feature note](../features/modal-position.md)) put the same
number in two places: the draw call and the mount's CSS transform. ADR 002 had all of that inside a
React component. The user's framing of the project: the desktop is a React app, but the engine
must be "something you plug in to React. Is not a react app with logic. You init the lib in
react." Research on how others do it (Chrome's origin-trial post, the WICG explainer, tldraw)
agreed: a state model is the single source of truth and one render pass writes both the canvas
and the DOM.

## Options

1. **Keep the draw and geometry logic inside React components** (ADR 002 as built). Smallest
   today; but positions end up in props/state, every drawn thing needs its own effect with canvas
   code, and nothing is reusable outside this app.
2. **Engine as a library, React as the host.** `@os-canvas/engine` is imperative TypeScript with no
   React imports: `createEngine(canvas)`, `engine.add(element, position)`, `item.moveTo()`,
   `dispose()`. It owns the render pass (backing store sizing, `drawElementImage`, geometry sync),
   the model of what is drawn where, and later input math and scheduling. React renders every
   element on screen — canvas, chrome, taskbar, apps, with shadcn — and initializes the engine once.
   A thin binding package, `@os-canvas/react` (`<CanvasSurface>`, `<Drawable>`,
   `useDrawableMount()`), is the only place the two meet, the way `react-konva` wraps Konva. Apps
   import the hook from the package, never from a path inside the shell.
3. **Engine owns the DOM too** (creates canvas, mounts and window chrome; React only inside content
   slots). Considered and walked back: it forbids shadcn for chrome and turns the desktop into
   engine code, when the desktop is meant to be the React app.

## Decision

Option 2. The engine lives in `packages/engine` as `@os-canvas/engine`, the React binding in
`packages/react` as `@os-canvas/react`, and the desktop in `apps/shell`.

## Why

The engine has a job now — one source of truth written to two outputs — so it earns a name and a
boundary. Keeping it React-free keeps the "solid logic in TypeScript" inspectable and testable on
its own, and matches the recognized pattern. Keeping the DOM in React keeps the desktop a normal
React app with a normal component library.

## Consequences

**Easier now**

- Positions, and later order/focus/camera, have one home. React never holds a position in state and
  never re-renders because something moved.
- Drag is `item.moveTo()` from a pointer handler; the second window is a second `engine.add()`,
  and the list inside the engine is the document when it's needed.
- When Chrome finishes auto-syncing hit-test geometry (WICG/html-in-canvas#174), the engine drops
  one line and nothing else changes.

**Harder now**

- Workspace packages again (engine + react). Accepted: the boundary is the point, and the engine is
  the thing the project exists to build. The binding carries no styling: the shell passes
  `className` to `<CanvasSurface>` and `<Drawable>` like any element.
- The engine can't be *fully* agnostic — "give me a DOM element to draw" is its contract — and the
  binding layer is React-specific. Any other host would write its own thin binding.

**Rules that follow:** the engine never imports React. Components never do canvas math or set a
transform on a drawable. Portalled primitives inside a `<Drawable>` portal into its mount.

**Revisit trigger:** a second host (not React) wanting a binding of its own; that's the test of
whether the engine's contract is really host-agnostic.

## References

- [ADR 002](./002-react-renders-inside-the-canvas.md)
- [Feature note: modal position](../features/modal-position.md)
- Chrome origin-trial post (draw, then `style.transform = transform.toString()`): https://developer.chrome.com/blog/html-in-canvas-origin-trial
- WICG breaking change, automatic geometry sync in 2D contexts: https://github.com/WICG/html-in-canvas/issues/174
