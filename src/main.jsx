import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Reload the page when the service worker updates and claims this client.
// Without this, iOS PWA keeps running old JS while the new SW serves new
// assets — deleted old chunks cause module-load failures.
if ("serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Fade out the pre-React splash screen once the JS bundle has loaded and
// React has taken over. requestAnimationFrame ensures we wait for the first
// painted frame so there's no gap between splash disappearing and app appearing.
requestAnimationFrame(() => {
  const splash = document.getElementById("mp-splash");
  if (!splash) return;
  splash.classList.add("mp-hidden");
  setTimeout(() => splash.remove(), 380);
});
