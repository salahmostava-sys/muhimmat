import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

const CHUNK_RELOAD_KEY = "__chunk_reload_once__";

const shouldHandleChunkError = (message: string) => {
  const m = message.toLowerCase();
  return (
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("dynamically imported module") ||
    m.includes("chunkloaderror") ||
    m.includes("loading chunk")
  );
};

const reloadOnceForChunkError = () => {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  globalThis.location.reload();
};

globalThis.addEventListener("vite:preloadError", () => {
  reloadOnceForChunkError();
});

globalThis.addEventListener("unhandledrejection", (event) => {
  const message =
    (event.reason && (event.reason.message || String(event.reason))) || "";
  if (shouldHandleChunkError(message)) {
    event.preventDefault();
    reloadOnceForChunkError();
  }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
