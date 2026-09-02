/* Rio Novo — navegação global (rail persistente no desktop + drawer no mobile).
 *
 * A sidebar é organizada por ÁREAS DE TRABALHO, não pela estrutura interna dos
 * módulos. As rotinas mais frequentes ficam sempre em um clique (Reprodução,
 * Sanidade, Controle leiteiro, Animais e Agronomia); recursos de configuração ou
 * análise menos frequentes ficam em "Mais opções" dentro da área correspondente.
 * A marca Terrano e o seletor de fazenda/sítio vivem no topo da sidebar.
 *
 * DESKTOP: trilho fixo sempre visível; entre 901–1100px vira ícone-only e expande
 * ao passar o mouse/focar (hover/focus-within). MOBILE (<=900px): drawer via
 * shadcn `Sheet` (Radix Dialog) — overlay, foco-trap e Escape de graça. */

import { useEffect, useState } from "react";
import type { Tab } from "./Shell";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TerranoSymbol } from "./TerranoLogo";
import { SidebarFarmPicker } from "./FarmPicker";
import { temAcessoArea } from "@/lib/areas";
import { PAPEIS, type User } from "@/data/acessos";

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
  "reb-acasalamento": <><circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/><path d="M11 12h2M8 9V5M16 9V5M6 5h4M14 5h4M8 15v4M16 15v4"/></>,
  "reb-sanidade": <path d="M12 6v12M6 12h12"/>,
  "reb-nutricao": <path d="M12 21c5-3 8-7 8-12 0-1.5-.5-3-1-4-3 0-7 1-9 4s-2 8-2 12c2-2 4-3 6-4"/>,
  "reb-producao": <><path d="M8 3h8l-1 4H9z"/><path d="M9 7l-2 4v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8l-2-4"/><path d="M7 13h10"/></>,
  "reb-estoque": <><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M3 8l9 5 9-5"/></>,
  "reb-custo": <><path d="M12 2v20"/><path d="M17 6.5a4 4 0 0 0-4-2.5h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5"/></>,
  "reb-carteira": <><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></>,
  "reb-sugestoes": <><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/></>,
  "reb-fiv": <><path d="M9 2h6"/><path d="M10 2v6.3a2 2 0 0 1-.4 1.2L5 16a2 2 0 0 0 1.6 3.2h10.8A2 2 0 0 0 19 16l-4.6-6.5a2 2 0 0 1-.4-1.2V2"/><path d="M7.5 14h9"/></>,
  "reb-relatorios": <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
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
  // — Corte (gado de corte) — ícones simbólicos.
  "cor-dashboard": <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  "cor-lote": <><circle cx="8" cy="11" r="3"/><circle cx="16" cy="11" r="3"/><path d="M4 20c0-2 2-4 4-4M16 16c2 0 4 2 4 4"/></>,
  "cor-pesagem": <><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 10v4M12 9v5M16 11v3"/></>,
  "cor-pasto": <><path d="M3 19c2-1 4-1 6 0M9 19c2-1 4-1 6 0M15 19c2-1 4-1 6 0"/><path d="M5 14v5M9 12v7M13 14v5M17 12v7"/></>,
  "cor-sanidade": <path d="M12 6v12M6 12h12"/>,
  "cor-nutricao": <path d="M12 21c5-3 8-7 8-12 0-1.5-.5-3-1-4-3 0-7 1-9 4s-2 8-2 12c2-2 4-3 6-4"/>,
  "cor-comercial": <><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>,
  "cor-custo": <><path d="M12 2v20"/><path d="M17 6.5a4 4 0 0 0-4-2.5h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5"/></>,
  // — Milho (cultivo) — ícones simbólicos.
  "mil-dashboard": <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  "mil-safras": <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></>,
  "mil-custos": <><path d="M5 3h14v18l-2-1.5L15 21l-2-1.5L11 21l-2-1.5L7 21l-2-1.5z"/><path d="M9 8h6M9 12h6"/></>,
  "mil-producao": <><path d="M12 21V8"/><path d="M12 12c-2 0-4-1.5-4-4 2 0 4 1.5 4 4zM12 12c2 0 4-1.5 4-4-2 0-4 1.5-4 4zM12 17c-2 0-4-1.5-4-4 2 0 4 1.5 4 4zM12 17c2 0 4-1.5 4-4-2 0-4 1.5-4 4z"/></>,
  "mil-silos": <><path d="M6 21V8a6 6 0 0 1 12 0v13"/><path d="M6 12h12M6 16h12"/><path d="M4 21h16"/></>,
  "mil-custo": <><path d="M12 2v20"/><path d="M17 6.5a4 4 0 0 0-4-2.5h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5"/></>,
  // — Equipe & Ponto — ícones simbólicos.
  "eqp-dashboard": <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  "eqp-funcionarios": <><circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-4 3.5-6 7-6s6 2 7 6"/><path d="M16 4a3.5 3.5 0 0 1 0 7"/></>,
  "eqp-ponto": <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  "eqp-folha": <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
};

