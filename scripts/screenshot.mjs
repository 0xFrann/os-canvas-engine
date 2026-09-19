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
 *   KEYS="Tab;Tab;Shift+Tab;Ctrl+Backquote" pnpm screenshot  # press keys in order, reporting what each one focuses
 *   PIXEL_AT="100,600" pnpm screenshot    # read those canvas pixels back (what the canvas itself is painted with)
 *   REGION_AT="200,200,64,64" pnpm screenshot  # ...or a region's mean and spread (flat fill vs texture)
 *   TRACE_AT="100,600" pnpm screenshot    # ...and watch that pixel from the first frame on, reporting every change
 *   RESIZE=800x600 pnpm screenshot        # resize the viewport mid-run (what a re-layout costs)
 *   RELOAD=1 pnpm screenshot              # reload at the end (what survives: localStorage)
 *   SIZE=800x600 pnpm screenshot          # start at a viewport other than 1280x800
 *   DPR=2 pnpm screenshot                 # emulate a 2x display
 *
 * One run does its actions in this order: CLICK (selectors), then DRAG, then CLICK_AT (points),
 * then KEYS, then RESIZE, then RELOAD. Selectors act on the page's own chrome — a dock icon that
 * opens a window — so they go first; points act on what is *drawn*, which those windows are, so
 * they come next and can use where a drag left something; keys act on whatever the pointer left
 * focused, so they follow; and the two that change the whole page come last, so everything above
 * has happened before the viewport changes or the page is reloaded.
 * While any of it happens, the page counts the canvas's `paint` events and the pointer events the
 * drag produced, and the summary reports them — that's how repaint rate gets looked at.
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
const pixelAt = points(process.env.PIXEL_AT);
const regionAt = points(process.env.REGION_AT);
const [traceAt] = points(process.env.TRACE_AT) ?? [];
const resize = process.env.RESIZE?.split("x").map(Number);
const reload = process.env.RELOAD;
const drag = process.env.DRAG?.split(":").map((p) => p.split(",").map(Number));
const dragSteps = Number(process.env.DRAG_STEPS ?? 24);
const dragStepMs = Number(process.env.DRAG_STEP_MS ?? 8);
const keys = process.env.KEYS?.split(";");

/**
 * The keys a desktop is driven with, by `KeyboardEvent.code`. A synthetic key needs the virtual
 * key code as well as the name, or Chrome dispatches the event without doing what the key does —
 * Tab in particular moves focus from the code, not from `key`.
 *
 * `text` is the other half of that: a `rawKeyDown` reaches the page but runs no default action, so
 * Enter on a focused button does nothing at all. The keys that carry text are sent as a full
 * `keyDown` instead, which is what makes Enter *press* the button it is on.
 */
const KEY_CODES = {
  Backquote: { key: "`", keyCode: 192 },
  Enter: { key: "Enter", keyCode: 13, text: "\r" },
  Escape: { key: "Escape", keyCode: 27 },
  Tab: { key: "Tab", keyCode: 9 },
};
/** CDP's modifier bitmask. */
const MODIFIERS = { Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 };

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

/*
 * A browser already listening on this port is a *different* browser, with a different profile.
 * Talking to it works — and quietly gives this run someone else's `localStorage` and someone
 * else's pages, which is how a value that looks persisted turns out to be one a run hours ago left
 * behind. Refuse instead, and say how to get out of it.
 */
const portInUse = await fetch(`http://localhost:${port}/json/version`).then(
  () => true,
  () => false,
);
if (portInUse) {
  throw new Error(
    `Something is already debugging on port ${port} — a browser a previous run left behind, most likely. ` +
      `Close it (pkill -f remote-debugging-port=${port}) or use CDP_PORT=<other>.`,
  );
}

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

