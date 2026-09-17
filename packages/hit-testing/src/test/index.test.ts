import { containsPoint, hitTest } from "../index";
import { describe, expect, it } from "vitest";
import { DocumentModel } from "@os-canvas/document";
import { createCamera } from "@os-canvas/camera";

const win = { anchor: "world" as const, contentKind: "notes" as const };
const bar = { anchor: "screen" as const, contentKind: "taskbar" as const };

describe("containsPoint", () => {
  it("includes the node's edges", () => {
    const doc = new DocumentModel({ name: "Board" });
    const node = doc.addNode({ height: 50, width: 50, x: 0, y: 0, ...win });
    expect(containsPoint(node, { x: 0, y: 0 })).toBe(true);
    expect(containsPoint(node, { x: 50, y: 50 })).toBe(true);
    expect(containsPoint(node, { x: 51, y: 0 })).toBe(false);
  });
});

describe("hitTest", () => {
  it("returns undefined when the point misses every node", () => {
    const doc = new DocumentModel({ name: "Board" });
    doc.addNode({ height: 50, width: 50, x: 100, y: 100, ...win });
    expect(hitTest(doc, createCamera(), { x: 10, y: 10 })).toBeUndefined();
  });

  it("hits a world node through the camera transform", () => {
    const doc = new DocumentModel({ name: "Board" });
    const node = doc.addNode({ height: 120, width: 200, x: 100, y: 50, ...win });
    const camera = createCamera({ zoom: 2 });
    // World point (150, 80) is inside the node's [100,300]x[50,170] box.
    expect(hitTest(doc, camera, { x: 300, y: 160 })).toBe(node.id);
  });

  it("prefers the higher zIndex when two world nodes overlap", () => {
    const doc = new DocumentModel({ name: "Board" });
    doc.addNode({ height: 100, width: 100, x: 0, y: 0, ...win });
    doc.selectNode("root");
    const top = doc.addNode({ height: 100, width: 100, x: 20, y: 20, ...win, zIndex: 1 });
    expect(hitTest(doc, createCamera(), { x: 50, y: 50 })).toBe(top.id);
  });

  it("uses world position for nested nodes", () => {
    const doc = new DocumentModel({ name: "Board" });
    doc.addNode({ height: 160, width: 200, x: 100, y: 50, ...win });
    const child = doc.addNode({ height: 60, width: 80, x: 20, y: 10, ...win });
    expect(hitTest(doc, createCamera(), { x: 130, y: 70 })).toBe(child.id);
  });

  it("keeps a screen-anchored node fixed regardless of camera pan/zoom", () => {
    const doc = new DocumentModel({ name: "Board" });
    const taskbar = doc.addNode({ height: 48, width: 800, x: 0, y: 752, ...bar });
    const camera = createCamera({ x: 5000, y: 5000, zoom: 3 });
    expect(hitTest(doc, camera, { x: 10, y: 760 })).toBe(taskbar.id);
  });

  it("prefers a screen-anchored node over an overlapping world node", () => {
    const doc = new DocumentModel({ name: "Board" });
    doc.addNode({ height: 800, width: 800, x: 0, y: 0, ...win, zIndex: 99 });
    doc.selectNode("root");
    const taskbar = doc.addNode({ height: 48, width: 800, x: 0, y: 0, ...bar });
    expect(hitTest(doc, createCamera(), { x: 10, y: 10 })).toBe(taskbar.id);
  });
});
