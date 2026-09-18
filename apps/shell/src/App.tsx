import { CanvasSurface } from "@os-canvas/react";
import { CounterModal } from "@apps/CounterModal";
import { UnsupportedBrowser } from "./UnsupportedBrowser";
import { Window } from "./components/Window";
import { detectHtmlInCanvasSupport } from "./detectHtmlInCanvasSupport";
import { useState } from "react";

// Where the window starts. The engine owns it from there: dragging the header moves it.
const WINDOW_POSITION = { x: 240, y: 160 };

export function App() {
  const [supported] = useState(detectHtmlInCanvasSupport);

  if (!supported) {
    return <UnsupportedBrowser />;
  }

  return (
    <CanvasSurface className="surface bg-muted" aria-label="Desktop">
      <Window title="Counter" initialPosition={WINDOW_POSITION}>
        <CounterModal />
      </Window>
    </CanvasSurface>
  );
}