/** Asks the browser to close, for the `finally` below. Set once the connection is up. */
let closeBrowser = null;

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
  // Fire and forget: a browser that is shutting down never answers.
  closeBrowser = () => ws.send(JSON.stringify({ id: ++nextId, method: "Browser.close" }));

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
  /* A headless window is never the OS's focused window, so without this the page reports no focus
     and Tab moves nothing. */
  await send("Emulation.setFocusEmulationEnabled", { enabled: true }, sessionId);
  /*
   * What the canvas is painted with at one point, from the very first frame on — installed before
   * the page exists, because the question it answers is what the desktop looked like *before* React
   * had settled (a wallpaper read from storage must not flash the other one). Only the changes are
   * kept, so an unchanging pixel is one entry.
   */
  if (traceAt) {
    await send(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source: `(() => {
          const [x, y] = ${JSON.stringify(traceAt)};
          const trace = [];
          window.__trace = trace;
          const sample = (canvas) => {
            try {
              const { data } = canvas.getContext("2d").getImageData(
                Math.round(x * devicePixelRatio), Math.round(y * devicePixelRatio), 1, 1);
              return "rgba(" + data[0] + "," + data[1] + "," + data[2] + "," + data[3] + ")";
            } catch (error) { return "unreadable: " + error.name; }
          };
          /* Driven by the canvas's own paint event, not by a frame loop: a rAF callback runs
             *before* the frame is painted, so it reads the canvas one render behind and reports a
             blank frame that was never on screen. Listening for paint — and reading straight
             after, so the engine's own handler has already drawn — records what each render
             actually left behind, first one included. */
          const watch = (canvas) => {
            trace.push({ value: "canvas in the page", ms: Math.round(performance.now()) });
            canvas.addEventListener("paint", () => {
              const value = sample(canvas);
              const last = trace.at(-1);
              if (!last || last.value !== value) trace.push({ value, ms: Math.round(performance.now()) });
            });
          };
          const find = () => {
            const canvas = document.querySelector("canvas");
            if (canvas) { watch(canvas); return; }
            if (performance.now() < ${waitMs}) requestAnimationFrame(find);
          };
          requestAnimationFrame(find);
        })()`,
      },
      sessionId,
    );
  }

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
  /*
   * Where the keyboard is, said the way this desktop thinks about it: which drawable the focused
   * element is in (a window), or that it is page chrome, plus whether it is the mount itself
   * rather than a control inside it.
   */
  const ACTIVE_ELEMENT = `(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "body (nothing focused)";
    const mount = el.closest("[drawable]");
    const label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 16);
    const what = el === mount ? "the mount" : el.tagName.toLowerCase() + (label ? ' "' + label + '"' : "");
    const where = mount
      ? "drawable z" + mount.style.zIndex + " " + mount.textContent.trim().slice(0, 16)
      : (el.closest(".desktop") ? "desktop chrome" : "the page");
    return what + " in " + where;
  })()`;
  /** The draw order as one line, back to front — which window a shortcut just brought forward. */
  const DRAW_ORDER = `[...document.querySelectorAll("canvas [drawable]")]
    .toSorted((a, b) => Number(a.style.zIndex) - Number(b.style.zIndex))
    .map((el) => el.textContent.trim().slice(0, 12) + " z" + el.style.zIndex)
    .join(" | ")`;

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

  /** Counts paint and pointer events in the page. Installed again after a reload, which drops it. */
  const installProbe = () =>
    probe(`(() => {
      const counts = { paints: 0, pointerdown: 0, pointermove: 0, pointerup: 0, since: performance.now() };
      window.__probe = counts;
      document.querySelector("canvas")?.addEventListener("paint", () => counts.paints++);
      for (const type of ["pointerdown", "pointermove", "pointerup"]) {
        window.addEventListener(type, () => counts[type]++, true);
      }
    })()`);
  const acting = drag || click || clickAt || hover || keys || resize || reload;

  if (acting) {
    await installProbe();
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

  if (keys) {
    // Sequential on purpose: each key acts on whatever the one before it focused.
    /* oxlint-disable no-await-in-loop */
    for (const spec of keys) {
      const parts = spec.split("+");
      const code = parts.pop();
      const named = KEY_CODES[code];
      if (!named) {
        throw new Error(`KEYS: no key named ${code} (known: ${Object.keys(KEY_CODES).join(", ")})`);
      }
      let modifiers = 0;
      for (const part of parts) {
        if (!MODIFIERS[part]) {
          throw new Error(`KEYS: no modifier named ${part}`);
        }
        modifiers |= MODIFIERS[part];
      }
      let down = "rawKeyDown";
      if (named.text) {
        down = "keyDown";
      }
      for (const type of [down, "keyUp"]) {
        const event = {
          code,
          key: named.key,
          modifiers,
          nativeVirtualKeyCode: named.keyCode,
          type,
          windowsVirtualKeyCode: named.keyCode,
        };
        if (type === down) {
          event.text = named.text;
        }
        await send("Input.dispatchKeyEvent", event, sessionId);
      }
      await new Promise((r) => setTimeout(r, 300));
      const report = await probe(`(() => {
        const { paints } = window.__probe;
        window.__probe.paints = 0;
        return { active: ${ACTIVE_ELEMENT}, order: ${DRAW_ORDER}, paints };
      })()`);
      let order = "";
      if (report.order) {
        order = ` — order ${report.order}`;
      }
      console.log(
        `pressed ${spec}: focus on ${report.active}, ${report.paints} paint events${order}`,
      );
    }
    /* oxlint-enable no-await-in-loop */
  }

  if (resize) {
    const [resizedWidth, resizedHeight] = resize;
    await send(
      "Emulation.setDeviceMetricsOverride",
      { deviceScaleFactor: dpr, height: resizedHeight, mobile: false, width: resizedWidth },
      sessionId,
    );
    await new Promise((r) => setTimeout(r, 500));
    const paints = await probe(`(() => {
      const { paints } = window.__probe;
      window.__probe.paints = 0;
      return paints;
    })()`);
    console.log(`resized to ${resizedWidth}x${resizedHeight}: ${paints} paint events`);
  }

  if (reload) {
    await send("Page.reload", {}, sessionId);
    await new Promise((r) => setTimeout(r, waitMs));
    // The page is new, so its counters are gone with it.
    await installProbe();
    await new Promise((r) => setTimeout(r, 500));
    const paints = await probe(`(() => {
      const { paints } = window.__probe;
      window.__probe.paints = 0;
      return paints;
    })()`);
    console.log(`reloaded: ${paints} paint events in the 500ms after it settled`);
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

  if (acting) {
    /* A second of nothing *after* the interactions, not just before them: a repaint loop is as
       easy to open by leaving something focused or hovered as by a bad write in the paint pass. */
    await new Promise((r) => setTimeout(r, 1000));
    const idle = await probe(`(() => {
      const { paints } = window.__probe;
      window.__probe.paints = 0;
      return paints;
    })()`);
    console.log(`idle afterwards: ${idle} paint events in 1000ms`);
  }

  const { result } = await send(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const canvas = document.querySelector("canvas");
        if (!canvas) return { supported: "drawElementImage" in CanvasRenderingContext2D.prototype, canvas: null };
        return {
          supported: "drawElementImage" in CanvasRenderingContext2D.prototype,
          active: ${ACTIVE_ELEMENT},
          canvas: {
            width: canvas.width, height: canvas.height, content: canvas.getAttribute("content"), layoutsubtree: canvas.hasAttribute("layoutsubtree"),
            // What the *element* is painted with, as opposed to what the engine drew into it.
            cssBackground: getComputedStyle(canvas).backgroundColor, cssRect: (() => { const r = canvas.getBoundingClientRect(); return [r.width, r.height].map(Math.round).join("x"); })(),
          },
          viewport: innerWidth + "x" + innerHeight + " @" + devicePixelRatio,
          elementApi: Object.getOwnPropertyNames(CanvasRenderingContext2D.prototype).filter((n) => /element/i.test(n)),
          mounts: [...canvas.querySelectorAll("[drawable]")].map((el) => {
            const r = el.getBoundingClientRect();
            return {
              domRect: [r.x, r.y, r.width, r.height].map(Math.round).join(" "), zIndex: el.style.zIndex, inert: el.inert, tabindex: el.getAttribute("tabindex"), text: el.textContent.slice(0, 40),
            };
          }),
          // Who a click at each HIT_AT point would reach: the drawable that owns the topmost element there.
          hits: ${JSON.stringify(hitAt ?? [])}.map(([x, y]) => {
            const el = document.elementFromPoint(x, y);
            const mount = el && el.closest("[drawable]");
            const owner = mount ? "drawable z" + mount.style.zIndex + " " + mount.textContent.slice(0, 20) : (el ? el.tagName.toLowerCase() + (el.closest(".desktop") ? " in .desktop" : " outside .desktop") : "nothing");
            return x + "," + y + " -> " + owner;
          }),
          // What the canvas is actually painted with at each point, read back out of its own pixels.
          pixels: ${JSON.stringify(pixelAt ?? [])}.map(([x, y]) => {
            const ctx = canvas.getContext("2d");
            try {
              const { data } = ctx.getImageData(Math.round(x * devicePixelRatio), Math.round(y * devicePixelRatio), 1, 1);
              const hex = "#" + [data[0], data[1], data[2]].map((c) => c.toString(16).padStart(2, "0")).join("");
              return x + "," + y + " -> " + hex + " alpha " + data[3];
            } catch (error) { return x + "," + y + " -> unreadable: " + error.name; }
          }),
          /* A region's mean and standard deviation, which is how "there is texture in there" gets a
             number: a flat fill reads 0 spread, anything grainy does not. */
          regions: ${JSON.stringify(regionAt ?? [])}.map(([x, y, w, h]) => {
            const ctx = canvas.getContext("2d");
            try {
              const { data } = ctx.getImageData(Math.round(x * devicePixelRatio), Math.round(y * devicePixelRatio), Math.round(w * devicePixelRatio), Math.round(h * devicePixelRatio));
              const luma = [];
              let sum = 0, squares = 0;
              for (let i = 0; i < data.length; i += 4) { const l = (data[i] + data[i + 1] + data[i + 2]) / 3; luma.push(l); sum += l; squares += l * l; }
              const mean = sum / luma.length;
              /* Spread says how much the region varies at all — a gradient varies plenty. The
                 average step between neighbouring pixels says how much of it is *per pixel*, which
                 is what distinguishes texture from a smooth ramp. */
              const pixels = Math.round(w * devicePixelRatio);
              let steps = 0, pairs = 0;
              for (let i = 0; i < luma.length; i++) { if ((i + 1) % pixels !== 0) { steps += Math.abs(luma[i + 1] - luma[i]); pairs++; } }
              return x + "," + y + " " + w + "x" + h + " -> mean " + mean.toFixed(2) + ", sd " + Math.sqrt(squares / luma.length - mean * mean).toFixed(3) + ", step " + (steps / pairs).toFixed(3);
            } catch (error) { return x + "," + y + " -> unreadable: " + error.name; }
          }),
          trace: window.__trace,
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
  closeBrowser();
  closeBrowser = null;
  ws.close();
} finally {
  /* SIGTERM on its own has been seen to leave a headless browser running — and then it holds the
     port, and every later run silently borrows its profile. Ask it to close, give it a moment,
     then signal it anyway. */
  closeBrowser?.();
  await new Promise((r) => setTimeout(r, 300));
  proc.kill();
}
