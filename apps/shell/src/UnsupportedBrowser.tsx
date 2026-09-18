export function UnsupportedBrowser() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted p-6">
      <div className="grid w-sm gap-4 rounded-xl bg-popover p-6 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10">
        <div className="grid gap-1">
          <h1 className="font-heading text-base font-medium">Sorry, this won't work here :(</h1>
          <p className="text-muted-foreground">
            Use Chrome Canary 148+ and enable{" "}
            <code className="select-all whitespace-nowrap">
              chrome://flags/#canvas-draw-element
            </code>
          </p>
        </div>
        <a
          href="https://github.com/WICG/html-in-canvas"
          target="_blank"
          rel="noreferrer"
          className="justify-self-start underline underline-offset-3 hover:text-foreground"
        >
          What is HTML-in-Canvas?
        </a>
      </div>
    </main>
  );
}
