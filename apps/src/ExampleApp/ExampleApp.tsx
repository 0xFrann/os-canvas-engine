/**
 * The reference desktop's Example app, ported as it is: one heading, which is all
 * `components/apps/ExampleApp.tsx` renders there. Its window title is the `label` the reference's
 * `appsConstants` gives it, so the pair reads the same as it does in the reference.
 */
export function ExampleApp() {
  return <h1 className="p-4 text-xl font-semibold">Example App</h1>;
}
