import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@os-canvas/ui";
import type { DockApp } from "@/dockApps";
import type { RefObject } from "react";

export interface DockProps {
  apps: readonly DockApp[];
  /** Open the app, or raise its window when it is already open. The desktop decides which. */
  onOpen: (id: string) => void;
  /**
   * Where the tooltips render. A portal defaults to `<body>`, which takes a tooltip out of the
   * desktop's subtree — the same thing the dialog ran into inside the canvas (ADR 002). The dock
   * itself can't host them: its transform and backdrop blur would make a containing block.
   */
  tooltipContainer: RefObject<HTMLElement | null>;
}

/**
 * The dock: a bar of app icons along the bottom of the desktop. Clicking one opens that app;
 * clicking it again raises the window it already opened. A disabled app is dimmed and does
 * nothing, which is how the reference marks an app that isn't available.
 *
 * What the reference decides here is *what exists and how it behaves* — these apps, a label on
 * hover, click to open. The look is this project's own: the same greys, border and radius as the
 * window chrome, so the dock and the windows read as one desktop.
 *
 * It is desktop chrome, so it is plain DOM laid over the canvas rather than something the engine
 * draws ([ADR 006](../../../../../docs/decisions/006-the-dock-is-chrome-over-the-canvas.md)).
 */
export function Dock({ apps, onOpen, tooltipContainer }: DockProps) {
  return (
    <TooltipProvider>
      <div
        aria-label="Dock"
        role="toolbar"
        /* A page shadow, not a drawn one: the dock is over the canvas, so it lifts off the
           desktop the way a window's drop shadow does, without costing a snapshot. */
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-window border-2 border-window-border bg-window/85 p-2 shadow-[0_4px_16px_rgba(0,0,0,0.15)] backdrop-blur-sm select-none"
      >
        {apps.map(({ disabled, icon: Icon, id, label }) => (
          <Tooltip key={id}>
            <TooltipTrigger
              aria-disabled={disabled}
              aria-label={label}
              data-app={id}
              onClick={() => !disabled && onOpen(id)}
              className="control flex size-12 items-center justify-center rounded-[calc(var(--window-radius)-0.25rem)]"
            >
              <Icon className="size-7" strokeWidth={1.5} />
            </TooltipTrigger>
            <TooltipContent container={tooltipContainer} side="top" sideOffset={10}>
              {label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