type AreaTrabalhoId = "pecuaria" | "agronomia" | "equipe";
type NavItem = { id: Tab; label: string };
type AreaTrabalho = {
  id: AreaTrabalhoId;
  label: string;
  permissao: string;
  principais: NavItem[];
  extras?: NavItem[];
  exigeFolha?: boolean;
};

/**
 * Taxonomia editorial da sidebar. Ela não cria rotas novas: apenas oferece
 * pontos de entrada orientados ao trabalho para as telas que já existem.
 */
const AREAS_TRABALHO: AreaTrabalho[] = [
  {
    id: "pecuaria",
    label: "Pecuária",
    permissao: "pecuaria",
    principais: [
      { id: "reb-dashboard", label: "Hoje na pecuária" },
      { id: "reb-animal", label: "Animais" },
      { id: "reb-reproducao", label: "Reprodução" },
      { id: "reb-sanidade", label: "Sanidade" },
      { id: "reb-producao", label: "Controle leiteiro" },
      { id: "reb-nutricao", label: "Nutrição" },
      { id: "cor-lote", label: "Lotes coletivos" },
      { id: "cor-pesagem", label: "Pesagens" },
    ],
    extras: [
      { id: "reb-acasalamento", label: "Acasalamento" },
      { id: "reb-fiv", label: "FIV / TE" },
      { id: "reb-estoque", label: "Estoque de insumos" },
      { id: "reb-custo", label: "Custos e indicadores" },
      { id: "reb-carteira", label: "Carteira do rebanho" },
      { id: "reb-sugestoes", label: "Sugestões" },
      { id: "cor-dashboard", label: "Resumo dos lotes" },
      { id: "cor-pasto", label: "Pasto" },
      { id: "cor-sanidade", label: "Sanidade coletiva" },
      { id: "cor-nutricao", label: "Nutrição coletiva" },
      { id: "cor-comercial", label: "Comercialização" },
      { id: "cor-custo", label: "Custos dos lotes" },
    ],
  },
  {
    id: "agronomia",
    label: "Agronomia",
    permissao: "agricultura",
    principais: [
      { id: "pla-dashboard", label: "Agronomia" },
      { id: "pla-talhao", label: "Talhões" },
      { id: "pla-fitossanidade", label: "Fitossanidade" },
      { id: "pla-nutricao", label: "Solo & nutrição" },
      { id: "pla-planejamento", label: "Manejo & planejamento" },
      { id: "mil-dashboard", label: "Milho & safras" },
    ],
    extras: [
      { id: "pla-fenologia", label: "Fenologia do café" },
      { id: "pla-colheita", label: "Colheita do café" },
      { id: "pla-estoque", label: "Estoque agrícola" },
      { id: "pla-custo", label: "Custos do café" },
      { id: "mil-safras", label: "Safras de milho" },
      { id: "mil-custos", label: "Lançar custos do milho" },
      { id: "mil-producao", label: "Produção de milho" },
      { id: "mil-silos", label: "Silos" },
      { id: "mil-custo", label: "Custo de produção do milho" },
    ],
  },
  {
    id: "equipe",
    label: "Equipe",
    permissao: "equipe",
    exigeFolha: true,
    principais: [
      { id: "eqp-dashboard", label: "Visão da equipe" },
      { id: "eqp-funcionarios", label: "Funcionários" },
      { id: "eqp-ponto", label: "Ponto" },
      { id: "eqp-folha", label: "Folha" },
    ],
  },
];

