import { describe, expect, it, vi } from "vitest";
import { DocumentModel } from "@os-canvas/document";
import { createCamera } from "@os-canvas/camera";
import { createRenderer } from "../index";

const win = { anchor: "world" as const, contentKind: "notes" as const };
const bar = { anchor: "screen" as const, contentKind: "taskbar" as const };

/**
 * Hand-rolled DOM stand-ins: no jsdom knows `drawElementImage` anyway, and the
 * renderer only touches a handful of element APIs.
 */
class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly style: Record<string, string> = {};
  inert = false;
  parent: FakeElement | null = null;
  children: FakeElement[] = [];

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  append(child: FakeElement): void {
    child.parent = this;
    this.children.push(child);
  }
  remove(): void {
    if (!this.parent) {
      return;
    }
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
}

function fakeCanvas(width = 800, height = 600) {
  const ctx = {
    clearRect: vi.fn(),
    drawElementImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    setTransform: vi.fn(),
  };
  const canvas = Object.assign(new FakeElement(), {
    getContext: () => ctx,
    height,
    ownerDocument: { createElement: () => new FakeElement() },
    requestPaint: vi.fn(),
    width,
  });
  return { canvas: canvas as unknown as HTMLCanvasElement, ctx, raw: canvas };
}

function setup(width?: number, height?: number) {
  const doc = new DocumentModel({ name: "Desktop" });
  const camera = createCamera();
  const { canvas, ctx, raw } = fakeCanvas(width, height);
  return { camera, canvas, ctx, doc, raw };
}

describe("createRenderer", () => {
  it("opts the canvas into drawable content", () => {
    const { canvas, doc, camera, raw } = setup();
    createRenderer({ camera, canvas, doc });
    expect(raw.getAttribute("content")).toBe("drawable");
  });

  it("throws when the canvas has no 2D context", () => {
    const { doc, camera, raw } = setup();
    const canvas = Object.assign(raw, { getContext: () => null }) as unknown as HTMLCanvasElement;
    expect(() => createRenderer({ camera, canvas, doc })).toThrow("2D context");
  });
});

