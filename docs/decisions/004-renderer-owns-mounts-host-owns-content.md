# ADR 004: The renderer owns each node's drawable mount; the host owns what's inside it

- **Status:** Accepted
- **Date:** 2026-09-17
- **Topic:** Renderer

## Context

With HTML-in-Canvas, "drawing a window" means calling `drawElementImage` on a real DOM element
that is a `drawable` descendant of the canvas. So unlike the base project's renderer (which only
ever called `fillRect`), this renderer has to answer: who creates those elements, who puts the
window's actual content in them, and who removes them?

ADR 001 already decided the content is React + shadcn/ui and flagged that the boundary between
the renderer and React "needs to be explicit so the two ownership boundaries don't fight each
other." This ADR makes it explicit.

Two other decisions fell out of building it and are recorded here rather than given their own ADR:
where the shared paint order lives, and what happens to a minimized window's DOM.

## Options

1. **Renderer owns everything** — a `contentKind → HTML` registry inside the renderer, which
   templates each node's innerHTML itself. Self-contained, but pulls app content into an engine
   package and forces the renderer to know about React (or forbid it).
2. **Host owns everything** — the app creates and manages the `drawable` elements and passes the
   renderer a `Map<nodeId, Element>`. Renderer stays tiny, but every host re-implements the
   create/size/remove/inert bookkeeping, and nothing guarantees the element is actually a canvas
   descendant with the right attribute.
3. **Renderer owns the mount, host owns the content** — the renderer creates one
   `<div drawable data-node-id>` per node as a canvas child, keeps its layout size equal to the
   node's size, removes it on delete, and exposes `onMount(node, element)` / `onUnmount(id, element)`.
   The host mounts a React root into the element and never touches its size or attributes.

## Decision

Option 3. Plus:

- **Paint order lives in `@os-canvas/document`** (`paintOrder`, `comparePaintOrder`) and is
  imported by both the renderer and `@os-canvas/hit-testing`. It was private to hit-testing before.
- **Minimized nodes keep their mount** but are set `inert` + `aria-hidden="true"` and skipped at
  draw time.
- **`supportsHtmlInCanvas()` moves into the renderer package** next to the API typings;
  `apps/shell` imports it instead of owning a copy.

## Why

The mount is engine-shaped: it's the thing `drawElementImage` needs, it must be a canvas child,
it must carry the `drawable` attribute, its layout size must match the node so the snapshot is
1:1 — all of that is renderer knowledge. The content is app-shaped: which React tree renders a
"notes" window is nothing the engine should know. Option 3 puts each concern with the package
that has the information to get it right, and gives React a stable element to own for the life
of the node.

Paint order has to be identical in the renderer and hit-testing or the topmost drawn window is
not the one you click — that's a correctness invariant, not a convenience, so it gets one
definition. It's a function of node fields alone (`anchor`, `zIndex`), which makes `document`
the natural owner even though it's "about paint."

Keeping a minimized window mounted means un-minimizing doesn't lose React state (a half-typed
note). But an undrawn element that's still focusable is an accessibility bug — Tab would move
focus into something invisible — so it's made `inert` and hidden from the accessibility tree, which
is the explainer's own recommendation for "hidden views or no-longer-drawn content."

## Consequences

**Easier now**

- The shell app's job in Step 7 is one hook: `onMount: (node, el) => createRoot(el).render(<Window node={node} />)`.
- Renderer and picker can't drift on z-order.
- Feature detection has one source of truth, typed next to the API it detects.

**Harder now**

- The renderer knows about a few DOM APIs (`createElement`, `append`, `inert`, `aria-hidden`), so
  its tests use hand-rolled fakes rather than a pure-function assertion style. Acceptable: no DOM
  shim knows `drawElementImage` anyway, so fakes were inevitable.
- Two `paint`-ordering call sites now depend on `document` exporting something paint-flavored.
  If a third consumer needs ordering that isn't a pure function of node fields (e.g. "always-on-top"
  windows), revisit whether it stays there.

**Revisit trigger:** a content kind that genuinely needs to control its own mount (e.g. a window
whose content must be an `<iframe>` rather than a `<div>`), or a host that isn't React.

## References

- [ADR 001](./001-shell-app-react-shadcn-base-ui.md) — where the boundary question was raised
- [ADR 002](./002-node-anchor-mode.md) — the anchor split the renderer branches on
- [WICG HTML-in-Canvas explainer — Accessibility](https://github.com/WICG/html-in-canvas#accessibility)
- [`docs/renderer.md`](../renderer.md)
