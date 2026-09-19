import { Drawable, useDragHandle, type DrawableItem, type Position } from "@os-canvas/react";
import type { ReactNode, Ref } from "react";

/** The close half of the reference desktop's close-minimize.svg, at the size it renders there. */
function CloseGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-[12.5px]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="-1 -1 12.49 12.49"
    >
      <path d="M0 0 10.49 10.49M10.49 0 0 10.49" />
    </svg>
  );
}

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
          className="-m-1.5 flex size-7 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-dotted focus-visible:outline-window-border"
        >
          <CloseGlyph />
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
export function Window({ children, initialPosition, onClose, ref, title }: WindowProps) {
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
      <div className="pointer-events-auto w-sm overflow-hidden rounded-window border-2 border-window-border bg-window text-window-foreground drop-shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
        <WindowHeader title={title} onClose={onClose} />
        <div className="border-t-2 border-window-border">{children}</div>
      </div>
    </Drawable>
  );
}
