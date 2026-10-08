import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { page } from "vite-plus/test/browser";
import App from "../src/App.tsx";

let currentRoot: Root | null = null;

export async function cleanupApp(): Promise<void> {
  if (currentRoot !== null) {
    await act(async () => {
      currentRoot?.unmount();
    });
    currentRoot = null;
  }
  const rootElement = document.getElementById("root");
  if (rootElement !== null) {
    rootElement.innerHTML = "";
  }
}

function getOrCreateRootContainer(): HTMLElement {
  let container = document.getElementById("root");
  if (container === null) {
    container = document.createElement("div");
    container.id = "root";
    document.body.appendChild(container);
  }
  return container;
}

export async function renderApp() {
  await cleanupApp();
  const container = getOrCreateRootContainer();

  currentRoot = createRoot(container);
  await act(async () => {
    currentRoot?.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });

  return Object.assign(page, { container });
}