const STORAGE_KEY = "rionovo:sidebar:openExtras";
const COLLAPSED_GROUPS_KEY = "rionovo:sidebar:collapsedGroups:v2";
type SidebarGroupId = AreaTrabalhoId | "financeiro";

function areaExtraOfTab(tab: Tab): AreaTrabalhoId | null {
  return AREAS_TRABALHO.find((area) => area.extras?.some((item) => item.id === tab))?.id ?? null;
}

// Breakpoints do antigo `.rb-side` (rebanho.css): >=901px o trilho fica sempre
// visível; entre 901–1100px vira ícone-only (colapsado) e expande temporário por
// cima do conteúdo no hover/foco; <=900px quem assume é o drawer (Sheet) abaixo.
// IMPORTANTE: o scanner do Tailwind lê o TEXTO literal do arquivo (não executa
// JS) — por isso estas constantes precisam conter os nomes de classe já
// escritos por extenso (sem `${...}` template), senão a CSS correspondente
// nunca é gerada (utilitário "desconhecido", descartado silenciosamente).
// Cada constante do trilho tem DUAS gatilhos: a faixa 901–1100px (media query,
// auto) E o colapso MANUAL (.side-collapsed no .app, via toggle no header). O
// colapso manual não tem hover-expand — fica ícone-only até o toggle reverter.
const RAIL_ICON_BTN =
  "min-[901px]:max-[1100px]:justify-center min-[901px]:max-[1100px]:gap-0 min-[901px]:max-[1100px]:px-2 min-[901px]:max-[1100px]:py-2.5 min-[901px]:max-[1100px]:[&_svg]:h-[19px] min-[901px]:max-[1100px]:[&_svg]:w-[19px] min-[901px]:max-[1100px]:[&_svg]:opacity-100 [.side-collapsed_&]:justify-center [.side-collapsed_&]:gap-0 [.side-collapsed_&]:px-2 [.side-collapsed_&]:py-2.5";
// item/módulo ativo dentro da faixa colapsada: mantém só o realce de fundo (sem
// barrinha ::before, que fica escondida na largura estreita).
const RAIL_ACTIVE =
  "min-[901px]:max-[1100px]:before:hidden min-[901px]:max-[1100px]:bg-[rgba(232,220,196,0.10)] [.side-collapsed_&]:before:hidden [.side-collapsed_&]:bg-[rgba(232,220,196,0.10)]";
// hidden por padrão na faixa colapsada, reaparece no hover/foco do <aside group>.
const RAIL_LABEL =
  "min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:flex min-[901px]:max-[1100px]:group-focus-within:flex [.side-collapsed_&]:hidden";
const RAIL_GROUP =
  "min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:block min-[901px]:max-[1100px]:group-focus-within:block [.side-collapsed_&]:hidden";
const RAIL_BLOCK =
  "min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:block min-[901px]:max-[1100px]:group-focus-within:block [.side-collapsed_&]:hidden";
// chevron `›` dos itens de clique único — some na faixa colapsada.
const RAIL_HIDE =
  "min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:inline min-[901px]:max-[1100px]:group-focus-within:inline [.side-collapsed_&]:hidden";

/** Item de navegação (clique único). `chevron` mostra o `›` do protótipo nos
 *  itens que abrem uma página/sub-página. `activeWhen` acende o item também
 *  quando a aba atual é uma das sub-abas dobradas nele (ex.: "Gastos" fica ativo
 *  em `caixinha`; "Configurações" em `cadastros`/`plano`/`acessos`). */
