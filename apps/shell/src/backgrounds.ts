import fieldUrl from "./assets/wallpapers/field.svg";

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
 * The wallpapers the desktop offers — the reference desktop has two
 * (`constants/backgroundConstants.ts`), this one has the real wallpaper plus two greys.
 *
 * **The greys are stand-ins**, kept because they are the cheapest thing to see a change with: one
 * is the shade the desktop was before it had a wallpaper (`--muted`, written out because canvas
 * `fillStyle` does not resolve `var()`), the other is the window chrome's border grey.
 */
export const BACKGROUNDS: readonly DesktopBackground[] = [
  { id: "field", label: "Field", src: fieldUrl },
  { color: "#f5f5f5", id: "grey-1", label: "Light grey" },
  { color: "#a6a6a6", id: "grey-2", label: "Mid grey" },
];

/** What the desktop starts on when nothing is stored. */
export const [DEFAULT_BACKGROUND] = BACKGROUNDS;

/** The reference desktop's key, so the two desktops remember the choice under the same name. */
export const BACKGROUND_STORAGE_KEY = "desktopBackground";

/** The wallpaper for an id — the default for anything unknown, e.g. an id from an older build. */
export function findBackground(id: string): DesktopBackground {
  return BACKGROUNDS.find((background) => background.id === id) ?? DEFAULT_BACKGROUND;
}

/**
 * Decoded images, by URL. The engine draws what it is given and loads nothing (a half-loaded image
 * is a frame of nothing), so loading is the desktop's — and a wallpaper that has been shown once is
 * kept, so going back to it is instant and costs no flash.
 */
const loading = new Map<string, Promise<HTMLImageElement>>();
const decoded = new Map<string, HTMLImageElement>();

function decode(src: string): Promise<HTMLImageElement> {
  let pending = loading.get(src);
  if (!pending) {
    const image = new Image();
    image.src = src;
    pending = image.decode().then(() => {
      decoded.set(src, image);
      return image;
    });
    loading.set(src, pending);
  }
  return pending;
}

/** What to hand the engine for a wallpaper: its color as it is, or its image once it has decoded. */
export function loadBackground(background: DesktopBackground): Promise<string | HTMLImageElement> {
  if (background.src) {
    return decode(background.src);
  }
  return Promise.resolve(background.color ?? "");
}

/** The same thing, if it can be had without waiting — a color always, an image once it is decoded. */
export function readyBackground(background: DesktopBackground): string | HTMLImageElement | null {
  if (background.src) {
    return decoded.get(background.src) ?? null;
  }
  return background.color ?? null;
}

/**
 * The wallpaper the desktop starts on: the choice it remembered, or the default. Read here rather
 * than in a component so the image can start decoding at import time, before React renders.
 */
export const INITIAL_BACKGROUND = findBackground(
  localStorage.getItem(BACKGROUND_STORAGE_KEY) ?? DEFAULT_BACKGROUND.id,
);
