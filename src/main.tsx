import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AirWatchProvider } from "./hooks/useAirWatch";
import { CloudAccountProvider } from "./hooks/useCloudAccount";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CloudAccountProvider>
      <AirWatchProvider><App /></AirWatchProvider>
    </CloudAccountProvider>
  </React.StrictMode>,
);
