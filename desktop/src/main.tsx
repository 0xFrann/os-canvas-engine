import "./index.css";
import { App } from "./App";
import { INITIAL_BACKGROUND, loadBackground } from "./backgrounds";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root element missing from index.html");
}

/*
 * The desktop's first frame has its wallpaper on it. A dock and a window over a blank canvas is a
 * flash of a desktop that never existed, and the engine is handed images already decoded — so the
 * wait belongs here, before anything is mounted. The wallpaper is bundled with the app, so this is
 * a decode and not a download; a wallpaper that will not decode is not worth hiding the desktop
 * for, and leaves the canvas as it was before there were any: transparent.
 */
await loadBackground(INITIAL_BACKGROUND).catch(() => null);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
