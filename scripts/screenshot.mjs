#!/usr/bin/env node
/**
 * Loads the shell app in a headless Chrome with HTML-in-Canvas enabled and
 * saves a screenshot, so a renderer change can be *looked at*, not just
 * unit-tested. No dependencies: talks CDP over Node's built-in WebSocket.
 *
 *   pnpm screenshot                       # http://localhost:5173 → screenshot.png
 *   URL=http://localhost:5174 OUT=x.png pnpm screenshot
 *   CHROME="/path/to/Chrome" pnpm screenshot
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
    { deviceScaleFactor: 1, height, mobile: false, width },
    sessionId,
  );
  await send("Page.navigate", { url }, sessionId);
  await new Promise((r) => setTimeout(r, waitMs));

  const { result } = await send(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const canvas = document.querySelector("canvas");
        if (!canvas) return { supported: "drawElementImage" in CanvasRenderingContext2D.prototype, canvas: null };
        return {
          supported: "drawElementImage" in CanvasRenderingContext2D.prototype,
          canvas: { width: canvas.width, height: canvas.height, content: canvas.getAttribute("content"), layoutsubtree: canvas.hasAttribute("layoutsubtree") },
          mounts: [...canvas.querySelectorAll("[drawable]")].map((el) => ({
            id: el.dataset.nodeId, layout: el.offsetWidth + "x" + el.offsetHeight, inert: el.inert, text: el.textContent.slice(0, 40),
          })),
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
