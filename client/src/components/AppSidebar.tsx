/* Rio Novo — navegação global (rail persistente no desktop + drawer no mobile).
 *
 * Layout novo (handoff "Shell - sidebar + header"): a marca Terrano e o seletor
 * de fazenda/sítio vivem no TOPO da sidebar (não mais no header). A navegação em
 * dois grupos — "Gestão" (financeiro) e "Atividades" (módulos operacionais, em
 * acordeão) — mais um rodapé "Configurações" ancorado embaixo que agrupa os itens
 * raros (Cadastros, Categorias, Caixinha, Configurações, Acessos).
 *
 * DESKTOP: trilho fixo sempre visível; entre 901–1100px vira ícone-only e expande
 * ao passar o mouse/focar (hover/focus-within). MOBILE (<=900px): drawer via
 * shadcn `Sheet` (Radix Dialog) — overlay, foco-trap e Escape de graça. */

import { useEffect, useState } from "react";
import type { Tab } from "./Shell";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TerranoSymbol } from "./TerranoLogo";
import { SidebarFarmPicker } from "./FarmPicker";

// ícones simples (single-path) por chave — reusa os do rebanho onde aplicável
const ICON: Partial<Record<Tab, JSX.Element>> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  gastos: <><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></>,
  lancar: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/></>,
  caixinha: <><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M4 12h16M12 12v3"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>,
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
      { id: "mil-custos", label: "Lançar custos" },
      { id: "mil-producao", label: "Produção" },
      { id: "mil-silos", label: "Silos" },
      { id: "mil-custo", label: "Custo de produção" },
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

// Breakpoints do antigo `.rb-side` (rebanho.css): >=901px o trilho fica sempre
// visível; entre 901–1100px vira ícone-only (colapsado) e expande temporário por
// cima do conteúdo no hover/foco; <=900px quem assume é o drawer (Sheet) abaixo.
// IMPORTANTE: o scanner do Tailwind lê o TEXTO literal do arquivo (não executa
// JS) — por isso estas constantes precisam conter os nomes de classe já
// escritos por extenso (sem `${...}` template), senão a CSS correspondente
// nunca é gerada (utilitário "desconhecido", descartado silenciosamente).
const RAIL_ICON_BTN =
  "min-[901px]:max-[1100px]:justify-center min-[901px]:max-[1100px]:gap-0 min-[901px]:max-[1100px]:px-2 min-[901px]:max-[1100px]:py-2.5 min-[901px]:max-[1100px]:[&_svg]:h-[19px] min-[901px]:max-[1100px]:[&_svg]:w-[19px] min-[901px]:max-[1100px]:[&_svg]:opacity-100";
// item/módulo ativo dentro da faixa colapsada: mantém só o realce de fundo (sem
// barrinha ::before, que fica escondida na largura estreita).
const RAIL_ACTIVE =
  "min-[901px]:max-[1100px]:before:hidden min-[901px]:max-[1100px]:bg-[rgba(232,220,196,0.10)]";
// hidden por padrão na faixa colapsada, reaparece no hover/foco do <aside group>.
const RAIL_LABEL =
  "min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:flex min-[901px]:max-[1100px]:group-focus-within:flex";
const RAIL_GROUP =
  "min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:block min-[901px]:max-[1100px]:group-focus-within:block";
const RAIL_BLOCK =
  "min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:block min-[901px]:max-[1100px]:group-focus-within:block";
const RAIL_INLINE_FLEX =
  "min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:inline-flex min-[901px]:max-[1100px]:group-focus-within:inline-flex";
// chevron `›` dos itens de clique único — some na faixa colapsada.
const RAIL_HIDE =
  "min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:inline min-[901px]:max-[1100px]:group-focus-within:inline";

/** Item de navegação (clique único). `chevron` mostra o `›` do protótipo nos
 *  itens que abrem uma página/sub-página. `activeWhen` acende o item também
 *  quando a aba atual é uma das sub-abas dobradas nele (ex.: "Gastos" fica ativo
 *  em `caixinha`; "Configurações" em `cadastros`/`plano`/`acessos`). */
function Item({ id, label, current, onNav, nested, chevron, activeWhen }: {
  id: Tab; label: string; current: Tab; onNav: (t: Tab) => void; nested?: boolean; chevron?: boolean; activeWhen?: Tab[];
}) {
  const isOn = current === id || (activeWhen?.includes(current) ?? false);
  return (
    <button
      type="button"
      onClick={() => onNav(id)}
      title={label}
      aria-label={label}
      aria-current={isOn ? "page" : undefined}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-3 rounded-[7px] bg-transparent px-2.5 py-[9px] text-left font-sans text-[13.5px] text-[var(--mast-ink)]",
        "[&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:flex-none [&_svg]:opacity-[.82]",
        "hover:bg-[rgba(232,220,196,0.06)]",
        RAIL_ICON_BTN,
        nested && "py-[7px] pl-8 text-[13px] [&_svg]:h-[15px] [&_svg]:w-[15px]",
        // item ativo: fundo sutil + barrinha brass à esquerda (::before)
        isOn && "bg-[rgba(232,220,196,0.10)] font-semibold [&_svg]:opacity-100 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-[2px] before:bg-leite",
        isOn && RAIL_ACTIVE,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>{ICON[id]}</svg>
      <span className={cn("flex-1", RAIL_LABEL)}>{label}</span>
      {chevron && (
        <span className={cn("flex-none text-[11px] text-[var(--side-mute,#8B8672)]", RAIL_HIDE)} aria-hidden>›</span>
      )}
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "px-2.5 pb-1.5 pt-1 font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--side-mute,#8B8672)]",
        RAIL_GROUP,
      )}
    >
      {children}
    </div>
  );
}

