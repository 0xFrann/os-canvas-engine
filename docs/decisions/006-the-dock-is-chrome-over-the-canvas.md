# ADR 006: The dock is chrome over the canvas, not something the engine draws

- **Status:** Accepted
- **Date:** 2026-09-18
- **Topic:** Which parts of the desktop go through `drawElementImage`, and which are ordinary DOM
- **Feature:** [multiple windows, opened from a dock](../features/multiple-windows.md)

## Context

Until the dock, everything visible inside the desktop was a window, and every window was drawn by
the engine. The dock is the first piece of desktop UI that is not a window, and it is not the last:
the menu bar, the boot splash and the desktop icon grid are all on the roadmap.

So the question the dock asks is not "where does the dock live" but "what is the canvas *for*".
Answer it wrong once and every later piece of chrome inherits the answer.

## Options

1. **Register the dock as a drawable.** `engine.add(dockElement, { x, y })` and the whole desktop
   goes through one rendering path. But a drawable is a thing in the scene: it has a position
   someone can change, a place in a draw order, and the engine raises it on `pointerdown`
   ([ADR 005](./005-draw-order-lives-in-the-engine.md)). The dock has none of that, and it must
   never be dragged or raised — so it would immediately need the engine to grow "pinned" and
   "never raise" flags, machinery invented for something that is not part of the scene. It would
   also cost a snapshot per paint, and the tooltip popup would have to portal into the drawable
   mount rather than the page.
2. **Plain DOM over the canvas.** The dock is a React component next to `<CanvasSurface>`, placed
   over it with CSS. The engine never hears about it.
3. **A second canvas for chrome.** Two canvases, two engines, and the same question again about
   which one anything belongs to. No gain over (2) today.

## Decision

Option 2. **The canvas draws the scene; everything that frames the scene is ordinary DOM laid over
it.** A thing belongs in the scene when it has a position the user can change, an order among other
such things, and a lifetime the user controls — that is a window, and nothing else so far. The dock,
and the menu bar after it, are chrome: fixed by CSS, above the canvas in the page.

`packages/react` needed no change for this. `CanvasSurface` renders a single `<canvas>` element, so
the desktop wraps it in a positioned `div` and renders the dock as its sibling:

```tsx
<div className="desktop">
  <CanvasSurface>{/* windows: drawn */}</CanvasSurface>
  <Dock />                              {/* chrome: not drawn */}
</div>
```

## Why

The engine is a library that draws elements at positions it owns. Anything handed to it is making a
claim — "my position and my stacking are yours" — and the dock cannot make that claim, because its
position is a CSS rule and its stacking is "always on top". Registering it would mean asking the
engine for exceptions to its own rules on the first day it has two kinds of drawable.

There is a practical half too. Chrome that is not drawn costs the canvas nothing: hovering the dock,
opening its tooltip and scaling an icon are **0 canvas paint events**, because none of it is a
drawable child Chrome has to re-snapshot. And the dock gets the whole normal web platform back —
`:hover`, a Base UI tooltip, focus rings — none of which has to be taught about the canvas. The
tooltip still portals into the desktop element rather than `document.body`, for the reason the
dialog did (ADR 002): everything the desktop shows lives in the desktop's subtree.

## Consequences

**Easier now**

- The dock is a plain React component built from what the shell already has (Base UI tooltip via
  shadcn, lucide icons, Tailwind). It imports nothing from the engine or the binding.
- The engine's contract stays one sentence: it owns the drawn rect, the DOM rect and the order of
  the things registered with it. Nothing was added to it for this feature.
- The menu bar, and the boot splash over the whole desktop, have their answer already.

**Harder now**

- There are two stacking worlds: `z-index` written by the engine *inside* the canvas, and the
  page's own stacking *outside* it. The dock is above the canvas in the page, so nothing drawn can
  ever cover it. That is right for a dock and wrong for something like a modal sheet over the
  chrome, which would have to be drawn or the chrome would have to move.
- A camera (pan/zoom the desktop) would transform the scene and leave the chrome alone. Right for a
  dock. The desktop icon grid, when it is built, has to pick a side — it looks like chrome and
  behaves like scene content — and this ADR does not pick it in advance.

**Revisit trigger:** a piece of chrome that has to be inside the scene (an icon grid that pans with
the wallpaper), or one that has to be covered by a window.

## References

- [ADR 003: the engine is a library plugged into React](./003-engine-is-a-library-plugged-into-react.md)
- [ADR 004: window chrome belongs to the desktop](./004-window-chrome-belongs-to-the-desktop.md)
- [ADR 005: draw order lives in the engine](./005-draw-order-lives-in-the-engine.md)
- [Feature note: multiple windows, opened from a dock](../features/multiple-windows.md)
- Reference desktop, where the dock comes from:
  [`DockBar.tsx`](https://github.com/0xFrann/desktop-os-react-next/blob/main/src/components/index/DockBar.tsx)
