import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";
import { ErrorBoundary } from "@shared/components/ErrorBoundary";
import { installGlobalErrorMonitoring } from "@shared/lib/logger";
import { isLikelyStaleChunkError, reloadOnceForStaleChunk } from "@shared/lib/chunkLoadRecovery";

globalThis.addEventListener("vite:preloadError", () => {
  reloadOnceForStaleChunk();
});

globalThis.addEventListener("unhandledrejection", (event) => {
  const message =
    (event.reason && (event.reason.message || String(event.reason))) || "";
  if (isLikelyStaleChunkError(message)) {
    event.preventDefault();
    reloadOnceForStaleChunk();
  }
});

installGlobalErrorMonitoring();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
