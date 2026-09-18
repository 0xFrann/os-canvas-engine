import { Button, Dialog, DialogFooter, DialogHeader, DialogTitle } from "@ui";
import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useDragHandle, useDrawableMount } from "@os-canvas/react";

/**
 * A real (Base UI) dialog that stays inside its drawn element: its Portal targets the Drawable's
 * mount instead of <body> (Base UI 1.8 insists on a Portal), no Backdrop, and `modal={false}` so
 * nothing traps focus or locks scroll. Its header is the drag handle — the engine moves the
 * drawable, this only says which element grabs it.
 */
export function CounterModal() {
  const [count, setCount] = useState(0);
  const mountRef = useDrawableMount();
  const headerRef = useDragHandle<HTMLDivElement>();

  return (
    <Dialog open modal={false}>
      <DialogPrimitive.Portal container={mountRef}>
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className="grid w-sm gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none"
        >
          <DialogHeader ref={headerRef} className="cursor-grab select-none">
            <DialogTitle>Counter</DialogTitle>
          </DialogHeader>
          <p className="text-5xl font-semibold tabular-nums">{count}</p>
          <DialogFooter>
            <Button onClick={() => setCount((c) => c + 1)}>+1</Button>
          </DialogFooter>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
