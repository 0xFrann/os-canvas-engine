# Roadmap

Living plan for os-canvas-engine. Status: `todo` | `building` | `done`.

Each row below is its own feature branch, opened as its own PR — see the project [README](../README.md) for the workflow.

| # | Topic | Status | Code | Docs | ADR |
|---|-------|--------|------|------|-----|
| 1 | Repo scaffold | done | — | this file | — |
| 2 | Capability gate | done | `apps/shell` | [engineering note](./engineering-notes/2026-09-17-capability-gate.md) | — |
| 3 | Document model (Window + Taskbar nodes) | done | `packages/document` | [document-model.md](./document-model.md), [engineering note](./engineering-notes/2026-09-17-document-model.md) | [002](./decisions/002-node-anchor-mode.md), [003](./decisions/003-flatten-document-model.md) |
| 4 | Camera / hit-testing | done | `packages/camera`, `packages/hit-testing` | [engineering note](./engineering-notes/2026-09-17-spatial-packages.md) | — |
| 5 | Renderer (HTML-in-Canvas) | done | `packages/renderer` | [renderer.md](./renderer.md), [engineering note](./engineering-notes/2026-09-17-renderer.md) | [004](./decisions/004-renderer-owns-mounts-host-owns-content.md) |
| 6 | Runtime (frame loop) | todo | `packages/runtime` | — | — |
| 7 | Shell app (desktop + taskbar + apps) | todo | `apps/shell` | — | [001](./decisions/001-shell-app-react-shadcn-base-ui.md) |
| — | GitHub Pages deploy | done | `.github/workflows/deploy-pages.yml` | [engineering note](./engineering-notes/2026-09-17-github-pages.md) | — |

Live preview: [0xfrann.github.io/os-canvas-engine](https://0xfrann.github.io/os-canvas-engine/) (deploys from `main` on every push).

## Decisions made ahead of their step

- **Shell app stack:** `apps/shell`'s chrome (dock, menu bar, window title bars, Settings app) is React + shadcn/ui (Base UI). Engine packages (`document` → `runtime`) stay framework-agnostic vanilla TypeScript. See [ADR 001](./decisions/001-shell-app-react-shadcn-base-ui.md).

## Session log

| Date | What happened |
|------|----------------|
| 2026-09-17 | Repo scaffolded; tooling, docs skeleton, and workflow in place |
| 2026-09-17 | ADR 001: shell app uses React + shadcn/ui (Base UI); engine packages stay vanilla TS |
| 2026-09-17 | Capability gate: apps/shell (Vite + React) gates on `drawElementImage` support |
| 2026-09-17 | GitHub Pages deploy wired up (deploy-pages workflow, Vite base path) |
| 2026-09-17 | Document model: `@os-canvas/document`, ADR 002 (anchor flag, one tree not two) |
| 2026-09-17 | Spatial packages: scene-graph, camera (+ `worldSizeToScreen`), anchor- and zIndex-aware hit-testing |
| 2026-09-17 | ADR 003: flattened the document model (no tree/reparent/dirty-sync); `@os-canvas/scene-graph` deleted, hit-testing reads x/y directly |
| 2026-09-17 | Renderer: `@os-canvas/renderer` (`drawElementImage` per node in paint order, DPR-aware), ADR 004 (renderer owns mounts, host owns content); `paintOrder` moved into `document`. Wired into `apps/shell` (`Desktop.tsx`) and verified on Chrome 153: shipped builds need `layoutsubtree`, not just `content="drawable"`, and don't sync hit-test geometry from `drawElementImage` (renderer positions mounts with CSS transforms instead). `ContentKind` aligned with the reference desktop's apps |
