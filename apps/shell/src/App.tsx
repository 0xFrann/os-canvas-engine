import { CanvasSurface, Drawable } from "@os-canvas/react";
import { CounterModal } from "@apps/CounterModal";
import { UnsupportedBrowser } from "./UnsupportedBrowser";
import { detectHtmlInCanvasSupport } from "./detectHtmlInCanvasSupport";
import { useState } from "react";

// Where the modal starts. The engine owns it from there: dragging the header moves it.
const MODAL_POSITION = { x: 240, y: 160 };

export function App() {
  const [supported] = useState(detectHtmlInCanvasSupport);

  if (!supported) {
    return <UnsupportedBrowser />;
  }

  return (
    <CanvasSurface className="surface bg-muted" aria-label="Desktop">
      <Drawable initialPosition={MODAL_POSITION} className="w-max p-6">
        <CounterModal />
      </Drawable>
    </CanvasSurface>
  );
}
