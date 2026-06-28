import { useEffect, useState } from "react";
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
  cadastros: <><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></>,
  config: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  "reb-dashboard": <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  "reb-animal": <><circle cx="12" cy="9" r="5"/><path d="M5 21c1-4 4-6 7-6s6 2 7 6"/></>,
  "reb-reproducao": <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>,
  "reb-sanidade": <path d="M12 6v12M6 12h12"/>,
  "reb-nutricao": <path d="M12 21c5-3 8-7 8-12 0-1.5-.5-3-1-4-3 0-7 1-9 4s-2 8-2 12c2-2 4-3 6-4"/>,
  "reb-producao": <><path d="M8 3h8l-1 4H9z"/><path d="M9 7l-2 4v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8l-2-4"/><path d="M7 13h10"/></>,
  "reb-estoque": <><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M3 8l9 5 9-5"/></>,
  "reb-custo": <><path d="M12 2v20"/><path d="M17 6.5a4 4 0 0 0-4-2.5h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5"/></>,
  "reb-ia": <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>,
  // — Plantio — ícones simbólicos para cada sub-aba.
  "pla-dashboard": <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  "pla-talhao": <><path d="M3 12h18M12 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/></>,
  "pla-fenologia": <><circle cx="12" cy="12" r="9"/><path d="M12 3v9l5 3"/></>,
  "pla-fitossanidade": <><path d="M12 2c2 4 5 7 5 11a5 5 0 0 1-10 0c0-4 3-7 5-11z"/><path d="M9 11c0-2 1.5-3 3-3"/></>,
  "pla-nutricao": <><path d="M4 19l4-4 3 3 5-5 4 4"/><path d="M4 4h16v16H4z" fill="none"/></>,
  "pla-colheita": <><path d="M4 14l8-10 8 10"/><path d="M6 14h12l-2 7H8z"/></>,
  "pla-estoque": <><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M3 8l9 5 9-5"/></>,
  "pla-custo": <><path d="M12 2v20"/><path d="M17 6.5a4 4 0 0 0-4-2.5h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5"/></>,
  "pla-ia": <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>,
};

type ModuloId = string;
type SubItem = { id: Tab; label: string };
type Modulo = { id: ModuloId; label: string; icon: JSX.Element; subs: SubItem[]; disabled?: boolean };

// Registrar um novo módulo operacional (Plantio, Gado de corte, Olericultura, etc.)
// é só adicionar uma entrada aqui. O acordeão e o estado persistido funcionam
// automaticamente para qualquer item da lista.
const MODULOS: Modulo[] = [
  {
    id: "rebanho",
    label: "Rebanho leiteiro",
    icon: <><circle cx="12" cy="10" r="5"/><path d="M7 8c-1-2-3-2-3 0M17 8c1-2 3-2 3 0"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></>,
    subs: [
      { id: "reb-dashboard", label: "Painel" },
      { id: "reb-animal", label: "Animal" },
      { id: "reb-reproducao", label: "Reprodução" },
      { id: "reb-sanidade", label: "Sanidade" },
      { id: "reb-nutricao", label: "Nutrição" },
      { id: "reb-producao", label: "Produção" },
      { id: "reb-estoque", label: "Estoque" },
      { id: "reb-custo", label: "Custo" },
      { id: "reb-ia", label: "IA do rebanho" },
    ],
  },
  {
    id: "plantio",
    label: "Plantio · café",
    icon: <><path d="M12 22V11"/><path d="M12 11c-3 0-6-2-6-6 3 0 6 2 6 6z"/><path d="M12 11c3 0 6-2 6-6-3 0-6 2-6 6z"/></>,
    subs: [
      { id: "pla-dashboard", label: "Painel" },
      { id: "pla-talhao", label: "Talhão" },
      { id: "pla-fenologia", label: "Fenologia" },
      { id: "pla-fitossanidade", label: "Fitossanidade" },
      { id: "pla-nutricao", label: "Nutrição & solo" },
      { id: "pla-colheita", label: "Colheita" },
      { id: "pla-estoque", label: "Estoque" },
      { id: "pla-custo", label: "Custo" },
      { id: "pla-ia", label: "IA da lavoura" },
    ],
  },
  {
    id: "corte",
    label: "Gado de corte",
    icon: <><circle cx="12" cy="11" r="5"/><path d="M6 7L3 4M18 7l3-3"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></>,
    subs: [],
    disabled: true,
  },
];

