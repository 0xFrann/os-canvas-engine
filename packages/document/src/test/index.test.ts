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
    expect(doc.children.size).toEqual(doc.nodeReferences.size);
    expect([...doc.children.keys()]).toEqual([]);
    expect(doc.activeNodeId).toBe("root");
    expect(doc.activeNode).toEqual(doc);
  });

  it("should add a new node under the active node with a generated id", () => {
    const doc = new DocumentModel({ name: "Test Document" });
    const created = doc.addNode({ x: 0, y: 0, ...window });

    expect(created.id).not.toBe("root");
    expect(created.parentId).toBe("root");
    const fromTree = doc.children.get(created.id);
    const fromIndex = doc.nodeReferences.get(created.id);
    expect(fromTree).toBeDefined();
    expect(fromIndex).toBe(fromTree);
    expect(doc.activeNodeId).toBe(created.id);
    expect(doc.activeNode).toBe(fromTree);
  });

  it("should add a nested node under the current active node", () => {
    const doc = new DocumentModel({ name: "Test Document" });
    const parent = doc.addNode({ x: 0, y: 0, ...window });
    const child = doc.addNode({ x: 0, y: 0, ...window });

    expect(child.parentId).toBe(parent.id);
    expect(parent.children.get(child.id)).toBe(child);
    expect(doc.nodeReferences.get(child.id)).toBe(child);
  });

  it("should generate unique ids for each add", () => {
    const doc = new DocumentModel({ name: "Test Document" });
    const a = doc.addNode({ x: 0, y: 0, ...window });
    doc.selectNode("root");
    const b = doc.addNode({ x: 1, y: 1, ...window });

    expect(a.id).not.toBe(b.id);
    expect(doc.nodeReferences.size).toBe(2);
  });

  it("should delete a node and its children", () => {
    const doc = new DocumentModel({ name: "Test Document" });
    const n1 = doc.addNode({ x: 0, y: 0, ...window });
    const n2 = doc.addNode({ x: 0, y: 0, ...window });
    const n4 = doc.addNode({ x: 0, y: 0, ...window });
    doc.selectNode(n1.id);
    const n3 = doc.addNode({ x: 0, y: 0, ...window });
    doc.selectNode(n1.id);
    doc.deleteNode(n1.id);

    expect(doc.children.size).toEqual(0);
    expect(doc.nodeReferences.size).toEqual(0);
    expect(doc.activeNodeId).toBe("root");
    expect(doc.activeNode).toEqual(doc);
    expect(doc.nodeReferences.get(n2.id)).toBeUndefined();
    expect(doc.nodeReferences.get(n3.id)).toBeUndefined();
    expect(doc.nodeReferences.get(n4.id)).toBeUndefined();
  });

  it("should save a flat document without nested children or nodeReferences", () => {
    const doc = new DocumentModel({ name: "Board" });
    const n1 = doc.addNode({ x: 0, y: 0, ...window, title: "Notes" });
    const n2 = doc.addNode({ x: 10, y: 10, ...taskbar });

    const saved = doc.save();

    expect(saved.metadata).toEqual({ name: "Board" });
    expect(saved.activeNodeId).toBe(n2.id);
    expect(saved.nodes).toEqual(
      expect.arrayContaining([
        {
          anchor: "world",
          contentKind: "notes",
          height: 320,
          id: n1.id,
          parentId: "root",
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
          id: n2.id,
          parentId: n1.id,
          state: "normal",
          title: "",
          width: 480,
          x: 10,
          y: 10,
          zIndex: 0,
        },
      ]),
    );
    expect(saved.nodes).toHaveLength(2);
    expect(saved).not.toHaveProperty("children");
    expect(saved).not.toHaveProperty("nodeReferences");
  });

  it("should round-trip save → load with same tree, index identity, and OS fields", () => {
    const doc = new DocumentModel({ name: "Board" });
    const n1 = doc.addNode({ x: 0, y: 0, ...window, title: "Notes", zIndex: 3 });
    doc.selectNode("root");
    const n2 = doc.addNode({ x: 10, y: 10, ...taskbar, state: "maximized" });
    doc.selectNode(n1.id);

    const loaded = DocumentModel.load(doc.save());

    expect(loaded.metadata.name).toBe("Board");
    expect(loaded.activeNodeId).toBe(n1.id);
    expect(loaded.activeNode).toBe(loaded.nodeReferences.get(n1.id));
    expect(loaded.nodeReferences.get(n1.id)).toMatchObject({
      anchor: "world",
      contentKind: "notes",
      title: "Notes",
      zIndex: 3,
    });
    expect(loaded.nodeReferences.get(n2.id)).toMatchObject({
      anchor: "screen",
      contentKind: "taskbar",
      state: "maximized",
    });
  });

  it("should update zIndex and state on the active node", () => {
    const doc = new DocumentModel({ name: "Board" });
    const created = doc.addNode({ x: 0, y: 0, ...window });

    const updated = doc.updateNode({ state: "maximized", zIndex: 7 });

    expect(updated.zIndex).toBe(7);
    expect(updated.state).toBe("maximized");
    expect(updated).toBe(created);
  });

  it("should default state to normal and zIndex to 0 when not provided", () => {
    const doc = new DocumentModel({ name: "Board" });
    const created = doc.addNode({ x: 0, y: 0, ...window });

    expect(created.state).toBe("normal");
    expect(created.zIndex).toBe(0);
    expect(created.title).toBe("");
  });

  it("should keep window and taskbar nodes independently anchored", () => {
    const doc = new DocumentModel({ name: "Board" });
    const win = doc.addNode({ x: 0, y: 0, ...window });
    doc.selectNode("root");
    const bar = doc.addNode({ x: 0, y: 0, ...taskbar });

    expect(win.anchor).toBe("world");
    expect(bar.anchor).toBe("screen");
  });

  it("should prevent updating the root", () => {
    const doc = new DocumentModel({ name: "Board" });
    expect(() => doc.updateNode({ x: 1 })).toThrow("Root node cannot be updated");
  });

  it("should reject reparenting under a descendant (cycle)", () => {
    const doc = new DocumentModel({ name: "Board" });
    const frame = doc.addNode({ x: 0, y: 0, ...window });
    const sticky = doc.addNode({ x: 5, y: 5, ...window });

    doc.selectNode(frame.id);
    expect(() => doc.reparentNode(sticky.id)).toThrow(
      "Cannot reparent a node under itself or its descendant",
    );
  });
});
