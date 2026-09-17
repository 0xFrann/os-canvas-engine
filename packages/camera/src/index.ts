import { type Camera, DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM, type Vec2 } from "./types";

export function createCamera(init: Partial<Camera> = {}): Camera {
  return {
    x: init.x ?? 0,
    y: init.y ?? 0,
    zoom: init.zoom ?? 1,
  };
}

export function worldToScreen(world: Vec2, camera: Camera): Vec2 {
  return {
    x: (world.x - camera.x) * camera.zoom,
    y: (world.y - camera.y) * camera.zoom,
  };
}

export function screenToWorld(screen: Vec2, camera: Camera): Vec2 {
  return {
    x: screen.x / camera.zoom + camera.x,
    y: screen.y / camera.zoom + camera.y,
  };
}

/**
 * Scales a world-space size (width/height) into screen space. Unlike
 * worldToScreen/screenToWorld this has no translation component — a size
 * isn't anchored to a point, it just grows or shrinks with zoom.
 */
export function worldSizeToScreen(size: Vec2, camera: Camera): Vec2 {
  return {
    x: size.x * camera.zoom,
    y: size.y * camera.zoom,
  };
}

export function panCamera(camera: Camera, screenDelta: Vec2): void {
  camera.x -= screenDelta.x / camera.zoom;
  camera.y -= screenDelta.y / camera.zoom;
}

export function zoomCameraAt(
  camera: Camera,
  screenPoint: Vec2,
  factor: number,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
): void {
  const world = screenToWorld(screenPoint, camera);
  const next = Math.min(maxZoom, Math.max(minZoom, camera.zoom * factor));
  camera.zoom = next;
  camera.x = world.x - screenPoint.x / camera.zoom;
  camera.y = world.y - screenPoint.y / camera.zoom;
}

export function applyCameraTransform(ctx: CanvasRenderingContext2D, camera: Camera): void {
  ctx.setTransform(
    camera.zoom,
    0,
    0,
    camera.zoom,
    -camera.x * camera.zoom,
    -camera.y * camera.zoom,
  );
}

export type { Camera, Vec2 } from "./types";
export { DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM } from "./types";
