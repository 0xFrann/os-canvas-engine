import type { Document, Node } from "@os-canvas/document";
import type { Camera } from "@os-canvas/camera";

/** Attribute the renderer sets on the canvas so its descendants get laid out. */
const CANVAS_CONTENT_ATTRIBUTE = "content";
const CANVAS_CONTENT_DRAWABLE = "drawable";
/** Attribute a canvas descendant needs before `drawElementImage` accepts it. */
const DRAWABLE_ATTRIBUTE = "drawable";
/** Set on every mount so the DOM ↔ document link is inspectable in devtools. */
const MOUNT_NODE_ID_ATTRIBUTE = "data-node-id";

interface RendererOptions {
  canvas: HTMLCanvasElement;
  doc: Document;
  camera: Camera;
  /** Optional desktop background fill (CSS color). Transparent when omitted. */
  background?: string;
  /**
   * Called once per node when its mount element is created. The renderer owns
   * the element's lifecycle and size; the host owns everything *inside* it
   * (see ADR 004). Typically: mount a React root here.
   */
  onMount?: (node: Node, element: HTMLElement) => void;
  /** Called once per node right before its mount element is removed. */
  onUnmount?: (nodeId: Node["id"], element: HTMLElement) => void;
}

interface Renderer {
  readonly canvas: HTMLCanvasElement;
  /**
   * Sizes the canvas backing store to `cssWidth × cssHeight` CSS pixels at
   * the given device pixel ratio. All node coordinates stay in CSS pixels.
   */
  resize(cssWidth: number, cssHeight: number, devicePixelRatio?: number): void;
  /** Creates/removes/resizes mount elements to match `doc.nodes`. Called by `render`. */
  syncMounts(): void;
  /** Clears the canvas and draws every non-minimized node in paint order. */
  render(): void;
  getMount(nodeId: Node["id"]): HTMLElement | undefined;
  /** Removes every mount element. The canvas itself is left alone. */
  dispose(): void;
}

export {
  CANVAS_CONTENT_ATTRIBUTE,
  CANVAS_CONTENT_DRAWABLE,
  DRAWABLE_ATTRIBUTE,
  MOUNT_NODE_ID_ATTRIBUTE,
  type RendererOptions,
  type Renderer,
};
