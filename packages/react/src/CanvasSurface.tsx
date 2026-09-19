import { createEngine, type Engine } from "@os-canvas/engine";
import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
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
 * the page); the engine draws them. Size and look it with `className` / `style` like any element.
 */
export function CanvasSurface({ children, ref, ...canvasProps }: CanvasSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const created = createEngine(canvas);
    setEngine(created);
    return () => {
      created.dispose();
      setEngine(null);
    };
  }, []);

  useImperativeHandle<Engine | null, Engine | null>(ref, () => engine, [engine]);

  return (
    <canvas ref={canvasRef} {...canvasProps}>
      <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>
    </canvas>
  );
}
