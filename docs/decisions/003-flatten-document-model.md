# ADR 003: Flatten the document model — no tree, no reparent, no deferred world-sync

- **Status:** Accepted
- **Date:** 2026-09-17
- **Topic:** Document model
- **Supersedes:** the tree/dirty-sync shape ported in the original `@os-canvas/document`

## Context

`@os-canvas/document` started as a close port of the base project's `DocumentModel`: a tree
(`children: Map`), `reparentNode` with cycle detection, a deferred `dirtyRootId`/`ensureWorld`
world-sync system, and a `worldX`/`worldY` pair kept separate from local `x`/`y`. Reviewing it
after ADR 002 made the mismatch obvious: that machinery exists in the base project to make
dragging a *nested frame* cheap — the frame's descendants' world positions need to be recomputed,
and doing that eagerly on every drag frame would be wasteful, so the base project defers it.

This project has no nested frames. Windows and the taskbar are flat — nothing here ever has a
non-root parent, nothing gets reparented. Carrying the tree/reparent/dirty-sync code forward
wasn't reusing a proven pattern, it was importing a solution to a problem this project doesn't
have. The result was code that was hard to read specifically *because* it implied assumptions
(arbitrary nesting depth, expensive subtree recomputation) that don't hold here — which is its
own kind of bug: a reader has to first disprove a feature exists before they can trust it's safe
to ignore.

## Options

1. **Keep the tree "just in case" nesting is needed later** — zero code change now, but keeps
   dead generality that has to be re-understood (and re-verified as unused) every time someone
   reads this package.
2. **Flatten now**: drop `children`/`parentId`/`reparentNode`/`isAncestorOf`, drop
   `dirtyRootId`/`ensureWorld`/`syncWorldSubtree`/`worldSyncCount`, drop `worldX`/`worldY` (local
   `x`/`y` *is* the position with no parent chain to sum). Also drop the now-pointless duplicate
   `SerializedNode` type — with no runtime-only fields left on `Node`, it was identical to `Node`.

## Decision

Option 2.

## Why

YAGNI, concretely: every dropped piece existed to serve nesting, and nothing in this project's
plan nests. `@os-canvas/scene-graph`'s entire purpose was wrapping `ensureWorld()` before reading
a position — with that gone, it becomes a one-line pass-through around nothing, so it's deleted
too (folded into this same cleanup pass; see the [spatial-packages PR](https://github.com/0xFrann/os-canvas-engine/pull/5)
for where `hit-testing` picks up reading `node.x`/`node.y` directly). `nodeReferences` is renamed
to `nodes` — it was named as "the id index, as opposed to the tree" specifically because there
used to be a tree to be "as opposed to"; now it's just the one flat store, so it gets the plainer
name.

## Consequences

**Easier now**

- Every remaining line in `DocumentModel` does something a current feature needs — no
  "why is this here" reading tax
- One position concept (`x`/`y`), not two (`x`/`y` vs `worldX`/`worldY`) that happen to be equal
  everywhere right now
- `@os-canvas/scene-graph` package deleted outright rather than kept as a trivial wrapper

**Harder now**

- If a future feature genuinely needs containment (e.g. a window hosting a nested child dialog
  that should move with it), this comes back — deliberately, when there's a real feature driving
  it, not preemptively

**Revisit trigger:** a concrete feature that needs one node's position to depend on another's
(nesting, grouping, docking one window to another). Until then, flat stays flat.

## References

- [ADR 002: node anchor mode](./002-node-anchor-mode.md) — the anchor split is unaffected by this;
  it was already anchor-agnostic
- Base project: [ADR 001 — document as tree](https://github.com/0xFrann/interactive-canvas-engine/blob/main/docs/decisions/001-document-as-tree.md),
  [ADR 013/014 — dirty root / ensureWorld](https://github.com/0xFrann/interactive-canvas-engine/tree/main/docs/decisions)
  (the machinery this ADR intentionally does not carry forward)
