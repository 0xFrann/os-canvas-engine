import { type Camera, type Vec2, screenToWorld } from "@os-canvas/camera";
import type { Document, Node } from "@os-canvas/document";

export function containsPoint(node: Node, point: Vec2): boolean {
  return (
    point.x >= node.worldX &&
    point.x <= node.worldX + node.width &&
    point.y >= node.worldY &&
    point.y <= node.worldY + node.height
  );
}

function anchorRank(anchor: Node["anchor"]): number {
  if (anchor === "screen") {
    return 1;
  }
  return 0;
}

/**
 * Paint order for picking: screen-anchored nodes (the taskbar) are always
 * drawn on top of world-anchored ones (windows), and within the same anchor
 * higher zIndex wins — matching the renderer's draw order (Step 5).
 */
function comparePaintOrder(a: Node, b: Node): number {
  const rankDiff = anchorRank(a.anchor) - anchorRank(b.anchor);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return a.zIndex - b.zIndex;
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
  doc.ensureWorld();
  const worldPoint = screenToWorld(screenPoint, camera);
  const nodes = [...doc.nodeReferences.values()].toSorted(comparePaintOrder);
  const matches = nodes.filter((node) =>
    containsPoint(node, resolvePickPoint(node, screenPoint, worldPoint)),
  );
  return matches.at(-1)?.id;
}
