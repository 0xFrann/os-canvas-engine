import { createEngine, type Engine } from "@os-canvas/engine";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

const EngineContext = createContext<Engine | null>(null);

/** The engine the nearest `<CanvasSurface>` created, or null before it exists / after disposal. */
export function useEngine() {
  return useContext(EngineContext);
}

export type CanvasSurfaceProps = Omit<ComponentProps<"canvas">, "children"> & {
  children?: ReactNode;
};

/**
 * A canvas with an engine created against it once mounted, handed down to `<Drawable>` children
 * through context. Children render as real DOM inside the canvas (laid out but never painted by
 * the page); the engine draws them. Size and look it with `className` / `style` like any element.
 */
export function CanvasSurface({ children, ...canvasProps }: CanvasSurfaceProps) {
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

  return (
    <canvas ref={canvasRef} {...canvasProps}>
      <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>
    </canvas>
  );
}
