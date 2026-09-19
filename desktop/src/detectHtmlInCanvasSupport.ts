/**
 * Feature-detects the HTML-in-Canvas API (`drawElementImage`), currently an
 * origin trial / Canary-flag-only Chrome feature. There is no fallback
 * renderer in this project, so callers use this to gate the whole app.
 */
export function detectHtmlInCanvasSupport(): boolean {
  return (
    typeof CanvasRenderingContext2D !== "undefined" &&
    "drawElementImage" in CanvasRenderingContext2D.prototype
  );
}