const STORAGE_KEY = "rionovo:sidebar:openModulo";

function moduloOfTab(t: Tab): ModuloId | null {
  for (const m of MODULOS) {
    if (m.subs.some((s) => s.id === t)) return m.id;
  }
  return null;
}

function Item({ id, label, current, onNav, nested }: { id: Tab; label: string; current: Tab; onNav: (t: Tab) => void; nested?: boolean }) {
  return (
    <button
      className={"navi" + (current === id ? " on" : "") + (nested ? " is-nested" : "")}
      onClick={() => onNav(id)}
      title={label}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>{ICON[id]}</svg>
      <span className="navi-label">{label}</span>
    </button>
  );
}

function ModuloHeader({ m, isOpen, isActive, onToggle }: { m: Modulo; isOpen: boolean; isActive: boolean; onToggle: () => void }) {
  return (
    <button
      className={"modulo-h" + (isActive ? " is-active" : "") + (m.disabled ? " is-disabled" : "")}
      onClick={m.disabled ? undefined : onToggle}
      aria-expanded={isOpen}
      disabled={m.disabled}
      title={m.label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{m.icon}</svg>
      <span className="modulo-label">{m.label}</span>
      {m.disabled ? (
        <span className="modulo-badge">em breve</span>
      ) : (
        <svg className={"modulo-chev" + (isOpen ? " is-open" : "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6"/>
        </svg>
      )}
    </button>
  );
}

export function AppSidebar({ current, onNav, financeiro, isAdmin, mobileOpen, onMobileToggle }: {
  current: Tab; onNav: (t: Tab) => void; financeiro: { id: Tab; label: string }[];
  isAdmin: boolean;
  mobileOpen: boolean; onMobileToggle: (open: boolean) => void;
}) {
  const [openModulo, setOpenModulo] = useState<ModuloId | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && MODULOS.some((m) => m.id === stored && !m.disabled)) return stored;
    } catch { /* ignora SSR / storage indisponível */ }
    return moduloOfTab(current) ?? MODULOS.find((m) => !m.disabled)?.id ?? null;
  });

  // Abre automaticamente o módulo da aba atual quando o usuário navega via outro caminho
  // (ex.: link do Dashboard que pula direto pro reb-animal).
  useEffect(() => {
    const m = moduloOfTab(current);
    if (m && m !== openModulo) setOpenModulo(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, openModulo ?? ""); } catch { /* noop */ }
  }, [openModulo]);

  // relabel financeiro: "IA" -> "IA financeira"
  const fin = financeiro.map((t) => (t.id === "ia" ? { ...t, label: "IA financeira" } : t));
  // wrapper: clicar em qualquer aba fecha o drawer no mobile
  const nav = (t: Tab) => { onNav(t); onMobileToggle(false); };

  const toggleModulo = (id: ModuloId) => setOpenModulo((cur) => (cur === id ? null : id));

  return (
    <>
      <div className={"rb-side-backdrop" + (mobileOpen ? " is-open" : "")} onClick={() => onMobileToggle(false)} />
      <aside className={"rb-side" + (mobileOpen ? " is-open" : "")}>
        <div className="grp">Visão &amp; gestão</div>
        {fin.map((t) => <Item key={t.id} id={t.id} label={t.label} current={current} onNav={nav} />)}

        <div className="grp">Operações</div>
        {MODULOS.map((m) => {
          const isOpen = openModulo === m.id && !m.disabled;
          const isActive = m.subs.some((s) => s.id === current);
          return (
            <div key={m.id} className={"modulo" + (isOpen ? " is-open" : "")}>
              <ModuloHeader m={m} isOpen={isOpen} isActive={isActive} onToggle={() => toggleModulo(m.id)} />
              {isOpen && (
                <div className="modulo-subs">
                  {m.subs.map((s) => <Item key={s.id} id={s.id} label={s.label} current={current} onNav={nav} nested />)}
                </div>
              )}
            </div>
          );
        })}

        <div className="spacer" />

        <div className="grp">Administração</div>
        <Item id="cadastros" label="Cadastros" current={current} onNav={nav} />
        <Item id="config" label="Configurações" current={current} onNav={nav} />
        {isAdmin && <Item id="acessos" label="Acessos" current={current} onNav={nav} />}
      </aside>
    </>
  );
}
