import {
  CanvasSurface,
  type CycleDirection,
  type DrawableItem,
  type Engine,
  type Position,
} from "@os-canvas/react";
import {
  BACKGROUND_STORAGE_KEY,
  BACKGROUNDS,
  findBackground,
  INITIAL_BACKGROUND,
  loadBackground,
  readyBackground,
} from "./backgrounds";
import { centeredPosition, Window } from "./components/Window";
import { DOCK_APPS } from "./dockApps";
import { type Desktop, DesktopProvider } from "@os-canvas/apps";
import { Dock } from "./components/Dock";
import { UnsupportedBrowser } from "./UnsupportedBrowser";
import { detectHtmlInCanvasSupport } from "./detectHtmlInCanvasSupport";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * How far each window is offset from the one before it, so a second window overlaps the first
 * instead of hiding it. A header's height, which is what keeps every open window's header
 * grabbable; a window itself is sized as a fraction of the viewport, but this is the chrome's own
 * measurement and stays in pixels, like the shadow band.
 */
const CASCADE_STEP = 44;

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
  /**
   * The wallpaper, by id — a setting, not geometry, so React state is where it belongs. The engine
   * is told what to cover the canvas with and nothing else; `localStorage`, under the reference
   * desktop's key, is what makes the choice survive a reload.
   */
  const [background, setBackgroundId] = useState(INITIAL_BACKGROUND.id);
  /**
   * And what that wallpaper actually is: a color, or an image that has finished decoding. Loading
   * is the desktop's job, because the engine draws what it is given and never waits for anything
   * ([ADR 008](../../../docs/decisions/008-the-engine-draws-the-background.md)). The one already in
   * hand stays on the canvas until the next one is ready, so switching never shows a gap.
   */
  const [drawnBackground, setDrawnBackground] = useState<string | CanvasImageSource | null>(() =>
    readyBackground(INITIAL_BACKGROUND),
  );
  useEffect(() => {
    let current = true;
    void loadBackground(findBackground(background)).then((next) => {
      if (current) {
        setDrawnBackground(next);
      }
    });
    return () => {
      current = false;
    };
  }, [background]);
  /** What the desktop lets the apps running on it ask for. Settings is its first consumer. */
  const desktop: Desktop = {
    background,
    backgrounds: BACKGROUNDS,
    setBackground: (id) => {
      setBackgroundId(id);
      localStorage.setItem(BACKGROUND_STORAGE_KEY, id);
    },
  };

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
   *
   * **Where it opens:** the first window is centred, and the ones after it cascade down the lowest
   * free step from *that* window's place. A window is a fraction of the viewport, so a fixed corner
   * would mean nothing; the desktop works the position out once, here, from its own size and the
   * window's, and the engine owns it from registration onwards. The canvas fills the viewport
   * (`.surface`) and a window's `vw`/`vh` size resolves against the same box, so the viewport is
   * the desktop's area for both.
   *
   * The cascade runs from one shared corner rather than from each window's own centred spot,
   * because the windows are different sizes: centred, a medium window's top edge sits half the
   * size difference above a small one's, and on screen that was enough for the second window to
   * land on the first one's header and hide it completely. From a shared corner, every window's
   * frame is exactly a step below the one before it, whatever size it is.
   */
  const openApp = (id: string) => {
    const app = DOCK_APPS.find((candidate) => candidate.id === id);
    if (!app) {
      return;
    }
    setOpenWindows((windows) => {
      if (windows.some((window) => window.id === id)) {
        return windows;
      }
      const slot = freeSlot(windows);
      const first = DOCK_APPS.find(
        (candidate) => candidate.id === windows.find((window) => window.slot === 0)?.id,
      );
      const anchor = centeredPosition(
        { height: globalThis.innerHeight, width: globalThis.innerWidth },
        (first ?? app).windowSize,
      );
      return [
        ...windows,
        {
          id,
          position: {
            x: anchor.x + CASCADE_STEP * slot,
            y: anchor.y + CASCADE_STEP * slot,
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
    <DesktopProvider value={desktop}>
      <div className="desktop" ref={desktopRef}>
        {/* No CSS background on the canvas: the wallpaper is drawn by the engine, so the desktop's
            own pixels come out of the canvas like everything else on it (ADR 008). */}
        <CanvasSurface
          aria-label="Desktop"
          background={drawnBackground}
          className="surface"
          ref={engineRef}
        >
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
                size={app.windowSize}
                title={app.label}
              >
                {app.content}
              </Window>
            );
          })}
        </CanvasSurface>
        <Dock apps={DOCK_APPS} onOpen={openApp} tooltipContainer={desktopRef} />
      </div>
    </DesktopProvider>
  );
}
