export function UnsupportedBrowser() {
  return (
    <main className="unsupported">
      <h1>This demo needs HTML-in-Canvas</h1>
      <p>
        os-canvas-engine renders every window through Chrome's experimental{" "}
        <a href="https://github.com/WICG/html-in-canvas" target="_blank" rel="noreferrer">
          HTML-in-Canvas API
        </a>
        . It isn't in stable Chrome yet — there's no fallback renderer here on purpose, this is a
        tech demo built specifically to explore the new API.
      </p>
      <ol>
        <li>
          Open this page in <strong>Chrome Canary 148+</strong>.
        </li>
        <li>
          Visit <code>chrome://flags/#canvas-draw-element</code> and enable the flag.
        </li>
        <li>Relaunch Chrome and reload this page.</li>
      </ol>
    </main>
  );
}