describe("syncMounts", () => {
  it("creates one drawable mount per node, sized to the node, and reports it", () => {
    const { canvas, doc, camera, raw } = setup();
    const onMount = vi.fn();
    const renderer = createRenderer({ camera, canvas, doc, onMount });
    const node = doc.addNode({ height: 120, width: 200, x: 10, y: 20, ...win });

    renderer.syncMounts();

    const mount = renderer.getMount(node.id) as unknown as FakeElement;
    expect(mount).toBeDefined();
    expect(mount.parent).toBe(raw);
    expect(mount.hasAttribute("drawable")).toBe(true);
    expect(mount.getAttribute("data-node-id")).toBe(node.id);
    expect(mount.style).toEqual({ height: "120px", width: "200px" });
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onMount).toHaveBeenCalledWith(node, mount);
  });

  it("is idempotent: a second sync neither re-creates nor re-reports mounts", () => {
    const { canvas, doc, camera, raw } = setup();
    const onMount = vi.fn();
    const renderer = createRenderer({ camera, canvas, doc, onMount });
    doc.addNode({ x: 0, y: 0, ...win });

    renderer.syncMounts();
    renderer.syncMounts();

    expect(raw.children).toHaveLength(1);
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it("follows node resizes", () => {
    const { canvas, doc, camera } = setup();
    const renderer = createRenderer({ camera, canvas, doc });
    const node = doc.addNode({ height: 100, width: 100, x: 0, y: 0, ...win });
    renderer.syncMounts();

    doc.updateNode({ height: 300, width: 400 });
    renderer.syncMounts();

    const mount = renderer.getMount(node.id) as unknown as FakeElement;
    expect(mount.style).toEqual({ height: "300px", width: "400px" });
  });

  it("removes the mount and reports it when a node is deleted", () => {
    const { canvas, doc, camera, raw } = setup();
    const onUnmount = vi.fn();
    const renderer = createRenderer({ camera, canvas, doc, onUnmount });
    const node = doc.addNode({ x: 0, y: 0, ...win });
    renderer.syncMounts();
    const mount = renderer.getMount(node.id);

    doc.deleteNode(node.id);
    renderer.syncMounts();

    expect(renderer.getMount(node.id)).toBeUndefined();
    expect(raw.children).toHaveLength(0);
    expect(onUnmount).toHaveBeenCalledWith(node.id, mount);
  });

  it("makes minimized mounts inert and hidden from assistive tech, and restores them", () => {
    const { canvas, doc, camera } = setup();
    const renderer = createRenderer({ camera, canvas, doc });
    const node = doc.addNode({ x: 0, y: 0, ...win });
    renderer.syncMounts();
    const mount = renderer.getMount(node.id) as unknown as FakeElement;

    doc.updateNode({ state: "minimized" });
    renderer.syncMounts();
    expect(mount.inert).toBe(true);
    expect(mount.getAttribute("aria-hidden")).toBe("true");

    doc.updateNode({ state: "normal" });
    renderer.syncMounts();
    expect(mount.inert).toBe(false);
    expect(mount.hasAttribute("aria-hidden")).toBe(false);
  });
});

describe("render", () => {
  it("clears the whole canvas, fills the background, then draws", () => {
    const { canvas, doc, camera, ctx } = setup(800, 600);
    const renderer = createRenderer({ background: "#123", camera, canvas, doc });
    doc.addNode({ x: 0, y: 0, ...win });

    renderer.render();

    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.fillStyle).toBe("#123");
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
    const [clearOrder] = ctx.clearRect.mock.invocationCallOrder;
    const [drawOrder] = ctx.drawElementImage.mock.invocationCallOrder;
    expect(clearOrder).toBeLessThan(drawOrder);
  });

  it("skips the background fill when none is configured", () => {
    const { canvas, doc, camera, ctx } = setup();
    createRenderer({ camera, canvas, doc }).render();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("draws a world node through the camera: position and size scale with zoom", () => {
    const { canvas, doc, camera, ctx } = setup();
    camera.x = 50;
    camera.y = 25;
    camera.zoom = 2;
    const renderer = createRenderer({ camera, canvas, doc });
    const node = doc.addNode({ height: 120, width: 200, x: 100, y: 50, ...win });

    renderer.render();

    const mount = renderer.getMount(node.id);
    expect(ctx.drawElementImage).toHaveBeenCalledWith(mount, 100, 50, 400, 240);
  });

  it("draws a screen node at its raw coordinates regardless of the camera", () => {
    const { canvas, doc, camera, ctx } = setup();
    camera.x = 5000;
    camera.y = 5000;
    camera.zoom = 3;
    const renderer = createRenderer({ camera, canvas, doc });
    const taskbar = doc.addNode({ height: 48, width: 800, x: 0, y: 752, ...bar });

    renderer.render();

    const mount = renderer.getMount(taskbar.id);
    expect(ctx.drawElementImage).toHaveBeenCalledWith(mount, 0, 752, 800, 48);
  });

  it("draws in paint order: world nodes by zIndex, then screen nodes on top", () => {
    const { canvas, doc, camera, ctx } = setup();
    const renderer = createRenderer({ camera, canvas, doc });
    const taskbar = doc.addNode({ x: 0, y: 0, ...bar });
    const top = doc.addNode({ x: 0, y: 0, ...win, zIndex: 5 });
    const bottom = doc.addNode({ x: 0, y: 0, ...win, zIndex: 1 });

    renderer.render();

    const drawn = ctx.drawElementImage.mock.calls.map((call) => call[0]);
    expect(drawn).toEqual([
      renderer.getMount(bottom.id),
      renderer.getMount(top.id),
      renderer.getMount(taskbar.id),
    ]);
  });

  it("does not draw minimized nodes", () => {
    const { canvas, doc, camera, ctx } = setup();
    const renderer = createRenderer({ camera, canvas, doc });
    doc.addNode({ x: 0, y: 0, ...win, state: "minimized" });
    const shown = doc.addNode({ x: 0, y: 0, ...win });

    renderer.render();

    expect(ctx.drawElementImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawElementImage.mock.calls[0]?.[0]).toBe(renderer.getMount(shown.id));
  });

  it("applies the device pixel ratio from resize while keeping CSS-pixel coordinates", () => {
    const { canvas, doc, camera, ctx, raw } = setup();
    const renderer = createRenderer({ camera, canvas, doc });
    doc.addNode({ height: 100, width: 100, x: 10, y: 10, ...win });

    renderer.resize(1024, 768, 2);
    renderer.render();

    expect(raw.width).toBe(2048);
    expect(raw.height).toBe(1536);
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1024, 768);
    expect(ctx.drawElementImage).toHaveBeenCalledWith(expect.anything(), 10, 10, 100, 100);
  });

  it("requests a paint and keeps going when a mount has no snapshot yet", () => {
    const { canvas, doc, camera, ctx, raw } = setup();
    const renderer = createRenderer({ camera, canvas, doc });
    doc.addNode({ x: 0, y: 0, ...win, zIndex: 0 });
    const second = doc.addNode({ x: 0, y: 0, ...win, zIndex: 1 });
    ctx.drawElementImage.mockImplementationOnce(() => {
      throw new DOMException("No cached paint record for element.", "InvalidStateError");
    });

    expect(() => renderer.render()).not.toThrow();

    expect(raw.requestPaint).toHaveBeenCalledTimes(1);
    expect(ctx.drawElementImage).toHaveBeenCalledTimes(2);
    expect(ctx.drawElementImage.mock.calls[1]?.[0]).toBe(renderer.getMount(second.id));
  });

  it("rethrows any other drawElementImage error", () => {
    const { canvas, doc, camera, ctx } = setup();
    const renderer = createRenderer({ camera, canvas, doc });
    doc.addNode({ x: 0, y: 0, ...win });
    ctx.drawElementImage.mockImplementationOnce(() => {
      throw new DOMException("Element is not a canvas descendant.", "NotSupportedError");
    });

    expect(() => renderer.render()).toThrow("not a canvas descendant");
  });
});

describe("dispose", () => {
  it("removes every mount and reports each one", () => {
    const { canvas, doc, camera, raw } = setup();
    const onUnmount = vi.fn();
    const renderer = createRenderer({ camera, canvas, doc, onUnmount });
    doc.addNode({ x: 0, y: 0, ...win });
    doc.addNode({ x: 0, y: 0, ...bar });
    renderer.render();

    renderer.dispose();

    expect(raw.children).toHaveLength(0);
    expect(onUnmount).toHaveBeenCalledTimes(2);
  });
});
