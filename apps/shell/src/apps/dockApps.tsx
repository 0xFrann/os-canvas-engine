import { AppWindow, Calculator, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { CounterModal } from "@apps/CounterModal";
import { ExampleApp } from "@apps/ExampleApp";
import type { ReactNode } from "react";
import { Settings } from "@apps/Settings";
import type { WindowSize } from "@/components/Window";

/**
 * An app the dock can open. The shape is the reference desktop's `TAppData`, minus what this
 * desktop has no feature for yet (`hide`, link-type entries).
 */
export interface DockApp {
  /** What fills the window's content area. The app renders this and nothing else (ADR 004). */
  content: ReactNode;
  /** Shown in the dock but not openable, the reference's `disabled` flag. */
  disabled?: boolean;
  /** The dock's icon for this app, from lucide. */
  icon: LucideIcon;
  id: string;
  /** The tooltip in the dock and the title of the window it opens, as in the reference. */
  label: string;
  /** How big its window opens, the reference's `windowSize`. */
  windowSize: WindowSize;
}

/**
 * The dock's apps, in the order the bar shows them. Which apps exist and what they are called is
 * the reference desktop's (`appsConstants.tsx`); what they look like is not — icons are lucide,
 * the same library the rest of the shell uses. Example Two is not here: it is a desktop icon in
 * the reference, which belongs to the icon grid, not the dock.
 *
 * Sizes are the reference's too — Settings `Small`, Example App `Medium`. The Counter is not in the
 * reference, so it takes the smallest size there is.
 */
export const DOCK_APPS: readonly DockApp[] = [
  {
    content: <CounterModal />,
    icon: Calculator,
    id: "counter",
    label: "Counter",
    windowSize: "small",
  },
  {
    content: <ExampleApp />,
    icon: AppWindow,
    id: "example",
    label: "Example App",
    windowSize: "medium",
  },
  {
    content: <Settings />,
    icon: SettingsIcon,
    id: "settings",
    label: "Settings",
    windowSize: "small",
  },
];
