import { describe, expect, it } from "vitest";
import { DocumentModel } from "../index";

const window = { anchor: "world" as const, contentKind: "notes" as const };
const taskbar = { anchor: "screen" as const, contentKind: "taskbar" as const };

describe("createDocument", () => {
  it("should create a new document with a valid structure", () => {
    const doc = new DocumentModel({ name: "Test Document" });

    expect(doc).toBeDefined();
    expect(doc.id).toBe("root");
    expect(doc.metadata.name).toEqual("Test Document");
    expect(doc.nodes.size).toBe(0);
    expect(doc.activeNodeId).toBe("root");
    expect(doc.activeNode).toEqual(doc);
  });

  it("should add a new node with a generated id and focus it", () => {
    const doc = new DocumentModel({ name: "Test Document" });
    const created = doc.addNode({ x: 0, y: 0, ...window });

    expect(created.id).not.toBe("root");
    expect(doc.nodes.get(created.id)).toBe(created);
    expect(doc.activeNodeId).toBe(created.id);
    expect(doc.activeNode).toBe(created);
  });

  it("should generate unique ids for each add", () => {
    const doc = new DocumentModel({ name: "Test Document" });
    const a = doc.addNode({ x: 0, y: 0, ...window });
    const b = doc.addNode({ x: 1, y: 1, ...window });

    expect(a.id).not.toBe(b.id);
    expect(doc.nodes.size).toBe(2);
  });

  it("should default width/height/state/zIndex/title on add", () => {
    const doc = new DocumentModel({ name: "Test Document" });
    const created = doc.addNode({ x: 10, y: 20, ...window });

    expect(created.width).toBe(480);
    expect(created.height).toBe(320);
    expect(created.state).toBe("normal");
    expect(created.zIndex).toBe(0);
    expect(created.title).toBe("");
  });

  it("should keep window and taskbar nodes independently anchored", () => {
    const doc = new DocumentModel({ name: "Board" });
    const win = doc.addNode({ x: 0, y: 0, ...window });
    const bar = doc.addNode({ x: 0, y: 0, ...taskbar });

    expect(win.anchor).toBe("world");
    expect(bar.anchor).toBe("screen");
  });

  it("should delete a node and refocus the desktop (root)", () => {
    const doc = new DocumentModel({ name: "Test Document" });
    const a = doc.addNode({ x: 0, y: 0, ...window });
    doc.deleteNode(a.id);

    expect(doc.nodes.size).toBe(0);
    expect(doc.nodes.get(a.id)).toBeUndefined();
    expect(doc.activeNodeId).toBe("root");
    expect(doc.activeNode).toEqual(doc);
  });

  it("should refuse to delete a node that is not currently active", () => {
    const doc = new DocumentModel({ name: "Test Document" });
    const a = doc.addNode({ x: 0, y: 0, ...window });
    doc.addNode({ x: 0, y: 0, ...window });

    expect(() => doc.deleteNode(a.id)).toThrow("Active node is not the node to delete");
  });

  it("should prevent deleting the root", () => {
    const doc = new DocumentModel({ name: "Test Document" });
    expect(() => doc.deleteNode("root")).toThrow("Root node cannot be deleted");
  });

  it("should update the active node's position and size in place", () => {
    const doc = new DocumentModel({ name: "Board" });
    const created = doc.addNode({ x: 0, y: 0, ...window });

    const updated = doc.updateNode({ height: 50, width: 90, x: 50, y: 25 });

    expect(updated).toBe(created);
    expect(updated.x).toBe(50);
    expect(updated.y).toBe(25);
    expect(updated.width).toBe(90);
    expect(updated.height).toBe(50);
  });

  it("should update zIndex and state on the active node", () => {
    const doc = new DocumentModel({ name: "Board" });
    doc.addNode({ x: 0, y: 0, ...window });

    const updated = doc.updateNode({ state: "maximized", zIndex: 7 });

    expect(updated.zIndex).toBe(7);
    expect(updated.state).toBe("maximized");
  });

  it("should prevent updating the root", () => {
    const doc = new DocumentModel({ name: "Board" });
    expect(() => doc.updateNode({ x: 1 })).toThrow("Root node cannot be updated");
  });

  it("should select a node by id without storing a separate object cursor", () => {
    const doc = new DocumentModel({ name: "Board" });
    const created = doc.addNode({ x: 0, y: 0, ...window });
    doc.selectNode("root");
    expect(doc.activeNodeId).toBe("root");
    doc.selectNode(created.id);
    expect(doc.activeNodeId).toBe(created.id);
    expect(doc.activeNode).toBe(doc.nodes.get(created.id));
  });

  it("should save a flat list of plain node objects", () => {
    const doc = new DocumentModel({ name: "Board" });
    const win = doc.addNode({ x: 0, y: 0, ...window, title: "Notes" });
    const bar = doc.addNode({ x: 0, y: 750, ...taskbar });

    const saved = doc.save();

    expect(saved.metadata).toEqual({ name: "Board" });
    expect(saved.activeNodeId).toBe(bar.id);
    expect(saved.nodes).toEqual(
      expect.arrayContaining([
        {
          anchor: "world",
          contentKind: "notes",
          height: 320,
          id: win.id,
          state: "normal",
          title: "Notes",
          width: 480,
          x: 0,
          y: 0,
          zIndex: 0,
        },
        {
          anchor: "screen",
          contentKind: "taskbar",
          height: 320,
          id: bar.id,
          state: "normal",
          title: "",
          width: 480,
          x: 0,
          y: 750,
          zIndex: 0,
        },
      ]),
    );
    expect(saved.nodes).toHaveLength(2);
  });

  it("should round-trip save → load with the same node data", () => {
    const doc = new DocumentModel({ name: "Board" });
    const win = doc.addNode({ x: 0, y: 0, ...window, title: "Notes", zIndex: 3 });

    const loaded = DocumentModel.load(doc.save());

    expect(loaded.metadata.name).toBe("Board");
    expect(loaded.activeNodeId).toBe(win.id);
    expect(loaded.nodes.get(win.id)).toEqual(win);
    expect(loaded.nodes.get(win.id)).not.toBe(win);
  });

  it("should reject loading a file with a duplicate node id", () => {
    expect(() =>
      DocumentModel.load({
        activeNodeId: "root",
        metadata: { name: "Board" },
        nodes: [
          {
            anchor: "world",
            contentKind: "notes",
            height: 1,
            id: "1",
            state: "normal",
            title: "",
            width: 1,
            x: 0,
            y: 0,
            zIndex: 0,
          },
          {
            anchor: "world",
            contentKind: "notes",
            height: 1,
            id: "1",
            state: "normal",
            title: "",
            width: 1,
            x: 0,
            y: 0,
            zIndex: 0,
          },
        ],
      }),
    ).toThrow("Duplicate node id: 1");
  });
});
