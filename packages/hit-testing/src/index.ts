import { type Camera, type Vec2, screenToWorld } from "@os-canvas/camera";
import { type Document, type Node, paintOrder } from "@os-canvas/document";

export function containsPoint(node: Node, point: Vec2): boolean {
  return (
    point.x >= node.x &&
    point.x <= node.x + node.width &&
    point.y >= node.y &&
    point.y <= node.y + node.height
  );
}

function resolvePickPoint(node: Node, screenPoint: Vec2, worldPoint: Vec2): Vec2 {
  if (node.anchor === "screen") {
    return screenPoint;
  }
  return worldPoint;
}

/**
 * Picks the topmost node under a screen-space point. World-anchored nodes
 * are tested against the camera-resolved world point; screen-anchored nodes
 * (the taskbar) are tested against the raw screen point, unaffected by pan
 * or zoom.
 */
export function hitTest(doc: Document, camera: Camera, screenPoint: Vec2): Node["id"] | undefined {
  const worldPoint = screenToWorld(screenPoint, camera);
  const matches = paintOrder(doc).filter((node) =>
    containsPoint(node, resolvePickPoint(node, screenPoint, worldPoint)),
  );
  return matches.at(-1)?.id;
}
