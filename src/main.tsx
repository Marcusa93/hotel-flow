import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register the push service worker at startup so subscribed devices receive
// pushes even if they never open Settings → Notificaciones (registration is
// idempotent — usePushNotifications keeps its own call too).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
