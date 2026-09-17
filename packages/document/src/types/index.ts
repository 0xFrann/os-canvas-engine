interface WorldPosition {
  x: number;
  y: number;
}

const DEFAULT_NODE_WIDTH = 480;
const DEFAULT_NODE_HEIGHT = 320;

/**
 * `world` nodes sit on the pannable/zoomable desktop surface (windows).
 * `screen` nodes are pinned to fixed viewport coordinates regardless of
 * camera pan/zoom (the taskbar). Both are drawn inside the same canvas —
 * see ADR 002.
 */
type NodeAnchor = "world" | "screen";

type ContentKind = "clock" | "notes" | "about" | "taskbar";

type WindowState = "normal" | "minimized" | "maximized";

interface Node {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  worldX: number;
  worldY: number;
  children: Map<Node["id"], Node>;
  parentId: Node["id"];
  anchor: NodeAnchor;
  title: string;
  contentKind: ContentKind;
  zIndex: number;
  state: WindowState;
}

type NodeUpdate = Partial<Pick<Node, "x" | "y" | "width" | "height" | "zIndex" | "state">>;

type NodeCreate = Pick<Node, "x" | "y" | "anchor" | "contentKind"> &
  Partial<Pick<Node, "width" | "height" | "title" | "zIndex" | "state">>;

interface Document {
  readonly id: string;
  readonly metadata: {
    name: string;
  };
  readonly children: Node["children"];
  readonly nodeReferences: Node["children"];
  activeNodeId: Node["id"] | Document["id"];
  readonly activeNode: Node | Document;

  addNode(props: NodeCreate): Node;
  selectNode(id: Node["id"] | Document["id"]): void;
  updateNode(patch: NodeUpdate): Node;
  reparentNode(newParentId: Node["id"] | Document["id"]): Node;
  deleteNode(id: Node["id"]): void;
  ensureWorld(): void;
  /** How many times a dirty root was flushed via ensureWorld (demo / teaching). */
  worldSyncCount: number;
  save(): SerializedDocument;
}

interface SerializedNode {
  id: Node["id"];
  parentId: Node["id"];
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: NodeAnchor;
  title: string;
  contentKind: ContentKind;
  zIndex: number;
  state: WindowState;
}

interface SerializedDocument {
  metadata: Document["metadata"];
  nodes: SerializedNode[];
  activeNodeId: Node["id"] | Document["id"];
}

export {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  type WorldPosition,
  type NodeAnchor,
  type ContentKind,
  type WindowState,
  type Node,
  type NodeUpdate,
  type NodeCreate,
  type Document,
  type SerializedNode,
  type SerializedDocument,
};
