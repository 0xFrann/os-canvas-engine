import { Button } from "@ui";
import { useState } from "react";

/**
 * The counter: a number and a button that increments it. It is content and nothing else — the
 * desktop puts it in a window, which is what carries the title and drags (ADR 004).
 */
export function CounterModal() {
  const [count, setCount] = useState(0);

  return (
    <div className="grid gap-4 p-4 text-sm">
      <p className="text-5xl font-semibold tabular-nums">{count}</p>
      <Button className="justify-self-end" onClick={() => setCount((c) => c + 1)}>
        +1
      </Button>
    </div>
  );
}
