import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useCanvasSurface } from "./CanvasSurface";

/**
 * A real (Base UI) dialog that stays a child of the canvas: its Portal targets the canvas's
 * drawable mount instead of <body> (Base UI 1.8 insists on a Portal), no Backdrop, and
 * `modal={false}` so nothing traps focus or locks scroll.
 */
export function CounterModal() {
  const [count, setCount] = useState(0);
  const { mountRef } = useCanvasSurface();

  return (
    <Dialog open modal={false}>
      <DialogPrimitive.Portal container={mountRef}>
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className="grid w-sm gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none"
        >
          <DialogHeader>
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
