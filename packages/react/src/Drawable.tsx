import type { DrawableItem, Position } from "@os-canvas/engine";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefCallback,
  type RefObject,
} from "react";
import { useEngine } from "./CanvasSurface";

interface DrawableContextValue {
  mountRef: RefObject<HTMLDivElement | null>;
  /** The registered item, or null until the engine has it (one render, right after mount). */
  item: DrawableItem | null;
}

const DrawableContext = createContext<DrawableContextValue | null>(null);

function useDrawableContext(hook: string) {
  const value = useContext(DrawableContext);
  if (!value) {
    throw new Error(`${hook} must be used inside <Drawable>`);
  }
  return value;
}

/**
 * The drawn element the calling content lives in. Anything that portals (dialogs, menus,
 * tooltips) must target it to stay inside the canvas, e.g. `<Dialog.Portal container={mount}>`.
 */
export function useDrawableMount() {
  return useDrawableContext("useDrawableMount").mountRef;
}

/**
 * A ref for the element that drags the drawable it's in — a window header, typically:
 * `<DialogHeader ref={useDragHandle()}>`. The engine owns the gesture and the position; this hook
 * only hands it the element, so no coordinate ever reaches React.
 *
 * It's a callback ref on purpose: the handle can appear in a later commit than the one that
 * registered the drawable (a portalled dialog popup does), and a ref object filled after the fact
 * would never reach the engine.
 */
export function useDragHandle<T extends HTMLElement = HTMLElement>(): RefCallback<T> {
  const { item } = useDrawableContext("useDragHandle");
  const [handle, setHandle] = useState<T | null>(null);

  useEffect(() => {
    if (!item || !handle) {
      return;
    }
    return item.addDragHandle(handle);
  }, [handle, item]);

  return setHandle;
}

export type DrawableProps = Omit<ComponentProps<"div">, "children"> & {
  children?: ReactNode;
  /** Where the engine first draws this element, in CSS pixels of the canvas. */
  initialPosition: Position;
};

/**
 * A DOM element the engine draws. `initialPosition` seeds it; from then on the engine owns where
 * it's drawn and where it's hit-tested — dragging it does not re-render anything here — so never
 * keep its position in state and never set a `transform` on it yourself.
 */
export function Drawable({ children, initialPosition, ...divProps }: DrawableProps) {
  const engine = useEngine();
  const mountRef = useRef<HTMLDivElement>(null);
  const [item, setItem] = useState<DrawableItem | null>(null);

  useEffect(() => {
    const element = mountRef.current;
    if (!engine || !element) {
      return;
    }
    const added = engine.add(element, initialPosition);
    setItem(added);
    return () => {
      added.remove();
      setItem(null);
    };
    // The position is read once, on registration: it's the engine's from there on.
  }, [engine]);

  const context = useMemo(() => ({ item, mountRef }), [item]);

  return (
    <DrawableContext.Provider value={context}>
      <div ref={mountRef} {...divProps}>
        {children}
      </div>
    </DrawableContext.Provider>
  );
}
