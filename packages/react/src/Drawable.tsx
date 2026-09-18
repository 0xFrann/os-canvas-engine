import type { DrawableItem, Position } from "@os-canvas/engine";
import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type Ref,
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
 * A ref for the element that drags the drawable it's in: `<div ref={useDragHandle()}>`.
 *
 * **For window chrome only.** Whoever provides the window decides what drags it — in this repo that
 * is the desktop's `Window` component, the hook's only caller. An app rendered inside a window never
 * calls it (see ADR 004). The engine owns the gesture and the position; this hook only hands it the
 * element, so no coordinate ever reaches React.
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

export type DrawableProps = Omit<ComponentProps<"div">, "children" | "ref"> & {
  children?: ReactNode;
  /** Where the engine first draws this element, in CSS pixels of the canvas. */
  initialPosition: Position;
  /**
   * Receives the engine's item for this drawable once it is registered, and `null` when it goes
   * away. It is the **item, not the `<div>`** — the element is `useDrawableMount()` — the same way
   * a canvas library hands back its own node rather than a DOM one.
   *
   * It is how the host reaches a drawable that the user did not press: the dock raising an app it
   * already opened calls `item.raise()`. It does not make position or order the host's: the item's
   * methods stay the engine's, and nothing here should read `item.position` into state.
   */
  ref?: Ref<DrawableItem | null>;
};

/**
 * A DOM element the engine draws. `initialPosition` seeds it; from then on the engine owns where
 * it's drawn and where it's hit-tested — dragging it does not re-render anything here — so never
 * keep its position in state and never set a `transform` on it yourself.
 */
export function Drawable({ children, initialPosition, ref, ...divProps }: DrawableProps) {
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

  useImperativeHandle<DrawableItem | null, DrawableItem | null>(ref, () => item, [item]);

  const context = useMemo(() => ({ item, mountRef }), [item]);

  return (
    <DrawableContext.Provider value={context}>
      <div ref={mountRef} {...divProps}>
        {children}
      </div>
    </DrawableContext.Provider>
  );
}
