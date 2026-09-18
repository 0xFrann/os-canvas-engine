// Typings for the experimental HTML-in-Canvas API (chrome://flags/#canvas-draw-element).
// Spec: https://github.com/WICG/html-in-canvas — names are still moving.
// See docs/engineering-notes/2026-09-18-reset-to-feature-roadmap.md for what shipped Chrome accepts.

declare global {
  interface CanvasRenderingContext2D {
    /**
     * Draws a snapshot of a `drawable` canvas descendant at (dx, dy). Chrome 153 returns the
     * DOMMatrix that maps the element's border box to the drawn location; newer builds return
     * `undefined` and sync hit-testing themselves (WICG/html-in-canvas#174).
     */
    drawElementImage(element: Element, dx: number, dy: number): DOMMatrix | undefined;
    drawElementImage(
      element: Element,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
    ): DOMMatrix | undefined;
  }

  interface HTMLCanvasElement {
    /** Asks the browser to record fresh snapshots of the drawable children and fire `paint`. */
    requestPaint(): void;
  }

  interface HTMLElementEventMap {
    /** Fired on the canvas once its drawable children have snapshots ready to draw. */
    paint: Event;
  }
}

// oxlint-disable-next-line unicorn/require-module-specifiers -- makes this file a module so `declare global` augments
export {};
