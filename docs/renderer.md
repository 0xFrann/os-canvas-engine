# Renderer

## What it is

HTML-in-Canvas paint for document nodes. Package: `@os-canvas/renderer` (`createRenderer`).
Reads `@os-canvas/document` and `@os-canvas/camera`; owns the canvas's drawable DOM mounts;
does not own window state.

## Why it exists

Same structure-vs-paint boundary as the base project: the document says *what* is on screen,
the renderer says *where the pixels go*. What's different here is that "pixels" are
`drawElementImage` snapshots of real DOM, so the renderer also has a DOM-lifecycle job the base
project's `fillRect` renderer never had — see [ADR 004](./decisions/004-renderer-owns-mounts-host-owns-content.md).

## How it works here

- **`createRenderer({ canvas, doc, camera, background?, onMount?, onUnmount? })`** sets
  `content="drawable"` on the canvas and returns `{ render, syncMounts, resize, getMount, dispose }`.
- **Mounts.** One `<div drawable data-node-id="…">` per node, appended as a direct child of the
  canvas. The renderer creates it, sizes it (`width`/`height` in CSS px = the node's world size),
  removes it when the node is deleted, and never touches what's inside. The host fills it in
  `onMount` (the shell app will mount a React root there) and tears down in `onUnmount`.
- **`render()`** = `syncMounts()` → reset transform to the device-pixel-ratio scale → `clearRect`
  → optional background fill → for each node in `paintOrder(doc)`, `drawElementImage(mount, x, y, w, h)`.
  - `anchor: "world"` (windows): `x,y` via `worldToScreen`, `w,h` via `worldSizeToScreen` — zoom is
    a draw-time scale, the mount's layout size never changes with zoom.
  - `anchor: "screen"` (taskbar): raw `x,y,w,h`. The camera is not consulted ([ADR 002](./decisions/002-node-anchor-mode.md)).
  - `state: "minimized"`: not drawn. Its mount stays in the DOM (so the host's component state
    survives un-minimizing) but is set `inert` + `aria-hidden="true"` so keyboard focus and
    assistive tech can't land in something invisible.
- **Paint order** lives in `@os-canvas/document` as `paintOrder(doc)` / `comparePaintOrder`,
  shared with `@os-canvas/hit-testing` so what's drawn on top is exactly what gets picked. Order:
  world nodes by `zIndex`, then screen nodes by `zIndex`.
- **`resize(cssWidth, cssHeight, dpr)`** sizes the backing store to `css × dpr` and `render` applies
  `setTransform(dpr, 0, 0, dpr, 0, 0)`, so every coordinate the renderer deals in is a CSS pixel.
  The host wires a `ResizeObserver` (the WICG explainer's own pattern).
- **First frame after mounting.** `drawElementImage` throws `InvalidStateError` ("No cached paint
  record for element") until the browser has recorded a drawable's first snapshot, which can't
  happen in the same task the element was inserted. `render` catches exactly that error, calls
  `canvas.requestPaint()`, and keeps drawing the other nodes. Any other error is rethrown.
- **Typings.** `src/types/html-in-canvas.ts` declares `drawElementImage`, `content`, `onpaint`,
  `requestPaint`, and the `paint` event globally (TypeScript's DOM lib doesn't have them yet), and
  exports `supportsHtmlInCanvas()` — the capability gate `apps/shell` now imports instead of
  keeping its own copy.

## What I would do differently

- Nothing verified in a real Canary yet — the tests drive the renderer against hand-rolled DOM
  and context fakes (no jsdom knows `drawElementImage` either). The first thing Step 6/7 should do
  is run this against Canary 148 and confirm the auto geometry update from `drawElementImage`
  makes clicks inside a zoomed window land on the right DOM element.

## Open questions

- [ ] `state: "maximized"` is currently drawn at whatever rect the document holds. Should the
      renderer own "fill the viewport in screen space," or does the shell app just write a
      screen-anchored rect into the node? Left to Step 7.
- [ ] `paint` vs `requestAnimationFrame`: HTML-in-Canvas fires `paint` on the canvas whenever a
      drawable's snapshot changes (a clock ticking inside a window). The runtime (Step 6) needs to
      decide whether `paint` *is* the frame loop or feeds one.
- [ ] Viewport culling: every non-minimized node is drawn each frame. Fine for a handful of windows.

## References

- [ADR 004: renderer owns mounts, host owns content](./decisions/004-renderer-owns-mounts-host-owns-content.md)
- [ADR 001: shell app stack](./decisions/001-shell-app-react-shadcn-base-ui.md) — where this ownership split was first called out
- [WICG HTML-in-Canvas explainer](https://github.com/WICG/html-in-canvas)
- Base project: [renderer.md](https://github.com/0xFrann/interactive-canvas-engine/blob/main/docs/renderer.md) — the `fillRect` version this replaces
