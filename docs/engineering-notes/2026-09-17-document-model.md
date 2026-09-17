# 2026-09-17 — Document model: window and taskbar are the same node

Started `packages/document` by porting the base project's proven CRUD/dirty-world-sync shape
fresh, then had to decide how the taskbar (fixed to the viewport) fits alongside windows
(camera-panned) in one tree. Tempting to reach for a discriminated `kind` union right away, but
nothing about the taskbar actually needs different fields from a window — it just needs to skip
the camera transform. Landed on a plain `anchor: "world" | "screen"` field instead (ADR 002) and
left the union idea as a revisit trigger if a future screen-anchored element ever needs fields a
window doesn't have.
