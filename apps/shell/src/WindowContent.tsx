import type { Node } from "@os-canvas/document";

/** The reference desktop's example apps, verbatim (desktop-os-react-next `components/apps`). */
function ExampleApp() {
  return (
    <div>
      <h1>Example App</h1>
    </div>
  );
}

function ExampleTwoApp() {
  return (
    <div>
      <h1>Example Two App</h1>
    </div>
  );
}

function AppContent({ node }: { node: Node }) {
  if (node.contentKind === "example") {
    return <ExampleApp />;
  }
  if (node.contentKind === "exampletwo") {
    return <ExampleTwoApp />;
  }
  // Settings (reference: background/language grid) lands with the shadcn/ui shell in Step 7.
  return null;
}

interface WindowContentProps {
  node: Node;
  onClose: () => void;
}

/**
 * What goes *inside* a renderer mount: the reference desktop's `AppsWindow`
 * (header with centered title + close, then the app) or its dock bar.
 */
export function WindowContent({ node, onClose }: WindowContentProps) {
  if (node.contentKind === "taskbar") {
    return <div className="taskbar" />;
  }
  return (
    <div className="apps-window">
      <div className="apps-window__header">
        <span className="apps-window__header__title">{node.title}</span>
        <button
          type="button"
          className="apps-window__header__close"
          aria-label={`Close ${node.title}`}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="apps-window__content">
        <AppContent node={node} />
      </div>
    </div>
  );
}
