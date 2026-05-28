import { useEffect, useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Relatorio } from "./pages/Relatorio";
import { Mensal } from "./pages/Mensal";
import { Diario } from "./pages/Diario";
import { Lancamentos } from "./pages/Lancamentos";
import { Cadastros } from "./pages/Cadastros";
import { Fechamento } from "./pages/Fechamento";
import { Login } from "./pages/Login";
import { clearToken, download, getToken, setUnauthorizedHandler } from "./api";

type Tab = "painel" | "relatorio" | "mensal" | "diario" | "lancamentos" | "cadastros" | "fechamento";

const TABS: { id: Tab; label: string }[] = [
  { id: "painel", label: "Painel" },
  { id: "relatorio", label: "Resultado Operacional" },
  { id: "mensal", label: "Mensal" },
  { id: "diario", label: "Diário" },
  { id: "lancamentos", label: "Lançamentos" },
  { id: "cadastros", label: "Cadastros" },
  { id: "fechamento", label: "Fechamento" },
];

export function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState<Tab>("painel");

  useEffect(() => {
    setUnauthorizedHandler(() => setAuthed(false));
  }, []);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🐄</span>
          <div>
            <h1>Fazenda Rio Novo</h1>
            <small>Gestão financeira · regime de caixa</small>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-export ghost" onClick={() => download("/relatorios/completo.xlsx", "Relatório Rio Novo.xlsx")}>
            ⬇ Planilha completa
          </button>
          <button className="btn-logout" onClick={() => { clearToken(); setAuthed(false); }}>
            Sair
          </button>
        </div>
      </header>
      <nav className="tabs main-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        {tab === "painel" && <Dashboard />}
        {tab === "relatorio" && <Relatorio />}
        {tab === "mensal" && <Mensal />}
        {tab === "diario" && <Diario />}
        {tab === "lancamentos" && <Lancamentos />}
        {tab === "cadastros" && <Cadastros />}
        {tab === "fechamento" && <Fechamento />}
      </main>
    </div>
  );
}
