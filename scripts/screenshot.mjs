#!/usr/bin/env node
/**
 * Loads the shell app in a headless Chrome with HTML-in-Canvas enabled and
 * saves a screenshot, so a renderer change can be *looked at*, not just
 * unit-tested. No dependencies: talks CDP over Node's built-in WebSocket.
 *
 *   pnpm screenshot                       # http://localhost:5173 → screenshot.png
 *   URL=http://localhost:5174 OUT=x.png pnpm screenshot
 *   CHROME="/path/to/Chrome" pnpm screenshot
 *   CLICK="button" pnpm screenshot        # click the first match (center of its DOM rect) before shooting
 *   CLICK=".a;.b" pnpm screenshot         # ...or several selectors, in order (open one app, then another)
 *   HOVER=".dock-app" pnpm screenshot     # leave the pointer over the first match (hover states, tooltips)
 *   CLICK_AT="300,200" pnpm screenshot    # click at page coordinates instead (where something is *drawn*)
 *   CLICK_AT="300,200;520,340" pnpm screenshot  # ...or several, in order (raise one thing, then use it)
 *   DRAG="300,200:520,340" pnpm screenshot  # press, move in steps, release (DRAG_STEPS=n, DRAG_STEP_MS=ms)
 *   HIT_AT="300,200;520,340" pnpm screenshot  # report which drawable owns those points (who a click would reach)
 *   DPR=2 pnpm screenshot                 # emulate a 2x display
 *
 * One run does its actions in this order: CLICK (selectors), then DRAG, then CLICK_AT (points).
 * Selectors act on the page's own chrome — a dock icon that opens a window — so they go first;
 * points act on what is *drawn*, which those windows are, so they go last and can use where a drag
 * left something. While any of it happens, the page counts the canvas's `paint` events and the
 * pointer events the drag produced, and the summary reports them — that's how repaint rate gets
 * looked at.
 *
 * Also prints console output from the page and a summary of the canvas's
 * drawable mounts, which is usually enough to tell *why* a screenshot is blank.
 */
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const url = process.env.URL ?? "http://localhost:5173/";
const out = process.env.OUT ?? "screenshot.png";
const waitMs = Number(process.env.WAIT_MS ?? 3000);
const port = Number(process.env.CDP_PORT ?? 9333);
const [width, height] = (process.env.SIZE ?? "1280x800").split("x").map(Number);
const click = process.env.CLICK?.split(";");
const hover = process.env.HOVER;
const dpr = Number(process.env.DPR ?? 1);
/** `x,y` or `x1,y1;x2,y2;…` — one point, or several to visit in order. */
const points = (value) => value?.split(";").map((p) => p.split(",").map(Number));
const clickAt = points(process.env.CLICK_AT);
const hitAt = points(process.env.HIT_AT);
const drag = process.env.DRAG?.split(":").map((p) => p.split(",").map(Number));
const dragSteps = Number(process.env.DRAG_STEPS ?? 24);
const dragStepMs = Number(process.env.DRAG_STEP_MS ?? 8);

