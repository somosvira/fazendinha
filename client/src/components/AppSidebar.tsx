import { useState } from "react";
import { PAPEIS, type User } from "../data/acessos";
import type { Tab } from "./Shell";

// ícones simples (single-path) por chave — reusa os do rebanho onde aplicável
const ICON: Partial<Record<Tab, JSX.Element>> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  gastos: <><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></>,
  lancar: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/></>,
  plano: <><path d="M4 6h16M4 12h16M4 18h10"/></>,
  relatorio: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
  ia: <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>,
  acessos: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/></>,
  "reb-dashboard": <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  "reb-animal": <><circle cx="12" cy="9" r="5"/><path d="M5 21c1-4 4-6 7-6s6 2 7 6"/></>,
  "reb-reproducao": <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>,
  "reb-sanidade": <path d="M12 6v12M6 12h12"/>,
  "reb-nutricao": <path d="M12 21c5-3 8-7 8-12 0-1.5-.5-3-1-4-3 0-7 1-9 4s-2 8-2 12c2-2 4-3 6-4"/>,
  "reb-ia": <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>,
};

const REBANHO_ITENS: { id: Tab; label: string }[] = [
  { id: "reb-dashboard", label: "Painel" },
  { id: "reb-animal", label: "Animal" },
  { id: "reb-reproducao", label: "Reprodução" },
  { id: "reb-sanidade", label: "Sanidade" },
  { id: "reb-nutricao", label: "Nutrição" },
  { id: "reb-ia", label: "IA do rebanho" },
];

function Item({ id, label, current, onNav }: { id: Tab; label: string; current: Tab; onNav: (t: Tab) => void }) {
  return (
    <button className={"navi" + (current === id ? " on" : "")} onClick={() => onNav(id)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{ICON[id]}</svg>
      {label}
    </button>
  );
}

export function AppSidebar({ current, onNav, financeiro, isAdmin, user, allUsers, onSwitchUser }: {
  current: Tab; onNav: (t: Tab) => void; financeiro: { id: Tab; label: string }[];
  isAdmin: boolean; user: User; allUsers: User[] | null; onSwitchUser: (id: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const papelNome = (u: User) => (u.papel === "personalizado" ? "Personalizado" : PAPEIS[u.papel]?.nome || "");
  // relabel financeiro: "IA" -> "IA financeira"
  const fin = financeiro.map((t) => (t.id === "ia" ? { ...t, label: "IA financeira" } : t));
  return (
    <aside className="rb-side">
      <div className="brand">
        <div className="lg">Rio Novo</div>
        <div className="farm"><span>🌾 Sítio São Francisco</span><span>▾</span></div>
      </div>

      <div className="grp">Financeiro</div>
      {fin.map((t) => <Item key={t.id} id={t.id} label={t.label} current={current} onNav={onNav} />)}

      <div className="grp">Rebanho</div>
      {REBANHO_ITENS.map((t) => <Item key={t.id} id={t.id} label={t.label} current={current} onNav={onNav} />)}

      <div className="spacer" />

      {isAdmin && <Item id="acessos" label="Acessos" current={current} onNav={onNav} />}

      <div className="user" style={{ position: "relative", cursor: allUsers ? "pointer" : "default" }} onClick={() => allUsers && setMenu((o) => !o)}>
        <div className="av">{user.inicial}</div>
        <div><div className="nm">{user.nome.split(" ")[0]}</div><div className="rl">{papelNome(user)}</div></div>
        {allUsers && <span style={{ marginLeft: "auto", color: "var(--mast-ink-2)" }}>▾</span>}
        {menu && allUsers && (
          <div className="user-menu" onClick={(e) => e.stopPropagation()}>
            <div className="user-menu-head">Entrar como (demonstração)</div>
            {allUsers.map((u) => (
              <button key={u.id} className="user-menu-opt" onClick={() => { onSwitchUser(u.id); setMenu(false); }}>
                <span className="umo-av">{u.inicial}</span>
                <span className="umo-info"><div className="umo-nome">{u.nome}</div><div className="umo-papel">{papelNome(u)}</div></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
