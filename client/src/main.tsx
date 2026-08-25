import React from "react";
import ReactDOM from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { App } from "./App";
import { ToastProvider } from "./components/Toast";
import { queryClient } from "./lib/offline/queryClient";
import { persister } from "./lib/offline/persister";
import { iniciarRetomadaAutomatica } from "./lib/offline/resume";
import { iniciarFila } from "./lib/offline/fila";
import { ShellOffline } from "./lib/offline/ShellOffline";
import "./styles/theme.css";
import "./styles/base.css";
import "./styles/dashboard.css";
import "./styles/dashboard-v2.css";
import "./styles/cockpit.css";
import "./styles/forms.css";
import "./styles/acessos.css";
import "./styles/terrano-intro.css";
import "./styles/typescale.css"; // override de escala tipográfica — carregado por último (legibilidade 60+)

// Chamado uma vez no boot do módulo (não num useEffect — não é efeito de
// componente, é assinatura de processo). Ver lib/offline/resume.ts e fila.ts.
iniciarRetomadaAutomatica();
iniciarFila();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <ToastProvider>
        <ShellOffline />
        <App />
      </ToastProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
