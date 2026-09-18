/**
 * Ambient typings for the HTML-in-Canvas API (Chrome Canary 148+, behind
 * `chrome://flags/#canvas-draw-element`). Not in TypeScript's DOM lib yet.
 * Names follow the WICG explainer and Chromium's current IDL:
 * https://github.com/WICG/html-in-canvas
 */

declare global {
  interface DrawElementImageOptions {
    /** When true, drawing does not sync the element's DOM geometry (hit-testing / a11y) to where it was drawn. */
    preserveElementGeometry?: boolean;
  }

  interface CanvasPaintEvent extends Event {
    /** The drawable descendants whose snapshot changed since the last paint. */
    readonly changedElements: readonly Element[];
  }

  interface CanvasRenderingContext2D {
    drawElementImage(
      element: Element,
      dx: number,
      dy: number,
      options?: DrawElementImageOptions,
    ): DOMMatrix | undefined;
    drawElementImage(
      element: Element,
      dx: number,
      dy: number,
      dwidth: number,
      dheight: number,
      options?: DrawElementImageOptions,
    ): DOMMatrix | undefined;
  }

  interface HTMLCanvasElement {
    /** `"drawable"` opts canvas descendants into layout so they can be drawn. Default `"fallback"`. */
    content: "fallback" | "drawable";
    onpaint: ((this: HTMLCanvasElement, ev: CanvasPaintEvent) => unknown) | null;
    /** Asks for one `paint` event at the next rendering opportunity even if no drawable changed. */
    requestPaint(): void;
  }

  interface HTMLElementEventMap {
    paint: CanvasPaintEvent;
  }
}

/**
 * Feature-detects `drawElementImage`. There is no fallback renderer in this
 * project, so hosts gate the whole app on this.
 */
export function supportsHtmlInCanvas(): boolean {
  return (
    typeof CanvasRenderingContext2D !== "undefined" &&
    "drawElementImage" in CanvasRenderingContext2D.prototype
  );
}
