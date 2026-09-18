import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

interface SurfaceContextValue {
  /** The `drawable` element the canvas draws. Portals must target it to stay inside the canvas. */
  mountRef: RefObject<HTMLDivElement | null>;
}

const SurfaceContext = createContext<SurfaceContextValue | null>(null);

/** Lets content drawn through the canvas reach the mount it lives in. */
export function useCanvasSurface() {
  const value = useContext(SurfaceContext);
  if (!value) {
    throw new Error("useCanvasSurface must be used inside <CanvasSurface>");
  }
  return value;
}

/**
 * A viewport-filling canvas that draws its one child through `drawElementImage`.
 *
 * The child is real DOM: laid out by the browser (thanks to `layoutsubtree`) but never painted by
 * the page, so the only way it shows up is the canvas drawing it on each `paint` event. Chrome
 * fires `paint` by itself whenever the child's rendering changes (verified: a state change inside
 * the child repaints without any `requestPaint()` call); we only request the first one and on resize.
 */
export function CanvasSurface({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => ({ mountRef }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const mount = mountRef.current;
    if (!canvas || !mount) {
      return;
    }

    const draw = () => {
      const dpr = window.devicePixelRatio;
      const { width, height } = canvas.getBoundingClientRect();
      const backingWidth = Math.round(width * dpr);
      const backingHeight = Math.round(height * dpr);
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.drawElementImage(mount, 0, 0);
    };

    canvas.addEventListener("paint", draw);
    const observer = new ResizeObserver(() => canvas.requestPaint());
    observer.observe(canvas);
    canvas.requestPaint();

    return () => {
      observer.disconnect();
      canvas.removeEventListener("paint", draw);
    };
  }, []);

  return (
    <SurfaceContext.Provider value={context}>
      <canvas
        ref={canvasRef}
        className="surface bg-muted"
        layoutsubtree=""
        content="drawable"
        aria-label="Desktop"
      >
        <div ref={mountRef} drawable="" className="w-max p-6">
          {children}
        </div>
      </canvas>
    </SurfaceContext.Provider>
  );
}
