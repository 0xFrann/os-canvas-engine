# 2026-09-17 — Capability gate first

Stood up `apps/shell` (Vite + React) before any engine code exists, just to gate on
`'drawElementImage' in CanvasRenderingContext2D.prototype`. With no fallback renderer planned,
the one thing this app must never do is show a blank or broken canvas to someone on stable
Chrome — so the very first thing it renders is either "you're supported" or clear instructions
to open Chrome Canary 148+ and flip `chrome://flags/#canvas-draw-element`.

Everything after this PR (document model, renderer, windows, taskbar) builds inside that
`supported` branch.
