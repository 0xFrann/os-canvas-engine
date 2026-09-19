import { Drawable, useDragHandle, type DrawableItem, type Position } from "@os-canvas/react";
import type { ReactNode, Ref } from "react";
import { X } from "lucide-react";

interface WindowHeaderProps {
  onClose?: () => void;
  title: string;
}

/**
 * The strip that drags the window. macOS-style: the left zone is the system's (close for now), the
 * rest is the app's area with the title in it, and every empty pixel of the strip drags — the whole
 * header is the handle, so the engine is what keeps the press on the close button from dragging.
 */
function WindowHeader({ onClose, title }: WindowHeaderProps) {
  const handleRef = useDragHandle<HTMLDivElement>();

  return (
    <div
      ref={handleRef}
      className="flex cursor-grab items-center gap-3 bg-window-header px-3 py-2.5 select-none"
    >
      <div className="flex w-12 shrink-0 items-center">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          // 28px hit area around the 16px glyph box; the negative margin keeps the glyph where it was.
          className="control -m-1.5 flex size-7 items-center justify-center rounded-full"
        >
          <X aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
      </div>
      {/* One line, always: a title too wide for the strip is trimmed, not wrapped (the native
          tooltip keeps it readable). `min-w-0` is what lets the flex item shrink below its text.
          CSS puts the 0.5em letter-space after the last letter too; the negative right margin
          gives that dead space back, so the glyphs center on the window and a title that fits
          by a letter is not trimmed by the gap behind it. */}
      <span
        title={title}
        className="-mr-[0.5em] min-w-0 flex-1 overflow-hidden text-center text-xl leading-none tracking-[0.5em] text-ellipsis whitespace-nowrap uppercase"
      >
        {title}
      </span>
      {/* Balances the reserved zone so the title centers on the window, not on what's left of it. */}
      <div aria-hidden="true" className="w-12 shrink-0" />
    </div>
  );
}

/**
 * One side of a window: a share of the viewport, with a floor and a ceiling — `clamp()`, as CSS
 * and as arithmetic, because the desktop has to work out where a window of that size opens.
 */
export interface WindowExtent {
  max: number;
  min: number;
  /** The share of the viewport this side takes between those two. */
  of: number;
}

/**
 * How big a window is. The reference desktop has the *set* — `Small`, `Medium`, `Large`, one per
 * app — and this desktop has its own measurements: a window that is 384px wide on a 1280px screen,
 * the width every window here has had, and that follows the viewport from there rather than being
 * stuck at it. The floor keeps a window whole on a phone-sized viewport; the ceiling keeps it from
 * becoming a wall on a large display.
 *
 * `large` is not here. It is Example Two's, and Example Two belongs to the desktop icon grid.
 */
export const WINDOW_SIZES = {
  medium: {
    height: { max: 500, min: 280, of: 0.46 },
    width: { max: 600, min: 384, of: 0.42 },
  },
  small: {
    height: { max: 420, min: 260, of: 0.38 },
    width: { max: 460, min: 320, of: 0.3 },
  },
} as const;

export type WindowSize = keyof typeof WINDOW_SIZES;

/** What an extent comes to on a viewport that is `extent` long on that axis — CSS `clamp()`, in JS. */
export function windowExtent(side: WindowExtent, viewport: number): number {
  return Math.min(Math.max(side.min, side.of * viewport), side.max);
}

/** And the same thing as CSS, so the size the page lays out and the size the desktop places agree. */
function extentCss(side: WindowExtent, unit: "vh" | "vw"): string {
  return `clamp(${side.min}px, ${side.of * 100}${unit}, ${side.max}px)`;
}

/**
 * The room around the frame that its drop shadow is drawn into. A window's position is the mount's,
 * and the mount leads with this band, so the desktop needs it to place a frame anywhere exactly.
 * In pixels: it is the shadow's measured size, not the window's, so it does not scale with either.
 */
const SHADOW_BAND = { bottom: 40, left: 36, right: 36, top: 32 };

export interface WindowArea {
  height: number;
  width: number;
}

/**
 * Where to put the mount of a window of `size` for its frame to be centred on a desktop of `area`.
 *
 * The desktop's placement policy calls this once, when a window opens; from then on the position is
 * the engine's. The window's own size resolves against the viewport, and the canvas fills the
 * viewport, so `area` is both.
 */
export function centeredPosition(area: WindowArea, size: WindowSize): Position {
  const { height, width } = WINDOW_SIZES[size];
  return {
    x: Math.round((area.width - windowExtent(width, area.width)) / 2 - SHADOW_BAND.left),
    y: Math.round((area.height - windowExtent(height, area.height)) / 2 - SHADOW_BAND.top),
  };
}

export interface WindowProps {
  /** The app: it fills the content area and is given nothing else. */
  children: ReactNode;
  /** Where the engine first draws the window; it owns the position from then on. */
  initialPosition: Position;
  onClose?: () => void;
  /**
   * The window's engine item, handed straight through from `<Drawable>`. The desktop keeps it so
   * the dock can raise a window that is already open — a raise with no pointer behind it.
   */
  ref?: Ref<DrawableItem | null>;
  /** How big the window is, relative to the viewport. The app it holds decides, as in the reference. */
  size: WindowSize;
  title: string;
}

/**
 * A desktop window, drawn on the canvas by the engine and dragged by its header.
 *
 * The desktop provides the chrome and apps get a content slot (ADR 004): nothing an app renders
 * can move, close, or restyle its window. Look ported from the reference
 * desktop's `apps-window`; the padding around the frame is room for its drop shadow, which is part
 * of the snapshot the engine draws. That band is transparent, so it must not take clicks either:
 * the mount is click-through and the frame is what a press reaches, or a window's shadow would sit
 * on top of the one behind it and swallow the press meant to raise that one.
 *
 * The band is sized to the shadow, because `drawElementImage` clips the snapshot to the mount's
 * border box: whatever the shadow paints past it is cut off, with a visible step where it stops.
 * Measured in Chrome 153, the reference's `0 4px 16px` shadow reaches 36px sideways (2.25x the
 * blur radius, confirmed by doubling the blur), so the band is that 36px shifted by the 4px
 * y-offset: 32 top, 36 sides, 40 bottom.
 */
export function Window({ children, initialPosition, onClose, ref, size, title }: WindowProps) {
  const { height, width } = WINDOW_SIZES[size];

  return (
    <Drawable
      initialPosition={initialPosition}
      ref={ref}
      /* The engine makes the mount focusable so the active window can hold the keyboard with no
         control in it focused. That is not something this desktop draws: the UA ring would frame
         the whole mount — shadow band and all — and mark the active window, which nothing here has
         decided to do. */
      className="pointer-events-none w-max px-9 pt-8 pb-10 outline-none"
    >
      {/* The size is CSS, so it is the page's: the mount is laid out inside the canvas, a viewport
          resize re-lays it out, and Chrome asks for the paint by itself. The engine never learns a
          window's size — it draws whatever the element turned out to be, at the position it owns. */}
      <div
        style={{ height: extentCss(height, "vh"), width: extentCss(width, "vw") }}
        className="pointer-events-auto flex flex-col overflow-hidden rounded-window border-2 border-window-border bg-window text-window-foreground drop-shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
      >
        <WindowHeader title={title} onClose={onClose} />
        {/* The app gets the rest of the frame, and keeps its own overflow inside it. */}
        <div className="min-h-0 flex-1 border-t-2 border-window-border">{children}</div>
      </div>
    </Drawable>
  );
}
