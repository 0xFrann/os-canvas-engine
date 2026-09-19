import { createContext, useContext } from "react";

/**
 * A wallpaper: either a picture the engine covers the desktop with, or a flat color it fills with.
 */
export interface DesktopBackground {
  /** A CSS color, for a wallpaper that is a flat shade. */
  color?: string;
  id: string;
  /** What Settings calls it, and the accessible name of its thumbnail. */
  label: string;
  /** The image's URL, for a wallpaper that is a picture. */
  src?: string;
}

/**
 * What an app can ask the desktop it runs on for. It lives with the apps because it is *their* side
 * of the line: the apps say what they need, the desktop provides it (`DesktopProvider`), and the
 * dependency keeps pointing one way — the desktop imports the apps, never the reverse.
 *
 * A small, explicit surface: an app fills a content slot and reaches nothing else (ADR 004) — not
 * the engine, not the DOM around its window — so a setting that belongs to the whole desktop is
 * handed to it here or not at all.
 *
 * The reference desktop's Settings writes `.main-layout`'s style and `localStorage` itself. Here
 * the desktop owns both, and Settings only says which wallpaper it wants.
 */
export interface Desktop {
  /** The wallpaper the desktop is showing, by id. */
  background: string;
  /** The wallpapers to choose from. */
  backgrounds: readonly DesktopBackground[];
  setBackground: (id: string) => void;
}

const DesktopContext = createContext<Desktop | null>(null);

export const DesktopProvider = DesktopContext.Provider;

/** The desktop an app is running on. Throws outside one: there is no app without a desktop. */
export function useDesktop(): Desktop {
  const desktop = useContext(DesktopContext);
  if (!desktop) {
    throw new Error("useDesktop must be used inside the desktop");
  }
  return desktop;
}
