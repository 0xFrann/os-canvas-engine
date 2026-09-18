import { Desktop } from "./Desktop";
import { UnsupportedBrowser } from "./UnsupportedBrowser";
import { supportsHtmlInCanvas } from "@os-canvas/renderer";
import { useState } from "react";

export function App() {
  const [supported] = useState(supportsHtmlInCanvas);

  if (!supported) {
    return <UnsupportedBrowser />;
  }

  return <Desktop />;
}
