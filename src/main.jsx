import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Reload the page when the service worker updates and claims this client.
// Without this, iOS PWA keeps running old JS while the new SW serves new
// assets — deleted old chunks cause module-load failures.
//
// PERO no interrumpir al usuario a mitad de una edición o con cambios sin
// guardar: la recarga en ese momento es brusca y arriesga perder el cambio.
// La app marca `window.__mpBlockReload` cuando está "ocupada" (sheet de añadir/
// editar abierto o guardado pendiente); esperamos a que se libere, con un tope
// de seguridad de 60s para que la actualización acabe aplicándose igual.
if ("serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    let waited = 0;
    const tryReload = () => {
      if (reloading) return;
      if (!window.__mpBlockReload || waited >= 60000) {
        reloading = true;
        window.location.reload();
        return;
      }
      waited += 1500;
      setTimeout(tryReload, 1500);
    };
    tryReload();
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