function ModuloHeader({ m, isOpen, isActive, onToggle }: { m: Modulo; isOpen: boolean; isActive: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={m.disabled ? undefined : onToggle}
      aria-expanded={isOpen}
      aria-disabled={m.disabled || undefined}
      disabled={m.disabled}
      title={m.disabled ? `${m.label} — em breve` : m.label}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-[7px] bg-transparent px-2.5 py-[9px] text-left font-sans text-[13.5px] text-[var(--mast-ink)]",
        "[&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:flex-none [&_svg]:opacity-[.82]",
        RAIL_ICON_BTN,
        m.disabled ? "cursor-not-allowed text-[var(--side-mute,#8B8672)] opacity-65 [&_svg]:opacity-60" : "cursor-pointer hover:bg-[rgba(232,220,196,0.06)]",
        isActive && !m.disabled && "font-semibold [&_svg]:opacity-100",
        // módulo ativo (alguma sub-aba aberta): barrinha brass à esquerda
        isActive && !m.disabled && "before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-[2px] before:bg-leite min-[901px]:max-[1100px]:before:hidden",
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>{m.icon}</svg>
      <span className={cn("flex-1", RAIL_LABEL)}>{m.label}</span>
      {m.disabled ? (
        <span
          aria-label="em breve"
          className={cn(
            "inline-flex items-center gap-[5px] rounded-[4px] border border-[var(--side-hair,rgba(232,220,196,0.1))] bg-[rgba(232,220,196,0.05)] px-[7px] py-[1px] font-serif text-[11px] italic text-[var(--side-mute,#8B8672)]",
            RAIL_INLINE_FLEX,
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-3 w-3 flex-none opacity-85">
            <rect x="5" y="11" width="14" height="9" rx="2"/>
            <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
          </svg>
          <span className="leading-none">em breve</span>
        </span>
      ) : (
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden
          className={cn(
            "!h-[11px] !w-[11px] flex-none !opacity-55 transition-transform duration-150 ease-in-out",
            isOpen && "rotate-90",
            RAIL_BLOCK,
          )}
        >
          <path d="M9 6l6 6-6 6"/>
        </svg>
      )}
    </button>
  );
}

export function AppSidebar({
  current, onNav, financeiro, isAdmin, podeVerFolha,
  mobileOpen, onMobileToggle, propAtiva, onTrocarProp,
}: {
  current: Tab; onNav: (t: Tab) => void; financeiro: { id: Tab; label: string }[];
  isAdmin: boolean;
  // Sem essa flag o módulo Equipe & Ponto (salário/CPF/Pix) não aparece na sidebar.
  podeVerFolha: boolean;
  mobileOpen: boolean; onMobileToggle: (open: boolean) => void;
  // Contexto de fazenda/sítio — o switcher agora vive no topo da sidebar.
  propAtiva: number | null; onTrocarProp: (id: number | null) => void;
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

  // Fecha o drawer mobile se a viewport estiver (ou passar a estar) >=901px —
  // nessa largura o trilho desktop assume e o painel do Sheet vira `hidden`
  // via CSS, mas o Radix mantém overlay/scroll-lock/focus-trap ativos sobre um
  // painel invisível se ninguém desmontar o Dialog. Sem um listener de resize,
  // abrir o drawer em <=900px e depois alargar/rotacionar a tela deixa o
  // desktop inteiro escuro e inclicável.
  useEffect(() => {
    if (!mobileOpen) return;
    const mq = window.matchMedia("(min-width: 901px)");
    if (mq.matches) { onMobileToggle(false); return; }
    const onChange = (e: MediaQueryListEvent) => { if (e.matches) onMobileToggle(false); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mobileOpen, onMobileToggle]);

  // relabel financeiro: "IA" -> "IA financeira". "Caixinha" dobrou dentro de
  // Gastos (sub-aba) e "Categorias" dentro de Configurações — nenhuma das duas
  // aparece como item solto na sidebar.
  const DOBRADAS = new Set<Tab>(["caixinha", "plano"]);
  const gestao = financeiro
    .filter((t) => !DOBRADAS.has(t.id))
    .map((t) => (t.id === "ia" ? { ...t, label: "IA financeira" } : t));
  // wrapper: clicar em qualquer aba fecha o drawer no mobile
  const nav = (t: Tab) => { onNav(t); onMobileToggle(false); };

  const toggleModulo = (id: ModuloId) => setOpenModulo((cur) => (cur === id ? null : id));

  // Cabeçalho da sidebar: marca Terrano + seletor de fazenda/sítio.
  const sideHead = (
    <div className="flex-none border-b border-[var(--side-hair,rgba(232,220,196,0.1))] px-3.5 pb-3.5 pt-4 min-[901px]:max-[1100px]:px-2">
      <div className="ah-brand flex items-center gap-2.5 px-1.5 pb-3 min-[901px]:max-[1100px]:justify-center min-[901px]:max-[1100px]:px-0">
        <TerranoSymbol size={30} tone="dark" strokeWidth={4.4} className="ah-brand-symbol flex-none" />
        <span className={cn("font-serif text-[21px] font-medium leading-none tracking-[-0.01em] text-[var(--mast-ink)]", RAIL_LABEL)}>
          Terrano
        </span>
      </div>
      <SidebarFarmPicker propAtiva={propAtiva} onTrocarProp={onTrocarProp} />
    </div>
  );

  const navBody = (
    <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-3.5 pb-2 pt-4 [scrollbar-color:#2a3025_transparent] [scrollbar-width:thin] min-[901px]:max-[1100px]:px-2">
      <div className="flex flex-col gap-px">
        <GroupLabel>Gestão</GroupLabel>
        {gestao.map((t) => (
          <Item
            key={t.id} id={t.id} label={t.label} current={current} onNav={nav} chevron
            activeWhen={t.id === "gastos" ? ["caixinha"] : undefined}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-px">
        <GroupLabel>Atividades</GroupLabel>
        {modulosVisiveis.map((m) => {
          const isOpen = openModulo === m.id && !m.disabled;
          const isActive = m.subs.some((s) => s.id === current);
          return (
            <div key={m.id} className="flex flex-col">
              <ModuloHeader m={m} isOpen={isOpen} isActive={isActive} onToggle={() => toggleModulo(m.id)} />
              {isOpen && (
                <div className={cn("flex flex-col gap-px pb-1", RAIL_BLOCK)}>
                  {m.subs.map((s) => <Item key={s.id} id={s.id} label={s.label} current={current} onNav={nav} nested />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Rodapé ancorado: um único item "Configurações" que abre o hub de setup/admin
  // (Geral · Cadastros · Categorias · Acessos como sub-abas lá dentro). Fica ativo
  // em qualquer uma dessas rotas dobradas.
  const sideFoot = (
    <div className="flex-none border-t border-[var(--side-hair,rgba(232,220,196,0.1))] px-3.5 py-2.5 min-[901px]:max-[1100px]:px-2">
      <div className="flex flex-col gap-px">
        <Item
          id="config" label="Configurações" current={current} onNav={nav} chevron
          activeWhen={["cadastros", "plano", ...(isAdmin ? (["acessos"] as Tab[]) : [])]}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* DESKTOP — trilho persistente (sempre no DOM, >=901px). `group` habilita
         o hover/focus-within-expande dos filhos na faixa 901–1100px. */}
      <aside
        className={cn(
          "group fixed inset-y-0 left-0 z-[11] hidden w-[var(--side-w)] flex-col overflow-hidden bg-mast text-mast-ink print:hidden",
          "min-[901px]:flex",
          "min-[901px]:max-[1100px]:w-[64px]",
          "min-[901px]:max-[1100px]:transition-[width,box-shadow] min-[901px]:max-[1100px]:duration-[180ms] min-[901px]:max-[1100px]:ease-in-out",
          "min-[901px]:max-[1100px]:hover:z-20 min-[901px]:max-[1100px]:hover:w-[240px] min-[901px]:max-[1100px]:hover:shadow-[8px_0_30px_rgba(0,0,0,0.22)]",
          "min-[901px]:max-[1100px]:focus-within:z-20 min-[901px]:max-[1100px]:focus-within:w-[240px] min-[901px]:max-[1100px]:focus-within:shadow-[8px_0_30px_rgba(0,0,0,0.22)]",
        )}
      >
        {sideHead}
        {navBody}
        {sideFoot}
      </aside>

      {/* MOBILE — drawer via shadcn Sheet (Radix Dialog): overlay, clique-fora,
         Escape e foco-trap já vêm de graça. `min-[901px]:hidden` garante que o
         drawer nunca aparece nas larguras onde o trilho já está visível. */}
      <Sheet open={mobileOpen} onOpenChange={onMobileToggle}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="max-w-none w-[min(288px,88vw)] gap-0 border-r-0 bg-mast p-0 text-mast-ink shadow-[8px_0_30px_rgba(0,0,0,0.18)] sm:max-w-none min-[901px]:hidden print:hidden"
        >
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SheetDescription className="sr-only">Navegação principal do Rio Novo</SheetDescription>
          <div className="flex h-full flex-col overflow-hidden">
            {sideHead}
            {navBody}
            {sideFoot}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
