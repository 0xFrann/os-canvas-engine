const DEFAULT_NODE_WIDTH = 480;
const DEFAULT_NODE_HEIGHT = 320;

/**
 * `world` nodes sit on the pannable/zoomable desktop surface (windows).
 * `screen` nodes are pinned to fixed viewport coordinates regardless of
 * camera pan/zoom (the taskbar). Both are drawn inside the same canvas —
 * see ADR 002.
 */
type NodeAnchor = "world" | "screen";

/**
 * Which app a window hosts. The app list mirrors the reference desktop
 * (desktop-os-react-next `APPS_DATA`): Example and Settings from the dock,
 * Example Two from the desktop grid. `taskbar` is the one non-window kind.
 */
type ContentKind = "example" | "exampletwo" | "settings" | "taskbar";

type WindowState = "normal" | "minimized" | "maximized";

interface Node {
  id: string;
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

type NodeUpdate = Partial<Pick<Node, "x" | "y" | "width" | "height" | "zIndex" | "state">>;

type NodeCreate = Pick<Node, "x" | "y" | "anchor" | "contentKind"> &
  Partial<Pick<Node, "width" | "height" | "title" | "zIndex" | "state">>;

interface Document {
  readonly id: string;
  readonly metadata: {
    name: string;
  };
  readonly nodes: Map<Node["id"], Node>;
  activeNodeId: Node["id"] | Document["id"];
  readonly activeNode: Node | Document;

  addNode(props: NodeCreate): Node;
  selectNode(id: Node["id"] | Document["id"]): void;
  updateNode(patch: NodeUpdate): Node;
  deleteNode(id: Node["id"]): void;
  save(): SerializedDocument;
}

interface SerializedDocument {
  metadata: Document["metadata"];
  nodes: Node[];
  activeNodeId: Node["id"] | Document["id"];
}

export {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  type NodeAnchor,
  type ContentKind,
  type WindowState,
  type Node,
  type NodeUpdate,
  type NodeCreate,
  type Document,
  type SerializedDocument,
};
