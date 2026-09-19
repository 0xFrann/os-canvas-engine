# ADR 009: The desktop is not an app — the workspace layout

- **Status:** Accepted
- **Date:** 2026-09-19
- **Topic:** Where the OS host, the programs it runs, and the UI components they share live
- **Feature:** none — a scaffolding refactor, no behaviour changes

## Context

The repo started as the usual monorepo: libraries under `packages/`, and one React app at
`apps/shell`. The programs the desktop runs (Counter, Example App, Settings) lived *inside* that
app, at `apps/shell/src/apps/`, next to the desktop's own `components/`, and the shadcn components
lived there too.

That layout says two things that are not true. A folder called `apps` holding the shell says the
shell is an app; it is the OS host — it owns the canvas, the window chrome, the theme and the
deploy. And programs nested in the host's source tree say they are part of it; they are what it
*runs*, and ADR 004 already draws that line in behaviour (an app fills a content slot and reaches
nothing else) without anything in the file tree holding it.

## Options

1. **Keep `apps/shell`**, move the programs to a sibling `apps/<name>` each. Still calls the host an
   app, and puts it level with what it runs.
2. **One package per program.** Honest, but three manifests for three components, with no program
   yet needing its own dependencies or build.
3. **The host at the top level, all programs in one package, shared UI in its own package.**

## Decision

Option 3.

```
packages/
  engine/     @os-canvas/engine   library
  react/      @os-canvas/react    binding
  ui/         @os-canvas/ui       shadcn components + cn()
desktop/      @os-canvas/desktop  the OS host: canvas, Window chrome, dock, theme, deploy
apps/         @os-canvas/apps     every program, one package
  src/
    Counter/
    ExampleApp/
    Settings/
    desktop.ts                    what an app may ask the desktop for
    index.ts
```

Dependencies go one way:

- The apps use `@os-canvas/ui`.
- The desktop uses `@os-canvas/react`, `@os-canvas/ui` and `@os-canvas/apps`.
- Nothing imports the desktop, and the apps never import the binding or the engine.

The theme and the Tailwind setup stay in `desktop/src/index.css`, with `@source` lines so Tailwind
also scans `packages/ui` and `apps`.

## Why

- **The tree now says what ADR 004 says.** An app cannot reach the engine because its package does
  not depend on it; before, only a convention stopped an import.
- **Settings needs something from the desktop, and the arrow still points one way.** The contract
  (`Desktop`, `useDesktop`, `DesktopProvider`, the `DesktopBackground` shape) lives with the apps —
  it is their side of the line: they say what they need, the desktop provides it. The desktop
  importing that contract is the dependency it already has.
- **Which apps are in the dock is the desktop's.** `dockApps.tsx` (label, lucide icon, window size,
  which component) moved to `desktop/src/`: a dock and a window size are the host's concepts. The
  apps package exports components and nothing about how they are presented.
- **One theme.** Components and apps carry class names, not CSS; the desktop that renders them is the
  one place a token is defined, which is what keeps every control one system.

## Consequences

- `CounterModal` is `Counter`: it has not been a modal since the window chrome took over (ADR 004).
- `@os-canvas/shell` is `@os-canvas/desktop`; `pnpm dev`, the Pages workflow and the oxlint ignore
  follow. The import aliases `@ui` and `@apps` are gone — those are package names now; `@/` remains
  inside the desktop. shadcn's `components.json` moved to `packages/ui`.
- Dated feature notes, engineering notes and earlier ADRs still say `apps/shell`. They are records
  of what was true when written and are not rewritten.
- Adding a program is a folder in `apps/src/` and an entry in the desktop's `dockApps.tsx`. A
  program that one day needs its own dependencies can become its own package without moving the
  line.

## References

- [ADR 003](./003-engine-is-a-library-plugged-into-react.md): the engine is a library, the desktop a
  React app that plugs it in.
- [ADR 004](./004-window-chrome-belongs-to-the-desktop.md): the desktop provides the chrome, an app
  fills a content slot.
