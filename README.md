# os-canvas-engine

**Live preview:** [0xfrann.github.io/os-canvas-engine](https://0xfrann.github.io/os-canvas-engine/) — needs Chrome Canary 148+ with the `canvas-draw-element` flag (see below), otherwise you'll just see the "unsupported browser" screen.

An experimental web-OS desktop shell — a taskbar and draggable, resizable windows — rendered through Chrome's experimental **HTML-in-Canvas API**, so every pixel is composited through `<canvas>` while the content inside each window stays real, interactive HTML (native text selection, inputs, accessibility).

## ⚠️ Browser requirement

This only runs in **Chrome Canary 148+** with the `chrome://flags/#canvas-draw-element` flag enabled (or via the Chrome origin trial). There is no fallback renderer — this is a tech demo built specifically to explore the new API, not a production app. See the [WICG explainer](https://github.com/WICG/html-in-canvas) for background on the API itself.

## Why this exists

This is a portfolio piece: an exploration of what a browser-native "OS" could look like once `<canvas>` can composite real DOM instead of only pixels. It's built on the architecture of [`interactive-canvas-engine`](https://github.com/0xFrann/interactive-canvas-engine) — a canvas-motor project (document model → scene graph → camera → hit testing → renderer → runtime) originally built as engineering interview prep — reused here as a proven layering, rewritten from scratch around HTML-in-Canvas rendering and an OS-shell demo instead of a board of shapes. The desktop-shell shape itself (dock, menu bar, app windows) also draws on an earlier DOM-only project, [Peacevoid OS](https://www.behance.net/gallery/194480187/THE-PEACEVOID-OS-Case-Study) ([desktop-os-react-next](https://github.com/0xFrann/desktop-os-react-next)) — this project asks what changes about that shell once the desktop surface itself is canvas-composited.

## Packages

| Package | Role |
|---------|------|
| `@os-canvas/document` | Flat node store + Window/Taskbar model |
| `@os-canvas/camera` | World ↔ screen (pan / zoom) |
| `@os-canvas/hit-testing` | World- and screen-space node pick |
| `@os-canvas/renderer` | HTML-in-Canvas paint (`drawElementImage`) |
| `@os-canvas/runtime` | Frame loop |
| `@os-canvas/shell` | The desktop-shell demo app |

(Packages land incrementally — see [`docs/roadmap.md`](./docs/roadmap.md) for status.)

## Workflow

Each roadmap step is its own feature branch and PR against `main`. Architecture decisions are recorded as ADRs in [`docs/decisions/`](./docs/decisions/), with short dated learning entries in [`docs/engineering-notes/`](./docs/engineering-notes/).

## Scripts

- `pnpm install`
- `pnpm dev` — run the shell app
- `pnpm test` — unit tests across packages
- `pnpm typecheck` — TypeScript across packages + app
- `pnpm lint` / `pnpm format`
- `pnpm screenshot` — loads the running dev server in a headless Chrome with the HTML-in-Canvas flag and saves `screenshot.png` (see `scripts/screenshot.mjs` for `CHROME` / `URL` overrides)
