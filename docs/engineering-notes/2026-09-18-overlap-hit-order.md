# 2026-09-18 — Draw order doesn't reach hit-testing

Two overlapping windows ([feature note](../features/multiple-windows.md)) asked the question the
[position feature](../features/modal-position.md) asked in another dimension: the canvas decides
what you *see*, the page decides what you *click*, and nothing keeps them in agreement unless the
engine does it.

**Measured, with the stacking write turned off.** Two mounts, both children of the canvas, Counter
first in the DOM and Example second. Pressing the Counter raises it in the engine's list, so
`drawElementImage` draws it last and it is visibly on top — its "+1" button paints over the Example
window. `document.elementFromPoint` at that button still answers **Example**, and a real click at
those coordinates goes to Example: the counter stays at 0. The order the canvas draws in has no
effect on hit-testing; the mounts are plain static siblings, so the browser hit-tests them in DOM
order, and DOM order is React's render order, which never changes.

**The fix is the same shape as the transform.** The engine writes each item's place in its list to
`element.style.zIndex` in the same paint pass that draws it, and — because a static box ignores
`z-index` — sets `position: relative` on a mount that is otherwise static, which changes no layout.
With that, raising the Counter gives it `z-index: 1` while it is still the *first* DOM child, and
the same click at the same coordinates increments it to 1. So the engine's rule grew a word: it owns
the drawn rect, the DOM rect, **and the order of both**.

What it does *not* do is reorder the DOM. Moving the mounts around would put the engine and React in
a fight over the children of the canvas on every render, for no gain over one style property.

**Two items cost what one did.** The paced 24-step drag still reports 25 `pointermove` and 25
`paint` events, and an idle desktop with two windows still reports **0 paint events per second** —
the z-index write is guarded the way the transform write is, so the extra style property doesn't
reopen the repaint loop the [drag note](./2026-09-18-drag-repaint.md) closed. A raise costs exactly
**1 paint**; raising the window that is already in front costs **0**, because the list reports that
nothing moved. A click on a buried window's "+1" that lands on the window above it costs 0 paints
too — Chrome repaints for hover and focus on things that have hover and focus, and an `<h1>` has
neither.

**Not a surprise, worth writing down anyway:** `drawElementImage` gives each element its own
snapshot, so overlapping drawables compose like any other canvas drawing — the second draw covers
the first, drop shadow included, with no z-fighting. The windows' shadows fall on each other
correctly because the shadow is inside the snapshot (the mount keeps a band around the frame for
it), not a page effect.

**Each snapshot *is* clipped, though — to the drawn element's own border box.** Ink the content
paints outside that box is kept (a shadow, a ring, an outline all survive), but it stops at the
edge of the element `drawElementImage` was given, and it stops abruptly. Measured on the Counter
window with the 24px band it had: the drop shadow's last pixel inside the band was 7/255 darker
than the desktop at the bottom, 4 at the sides, 2 at the top, and the very next pixel was the bare
desktop — a step, not a fade, on all four sides.

**So the band has to be the shadow's real extent, which is bigger than the usual rule of thumb.**
Widening the band to 80px and reading the pixels, the reference's `drop-shadow(0 4px 16px
rgba(0,0,0,.25))` reaches **35px sideways, 30px up and 38px down** from the frame's border box
before it quantizes to nothing. The 24px band was therefore cutting 12px off each side, 7 off the
top and 15 off the bottom. A CSS blur radius is twice the Gaussian's σ (σ = 8px here), so the
3σ = 24px estimate is what the old band was, and it is wrong by a third: Chromium's blur carries
visible ink to about **4.5σ, i.e. 2.25× the blur radius**. Doubling the blur to 32px doubled the
extent (70px sideways, 63 up, 71 down), which is what makes that a ratio and not a coincidence.

The desktop's `Window` sizes the band from it — 36px sideways, and that same 36 shifted by the
shadow's 4px y-offset: 32 top, 40 bottom — and `App.tsx` starts each window 12px left and 8px up of
where it did, so the frames stay on the pixels they were on. The engine is unchanged: how much room
a snapshot needs is a fact about the content, which is the desktop's business.

**The flip side, found on screen:** that padding is a real box to hit-testing. A press on the back
window that fell inside the front window's transparent band (14px from its border) reached the front
mount and raised nothing — the band was, to the browser, the front window. Transparency in the
snapshot says nothing about who gets the click. The desktop's `Window` fixed it, not the engine: the
mount is `pointer-events: none` and the frame `pointer-events: auto`, so the drawn rect stays
padded and the hit rect is the frame. The engine's `pointerdown` listener on the mount still fires,
because the event bubbles up from the frame.
