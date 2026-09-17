import { UnsupportedBrowser } from "./UnsupportedBrowser";
import { detectHtmlInCanvasSupport } from "./detectHtmlInCanvasSupport";
import { useState } from "react";

export function App() {
  const [supported] = useState(detectHtmlInCanvasSupport);

  if (!supported) {
    return <UnsupportedBrowser />;
  }

  return (
    <main className="ready">
      <h1>HTML-in-Canvas supported ✅</h1>
      <p>The desktop shell (document model, renderer, windows, taskbar) lands in later PRs.</p>
    </main>
  );
}
