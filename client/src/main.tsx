import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ToastProvider } from "./components/Toast";
import "./styles/base.css";
import "./styles/dashboard.css";
import "./styles/dashboard-v2.css";
import "./styles/cockpit.css";
import "./styles/forms.css";
import "./styles/datepicker.css";
import "./styles/acessos.css";
import "./styles/simulador.css";
import "./styles/vigilancia.css";
import "./rebanho/styles/rebanho.css";
import "./styles/command-palette.css";
import "./styles/typescale.css"; // override de escala tipográfica — carregado por último (legibilidade 60+)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);
