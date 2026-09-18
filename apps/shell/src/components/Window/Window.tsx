import { Drawable, useDragHandle, type Position } from "@os-canvas/react";
import type { ReactNode } from "react";

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
          className="-m-1.5 flex size-7 cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-dotted focus-visible:outline-window-border"
        >
          <CloseGlyph />
        </button>
      </div>
      <span className="flex-1 text-center text-xl leading-none tracking-[0.5em] uppercase">
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
  title: string;
}

/**
 * A desktop window, drawn on the canvas by the engine and dragged by its header.
 *
 * The desktop provides the chrome and apps get a content slot (ADR 004): nothing an app renders
 * can move, close, or restyle its window. Look ported from the reference
 * desktop's `apps-window`; the padding around the frame is room for its drop shadow, which is part
 * of the snapshot the engine draws.
 */
export function Window({ children, initialPosition, onClose, title }: WindowProps) {
  return (
    <Drawable initialPosition={initialPosition} className="w-max p-6">
      <div className="w-sm overflow-hidden rounded-window border-2 border-window-border bg-window text-window-foreground drop-shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
        <WindowHeader title={title} onClose={onClose} />
        <div className="border-t-2 border-window-border">{children}</div>
      </div>
    </Drawable>
  );
}
