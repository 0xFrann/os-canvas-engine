import { describe, expect, it } from "vitest";
import { DocumentModel } from "@os-canvas/document";
import { getWorldPosition } from "../index";

const window = { anchor: "world" as const, contentKind: "notes" as const };

describe("getWorldPosition", () => {
  it("throws for an unknown node id", () => {
    const doc = new DocumentModel({ name: "Board" });
    expect(() => getWorldPosition(doc, "missing")).toThrow("Node not found: missing");
  });

  it("returns world position for a top-level node", () => {
    const doc = new DocumentModel({ name: "Board" });
    const node = doc.addNode({ x: 100, y: 50, ...window });
    expect(getWorldPosition(doc, node.id)).toEqual({ x: 100, y: 50 });
  });

  it("sums parent + child locals into world position", () => {
    const doc = new DocumentModel({ name: "Board" });
    const parent = doc.addNode({ x: 100, y: 50, ...window });
    const child = doc.addNode({ x: 20, y: 10, ...window });
    expect(getWorldPosition(doc, parent.id)).toEqual({ x: 100, y: 50 });
    expect(getWorldPosition(doc, child.id)).toEqual({ x: 120, y: 60 });
  });

  it("flushes a pending dirty root before reading world position", () => {
    const doc = new DocumentModel({ name: "Board" });
    const parent = doc.addNode({ x: 0, y: 0, ...window });
    const child = doc.addNode({ x: 10, y: 10, ...window });
    doc.selectNode(parent.id);
    doc.updateNode({ x: 200, y: 100 });

    expect(getWorldPosition(doc, child.id)).toEqual({ x: 210, y: 110 });
  });
});
