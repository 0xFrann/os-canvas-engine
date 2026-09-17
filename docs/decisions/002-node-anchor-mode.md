# ADR 002: One node tree with an `anchor` flag, not separate world/screen trees

- **Status:** Accepted
- **Date:** 2026-09-17
- **Topic:** Document model

## Context

The desktop shell has two kinds of on-screen content: windows, which live on a pannable/zoomable
desktop surface, and the taskbar, which must stay pinned to fixed viewport coordinates regardless
of camera pan/zoom. Both are drawn inside the same canvas (no separate page-level DOM for the
taskbar), so the document model needs to represent both.

## Options

1. **Two separate trees** — a `desktop` document for world-space windows and a `chrome` document
   for screen-space UI (taskbar, future menu bar/dock). Each tree is simpler in isolation.
2. **One tree, one `Node` shape, an `anchor: "world" | "screen"` field** — windows and the
   taskbar are both just nodes; `anchor` tells the renderer/camera whether to apply the
   world→screen transform before drawing.
3. **One tree, a `kind` discriminated union** (`WindowNode` vs `TaskbarNode` with different
   shapes) — most precise typing, but the two node shapes only actually differ in a couple of
   optional fields today.

## Decision

Option 2: a single `Node` shape, with `anchor` as a plain field alongside the existing local
`x`/`y`/`width`/`height`.

## Why

Every other capability the document already has — CRUD, `nodeReferences` id lookup, the
`activeNodeId` cursor, `save`/`load`, and especially the dirty/`ensureWorld` deferred world-sync
(carried over from the base project) — is generic over "a positioned node." Splitting into two
trees would duplicate all of that for no real gain, since the taskbar doesn't need anything a
window doesn't already have (id, position, size, a cursor for focus). A `kind` union was tempting
for stricter typing, but nothing in the shape genuinely diverges yet — `anchor` is the one field
that actually changes renderer behavior, so it's the one field that earns its own type.

## Consequences

**Easier now**

- One CRUD surface, one persistence format, one dirty/world-sync path for every node
- Adding a second screen-anchored element later (a menu bar, a dock) costs nothing new here

**Harder now**

- `Node` carries a few fields (`title`, `contentKind`, `zIndex`, `state`) that are genuinely
  meaningless for the taskbar (e.g. `state: "minimized"` doesn't apply to it) — accepted as a
  small amount of unused-field noise in exchange for one simpler model
- The renderer (Step 5) owns the actual behavioral split: `anchor: "screen"` nodes skip the
  camera transform, `anchor: "world"` nodes don't. This ADR doesn't decide that logic, just that
  the model needs to expose which is which

**Revisit trigger:** if a screen-anchored element needs meaningfully different fields from a
window (not just unused ones), split it into its own `kind` at that point rather than growing
`Node` further.

## References

- [Base project: ADR 001 — document as tree](https://github.com/0xFrann/interactive-canvas-engine/blob/main/docs/decisions/001-document-as-tree.md)
- [`docs/roadmap.md`](../roadmap.md)
