import { createEngine, type Engine } from "@os-canvas/engine";
import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from "react";

const EngineContext = createContext<Engine | null>(null);

/** The engine the nearest `<CanvasSurface>` created, or null before it exists / after disposal. */
export function useEngine() {
  return useContext(EngineContext);
}

export type CanvasSurfaceProps = Omit<ComponentProps<"canvas">, "children" | "ref"> & {
  /**
   * What the engine covers the canvas with under the drawn children — a CSS color, a decoded image
   * (drawn to cover), or `null`/absent for a transparent canvas. Not a CSS background: this one is
   * painted by the engine, so it is in the canvas's pixels (ADR 008).
   *
   * Loading an image is the host's: hand this one over already decoded.
   */
  background?: string | CanvasImageSource | null;
  children?: ReactNode;
  /**
   * Receives the engine once it exists, and `null` when it is disposed. It is the **engine, not the
   * `<canvas>`**, the same way `<Drawable ref>` hands back the item rather than the `<div>`.
   *
   * It is for the host code that is *outside* the surface and so cannot use `useEngine()` — the
   * desktop's keyboard shortcut for switching windows is the first of those.
   */
  ref?: Ref<Engine | null>;
};

/**
 * A canvas with an engine created against it once mounted, handed down to `<Drawable>` children
 * through context. Children render as real DOM inside the canvas (laid out but never painted by
 * the page); the engine draws them. Size it with `className` / `style` like any element — but give
 * it a `background` rather than a CSS one, so what fills it is drawn instead of shown through.
 */
export function CanvasSurface({ background, children, ref, ...canvasProps }: CanvasSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);

  /* Read by the effect below, so the engine is created with its background already set: the engine
     asks for a paint as soon as it observes the canvas, and waiting for the next commit to say
     what to fill with would let that first paint through with nothing in it. */
  const initialBackground = useRef(background);

  /* A layout effect, not a passive one: the engine has to exist, and know what it is drawing on,
     before the browser paints the canvas it was just given. A frame late is a frame of empty
     canvas, which on a desktop is a flash of nothing where the wallpaper should be. */
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const created = createEngine(canvas);
    created.setBackground(initialBackground.current ?? null);
    setEngine(created);
    return () => {
      created.dispose();
      setEngine(null);
    };
  }, []);

  useEffect(() => {
    engine?.setBackground(background ?? null);
  }, [background, engine]);

  useImperativeHandle<Engine | null, Engine | null>(ref, () => engine, [engine]);

  return (
    <canvas ref={canvasRef} {...canvasProps}>
      <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>
    </canvas>
  );
}
