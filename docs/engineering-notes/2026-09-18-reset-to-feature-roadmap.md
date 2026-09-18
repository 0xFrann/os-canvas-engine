# 2026-09-18 — Reset to the CI commit: features, not layers

The first attempt at this project (PRs #4–#7) built it the way the base project's roadmap reads:
document model → camera → hit-testing → renderer, each as its own package with unit tests. Four
packages landed and the running shell had exactly one interaction wired up — a window's close
button. `hit-testing` was imported by nothing, camera pan/zoom was never called, the taskbar was an
empty strip, and no app could be opened. Nothing reached the screen until the renderer step was
explicitly stopped and asked to show something.

The verdict, in the words that triggered this reset: "We think on a feature, we analyze the need,
we design and only then build. Now, it feels like we are designing and coding a system that I
don't understand and do not know what it does and what can we do later. [...] An abstraction, a
complex logic without use is worthless."

So the tree is back to the CI commit (`cd988f0`: capability gate, Pages deploy, tooling) and the
[roadmap](../roadmap.md) is now a list of user-visible features. Each feature is designed only as
far as it needs, built, and looked at in Chrome Canary before the next one starts. Packages under
`packages/` appear when a feature makes a boundary obvious, not before.

## What the first attempt learned about the browser

Worth keeping so the same walls aren't hit blind. Each of these will still be *shown* on screen at
the first features of the roadmap — this is what to expect, not a substitute for seeing it.

- **Attribute names are mid-rename.** The WICG explainer and Chromium main use `content="drawable"`
  on the canvas. Shipped Chrome (tested on Chrome for Testing 153 with
  `--enable-blink-features=CanvasDrawElement`) only knows the older boolean `layoutsubtree`
  attribute; `drawElementImage` throws
  `InvalidStateError: DrawElementImage requires the canvas to have the layoutsubtree attribute`
  without it. Chromium main reads `content` first and falls back to `layoutsubtree`, so set both.
- **You can't draw an element in the same task you inserted it.** `drawElementImage` needs a
  recorded snapshot, taken during the rendering update. Drawing right after inserting the element
  throws `InvalidStateError: No cached paint record for element`. The canvas fires a `paint` event
  once a snapshot exists (`canvas.requestPaint()` asks for one), so draw from there. Match the
  error *message*, not just the name — matching the name alone turned the `layoutsubtree` error
  above into a silent 60 Hz `requestPaint` loop.
- **Pixels follow the draw; hit-testing does not.** In the shipped build, `drawElementImage` returns
  the matrix it recorded but does nothing with it for hit-testing: every drawn element's
  `getBoundingClientRect()` stays at its DOM position (top-left of the canvas at natural size),
  so clicks and text selection land on the wrong element as soon as it's drawn anywhere other
  than (0, 0). What worked: also position the element with CSS —
  `transform: translate(x, y) scale(zoom); transform-origin: 0 0` and a `z-index` matching paint
  order. The snapshot is taken before CSS transforms, so the drawn output is unchanged.

## Tools kept

`scripts/screenshot.mjs` (`pnpm screenshot`) launches a flag-enabled Chrome headless, loads the
dev server, dumps the canvas attributes, every `[drawable]` child, and page console errors, then
saves `screenshot.png`. It's how "seen on screen" gets attached to a PR.
