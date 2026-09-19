# 2026-09-18 — A wallpaper inside the canvas: viewport units, the first frame, and reading pixels back

What the [wallpaper feature](../features/wallpaper.md) ran into in Chrome 153, measured with
`pnpm screenshot`.

**The canvas is not tainted, so the desktop can be read back.** `drawElementImage` of same-origin
DOM, and an SVG wallpaper imported through Vite and drawn with `drawImage`, both leave
`getImageData` working. That is the whole verification story for this feature: the claim "the
desktop's background comes out of the canvas and not out of CSS" is one computed style
(`rgba(0, 0, 0, 0)` on the canvas element) plus one pixel read (`#fac8ad` at (40, 40)). It also gives
a cheap texture test — a 48×48 region's mean, its spread, and the average step between neighbouring
pixels: the film grain reads sd 0.257 / step 0.264, and a flat `fillRect` of the same size reads
0.000 / 0.000.

**`vw` and `vh` inside a `layoutsubtree` canvas resolve against the viewport, not the canvas.**
There was no reason to assume it — the canvas's children are laid out but never painted by the page,
and nothing says which box a percentage-of-viewport unit answers to in there. It is the viewport,
and since `.surface` is `100vw × 100vh` the two are the same box anyway. A window sized
`clamp(320px, 30vw, 460px)` measures 384px at a 1280px viewport and 320 at 800, drawn.

**A viewport resize re-lays the drawables out and costs exactly one paint, with no engine call.**
Going from 1280×800 to 800×600 with two windows open: the page re-lays out both mounts (each shrinks
to its `clamp()` floor), the engine's own `ResizeObserver` on the canvas asks for one paint, the
backing store is resized in the paint handler and everything is redrawn — background included —
for **1 paint event** total. `apps/shell` calls nothing. Positions are untouched, so windows near
the right edge end up hanging off it; nothing clamps a position, which is the same answer this
project has given since the drag.

**The engine has to exist before the browser paints the canvas.** Creating it in a passive
`useEffect` leaves one frame where the canvas element is in the page and nothing has been drawn into
it — invisible while the background was a CSS class, a flash of blank desktop once the background is
the engine's. A `useLayoutEffect` closes it: the engine is created, told its background and has
asked for a paint before that commit reaches the screen.

**A `requestAnimationFrame` loop reads the canvas one render behind.** The first attempt at "was
there a frame with the wrong wallpaper on it" sampled a pixel every rAF, and reported a transparent
frame that was never on screen: rAF callbacks run *before* the frame is painted, and the engine
draws during the paint. Listening for the canvas's own `paint` event and sampling straight after it
— the engine's handler is registered first, so it has already drawn — records what each render
actually left behind. With that, the desktop's very first render already carries its wallpaper, on a
cold load and on a reload with a stored choice.

**A CDP `rawKeyDown` presses nothing.** `Input.dispatchKeyEvent` with `type: "rawKeyDown"` delivers
the event to the page but runs no default action, so Enter on a focused button does nothing at all —
which is why keyboard activation had silently "cost 0 paints". Sending the keys that carry text as a
full `keyDown` with `text: "\r"` makes Enter press the button. That turned out to be the only way to
measure the engine's own cost for a wallpaper change: a mouse click also repaints the window it
lands in, while Enter on an already-focused thumbnail is **1 paint**, and the same Enter again is
**0**.

**A leaked headless browser silently hands the next run its profile.** `pnpm screenshot` fixes its
debugging port, and a browser a previous run left alive answers on it: every run for an hour
attached to a browser from two hours earlier, sharing its `localStorage`, which is exactly the state
a "the choice survives a reload" check is about. The script now refuses to start when the port is
already answering, and asks the browser it opened to close.

**Transitions are still the expensive thing inside a drawable.** The dock's `transition-all
duration-150` costs the canvas nothing because the dock is not drawn; the same hover on a thumbnail
*inside* a window cost 10 paints, and a click that changed the wallpaper cost 11. Dropping the
transitions from the app's own controls — keeping the visual language, losing the animation — takes
that click to **2**: one for the engine, one for the window's own repaint. It is the same finding as
"a 150 ms transition inside a drawable is ten snapshots", now as a design rule for apps: chrome may
animate, what is drawn should not, until something makes it worth the frames.
