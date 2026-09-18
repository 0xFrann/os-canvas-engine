import {
  CANVAS_CONTENT_ATTRIBUTE,
  CANVAS_CONTENT_DRAWABLE,
  CANVAS_LAYOUTSUBTREE_ATTRIBUTE,
  DRAWABLE_ATTRIBUTE,
  MOUNT_NODE_ID_ATTRIBUTE,
  type Renderer,
  type RendererOptions,
} from "./types";
import { type Node, paintOrder } from "@os-canvas/document";
import { worldSizeToScreen, worldToScreen } from "@os-canvas/camera";

interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Thrown by `drawElementImage` when a drawable has been added to the DOM but
 * the browser hasn't recorded its first snapshot yet. Expected for a mount
 * created this frame. Matched on Chromium's message on purpose: the same
 * `InvalidStateError` name also covers real misconfiguration (e.g. the canvas
 * missing its layout opt-in), and swallowing that would hide it behind an
 * endless requestPaint loop — which is exactly what happened the first time
 * this ran in a browser.
 */
function isSnapshotNotReady(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    error.name === "InvalidStateError" &&
    error.message.includes("No cached paint record")
  );
}

/**
 * The mount is laid out at the node's world size (CSS px) so the browser's
 * snapshot is recorded at 1:1; zoom is applied at draw time, not in layout.
 * Minimized nodes stay mounted (so React state survives) but are made inert
 * and hidden from assistive tech, since they're not drawn anywhere.
 */
function syncMount(node: Node, element: HTMLElement): void {
  const width = `${node.width}px`;
  const height = `${node.height}px`;
  if (element.style.width !== width) {
    element.style.width = width;
  }
  if (element.style.height !== height) {
    element.style.height = height;
  }

  const hidden = node.state === "minimized";
  if (element.inert !== hidden) {
    element.inert = hidden;
  }
  if (hidden) {
    element.setAttribute("aria-hidden", "true");
  } else {
    element.removeAttribute("aria-hidden");
  }
}

/**
 * Shipped Chrome (153) records the transform `drawElementImage` was given
 * but never applies it to DOM hit-testing, so every mount would keep
 * answering pointer events at the canvas origin. Positioning the mount
 * with a CSS transform moves its hit-test box (and its a11y geometry) to
 * where it's drawn, and — per the explainer — the snapshot is recorded
 * *before* CSS transforms, so the drawn pixels are unaffected. z-index
 * mirrors paint order so the topmost drawn window is the one you click.
 */
function syncGeometry(
  node: Node,
  element: HTMLElement,
  rect: ScreenRect,
  paintIndex: number,
): void {
  let scale = 1;
  if (node.width !== 0) {
    scale = rect.width / node.width;
  }
  const transform = `translate(${rect.x}px, ${rect.y}px) scale(${scale})`;
  if (element.style.transform !== transform) {
    element.style.transform = transform;
  }
  const zIndex = String(paintIndex);
  if (element.style.zIndex !== zIndex) {
    element.style.zIndex = zIndex;
  }
}

function getContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get a 2D context from the canvas");
  }
  return ctx;
}

function createRenderer(options: RendererOptions): Renderer {
  const { canvas, doc, camera } = options;
  const ctx = getContext2d(canvas);

  canvas.setAttribute(CANVAS_CONTENT_ATTRIBUTE, CANVAS_CONTENT_DRAWABLE);
  canvas.setAttribute(CANVAS_LAYOUTSUBTREE_ATTRIBUTE, "");

  const mounts = new Map<Node["id"], HTMLElement>();
  let cssWidth = canvas.width;
  let cssHeight = canvas.height;
  let dpr = 1;

  function createMount(node: Node): HTMLElement {
    const element = canvas.ownerDocument.createElement("div");
    element.setAttribute(DRAWABLE_ATTRIBUTE, "");
    element.setAttribute(MOUNT_NODE_ID_ATTRIBUTE, node.id);
    // Needed for z-index to apply; the transform origin must match drawElementImage's (top-left).
    element.style.position = "relative";
    element.style.transformOrigin = "0 0";
    canvas.append(element);
    mounts.set(node.id, element);
    options.onMount?.(node, element);
    return element;
  }

  function removeMount(nodeId: Node["id"], element: HTMLElement): void {
    options.onUnmount?.(nodeId, element);
    element.remove();
    mounts.delete(nodeId);
  }

  function syncMounts(): void {
    for (const [nodeId, element] of mounts) {
      if (!doc.nodes.has(nodeId)) {
        removeMount(nodeId, element);
      }
    }
    for (const node of doc.nodes.values()) {
      const element = mounts.get(node.id) ?? createMount(node);
      syncMount(node, element);
    }
  }

  /** Where a node lands on screen: windows go through the camera, the taskbar doesn't (ADR 002). */
  function screenRect(node: Node): ScreenRect {
    if (node.anchor === "screen") {
      return { height: node.height, width: node.width, x: node.x, y: node.y };
    }
    const position = worldToScreen({ x: node.x, y: node.y }, camera);
    const size = worldSizeToScreen({ x: node.width, y: node.height }, camera);
    return { height: size.y, width: size.x, x: position.x, y: position.y };
  }

  function drawNode(node: Node, paintIndex: number): void {
    const element = mounts.get(node.id);
    if (!element) {
      return;
    }
    const rect = screenRect(node);
    syncGeometry(node, element, rect, paintIndex);
    try {
      ctx.drawElementImage(element, rect.x, rect.y, rect.width, rect.height);
    } catch (error) {
      if (!isSnapshotNotReady(error)) {
        throw error;
      }
      /*
       * First frame after mounting: nothing to draw yet. The browser fires
       * `paint` once the snapshot exists; ask for it explicitly too.
       */
      canvas.requestPaint();
    }
  }

  function resize(nextCssWidth: number, nextCssHeight: number, devicePixelRatio = 1): void {
    cssWidth = nextCssWidth;
    cssHeight = nextCssHeight;
    dpr = devicePixelRatio;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
  }

  function render(): void {
    syncMounts();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    if (options.background) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, cssWidth, cssHeight);
    }

    paintOrder(doc).forEach((node, paintIndex) => {
      if (node.state !== "minimized") {
        drawNode(node, paintIndex);
      }
    });
  }

  function dispose(): void {
    for (const [nodeId, element] of mounts) {
      removeMount(nodeId, element);
    }
  }

  return {
    canvas,
    dispose,
    getMount: (nodeId) => mounts.get(nodeId),
    render,
    resize,
    syncMounts,
  };
}

export { createRenderer };
export { supportsHtmlInCanvas } from "./types/html-in-canvas";
export {
  CANVAS_CONTENT_ATTRIBUTE,
  CANVAS_CONTENT_DRAWABLE,
  CANVAS_LAYOUTSUBTREE_ATTRIBUTE,
  DRAWABLE_ATTRIBUTE,
  MOUNT_NODE_ID_ATTRIBUTE,
  type Renderer,
  type RendererOptions,
} from "./types";
