# Document model

## What it is

The source of truth for every on-screen thing — windows and the taskbar alike. Package:
`@os-canvas/document` (`DocumentModel`).

## Why it exists

Structure (this package) stays separate from paint (`@os-canvas/renderer`, Step 5). The renderer
reads from here; it does not own window state.

## How it works here

Deliberately flat — see [ADR 003](./decisions/003-flatten-document-model.md) for why this isn't
the base project's tree/reparent/dirty-sync shape.

- **`DocumentModel` is the root** (`id: "root"`). No separate root `Node` object.
- **`nodes: Map<id, Node>`** — the one flat store. No tree, no separate id index alongside it.
- **`Node`:** `id`, `x`/`y`/`width`/`height` (this *is* the position — nothing nests, so there's
  no separate world position to keep in sync), `anchor` (`"world" | "screen"`, [ADR 002](./decisions/002-node-anchor-mode.md)),
  `title`, `contentKind`, `zIndex`, `state` (`"normal" | "minimized" | "maximized"`).
- **`activeNodeId`:** doubles as the focused-window cursor. Adding a node focuses it (opening an
  app focuses its window); deleting the active node refocuses `"root"` (the desktop).
- **API:** `addNode({ x, y, anchor, contentKind, ... })` (UUID id, size/state/zIndex/title
  defaulted), `selectNode`, `updateNode` (patches `x`/`y`/`width`/`height`/`zIndex`/`state` on the
  active node), `deleteNode`, `save`/`DocumentModel.load` (flat array of plain `Node` objects —
  `Node` and the serialized shape are now identical, so there's no separate `SerializedNode`
  type).
- **`paintOrder(doc)` / `comparePaintOrder`:** bottom-to-top order (world nodes by `zIndex`,
  then screen nodes by `zIndex`). Lives here rather than in the renderer because both
  `@os-canvas/renderer` and `@os-canvas/hit-testing` must agree on it — see [ADR 004](./decisions/004-renderer-owns-mounts-host-owns-content.md).
- **Ids:** `crypto.randomUUID()` on `addNode`; file load preserves stored ids and rejects
  duplicates.
- **`title` is set on creation only** — not currently patchable (no rename-window feature yet).

## What I would do differently

- Should have started here instead of porting the base project's tree/dirty-sync model first —
  see ADR 003. The lesson generalizes: port the *proven pattern*, not the code, and check each
  piece against this project's actual requirements before keeping it.

## Open questions

- [ ] Should `title` become patchable once the shell app needs window renaming?
- [ ] Does zIndex need auto-bring-to-front on focus, or does the shell app just call
      `updateNode({ zIndex })` itself when a window is clicked? Left to Step 7.

## References

- [ADR 002: node anchor mode](./decisions/002-node-anchor-mode.md)
- [ADR 003: flatten the document model](./decisions/003-flatten-document-model.md)
- Base project: [document-model.md](https://github.com/0xFrann/interactive-canvas-engine/blob/main/docs/document-model.md) — the tree/dirty-sync shape this project deliberately doesn't carry forward
