import type { Document, Node, WorldPosition } from "@os-canvas/document";

export function getWorldPosition(doc: Document, nodeId: Node["id"]): WorldPosition {
  doc.ensureWorld();
  const node = doc.nodeReferences.get(nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }
  return { x: node.worldX, y: node.worldY };
}

export type { WorldPosition } from "@os-canvas/document";
