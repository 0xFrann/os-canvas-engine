import { CanvasSurface } from "./CanvasSurface";
import { CounterModal } from "./CounterModal";
import { UnsupportedBrowser } from "./UnsupportedBrowser";
import { detectHtmlInCanvasSupport } from "./detectHtmlInCanvasSupport";
import { useState } from "react";

export function App() {
  const [supported] = useState(detectHtmlInCanvasSupport);

  if (!supported) {
    return <UnsupportedBrowser />;
  }

  return (
    <CanvasSurface>
      <CounterModal />
    </CanvasSurface>
  );
}
