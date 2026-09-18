# os-canvas-engine

**Live preview:** [0xfrann.github.io/os-canvas-engine](https://0xfrann.github.io/os-canvas-engine/) — needs Chrome Canary 148+ with the `canvas-draw-element` flag (see below), otherwise you'll just see the "unsupported browser" screen.

An experimental web-OS desktop shell — a taskbar and draggable, resizable windows — rendered through Chrome's experimental **HTML-in-Canvas API**, so every pixel is composited through `<canvas>` while the content inside each window stays real, interactive HTML (native text selection, inputs, accessibility).

## ⚠️ Browser requirement

This only runs in **Chrome Canary 148+** with the `chrome://flags/#canvas-draw-element` flag enabled (or via the Chrome origin trial). There is no fallback renderer — this is a tech demo built specifically to explore the new API, not a production app. See the [WICG explainer](https://github.com/WICG/html-in-canvas) for background on the API itself.

## Why this exists

This is a portfolio piece: an exploration of what a browser-native "OS" could look like once `<canvas>` can composite real DOM instead of only pixels. It's built on the architecture of [`interactive-canvas-engine`](https://github.com/0xFrann/interactive-canvas-engine) — a canvas-motor project (document model → scene graph → camera → hit testing → renderer → runtime) originally built as engineering interview prep — reused here for its reasoning (ADRs, notes, the same building blocks when a feature needs them), rewritten from scratch around HTML-in-Canvas rendering and an OS-shell demo instead of a board of shapes. The desktop-shell shape itself (dock, menu bar, app windows) also draws on an earlier DOM-only project, [Peacevoid OS](https://www.behance.net/gallery/194480187/THE-PEACEVOID-OS-Case-Study) ([desktop-os-react-next](https://github.com/0xFrann/desktop-os-react-next)) — this project asks what changes about that shell once the desktop surface itself is canvas-composited.

## How this is built

Feature by feature, not layer by layer. The [roadmap](./docs/roadmap.md) is a ladder of user-visible features — a counter modal drawn through the canvas, then moving it, dragging it, making it a window, a second window, a dock, the rest of the reference desktop — in a rough order that can change as we learn. Each feature is designed only as far as it needs, built, and looked at in Chrome Canary before the next one starts. Engine code (the "render engine" part of the name) is extracted into `packages/` when a feature makes a boundary obvious, not before. Each feature has a [feature note](./docs/features/README.md) with its need, its design, and what was verified on screen.

## Workflow

Each feature is its own branch and PR against `main`, with a screenshot from Chrome Canary attached. Architecture decisions are recorded as ADRs in [`docs/decisions/`](./docs/decisions/), with short dated learning entries in [`docs/engineering-notes/`](./docs/engineering-notes/).

## Scripts

- `pnpm install`
- `pnpm dev` — run the shell app
- `pnpm test` — unit tests (none yet)
- `pnpm typecheck` — TypeScript
- `pnpm lint` / `pnpm format`
- `pnpm screenshot` — loads the running dev server in a headless Chrome with the HTML-in-Canvas flag and saves `screenshot.png` (see `scripts/screenshot.mjs` for `CHROME` / `URL` overrides)