function findChrome() {
  if (process.env.CHROME) {
    return process.env.CHROME;
  }
  const candidates = [
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  // Playwright's cached "Chrome for Testing" builds, newest first.
  const cache = join(homedir(), "Library/Caches/ms-playwright");
  if (existsSync(cache)) {
    const builds = readdirSync(cache)
      .filter((d) => /^chromium-\d+$/.test(d))
      .toSorted()
      .toReversed();
    for (const build of builds) {
      candidates.unshift(
        join(
          cache,
          build,
          "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        ),
      );
    }
  }
  const found = candidates.find((c) => existsSync(c));
  if (!found) {
    throw new Error("No Chrome found. Set CHROME=/path/to/chrome binary.");
  }
  return found;
}

const chrome = findChrome();
const profile = mkdtempSync(join(tmpdir(), "os-canvas-shot-"));
const proc = spawn(
  chrome,
  [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=${width},${height}`,
    // The chrome://flags/#canvas-draw-element runtime feature.
    "--enable-blink-features=CanvasDrawElement",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

// Polling on purpose: each attempt depends on the previous one failing.
/* oxlint-disable no-await-in-loop */
async function waitForCdp() {
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/json/version`);
      return await response.json();
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("Chrome did not open its debugging port");
}
/* oxlint-enable no-await-in-loop */

try {
  const version = await waitForCdp();
  console.log(`${version.Browser} — ${chrome}`);
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));

  let nextId = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener("message", ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled") {
      logs.push(
        `console.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(" ")}`,
      );
    } else if (msg.method === "Runtime.exceptionThrown") {
      logs.push(
        `exception: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`,
      );
    } else if (msg.method === "Log.entryAdded") {
      logs.push(`log.${msg.params.entry.level}: ${msg.params.entry.text}`);
    }
  });
  const send = (method, params, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (msg) => {
        if (msg.error) {
          reject(new Error(`${method}: ${msg.error.message}`));
          return;
        }
        resolve(msg.result);
      });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const { targetId } = await send("Target.createTarget", {
    height,
    newWindow: true,
    url: "about:blank",
    width,
  });
  const { sessionId } = await send("Target.attachToTarget", { flatten: true, targetId });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Log.enable", {}, sessionId);
  await send(
    "Emulation.setDeviceMetricsOverride",
    { deviceScaleFactor: dpr, height, mobile: false, width },
    sessionId,
  );
  await send("Page.navigate", { url }, sessionId);
  await new Promise((r) => setTimeout(r, waitMs));

  /*
   * Counts what the browser does on its own (idle) and then what the drag/click causes. The page
   * is the only place that can see `paint` events, so the counters live there.
   */
  const probe = (expression) =>
    send("Runtime.evaluate", { expression, returnByValue: true }, sessionId).then(
      (r) => r.result.value,
    );
  /** Where to aim at a selector: the center of the first match's DOM rect, or null. */
  const centerOf = (selector) =>
    probe(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
  /** Clicks each target in turn, reporting what one cost in paint events. */
  const clickTargets = async (targets) => {
    // Sequential on purpose: press must land before release, and one click before the next.
    /* oxlint-disable no-await-in-loop */
    for (const { label, point } of targets) {
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
        await send(
          "Input.dispatchMouseEvent",
          { button: "left", clickCount: 1, type, ...point },
          sessionId,
        );
      }
      await new Promise((r) => setTimeout(r, 500));
      const paints = await probe(`(() => {
        const { paints } = window.__probe;
        window.__probe.paints = 0;
        return paints;
      })()`);
      console.log(
        `clicked ${label} at ${Math.round(point.x)},${Math.round(point.y)}: ${paints} paint events`,
      );
    }
    /* oxlint-enable no-await-in-loop */
  };

  if (drag || click || clickAt || hover) {
    await probe(`(() => {
      const counts = { paints: 0, pointerdown: 0, pointermove: 0, pointerup: 0, since: performance.now() };
      window.__probe = counts;
      document.querySelector("canvas")?.addEventListener("paint", () => counts.paints++);
      for (const type of ["pointerdown", "pointermove", "pointerup"]) {
        window.addEventListener(type, () => counts[type]++, true);
      }
    })()`);
    // A second of nothing: any paint counted here is the engine painting itself in a loop.
    await new Promise((r) => setTimeout(r, 1000));
    const idle = await probe(`(() => {
      const { paints, since } = window.__probe;
      Object.assign(window.__probe, { paints: 0, pointerdown: 0, pointermove: 0, pointerup: 0, since: performance.now() });
      return { paints, ms: Math.round(performance.now() - since) };
    })()`);
    console.log(`idle: ${idle.paints} paint events in ${idle.ms}ms`);
  }

  if (click) {
    /*
     * Each selector is resolved right before it is clicked, on purpose: a click can add the
     * element that the next one matches (a dock icon opens the window whose close button follows).
     */
    /* oxlint-disable no-await-in-loop */
    for (const selector of click) {
      const point = await centerOf(selector);
      if (!point) {
        throw new Error(`CLICK: nothing matches ${selector}`);
      }
      await clickTargets([{ label: selector, point }]);
    }
    /* oxlint-enable no-await-in-loop */
  }

  if (drag) {
    const [[fromX, fromY], [toX, toY]] = drag;
    // Sequential on purpose: a press, then moves in order, then the release.
    /* oxlint-disable no-await-in-loop */
    await send(
      "Input.dispatchMouseEvent",
      { button: "left", buttons: 0, type: "mouseMoved", x: fromX, y: fromY },
      sessionId,
    );
    await send(
      "Input.dispatchMouseEvent",
      { button: "left", buttons: 1, clickCount: 1, type: "mousePressed", x: fromX, y: fromY },
      sessionId,
    );
    for (let step = 1; step <= dragSteps; step++) {
      const t = step / dragSteps;
      await send(
        "Input.dispatchMouseEvent",
        {
          button: "left",
          buttons: 1,
          type: "mouseMoved",
          x: Math.round(fromX + (toX - fromX) * t),
          y: Math.round(fromY + (toY - fromY) * t),
        },
        sessionId,
      );
      await new Promise((r) => setTimeout(r, dragStepMs));
    }
    await send(
      "Input.dispatchMouseEvent",
      { button: "left", buttons: 0, clickCount: 1, type: "mouseReleased", x: toX, y: toY },
      sessionId,
    );
    /* oxlint-enable no-await-in-loop */
    await new Promise((r) => setTimeout(r, 300));
    const counts = await probe(`(() => {
      const { paints, pointerdown, pointermove, pointerup, since } = window.__probe;
      Object.assign(window.__probe, { paints: 0, pointerdown: 0, pointermove: 0, pointerup: 0, since: performance.now() });
      return { paints, pointerdown, pointermove, pointerup, ms: Math.round(performance.now() - since) };
    })()`);
    console.log(
      `dragged (${fromX}, ${fromY}) → (${toX}, ${toY}) in ${dragSteps} moves: ` +
        `${counts.pointermove} pointermove, ${counts.paints} paint events in ${counts.ms}ms ` +
        `(down ${counts.pointerdown}, up ${counts.pointerup})`,
    );
  }

  if (clickAt) {
    await clickTargets(clickAt.map(([x, y]) => ({ label: `(${x}, ${y})`, point: { x, y } })));
  }

  if (hover) {
    const point = await centerOf(hover);
    if (!point) {
      throw new Error(`HOVER: nothing matches ${hover}`);
    }
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point }, sessionId);
    // Long enough for a hover transition to finish and a tooltip to render.
    await new Promise((r) => setTimeout(r, 500));
    const paints = await probe(`(() => {
      const { paints } = window.__probe;
      window.__probe.paints = 0;
      return paints;
    })()`);
    console.log(
      `hovering ${hover} at ${Math.round(point.x)},${Math.round(point.y)}: ${paints} paint events`,
    );
  }

  const { result } = await send(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const canvas = document.querySelector("canvas");
        if (!canvas) return { supported: "drawElementImage" in CanvasRenderingContext2D.prototype, canvas: null };
        return {
          supported: "drawElementImage" in CanvasRenderingContext2D.prototype,
          canvas: { width: canvas.width, height: canvas.height, content: canvas.getAttribute("content"), layoutsubtree: canvas.hasAttribute("layoutsubtree") },
          elementApi: Object.getOwnPropertyNames(CanvasRenderingContext2D.prototype).filter((n) => /element/i.test(n)),
          mounts: [...canvas.querySelectorAll("[drawable]")].map((el) => {
            const r = el.getBoundingClientRect();
            return {
              domRect: [r.x, r.y, r.width, r.height].map(Math.round).join(" "), zIndex: el.style.zIndex, inert: el.inert, text: el.textContent.slice(0, 40),
            };
          }),
          // Who a click at each HIT_AT point would reach: the drawable that owns the topmost element there.
          hits: ${JSON.stringify(hitAt ?? [])}.map(([x, y]) => {
            const el = document.elementFromPoint(x, y);
            const mount = el && el.closest("[drawable]");
            const owner = mount ? "drawable z" + mount.style.zIndex + " " + mount.textContent.slice(0, 20) : (el ? el.tagName.toLowerCase() + (el.closest(".desktop") ? " in .desktop" : " outside .desktop") : "nothing");
            return x + "," + y + " -> " + owner;
          }),
        };
      })()`,
      returnByValue: true,
    },
    sessionId,
  );
  console.log(JSON.stringify(result.value, null, 2));
  for (const line of logs.filter((l) => !l.includes("[vite]") && !l.includes("React DevTools"))) {
    console.log(line);
  }

  const { data } = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  writeFileSync(out, Buffer.from(data, "base64"));
  console.log(`saved ${out}`);
  ws.close();
} finally {
  proc.kill();
}
