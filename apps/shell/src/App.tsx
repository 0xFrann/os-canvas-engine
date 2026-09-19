import {
  CanvasSurface,
  type CycleDirection,
  type DrawableItem,
  type Engine,
  type Position,
} from "@os-canvas/react";
import { DOCK_APPS } from "@apps/dockApps";
import { Dock } from "./components/Dock";
import { UnsupportedBrowser } from "./UnsupportedBrowser";
import { Window } from "./components/Window";
import { detectHtmlInCanvasSupport } from "./detectHtmlInCanvasSupport";
import { useEffect, useMemo, useRef, useState } from "react";

/*
 * Where windows open, and how far each one is offset from the one before it, so a second window
 * overlaps the first instead of hiding it. A position is the mount's, not the frame's, and the
 * mount leads with the shadow band `Window` puts around the frame (36 left, 32 top): the first two
 * windows put their frames at (264, 184) and (404, 284).
 *
 * This is all the placement policy the desktop has. The engine owns the position from the moment
 * the window is registered — dragging one never comes back here.
 */
const FIRST_POSITION: Position = { x: 228, y: 152 };
const CASCADE_STEP: Position = { x: 140, y: 100 };

interface OpenWindow {
  id: string;
  position: Position;
  /** Which step of the cascade this window took, so a later one doesn't take the same. */
  slot: number;
}

/** The lowest cascade step no open window is using. Keeps two windows from opening on top of each other. */
function freeSlot(windows: readonly OpenWindow[]): number {
  const taken = new Set(windows.map((window) => window.slot));
  let slot = 0;
  while (taken.has(slot)) {
    slot++;
  }
  return slot;
}

export function App() {
  const [supported] = useState(detectHtmlInCanvasSupport);
  /**
   * Which windows exist, in the order they were opened — React state, because mounting a `<Window>`
   * is what registers a drawable. Not their positions and not their draw order: those are the
   * engine's, which is why nothing here re-renders when one is dragged or raised.
   */
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);

  /** Each open window's engine item, so the dock can raise one without a pointer on it. */
  const items = useRef(new Map<string, DrawableItem>()).current;
  const itemRefs = useMemo(
    () =>
      new Map(
        DOCK_APPS.map((app) => [
          app.id,
          (item: DrawableItem | null) => {
            if (item) {
              items.set(app.id, item);
            } else {
              items.delete(app.id);
            }
          },
        ]),
      ),
    [items],
  );

  /**
   * A dock click. Both halves are idempotent: an app that is already open is not opened twice, it
   * is raised — which is `item.raise()`, the engine's own press-to-raise with no press behind it.
   */
  const openApp = (id: string) => {
    setOpenWindows((windows) => {
      if (windows.some((window) => window.id === id)) {
        return windows;
      }
      const slot = freeSlot(windows);
      return [
        ...windows,
        {
          id,
          position: {
            x: FIRST_POSITION.x + CASCADE_STEP.x * slot,
            y: FIRST_POSITION.y + CASCADE_STEP.y * slot,
          },
          slot,
        },
      ];
    });
    items.get(id)?.raise();
  };

  const desktopRef = useRef<HTMLDivElement>(null);

  /**
   * The engine, for the one thing the desktop asks it outside a window: switch windows.
   *
   * **Ctrl+` cycles forward, Ctrl+Shift+` backward.** Every shortcut a desktop would rather use is
   * taken before the page sees it — Cmd+` and Cmd+Tab are macOS's, Alt+Tab the OS's elsewhere,
   * Ctrl+Tab the browser's — so Ctrl+` is the closest free one, and it keeps the ` that macOS uses
   * for "next window". Matched on `code`, not `key`: the character that physical key produces
   * depends on the layout, the key's place on the keyboard doesn't.
   *
   * Which key it is, is the desktop's call; what "the next window" means is the draw order, which is
   * the engine's.
   */
  const engineRef = useRef<Engine | null>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Backquote" || !event.ctrlKey) {
        return;
      }
      event.preventDefault();
      let direction: CycleDirection = "forward";
      if (event.shiftKey) {
        direction = "backward";
      }
      engineRef.current?.cycleFront(direction);
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, []);

  const closeApp = (id: string) => {
    setOpenWindows((windows) => windows.filter((window) => window.id !== id));
  };

  if (!supported) {
    return <UnsupportedBrowser />;
  }

  return (
    <div className="desktop" ref={desktopRef}>
      <CanvasSurface className="surface bg-muted" aria-label="Desktop" ref={engineRef}>
        {openWindows.map(({ id, position }) => {
          const app = DOCK_APPS.find((candidate) => candidate.id === id);
          if (!app) {
            return null;
          }
          return (
            <Window
              key={id}
              initialPosition={position}
              onClose={() => closeApp(id)}
              ref={itemRefs.get(id)}
              title={app.label}
            >
              {app.content}
            </Window>
          );
        })}
      </CanvasSurface>
      <Dock apps={DOCK_APPS} onOpen={openApp} tooltipContainer={desktopRef} />
    </div>
  );
}
