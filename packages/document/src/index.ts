import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  type Document,
  type Node,
  type NodeCreate,
  type NodeUpdate,
  type SerializedDocument,
  type WorldPosition,
} from "./types";

class DocumentModel implements Document {
  readonly id: Document["id"] = "root";
  readonly metadata: Document["metadata"];
  readonly children: Document["children"];
  readonly nodeReferences: Document["nodeReferences"];
  activeNodeId: Document["activeNodeId"];
  /** Single pending world-sync root (one dragged ancestor at a time). */
  private dirtyRootId: Node["id"] | null = null;
  /** Increments when ensureWorld actually runs syncWorldSubtree. */
  worldSyncCount = 0;

  constructor(metadata: Document["metadata"]) {
    this.metadata = metadata;
    this.children = new Map();
    this.nodeReferences = new Map();
    this.activeNodeId = this.id;
  }

  get activeNode(): Node | DocumentModel {
    return this.getNode(this.activeNodeId);
  }

  private createId(): string {
    return crypto.randomUUID();
  }

  private parentWorld(parent: Node | DocumentModel): WorldPosition {
    if (parent === this) {
      return { x: 0, y: 0 };
    }
    return { x: (parent as Node).worldX, y: (parent as Node).worldY };
  }

  private syncWorldSubtree(node: Node): void {
    const parent = this.getNode(node.parentId);
    const origin = this.parentWorld(parent);
    node.worldX = origin.x + node.x;
    node.worldY = origin.y + node.y;
    for (const child of node.children.values()) {
      this.syncWorldSubtree(child);
    }
  }

  private markWorldDirty(nodeId: Node["id"]): void {
    if (this.dirtyRootId !== null && this.dirtyRootId !== nodeId) {
      this.ensureWorld();
    }
    this.dirtyRootId = nodeId;
  }

  ensureWorld(): void {
    if (this.dirtyRootId === null) {
      return;
    }
    const node = this.nodeReferences.get(this.dirtyRootId);
    this.dirtyRootId = null;
    if (node) {
      this.worldSyncCount += 1;
      this.syncWorldSubtree(node);
    }
  }

  private createNode(node: Node, parentNode: Node | Document): Node {
    if (node.id === "root") {
      throw new Error("Root node cannot be overridden");
    }
    if (this.nodeReferences.has(node.id)) {
      throw new Error(`Duplicate node id: ${node.id}`);
    }

    // Same object in tree + index (not a copy).
    parentNode.children.set(node.id, node);
    this.nodeReferences.set(node.id, node);
    this.activeNodeId = node.id;
    return node;
  }

  addNode(props: NodeCreate): Node {
    this.ensureWorld();
    const parentNode = this.getNode(this.activeNodeId);
    const origin = this.parentWorld(parentNode);

    const node: Node = {
      anchor: props.anchor,
      children: new Map(),
      contentKind: props.contentKind,
      height: props.height ?? DEFAULT_NODE_HEIGHT,
      id: this.createId(),
      parentId: parentNode.id,
      state: props.state ?? "normal",
      title: props.title ?? "",
      width: props.width ?? DEFAULT_NODE_WIDTH,
      worldX: origin.x + props.x,
      worldY: origin.y + props.y,
      x: props.x,
      y: props.y,
      zIndex: props.zIndex ?? 0,
    };

    return this.createNode(node, parentNode);
  }

  selectNode(id: Node["id"] | Document["id"]): void {
    this.getNode(id); // Validate
    this.activeNodeId = id;
  }

  updateNode(patch: NodeUpdate): Node {
    if (this.activeNodeId === this.id) {
      throw new Error("Root node cannot be updated");
    }

    const node = this.getNode(this.activeNodeId) as Node;
    if (patch.x !== undefined) {
      node.x = patch.x;
    }
    if (patch.y !== undefined) {
      node.y = patch.y;
    }
    if (patch.width !== undefined) {
      node.width = patch.width;
    }
    if (patch.height !== undefined) {
      node.height = patch.height;
    }
    if (patch.zIndex !== undefined) {
      node.zIndex = patch.zIndex;
    }
    if (patch.state !== undefined) {
      node.state = patch.state;
    }
    if (patch.x !== undefined || patch.y !== undefined) {
      this.markWorldDirty(node.id);
    }
    return node;
  }

