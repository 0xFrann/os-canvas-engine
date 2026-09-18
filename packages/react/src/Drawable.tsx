import type { DrawableItem, Position } from "@os-canvas/engine";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import { useEngine } from "./CanvasSurface";

const MountContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

/**
 * The drawn element the calling content lives in. Anything that portals (dialogs, menus,
 * tooltips) must target it to stay inside the canvas, e.g. `<Dialog.Portal container={mount}>`.
 */
export function useDrawableMount() {
  const ref = useContext(MountContext);
  if (!ref) {
    throw new Error("useDrawableMount must be used inside <Drawable>");
  }
  return ref;
}

export type DrawableProps = Omit<ComponentProps<"div">, "children"> & {
  children?: ReactNode;
  /** Where the engine draws this element, in CSS pixels of the canvas. */
  position: Position;
};

/**
 * A DOM element the engine draws at `position`. Registers itself with the engine on mount and
 * forwards position changes; the engine owns where it's drawn and where it's hit-tested, so never
 * set a `transform` on it yourself.
 */
export function Drawable({ children, position, ...divProps }: DrawableProps) {
  const engine = useEngine();
  const mountRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<DrawableItem | null>(null);

  useEffect(() => {
    const element = mountRef.current;
    if (!engine || !element) {
      return;
    }
    const item = engine.add(element, position);
    itemRef.current = item;
    return () => {
      item.remove();
      itemRef.current = null;
    };
    // The initial position is read once here; later changes go through moveTo below.
  }, [engine]);

  useEffect(() => {
    itemRef.current?.moveTo(position);
  }, [position.x, position.y]);

  return (
    <MountContext.Provider value={mountRef}>
      <div ref={mountRef} {...divProps}>
        {children}
      </div>
    </MountContext.Provider>
  );
}
