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
  "pla-planejamento": <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v4M16 3v4M4 9h16M9 14l2 2 4-4"/></>,
  "pla-estoque": <><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M3 8l9 5 9-5"/></>,
  "pla-custo": <><path d="M12 2v20"/><path d="M17 6.5a4 4 0 0 0-4-2.5h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5"/></>,
  "pla-ia": <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>,
  // — Corte (gado de corte) — ícones simbólicos.
  "cor-dashboard": <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  "cor-lote": <><circle cx="8" cy="11" r="3"/><circle cx="16" cy="11" r="3"/><path d="M4 20c0-2 2-4 4-4M16 16c2 0 4 2 4 4"/></>,
  "cor-pesagem": <><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 10v4M12 9v5M16 11v3"/></>,
  "cor-pasto": <><path d="M3 19c2-1 4-1 6 0M9 19c2-1 4-1 6 0M15 19c2-1 4-1 6 0"/><path d="M5 14v5M9 12v7M13 14v5M17 12v7"/></>,
  "cor-sanidade": <path d="M12 6v12M6 12h12"/>,
  "cor-nutricao": <path d="M12 21c5-3 8-7 8-12 0-1.5-.5-3-1-4-3 0-7 1-9 4s-2 8-2 12c2-2 4-3 6-4"/>,
  "cor-comercial": <><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>,
  "cor-custo": <><path d="M12 2v20"/><path d="M17 6.5a4 4 0 0 0-4-2.5h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5"/></>,
  "cor-ia": <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>,
  // — Milho (cultivo) — ícones simbólicos.
  "mil-safras": <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></>,
  "mil-custos": <><path d="M5 3h14v18l-2-1.5L15 21l-2-1.5L11 21l-2-1.5L7 21l-2-1.5z"/><path d="M9 8h6M9 12h6"/></>,
  "mil-producao": <><path d="M12 21V8"/><path d="M12 12c-2 0-4-1.5-4-4 2 0 4 1.5 4 4zM12 12c2 0 4-1.5 4-4-2 0-4 1.5-4 4zM12 17c-2 0-4-1.5-4-4 2 0 4 1.5 4 4zM12 17c2 0 4-1.5 4-4-2 0-4 1.5-4 4z"/></>,
  "mil-silos": <><path d="M6 21V8a6 6 0 0 1 12 0v13"/><path d="M6 12h12M6 16h12"/><path d="M4 21h16"/></>,
  "mil-custo": <><path d="M12 2v20"/><path d="M17 6.5a4 4 0 0 0-4-2.5h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5"/></>,
  // — Equipe & Ponto — ícones simbólicos.
  "eqp-funcionarios": <><circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-4 3.5-6 7-6s6 2 7 6"/><path d="M16 4a3.5 3.5 0 0 1 0 7"/></>,
  "eqp-ponto": <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  "eqp-folha": <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
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
      { id: "pla-planejamento", label: "Planejamento" },
      { id: "pla-estoque", label: "Estoque" },
      { id: "pla-custo", label: "Custo" },
      { id: "pla-ia", label: "IA da lavoura" },
    ],
  },
  {
    id: "corte",
    label: "Gado de corte",
    icon: <><circle cx="12" cy="11" r="5"/><path d="M6 7L3 4M18 7l3-3"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></>,
    // Módulo liberado (Onda 1 — núcleo lê/escreve em /api/corte/*).
    subs: [
      { id: "cor-dashboard", label: "Painel" },
      { id: "cor-lote", label: "Lote" },
      { id: "cor-pesagem", label: "Pesagem" },
      { id: "cor-pasto", label: "Pasto" },
      { id: "cor-sanidade", label: "Sanidade" },
      { id: "cor-nutricao", label: "Nutrição" },
      { id: "cor-comercial", label: "Comercial" },
      { id: "cor-custo", label: "Custo" },
      { id: "cor-ia", label: "IA do plantel" },
    ],
  },
  {
    id: "cultivo",
    label: "Milho",
    icon: <><path d="M12 22v-5"/><path d="M12 17c-3 0-5.5-2.8-5.5-6.5C6.5 6.5 9 3 12 2c3 1 5.5 4.5 5.5 8.5C17.5 14.2 15 17 12 17z"/><path d="M12 6v11M9 9c1 .8 2 1.2 3 1.2s2-.4 3-1.2M9 13c1 .8 2 1.2 3 1.2s2-.4 3-1.2"/></>,
    // Culturas anuais (crop-agnostic via `cultura` no backend) — MILHO é o 1º caso.
    subs: [
      { id: "mil-safras", label: "Safras" },
      { id: "mil-custos", label: "Custos" },
      { id: "mil-producao", label: "Produção" },
      { id: "mil-silos", label: "Silos" },
      { id: "mil-custo", label: "Custo" },
    ],
  },
  {
    id: "equipe",
    label: "Equipe & Ponto",
    icon: <><circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-4 3.5-6 7-6s6 2 7 6"/><path d="M16 4a3.5 3.5 0 0 1 0 7"/></>,
    // Módulo de RH leve (admin gerencia) — funcionários, ponto e folha.
    subs: [
      { id: "eqp-funcionarios", label: "Funcionários" },
      { id: "eqp-ponto", label: "Ponto" },
      { id: "eqp-folha", label: "Folha" },
    ],
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
      aria-disabled={m.disabled || undefined}
      disabled={m.disabled}
      title={m.disabled ? `${m.label} — em breve` : m.label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{m.icon}</svg>
      <span className="modulo-label">{m.label}</span>
      {m.disabled ? (
        <span className="modulo-lock" aria-label="em breve">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2"/>
            <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
          </svg>
          <span className="modulo-lock-txt">em breve</span>
        </span>
      ) : (
        <svg className={"modulo-chev" + (isOpen ? " is-open" : "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6"/>
        </svg>
      )}
    </button>
  );
}

export function AppSidebar({ current, onNav, financeiro, isAdmin, podeVerFolha, mobileOpen, onMobileToggle }: {
  current: Tab; onNav: (t: Tab) => void; financeiro: { id: Tab; label: string }[];
  isAdmin: boolean;
  // Sem essa flag o módulo Equipe & Ponto (salário/CPF/Pix) não aparece na sidebar.
  podeVerFolha: boolean;
  mobileOpen: boolean; onMobileToggle: (open: boolean) => void;
}) {
  // Módulos exibidos = MODULOS - equipe se o user não tem verSalarios.
  const modulosVisiveis = podeVerFolha ? MODULOS : MODULOS.filter((m) => m.id !== "equipe");
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
        {modulosVisiveis.map((m) => {
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
