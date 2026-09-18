# 2026-09-18 — What drives repaint during a drag

Dragging the modal ([feature note](../features/modal-drag.md)) was the first thing that changes a
position many times a second, so it was the first honest test of who runs the frame loop. Three
things came out of it, measured with the `paint`-event counters `pnpm screenshot` now prints.

**Chrome already coalesces the input, so `requestPaint()` per move is frame-bounded.** Pacing a
24-step drag at 8 ms produced 25 `pointermove` and 25 `paint` events: each request was answered
before the next move arrived. Firing 60 moves in a burst produced **3** `pointermove` events and
**2** paints — Chrome batches pointer moves to about one per frame, the way it does for any page —
and the element still landed on the exact pixel, because the last move wins and the engine reads
the position at paint time. So the engine needs no `requestAnimationFrame` loop; it marks itself
dirty, asks for one paint, and the `paint` handler clears the mark as it draws. Every
`requestPaint()` was followed by a `paint` event at every pacing tried, which is what makes that
dirty flag safe — if one ever weren't, the flag would stay set and the drag would freeze.

**Writing the CSS transform is itself a reason for Chrome to repaint.** The engine writes the
matrix `drawElementImage` returns onto the drawn element (the hit-test sync from the
[position feature](../features/modal-position.md)). Chrome fires `paint` whenever a drawable
child's rendering changes, so an unconditional write inside the paint handler is a loop that never
settles. Writing only when the value actually changed brings an idle canvas back to **0 paint
events per second**, and costs nothing during a drag, where it changes every frame anyway.
For scale: one click on "+1" costs 11 paint events — hover, press, focus ring, the new number.
Chrome's repaint policy is generous; the engine's job is not to add to it.

**The DOM rect cannot lag the drawn rect.** It's written from the matrix that same draw returned,
so both come from one draw pass. Sampled mid-gesture, the mount read
`transform: matrix(1, 0, 0, 1, 460, 300)` with the DOM rect at `460 300` and the pointer still over
the header it grabbed. And since the snapshot is recorded before transforms, moving the element
around never changes what gets drawn — no flicker from writing it every frame.

**Unrelated to the browser, but it cost the most:** a hook that hands out a ref *object* for the
drag handle never sees the element when the content is portalled. Base UI mounts the dialog popup
in a later commit than the one where the drawable registers itself, so the hook's effect had
already run with `ref.current === null` and had no reason to run again. A callback ref keeping the
element in state attaches in either order. The tell was the handle's `style.touchAction` being
empty in the page — the engine sets it when it takes a handle, so it doubles as a "did this get
wired up" probe.
