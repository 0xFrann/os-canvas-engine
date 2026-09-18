# 2026-09-18 — Counter modal: three things the browser (and React) told us

The counter modal ([feature note](../features/counter-modal.md)) — a shadcn Dialog with a
"+1" button drawn through the canvas — took three tries to show up, and each failure was worth
more than the design.

**React silently drops `true` on attributes it doesn't know.** `<canvas layoutsubtree>` in JSX
becomes `layoutsubtree={true}`, and React 19 refuses to write a boolean to a non-boolean attribute
(with a console warning that's easy to miss under Vite's noise). The canvas rendered with no
attribute, and `drawElementImage` threw exactly the `layoutsubtree` error the reset note predicted.
The fix is `layoutsubtree=""` and `drawable=""` — presence is what the browser checks. The typings
in `html-in-canvas.d.ts` say `string`, not `boolean`, for that reason.

**Base UI 1.8 will not render a Dialog popup without a Portal**, contrary to the doc summary I
designed from: `Dialog.Popup` throws `<Dialog.Portal> is missing`. Portals default to `<body>`,
which would take the popup out of the canvas's subtree, so `<Dialog.Portal container={mountRef}>`
targets the drawable mount instead. That's now the rule for any portalled primitive (menus,
tooltips) that has to be drawn: portal into the mount.

**Chrome fires `paint` by itself.** The design hedged: the counter would call `requestPaint()`
after every state change, "unless the paint event fires on its own". Removing the call and
clicking again repainted the canvas to 1 regardless — a drawable child's re-render is enough to
schedule a paint event in Chrome 153. So the surface only requests the first paint and on resize,
and content never has to know it's being drawn.

Also: the `pnpm screenshot` tool grew a `CLICK=<selector>` option (a real CDP mouse press at the
element's DOM rect), which is how "the number changed on the canvas" is proven in the PR.
