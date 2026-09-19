# 2026-09-18 — `inert` can't confine the keyboard to the front window

Keeping Tab inside the active window ([feature note](../features/active-window.md)) has an obvious
platform answer: mark every window that isn't in front `inert`, and the browser stops handing it
focus. Two things about it were unknown here, and both had to be measured rather than reasoned
about — one because an inert element is also invisible to hit-testing, which is how this desktop
raises windows, and one because nothing says what an experimental snapshot API does with inert
content.

Measured with a temporary write in the engine's paint pass (`element.inert = index !== front`,
guarded the way the transform and z-index writes are), two windows open, Counter buried.

**It changes nothing about the snapshot.** Reading the canvas back with `getImageData` and
checksumming it, the Counter's frame, its header, the Example window's frame and the *whole
1280×800 canvas* come out byte-identical with the Counter inert and with it not — same checksum,
same 942,735 ink pixels. So `drawElementImage` records an inert element exactly as it records a live
one: no dimming, no "disabled" rendering, no lost text. Worth knowing beyond this feature, because
inert is how a modal sheet over a window would be built later.

**And it takes the window out of hit-testing entirely, which kills raise-on-press.** With the
Counter inert, `document.elementFromPoint` at (390, 300) — squarely on its frame — answers
**`canvas`**, not the mount: the browser does not merely refuse the click, it refuses to see the
element at all. So a real click there costs **0 paint events**, the z-indices don't move, and the
buried window can never be brought forward by pointing at it. Press-to-raise is the engine's rule
([ADR 005](../decisions/005-draw-order-lives-in-the-engine.md)) and `inert` is its exact opposite:
one says *whatever you touch, you touched the top one*, the other says *you cannot touch this*.

**Third thing, which settles it even without the first two.** `inert` only does half of what the
feature needs. With the back window inert, Tab from nothing focused went to the front window's close
button and then straight out to the **dock icons** — inert keeps Tab out of the *buried* window, but
nothing confines it to the front one and nothing wraps it. It would have to be paired with a Tab
handler anyway, and the handler alone does the whole job.

So the engine handles `keydown` for Tab itself: it computes the front item's tabbable elements,
moves focus to the next or previous one, wraps, and `preventDefault`s every time — at the edges and
in the middle, because the confinement *is* the edge. Nothing is toggled per paint, which also keeps
the paint pass out of it: the only attribute the engine adds for this is a `tabindex="-1"` written
once when an item is registered, not a flag flipped every time the order changes.

**One tooling fact, or none of the above is measurable.** A headless Chrome window is never the OS's
focused window, so the page reports no focus and Tab moves nothing at all. `pnpm screenshot` now
sends `Emulation.setFocusEmulationEnabled` before it navigates; without it the first Tab appears to
do nothing and the whole feature looks broken. Synthetic keys also need the virtual key code, not
just the name — `Input.dispatchKeyEvent` with `key: "Tab"` and no `windowsVirtualKeyCode: 9`
dispatches an event the page sees but the browser doesn't act on.
