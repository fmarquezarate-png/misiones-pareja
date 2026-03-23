
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
      .upsert({ id: ROW_ID, data: appData, updated_at: new Date().toISOString() })
    if (error) console.error('Save error:', error)
  } catch (e) { console.error(e); }
}
