// Typings for the experimental HTML-in-Canvas API (chrome://flags/#canvas-draw-element).
// Spec: https://github.com/WICG/html-in-canvas — names are still moving.
// See docs/engineering-notes/2026-09-18-reset-to-feature-roadmap.md for what shipped Chrome accepts.

declare global {
  interface CanvasRenderingContext2D {
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

declare module "react" {
  interface CanvasHTMLAttributes<T> extends HTMLAttributes<T> {
    /** Shipped Chrome: marks the canvas children as laid out + drawable. Pass "" — React drops `true` on unknown attributes. */
    layoutsubtree?: string;
    /** Chromium main: `content="drawable"` replaces `layoutsubtree`. */
    content?: string;
  }
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    /** Marks a canvas child as something `drawElementImage` may draw. Pass "" — React drops `true` on unknown attributes. */
    drawable?: string;
  }
}

// oxlint-disable-next-line unicorn/require-module-specifiers -- makes this a module so `declare module "react"` augments instead of replacing
export {};
