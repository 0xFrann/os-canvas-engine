# ADR 001: Shell app UI built with React + shadcn/ui (Base UI), engine code stays framework-agnostic

- **Status:** Accepted
- **Date:** 2026-09-17
- **Topic:** Shell app tech stack

## Context

`apps/shell` needs real chrome for the desktop metaphor — a dock/taskbar, a menu bar, window title bars, and at least one settings-style app with dialogs and menus — and the whole point of this project is that this content is genuinely interactive, accessible DOM (native text selection, focus, screen readers) composited through `drawElementImage`, not painted pixels. The base project (`interactive-canvas-engine`) built its demo with plain TypeScript and direct DOM manipulation, which works but means hand-rolling every accessible interactive primitive (menus, dialogs, focus trapping) from scratch.

As of July 2026, shadcn/ui ships with [Base UI](https://base-ui.com) as its default underlying primitives library (Radix still supported) — accessible, unstyled React components maintained by the same team behind Radix/MUI.

## Options

1. **Vanilla TS + direct DOM, matching the engine code** — no new dependencies, one language/paradigm across the whole repo; but every accessible interactive primitive (dropdown menu, dialog, focus management) gets hand-built.
2. **React + shadcn/ui (Base UI) for `apps/shell`'s content; engine code stays vanilla TS** — whatever engine code gets extracted (see the [roadmap](../roadmap.md): it's extracted when a feature makes the boundary obvious, not planned up front) remains framework-agnostic; the shell's chrome content (dock, menu bar, window title bars, Settings app) is built with React + shadcn/ui.
3. **React everywhere, including the engine code** — rejected; the engine's value as a portfolio piece is that it's a small, dependency-free motor. Coupling it to React would obscure that.

## Decision

Option 2: React + shadcn/ui (Base UI) for `apps/shell`'s chrome. Engine code stays vanilla TypeScript.

## Why

The engine code is the "how does this work" story — it should stay minimal and inspectable, same as the base project. The shell app is the "does this actually feel real" story — accessible menus, dialogs, and focus handling are exactly the kind of correctness that's tedious and easy to get subtly wrong by hand, and Base UI's primitives get that right for free. Using shadcn/ui for the shell also lets the demo look genuinely polished without spending the build budget on component styling from scratch.

## Consequences

**Easier now**

- Accessible dock/menu/dialog primitives without hand-building focus traps, ARIA wiring, or keyboard navigation
- Shell app can look presentable quickly, which matters for a portfolio piece

**Harder now**

- Whoever draws an element through `drawElementImage` and whoever renders React into it are two owners of the same DOM node. Where that boundary sits is decided when the first drawn element exists (roadmap rung 1), not here.
- Two dependency stacks in one repo (vanilla TS engine code + a React/Tailwind app) — acceptable as long as the boundary is a whole package vs. a whole app, not mixed within one package.

## References

- [shadcn/ui — Base UI as the default (July 2026 changelog)](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
- [Base UI](https://base-ui.com)
