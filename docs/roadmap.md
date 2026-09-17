# Roadmap

Living plan for os-canvas-engine. Status: `todo` | `building` | `done`.

Each row below is its own feature branch, opened as its own PR — see the project [README](../README.md) for the workflow.

| # | Topic | Status | Code | Docs | ADR |
|---|-------|--------|------|------|-----|
| 1 | Repo scaffold | done | — | this file | — |
| 2 | Capability gate | done | `apps/shell` | [engineering note](./engineering-notes/2026-09-17-capability-gate.md) | — |
| 3 | Document model (Window + Taskbar nodes) | todo | `packages/document` | — | — |
| 4 | Scene graph / camera / hit-testing | todo | `packages/scene-graph`, `packages/camera`, `packages/hit-testing` | — | — |
| 5 | Renderer (HTML-in-Canvas) | todo | `packages/renderer` | — | — |
| 6 | Runtime (frame loop) | todo | `packages/runtime` | — | — |
| 7 | Shell app (desktop + taskbar + apps) | todo | `apps/shell` | — | [001](./decisions/001-shell-app-react-shadcn-base-ui.md) |

## Decisions made ahead of their step

- **Shell app stack:** `apps/shell`'s chrome (dock, menu bar, window title bars, Settings app) is React + shadcn/ui (Base UI). Engine packages (`document` → `runtime`) stay framework-agnostic vanilla TypeScript. See [ADR 001](./decisions/001-shell-app-react-shadcn-base-ui.md).

## Session log

| Date | What happened |
|------|----------------|
| 2026-09-17 | Repo scaffolded; tooling, docs skeleton, and workflow in place |
| 2026-09-17 | ADR 001: shell app uses React + shadcn/ui (Base UI); engine packages stay vanilla TS |
| 2026-09-17 | Capability gate: apps/shell (Vite + React) gates on `drawElementImage` support |
