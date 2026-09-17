# 2026-09-17 — Flattening the document model

Went back through `@os-canvas/document` after PR #5 (scene-graph/camera/hit-testing) and realized
a chunk of it was unexplainable without also explaining a feature this project doesn't have.
`reparentNode`, `isAncestorOf`, `dirtyRootId`/`ensureWorld`, `worldSyncCount` — all of it exists
in the base project to make dragging a *nested frame* cheap. Nothing here nests. Windows and the
taskbar are flat. So none of it was actually protecting against a real bug or serving a real
feature — it was just there because the base project had it, and porting the base project's
proven *pattern* isn't the same thing as porting its code wholesale.

Cut it (ADR 003): no tree, no reparent, no deferred world-sync, no `worldX`/`worldY` distinct from
`x`/`y`. That also killed `@os-canvas/scene-graph` outright — its only job was wrapping
`ensureWorld()`, and once that's gone it was a facade around nothing.

The lesson for the rest of this build: when porting something from the base project, port the
reasoning, not the diff. Check each piece against what this project's actual nodes need before
keeping it, rather than assuming "it was in the reference implementation" is itself a reason to
keep something.