  reparentNode(newParentId: Node["id"] | Document["id"]): Node {
    if (this.activeNodeId === this.id) {
      throw new Error("Root node cannot be reparented");
    }

    this.ensureWorld();
    const node = this.getNode(this.activeNodeId) as Node;
    const newParent = this.getNode(newParentId);

    if (node.parentId === newParent.id) {
      return node;
    }

    if (this.isAncestorOf(node, newParent)) {
      throw new Error("Cannot reparent a node under itself or its descendant");
    }

    const origin = this.parentWorld(newParent);
    node.x = node.worldX - origin.x;
    node.y = node.worldY - origin.y;

    const oldParent = this.getNode(node.parentId);
    oldParent.children.delete(node.id);
    node.parentId = newParent.id;
    newParent.children.set(node.id, node);
    return node;
  }

  private isAncestorOf(ancestor: Node, node: Node | DocumentModel): boolean {
    if (node === this) {
      return false;
    }

    let current: Node | DocumentModel = node;
    while (current !== this) {
      if (current === ancestor) {
        return true;
      }
      current = this.getNode((current as Node).parentId);
    }
    return false;
  }

  private getNode(id: Node["id"] | Document["id"]): Node | DocumentModel {
    if (!id) {
      throw new Error("Node id is required");
    }

    if (id === this.id) {
      return this;
    }

    const node = this.nodeReferences.get(id);
    if (!node) {
      throw new Error("Node not found");
    }
    return node;
  }

  private clearSubtreeFromIndex(node: Node): void {
    for (const child of node.children.values()) {
      this.clearSubtreeFromIndex(child);
    }
    this.nodeReferences.delete(node.id);
  }

  deleteNode(id: Node["id"]): void {
    if (this.activeNodeId !== id) {
      throw new Error("Active node is not the node to delete");
    }

    if (this.activeNodeId === this.id) {
      throw new Error("Root node cannot be deleted");
    }

    const deleted = this.getNode(id) as Node;
    const parentNode = this.getNode(deleted.parentId);

    this.clearSubtreeFromIndex(deleted);
    parentNode.children.delete(deleted.id);
    this.activeNodeId = parentNode.id;
  }

  save(): SerializedDocument {
    const nodes: SerializedDocument["nodes"] = [];
    for (const node of this.nodeReferences.values()) {
      nodes.push({
        anchor: node.anchor,
        contentKind: node.contentKind,
        height: node.height,
        id: node.id,
        parentId: node.parentId,
        state: node.state,
        title: node.title,
        width: node.width,
        x: node.x,
        y: node.y,
        zIndex: node.zIndex,
      });
    }

    return {
      activeNodeId: this.activeNodeId,
      metadata: { ...this.metadata },
      nodes,
    };
  }

  static load(data: SerializedDocument): DocumentModel {
    const doc = new DocumentModel({ ...data.metadata });

    for (const row of data.nodes) {
      if (row.id === "root") {
        throw new Error("Root node cannot be overridden");
      }
      if (doc.nodeReferences.has(row.id)) {
        throw new Error(`Duplicate node id: ${row.id}`);
      }

      const node: Node = {
        anchor: row.anchor,
        children: new Map(),
        contentKind: row.contentKind,
        height: row.height,
        id: row.id,
        parentId: row.parentId,
        state: row.state,
        title: row.title,
        width: row.width,
        worldX: 0,
        worldY: 0,
        x: row.x,
        y: row.y,
        zIndex: row.zIndex,
      };
      doc.nodeReferences.set(node.id, node);
    }

    for (const node of doc.nodeReferences.values()) {
      let parent: Node | DocumentModel | undefined = doc.nodeReferences.get(node.parentId);
      if (node.parentId === "root") {
        parent = doc;
      }

      if (!parent) {
        throw new Error(`Parent node not found: ${node.parentId}`);
      }

      parent.children.set(node.id, node);
    }

    for (const child of doc.children.values()) {
      doc.syncWorldSubtree(child);
    }

    doc.getNode(data.activeNodeId); // Validate
    doc.activeNodeId = data.activeNodeId;
    return doc;
  }
}

export { DocumentModel };
export {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  type SerializedDocument,
  type SerializedNode,
  type Node,
  type NodeAnchor,
  type ContentKind,
  type WindowState,
  type NodeCreate,
  type NodeUpdate,
  type Document,
  type WorldPosition,
} from "./types";
