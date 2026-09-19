# ADR 008: The engine draws the desktop's background

- **Status:** Accepted
- **Date:** 2026-09-18
- **Topic:** Whether the pixel behind the windows belongs to the canvas or to the page
- **Feature:** [a wallpaper the user can change](../features/wallpaper.md)

## Context

Everything the engine has drawn so far is a DOM element registered with it. The desktop's own
surface was not drawn at all: the canvas carried a Tailwind `bg-muted`, a CSS background showing
through a transparent canvas. That was fine while it was one flat grey nobody could change.

A wallpaper the user chooses makes it a question. And
[ADR 006](./006-the-dock-is-chrome-over-the-canvas.md) already answered a version of it for the
dock — chrome is plain DOM over the canvas, and a thing belongs in the scene when it has a position
the user can change, an order among other such things, and a lifetime the user controls. A wallpaper
has none of those. By that test it is chrome, and the reference desktop treats it as exactly that
(`background-image` on `.main-layout`, written by the Settings app).

## Options

1. **A CSS background on the canvas element**, swapped by the desktop. Cheapest: no engine change,
   no image drawing, no cover-fit maths, and the browser handles decode and scaling. It is what the
   reference does and what `bg-muted` already was.
2. **A DOM element registered as a drawable**, sized to the canvas. Reuses the one path the engine
   has — but a drawable is a thing in the scene: it has a position, a place in the order, and the
   engine raises it on `pointerdown`. A wallpaper would need "pinned", "never raise" and "always
   last", which is the machinery ADR 006 refused to invent, and it would cost a snapshot per paint.
3. **The engine fills the canvas itself**, under the items: one value on the engine, one step of the
   render pass, no element and no place in the order.

## Decision

Option 3. **The engine owns the background. The whole desktop is drawn.**

```ts
setBackground(background: string | CanvasImageSource | null): void;
```

A CSS color is a `fillRect`; an image is a `drawImage` fitted to **cover** — scaled to fill the
canvas, aspect ratio kept, centred, overflow cropped — in backing-store pixels like the rest of the
pass. `null` is transparent, which is what the canvas was before. Setting the same value again does
nothing; a new one is one scheduled paint.

Three things it deliberately is not:

- **Not an item.** No element, no position, no place in the draw order, nothing to raise, pick or
  remove. ADR 006's test still says a wallpaper is not a drawable, and this agrees with it: the
  background is not *in* the scene, it is what the scene is drawn on.
- **Not a loader.** The engine never waits for anything. An image arrives decoded, from the host,
  because a half-loaded image drawn in a paint handler is a frame of nothing.
- **Not a model.** No layers, no tiling, no object describing a background. One value.

It is its own small step of `render()`, because the next thing this feature's need becomes — a
wallpaper that moves — has to drive exactly that step, and nothing else about the pass should have
to change for it.

## Why

Because the point of this project is a desktop drawn through the canvas, and the pixel behind the
windows is part of the desktop. If the canvas does not own it: a screenshot of the canvas is not a
screenshot of the desktop; a camera that pans and zooms the scene later would slide the windows over
a background that stays still, which is the one thing a desktop's wallpaper must not do; and the
engine could never be told to do anything to the background at all — dim it, move it, fade between
two — without the host reaching around it into CSS.

ADR 006's test is still the right test for *items*. This is the answer to a different question:
**what is drawn** rather than **what is a drawable**. The canvas draws the scene and the surface it
sits on; everything that frames them — the dock, the menu bar later — is still chrome over the top.

The cover fit is the engine's because it is a function of the canvas's backing store, which is the
engine's own geometry: the host does not know the device pixel ratio the pass runs at, and doing it
in the host would mean either a second copy of that arithmetic or a pre-scaled image per viewport.
Loading is not the engine's for the mirror reason: a URL is the host's world, and the engine's whole
contract is that it draws, now, what it has been given.

## Consequences

**Easier now**

- The desktop has no CSS background at all. `getImageData` on any empty point of the canvas is the
  wallpaper, which is how this feature was verified at all.
- The wallpaper costs the engine exactly one paint to change and nothing per frame: idle stays at 0
  paints per second with an image on screen.
- An animated wallpaper has a place to happen, and it is inside the engine where the paint schedule
  already lives.
- The Settings app never touches the canvas. It asks the desktop, the desktop tells the engine —
  which is [ADR 004](./004-window-chrome-belongs-to-the-desktop.md) holding for something that is
  not a window.

**Harder now**

- The engine's contract is no longer only "elements at positions I own". It has a second kind of
  thing it draws, with its own type union, and the first bit of image maths in the codebase.
- What the browser did for free — decode, cache, resample an image behind an element — is now
  partly the host's (loading, keeping decoded images) and partly the engine's (the fit). An SVG
  drawn into canvas is rasterized at its intrinsic size, so upscaling past it is the engine's blur,
  not the page's.
- The desktop's first frame now depends on something asynchronous. The shell awaits the initial
  wallpaper's decode before mounting, and `CanvasSurface` creates the engine in a layout effect, or
  the canvas reaches the screen before it knows what to cover itself with.
- Only one background at a time, and only one fit. A gradient the engine builds, two wallpapers
  crossfading, or "fit" instead of "cover" would each widen this call.

**Revisit trigger:** a background that has to be composed of more than one thing (a crossfade, a
tint over an image), a wallpaper that has to be drawn per frame from something other than a single
source, or a host that needs the background *between* items rather than under all of them.

## References

- [ADR 005: draw order lives in the engine](./005-draw-order-lives-in-the-engine.md)
- [ADR 006: the dock is chrome over the canvas](./006-the-dock-is-chrome-over-the-canvas.md)
- [ADR 004: window chrome belongs to the desktop](./004-window-chrome-belongs-to-the-desktop.md)
- [Feature note: a wallpaper the user can change](../features/wallpaper.md)
- [Engineering note: a wallpaper inside the canvas](../engineering-notes/2026-09-18-wallpaper-in-the-canvas.md)
