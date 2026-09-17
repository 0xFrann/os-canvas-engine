# 2026-09-17 — camera, hit-testing (scene-graph came and went)

`camera` ported straight from the base project — its math doesn't care about `anchor` at all,
which is exactly what ADR 002 predicted: the taskbar/window split is a rendering and picking
concern, not a "what is position" concern. Added one small thing camera didn't have:
`worldSizeToScreen`, since `drawElementImage` (Step 5) needs a screen width/height, not just a
screen x/y, and a size scales by zoom with no translation component.

This PR originally also ported `scene-graph` (a facade whose only job was calling
`ensureWorld()` before reading a node's world position). ADR 003 then flattened the document
model and removed `ensureWorld()` entirely — with nothing left for it to wrap, `scene-graph` was
deleted rather than kept as a pass-through. `hit-testing` and the future renderer read `node.x`/
`node.y` straight off the document.

`hit-testing` is where `anchor` actually shows up. `hitTest` now takes a `Camera` and a
screen-space point, resolves world position once, and picks per node using either the raw screen
point (`anchor: "screen"`, the taskbar) or the resolved world point (`anchor: "world"`, windows).
Also added real z-order to picking — the base project's version just took "last node in insertion
order wins"; ours sorts by anchor (screen on top) then `zIndex`, so the topmost *visible* node is
the one that gets picked, not just the most recently created one.

Dropped `resolveDropParent` from the port — it existed in the base project for frame-containment
drag-and-drop, which isn't a feature this project has (windows don't get reparented by dragging
them onto each other). Easy to bring back if that changes.
