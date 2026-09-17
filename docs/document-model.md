# Document model

## What it is

The source of truth for every on-screen thing — windows and the taskbar alike. Package:
`@os-canvas/document` (`DocumentModel`).

## Why it exists

Same split as the base project: structure (this package) stays separate from paint
(`@os-canvas/renderer`, Step 5). The renderer reads from here; it does not own window state.

## How it works here

Built on the base project's proven shape (`DocumentModel` as root, `Node` with local
`x`/`y`/`width`/`height`, `worldX`/`worldY` kept in sync via a single deferred `dirtyRootId` +
`ensureWorld()`, `nodeReferences: Map<id, Node>` as the same-object id index, `activeNodeId` as
the selection/focus cursor) — see the base project's [`document-model.md`](https://github.com/0xFrann/interactive-canvas-engine/blob/main/docs/document-model.md)
for the full mechanics, which this package doesn't repeat.

What's new for the OS shell:

- **`anchor: "world" | "screen"`** — windows are `world` (camera pan/zoom applies); the taskbar
  is `screen` (fixed viewport position). See [ADR 002](./decisions/002-node-anchor-mode.md).
- **`contentKind`** — which content a node hosts (`"clock" | "notes" | "about" | "taskbar"`).
- **`zIndex` / `state`** (`"normal" | "minimized" | "maximized"`) — both patchable through the
  existing `updateNode`, same pattern as `x`/`y`/`width`/`height`.
- **`title`** — set on creation; not currently patchable (no rename-window feature yet).
- **`activeNodeId`** doubles as "focused window" — no new focus-tracking field needed.

## Open questions

- [ ] Should `title` become patchable once the shell app needs window renaming?
- [ ] Does zIndex need auto-bring-to-front on focus, or does the shell app just call
      `updateNode({ zIndex })` itself when a window is clicked? Left to Step 7.

## References

- [ADR 002: node anchor mode](./decisions/002-node-anchor-mode.md)
- Base project: [document-model.md](https://github.com/0xFrann/interactive-canvas-engine/blob/main/docs/document-model.md), [ADR 001–004](https://github.com/0xFrann/interactive-canvas-engine/tree/main/docs/decisions)