function Item({ id, label, current, onNav, nested, chevron, activeWhen, featured }: {
  id: Tab; label: string; current: Tab; onNav: (t: Tab) => void; nested?: boolean; chevron?: boolean; activeWhen?: Tab[]; featured?: boolean;
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
        featured && "border border-[rgba(232,220,196,0.14)] bg-[rgba(232,220,196,0.08)] min-[901px]:max-[1100px]:border-0 min-[901px]:max-[1100px]:bg-transparent [.side-collapsed_&]:border-0 [.side-collapsed_&]:bg-transparent",
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

function SearchItem({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Buscar"
      aria-label="Buscar páginas, animais e ações"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-3 rounded-[7px] border border-[var(--side-hair,rgba(232,220,196,0.1))] bg-transparent px-2.5 py-[9px] text-left font-sans text-[13.5px] text-[var(--mast-ink)]",
        "hover:bg-[rgba(232,220,196,0.06)] [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:flex-none [&_svg]:opacity-[.82]",
        RAIL_ICON_BTN,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
      <span className={cn("flex-1", RAIL_LABEL)}>Buscar</span>
      <span className={cn("text-[10px] text-[var(--side-mute,#8B8672)]", RAIL_HIDE)} aria-hidden>Ctrl K</span>
    </button>
  );
}

function UserMenu({ user, onAcessos, onSair }: { user: User; onAcessos: () => void; onSair?: () => void }) {
  const papel = user.papel === "personalizado" ? "Personalizado" : PAPEIS[user.papel]?.nome ?? "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Menu da conta" className={cn("flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left hover:bg-[rgba(232,220,196,0.08)]", RAIL_ICON_BTN)}>
          <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-leite text-sm font-semibold text-ink">{user.inicial}</span>
          <span className={cn("min-w-0 flex-1", RAIL_LABEL)}><span className="block truncate text-[13px] font-semibold text-mast-ink">{user.nome}</span><span className="mt-0.5 block truncate text-[10.5px] text-[var(--side-mute)]">{papel}</span></span>
          <span className={cn("text-xs text-[var(--side-mute)]", RAIL_HIDE)} aria-hidden>⌃</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-[240px] rounded-[11px] p-1.5">
        <div className="mb-1 border-b border-rule-soft px-2.5 pb-2.5 pt-2"><div className="text-sm font-semibold text-ink">{user.nome}</div>{user.email && <div className="mt-0.5 text-xs text-ink-mute">{user.email}</div>}</div>
        <DropdownMenuItem onSelect={onAcessos} className="rounded-[7px] px-2.5 py-2 text-[13.5px]">Acessos</DropdownMenuItem>
        {onSair && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={onSair} className="rounded-[7px] px-2.5 py-2 text-[13.5px] text-[color:var(--prejuizo)] focus:text-[color:var(--prejuizo)]">Sair</DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
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

function GroupToggle({ label, isOpen, onToggle }: { label: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-label={`${isOpen ? "Recolher" : "Expandir"} ${label}`}
      className={cn(
        "flex w-full items-center justify-between rounded-[7px] px-2.5 pb-1.5 pt-1 text-left font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--side-mute,#8B8672)]",
        "hover:bg-[rgba(232,220,196,0.06)] hover:text-[var(--mast-ink)]",
        RAIL_GROUP,
      )}
    >
      <span>{label}</span>
      <svg
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden
        className={cn("h-[10px] w-[10px] transition-transform duration-150", isOpen && "rotate-90")}
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

function MoreToggle({ label, isOpen, total, onToggle }: { label: string; isOpen: boolean; total: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      title={label}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-3 rounded-[7px] bg-transparent px-2.5 py-[8px] text-left font-sans text-[12.5px] text-[var(--side-mute,#8B8672)]",
        "hover:bg-[rgba(232,220,196,0.06)] hover:text-[var(--mast-ink)] [&_svg]:h-[16px] [&_svg]:w-[16px] [&_svg]:flex-none [&_svg]:opacity-[.72]",
        RAIL_ICON_BTN,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
      <span className={cn("flex-1", RAIL_LABEL)}>{label}</span>
      <span className={cn("text-[10px] tabular-nums", RAIL_HIDE)}>{total}</span>
      <svg
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden
        className={cn("!h-[10px] !w-[10px] flex-none transition-transform duration-150", isOpen && "rotate-90", RAIL_BLOCK)}
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

export function AppSidebar({
  current, onNav, financeiro, isAdmin, podeVerFolha, areas,
  mobileOpen, onMobileToggle, onAbrirBusca, propAtiva, onTrocarProp,
  user, colapsada, onToggleColapsar, onAcessos, onSair,
}: {
  current: Tab; onNav: (t: Tab) => void; financeiro: { id: Tab; label: string }[];
  isAdmin: boolean;
  // Sem essa flag o módulo Equipe & Ponto (salário/CPF/Pix) não aparece na sidebar.
  podeVerFolha: boolean;
  areas?: string[];
  mobileOpen: boolean; onMobileToggle: (open: boolean) => void;
  onAbrirBusca: () => void;
  // Contexto de fazenda/sítio — o switcher agora vive no topo da sidebar.
  propAtiva: number | null; onTrocarProp: (id: number | null) => void;
  user: User; colapsada: boolean; onToggleColapsar: () => void;
  onAcessos: () => void; onSair?: () => void;
}) {
  const areasEfetivas = areas ?? ["pecuaria", "agricultura", "equipe"];
  const areasVisiveis = AREAS_TRABALHO.filter(
    (area) => temAcessoArea(areasEfetivas, area.permissao as "pecuaria" | "agricultura" | "equipe") && (!area.exigeFolha || podeVerFolha),
  );
  const [openExtras, setOpenExtras] = useState<AreaTrabalhoId | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && AREAS_TRABALHO.some((area) => area.id === stored && area.extras?.length)) return stored as AreaTrabalhoId;
    } catch { /* ignora SSR / storage indisponível */ }
    return areaExtraOfTab(current);
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<SidebarGroupId>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        if (Array.isArray(stored)) return new Set(stored.filter((id): id is SidebarGroupId => id === "financeiro" || AREAS_TRABALHO.some((area) => area.id === id)));
      }
    } catch { /* ignora SSR / storage inválido */ }
    return new Set<SidebarGroupId>(["financeiro", ...AREAS_TRABALHO.map((area) => area.id)]);
  });

  // Se um deep-link cair numa opção secundária, abre o bloco certo para manter
  // a localização atual visível sem exigir outro clique do usuário.
  useEffect(() => {
    const area = areaExtraOfTab(current);
    if (area && area !== openExtras) setOpenExtras(area);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, openExtras ?? ""); } catch { /* noop */ }
  }, [openExtras]);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...collapsedGroups])); } catch { /* noop */ }
  }, [collapsedGroups]);

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

  // IDs antigos de caixinha/categorias continuam aceitos por links históricos,
  // mas não aparecem como áreas financeiras independentes.
  const DOBRADAS = new Set<Tab>(["plano"]);
  const itensFinanceiros = financeiro.filter((t) => !DOBRADAS.has(t.id));
  // wrapper: clicar em qualquer aba fecha o drawer no mobile
  const nav = (t: Tab) => { onNav(t); onMobileToggle(false); };
  const abrirBusca = () => { onMobileToggle(false); onAbrirBusca(); };
  const toggleExtras = (id: AreaTrabalhoId) => setOpenExtras((cur) => (cur === id ? null : id));
  const toggleGroup = (id: SidebarGroupId) => setCollapsedGroups((atuais) => {
    const proximos = new Set(atuais);
    if (proximos.has(id)) proximos.delete(id); else proximos.add(id);
    return proximos;
  });

  useEffect(() => {
    const grupoAtivo: SidebarGroupId | null = itensFinanceiros.some((item) => item.id === current) || current === "plano"
      ? "financeiro"
      : areasVisiveis.find((area) => area.principais.some((item) => item.id === current) || area.extras?.some((item) => item.id === current))?.id ?? null;
    if (grupoAtivo && collapsedGroups.has(grupoAtivo)) {
      setCollapsedGroups((atuais) => { const proximos = new Set(atuais); proximos.delete(grupoAtivo); return proximos; });
    }
    // O conjunto só deve reagir a mudanças de rota; clicar no título pode recolher o grupo ativo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Cabeçalho da sidebar: marca e controle do trilho; o contexto da fazenda
  // fica em um bloco próprio depois do divisor.
  const sideHead = (
    <div className="flex-none">
      <div className="border-b border-[var(--side-hair,rgba(232,220,196,0.1))] px-3.5 py-4 min-[901px]:max-[1100px]:px-2 [.side-collapsed_&]:px-2">
        <div className="ah-brand flex items-center gap-2.5 px-1.5 min-[901px]:max-[1100px]:flex-col min-[901px]:max-[1100px]:px-0 [.side-collapsed_&]:flex-col [.side-collapsed_&]:px-0">
          <TerranoSymbol size={30} tone="dark" strokeWidth={4.4} className="ah-brand-symbol flex-none" />
          <span className={cn("font-serif text-[21px] font-medium leading-none tracking-[-0.01em] text-[var(--mast-ink)]", RAIL_LABEL)}>Terrano</span>
          <button type="button" onClick={onToggleColapsar} aria-label={colapsada ? "Expandir menu lateral" : "Recolher menu lateral"} title={colapsada ? "Expandir menu lateral" : "Recolher menu lateral"} className="ml-auto hidden h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--side-mute)] hover:bg-white/5 hover:text-mast-ink min-[901px]:flex min-[901px]:max-[1100px]:ml-0 [.side-collapsed_&]:ml-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-[18px] w-[18px]" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>{colapsada ? <path d="m13 9 3 3-3 3"/> : <path d="m16 9-3 3 3 3"/>}</svg>
          </button>
        </div>
      </div>
      <div className="px-3.5 py-3 min-[901px]:max-[1100px]:px-2 [.side-collapsed_&]:px-2">
        <SidebarFarmPicker propAtiva={propAtiva} onTrocarProp={onTrocarProp} />
      </div>
    </div>
  );

  const navBody = (
    <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-3.5 pb-2 pt-4 [scrollbar-color:#2a3025_transparent] [scrollbar-width:thin] min-[901px]:max-[1100px]:px-2 [.side-collapsed_&]:px-2">
      <div className="flex flex-col gap-px">
        <GroupLabel>Acesso rápido</GroupLabel>
        <SearchItem onClick={abrirBusca} />
      </div>

      {itensFinanceiros.length > 0 && (
        <div className="mt-4 flex flex-col gap-px">
          <GroupToggle label="Financeiro" isOpen={!collapsedGroups.has("financeiro")} onToggle={() => toggleGroup("financeiro")} />
          {!collapsedGroups.has("financeiro") && itensFinanceiros.map((t) => (
            <Item
              key={t.id}
              id={t.id}
              label={t.id === "dashboard" ? "Visão geral" : t.id === "lancar" ? "Operações" : t.id === "gastos" ? "Compromissos" : t.id === "caixinha" ? "Contas e extratos" : t.id === "cadastros" ? "Configurações financeiras" : t.label}
              current={current}
              onNav={nav}
              chevron={t.id !== "dashboard" && t.id !== "lancar"}
              featured={t.id === "lancar"}
              activeWhen={t.id === "cadastros" ? ["plano"] : undefined}
            />
          ))}
        </div>
      )}

      {areasVisiveis.map((area) => {
        const isOpen = openExtras === area.id;
        const groupOpen = !collapsedGroups.has(area.id);
        return (
          <div key={area.id} className="mt-4 flex flex-col gap-px">
            <GroupToggle label={area.label} isOpen={groupOpen} onToggle={() => toggleGroup(area.id)} />
            {groupOpen && area.principais.map((item) => (
              <Item key={item.id} id={item.id} label={item.label} current={current} onNav={nav} />
            ))}
            {groupOpen && !!area.extras?.length && (
              <>
                <MoreToggle
                  label={`Mais opções de ${area.label.toLowerCase()}`}
                  total={area.extras.length}
                  isOpen={isOpen}
                  onToggle={() => toggleExtras(area.id)}
                />
                {isOpen && (
                  <div className={cn("flex flex-col gap-px pb-1", RAIL_BLOCK)}>
                    {area.extras.map((item) => (
                      <Item key={item.id} id={item.id} label={item.label} current={current} onNav={nav} nested />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      <div className="mt-4 flex flex-col gap-px">
        <Item id="config" label="Configurações" current={current} onNav={nav} chevron activeWhen={[...(isAdmin ? (["acessos"] as Tab[]) : [])]} />
      </div>
    </div>
  );

  // Rodapé ancorado: somente identidade e ações do usuário.
  const sideFoot = (
    <div className="flex-none border-t border-[var(--side-hair,rgba(232,220,196,0.1))] px-3.5 py-2.5 min-[901px]:max-[1100px]:px-2 [.side-collapsed_&]:px-2">
      <div className="flex flex-col gap-px">
        <UserMenu user={user} onAcessos={onAcessos} onSair={onSair} />
      </div>
    </div>
  );

  return (
    <>
      {!mobileOpen && <button type="button" onClick={() => onMobileToggle(true)} aria-label="Abrir menu" className="fixed left-3 top-3 z-30 hidden h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg-card text-ink shadow-sm max-[900px]:flex print:hidden"><svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg></button>}
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
          <button type="button" onClick={() => onMobileToggle(false)} aria-label="Fechar menu" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg text-mast-ink hover:bg-white/5"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg></button>
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
