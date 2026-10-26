import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, useClerk } from "@clerk/react";
import { App } from "./App";
import { ToastProvider } from "./components/Toast";
import "./styles/theme.css";
import "./styles/base.css";
import "./styles/dashboard.css";
import "./styles/dashboard-v2.css";
import "./styles/cockpit.css";
import "./styles/forms.css";
import "./styles/acessos.css";
import "./styles/auth.css";
import "./styles/terrano-intro.css";
import "./styles/typescale.css";

function ClerkLogoutBridge() {
  const { signOut } = useClerk();

  useEffect(() => {
    const sair = () => void signOut();
    window.addEventListener("terrano:logout", sair);
    return () => window.removeEventListener("terrano:logout", sair);
  }, [signOut]);

  return null;
}

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function Aplicacao() {
  if (!publishableKey) {
    return <main className="grid min-h-screen place-items-center bg-[#edf2ed] p-6 text-center text-[#203c39]">
      <p>Configure VITE_CLERK_PUBLISHABLE_KEY para iniciar o acesso Terrano.</p>
    </main>;
  }

  return <ClerkProvider publishableKey={publishableKey}>
    <ClerkLogoutBridge />
    <ToastProvider><App /></ToastProvider>
  </ClerkProvider>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><Aplicacao /></React.StrictMode>,
);
