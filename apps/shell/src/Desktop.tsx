import { type Camera, createCamera } from "@os-canvas/camera";
import { DocumentModel, type Node } from "@os-canvas/document";
import { type Renderer, createRenderer } from "@os-canvas/renderer";
import { type Root, createRoot } from "react-dom/client";
import { useEffect, useRef } from "react";
import { WindowContent } from "./WindowContent";

declare global {
  /** Dev-only handle so `pnpm screenshot` and the devtools console can poke at the live engine. */
  // oxlint-disable-next-line no-var -- only `var` declarations land on globalThis
  var osCanvas:
    | { camera: Camera; canvas: HTMLCanvasElement; doc: DocumentModel; renderer: Renderer }
    | undefined;
}

const TASKBAR_HEIGHT = 48;

/**
 * Seeds the two example apps from the reference desktop (desktop-os-react-next)
 * open side by side, plus the taskbar. Window management (open from the
 * taskbar, drag, focus) is Step 7; this only proves the render path.
 */
function seedDocument(): { doc: DocumentModel; taskbarId: Node["id"] } {
  const doc = new DocumentModel({ name: "Desktop" });
  doc.addNode({
    anchor: "world",
    contentKind: "example",
    height: 320,
    title: "Example App",
    width: 480,
    x: 96,
    y: 72,
  });
  doc.addNode({
    anchor: "world",
    contentKind: "exampletwo",
    height: 360,
    title: "Example Two App",
    width: 560,
    x: 420,
    y: 240,
    zIndex: 1,
  });
  const taskbar = doc.addNode({
    anchor: "screen",
    contentKind: "taskbar",
    height: TASKBAR_HEIGHT,
    title: "Taskbar",
    width: 0,
    x: 0,
    y: 0,
  });
  return { doc, taskbarId: taskbar.id };
}

export function Desktop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const { doc, taskbarId } = seedDocument();
    const camera = createCamera();
    const roots = new Map<Node["id"], Root>();

    const close = (nodeId: Node["id"]) => {
      doc.selectNode(nodeId);
      doc.deleteNode(nodeId);
      canvas.requestPaint();
    };

    const renderer = createRenderer({
      camera,
      canvas,
      doc,
      onMount: (node, element) => {
        const root = createRoot(element);
        root.render(<WindowContent node={node} onClose={() => close(node.id)} />);
        roots.set(node.id, root);
      },
      onUnmount: (nodeId) => {
        roots.get(nodeId)?.unmount();
        roots.delete(nodeId);
      },
    });

    /*
     * HTML-in-Canvas fires `paint` whenever a drawable's snapshot changes
     * (the clock ticking, a new mount getting its first snapshot). Until the
     * runtime package (Step 6) exists, that event *is* the frame loop.
     */
    const paint = () => renderer.render();
    canvas.addEventListener("paint", paint);

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      renderer.resize(width, height, window.devicePixelRatio);
      // Pin the taskbar to the bottom edge of the viewport.
      doc.selectNode(taskbarId);
      doc.updateNode({ width, y: height - TASKBAR_HEIGHT });
      canvas.requestPaint();
    });
    observer.observe(canvas);

    if (import.meta.env.DEV) {
      // Lets `pnpm screenshot` (and a devtools console) poke at the live engine.
      globalThis.osCanvas = { camera, canvas, doc, renderer };
    }

    return () => {
      globalThis.osCanvas = undefined;
      observer.disconnect();
      canvas.removeEventListener("paint", paint);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="desktop" aria-label="Desktop" />;
}
