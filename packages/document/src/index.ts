import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  type Document,
  type Node,
  type NodeCreate,
  type NodeUpdate,
  type SerializedDocument,
} from "./types";

class DocumentModel implements Document {
  readonly id: Document["id"] = "root";
  readonly metadata: Document["metadata"];
  readonly nodes: Document["nodes"];
  activeNodeId: Document["activeNodeId"];

  constructor(metadata: Document["metadata"]) {
    this.metadata = metadata;
    this.nodes = new Map();
    this.activeNodeId = this.id;
  }

  get activeNode(): Node | DocumentModel {
    return this.getNode(this.activeNodeId);
  }

  private createId(): string {
    return crypto.randomUUID();
  }

  addNode(props: NodeCreate): Node {
    const node: Node = {
      anchor: props.anchor,
      contentKind: props.contentKind,
      height: props.height ?? DEFAULT_NODE_HEIGHT,
      id: this.createId(),
      state: props.state ?? "normal",
      title: props.title ?? "",
      width: props.width ?? DEFAULT_NODE_WIDTH,
      x: props.x,
      y: props.y,
      zIndex: props.zIndex ?? 0,
    };

    this.nodes.set(node.id, node);
    this.activeNodeId = node.id;
    return node;
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
    return node;
  }

  private getNode(id: Node["id"] | Document["id"]): Node | DocumentModel {
    if (!id) {
      throw new Error("Node id is required");
    }

    if (id === this.id) {
      return this;
    }

    const node = this.nodes.get(id);
    if (!node) {
      throw new Error("Node not found");
    }
    return node;
  }

  deleteNode(id: Node["id"]): void {
    if (this.activeNodeId !== id) {
      throw new Error("Active node is not the node to delete");
    }

    if (this.activeNodeId === this.id) {
      throw new Error("Root node cannot be deleted");
    }

    this.getNode(id); // Validate
    this.nodes.delete(id);
    this.activeNodeId = this.id;
  }

  save(): SerializedDocument {
    const nodes: Node[] = [];
    for (const node of this.nodes.values()) {
      nodes.push({ ...node });
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
      if (doc.nodes.has(row.id)) {
        throw new Error(`Duplicate node id: ${row.id}`);
      }
      doc.nodes.set(row.id, { ...row });
    }

    doc.getNode(data.activeNodeId); // Validate
    doc.activeNodeId = data.activeNodeId;
    return doc;
  }
}

function anchorRank(anchor: Node["anchor"]): number {
  if (anchor === "screen") {
    return 1;
  }
  return 0;
}

/**
 * Bottom-to-top paint order shared by the renderer (draw order) and
 * hit-testing (pick order), so what's drawn on top is what gets picked:
 * screen-anchored nodes (the taskbar) always sit above world-anchored ones
 * (windows), and within the same anchor a higher zIndex is on top.
 */
function comparePaintOrder(a: Node, b: Node): number {
  const rankDiff = anchorRank(a.anchor) - anchorRank(b.anchor);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return a.zIndex - b.zIndex;
}

/** The document's nodes as a new array sorted bottom-to-top. */
function paintOrder(doc: Document): Node[] {
  return [...doc.nodes.values()].toSorted(comparePaintOrder);
}

export { DocumentModel, comparePaintOrder, paintOrder };
export {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  type SerializedDocument,
  type Node,
  type NodeAnchor,
  type ContentKind,
  type WindowState,
  type NodeCreate,
  type NodeUpdate,
  type Document,
} from "./types";
