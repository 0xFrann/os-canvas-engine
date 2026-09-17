import {
  createCamera,
  panCamera,
  screenToWorld,
  worldSizeToScreen,
  worldToScreen,
  zoomCameraAt,
} from "../index";
import { describe, expect, it } from "vitest";

describe("camera transforms", () => {
  it("round-trips world ↔ screen at identity", () => {
    const camera = createCamera();
    const world = { x: 120, y: 60 };
    expect(screenToWorld(worldToScreen(world, camera), camera)).toEqual(world);
  });

  it("applies pan and zoom", () => {
    const camera = createCamera({ x: 10, y: 20, zoom: 2 });
    expect(worldToScreen({ x: 10, y: 20 }, camera)).toEqual({ x: 0, y: 0 });
    expect(worldToScreen({ x: 30, y: 40 }, camera)).toEqual({ x: 40, y: 40 });
    expect(screenToWorld({ x: 40, y: 40 }, camera)).toEqual({ x: 30, y: 40 });
  });

  it("pans by screen delta in world units", () => {
    const camera = createCamera({ zoom: 2 });
    panCamera(camera, { x: 40, y: -20 });
    expect(camera.x).toBe(-20);
    expect(camera.y).toBe(10);
  });

  it("zooms about a screen point without drifting that world point", () => {
    const camera = createCamera({ x: 0, y: 0, zoom: 1 });
    const screen = { x: 100, y: 50 };
    const worldBefore = screenToWorld(screen, camera);
    zoomCameraAt(camera, screen, 2);
    expect(camera.zoom).toBe(2);
    expect(screenToWorld(screen, camera)).toEqual(worldBefore);
  });

  it("scales a world size by zoom, with no translation", () => {
    const camera = createCamera({ x: 100, y: 100, zoom: 2 });
    expect(worldSizeToScreen({ x: 480, y: 320 }, camera)).toEqual({ x: 960, y: 640 });
  });
});
