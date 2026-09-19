/**
 * Every program the desktop can run, and the one thing a program may ask the desktop for.
 *
 * An app is content: it fills a window's content slot and nothing else (ADR 004). So this package
 * depends on `@os-canvas/ui` and on nothing that draws — not the binding, not the engine, and never
 * the desktop, which is what imports *it*.
 */
export { Counter } from "./Counter";
export { ExampleApp } from "./ExampleApp";
export { Settings } from "./Settings";
export { DesktopProvider, useDesktop, type Desktop, type DesktopBackground } from "./desktop";
