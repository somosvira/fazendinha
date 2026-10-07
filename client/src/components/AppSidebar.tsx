/* Rio Novo — navegação global (rail persistente no desktop + drawer no mobile).
 *
 * A sidebar é organizada por ÁREAS DE TRABALHO, não pela estrutura interna dos
 * módulos. Pecuária mantém uma aba autorizada, com destinos operacionais
 * para as várias rotinas. Recursos de configuração ou análise menos
 * frequentes ficam em "Mais opções" dentro da área correspondente.
 * A marca Terrano e o seletor de fazenda/sítio vivem no topo da sidebar.
 *
 * DESKTOP: trilho fixo sempre visível; entre 901–1100px vira ícone-only e expande
 * ao passar o mouse/focar (hover/focus-within). MOBILE (<=900px): drawer via
 * shadcn `Sheet` (Radix Dialog) — overlay, foco-trap e Escape de graça. */

import { useEffect, useState } from "react";
import { FilePenLine, Plus } from "lucide-react";
import type { Tab } from "./Shell";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TerranoSymbol } from "./TerranoLogo";
import { SidebarFarmPicker } from "./FarmPicker";
import { temAcessoArea, temAcessoEstoque } from "@/lib/areas";
import { PAPEIS, type User } from "@/data/acessos";
import { quandoSalvo, type ResumoRascunho } from "@/financeiro/lib/rascunho";
import { navegarPara } from "@/router";

type ResumoTrabalhoAtivo = Pick<ResumoRascunho, "titulo" | "tipo" | "detalhe" | "atualizadoEm">;

// ícones simples (single-path) por chave
const ICON: Partial<Record<Tab, JSX.Element>> = {
  "pec-rebanho": <><circle cx="12" cy="9" r="5"/><path d="M5 21c1-4 4-6 7-6s6 2 7 6"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  gastos: <><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></>,
  lancar: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/></>,
  caixinha: <><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M4 12h16M12 12v3"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>,
  plano: <><path d="M4 6h16M4 12h16M4 18h10"/></>,
  relatorio: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
  ia: <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>,
  acessos: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/></>,
  cadastros: <><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></>,
  estoque: <><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M3 8l9 5 9-5"/></>,
  config: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
};

const ICON_PECUARIA: Record<string, JSX.Element | undefined> = {
  "/pecuaria/rebanho": ICON.dashboard,
  "/pecuaria/rebanho/coletas": ICON.relatorio,
  "/pecuaria/rebanho/animais": <><path d="M7 7 3 3v6l4 2m10-4 4-4v6l-4 2M7 7h10v9a5 5 0 0 1-10 0z"/><path d="M9 17h6M9 12h.01M15 12h.01"/></>,
  "/pecuaria/rebanho/lotes": <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  "/pecuaria/rebanho/pesagens": <><path d="M6 8h12l3 13H3z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M12 12v4"/></>,
  "/pecuaria/rebanho/sanidade": <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM12 8v8M8 12h8"/></>,
  "/pecuaria/rebanho/nutricao": <><path d="M20 3C7 3 3 9 5 15s13 7 15-12ZM4 21l11-11"/></>,
  "/pecuaria/rebanho/cadastros": ICON.cadastros,
};

type AreaTrabalhoId = "pecuaria";
type NavItem = { id: Tab; label: string; href?: string };
type AreaTrabalho = {
  id: AreaTrabalhoId;
  label: string;
  permissao: string;
  principais: NavItem[];
  extras?: NavItem[];
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
      { id: "pec-rebanho", label: "Visão geral", href: "/pecuaria/rebanho" },
      { id: "pec-rebanho", label: "Coletas de campo", href: "/pecuaria/rebanho/coletas" },
      { id: "pec-rebanho", label: "Animais", href: "/pecuaria/rebanho/animais" },
      { id: "pec-rebanho", label: "Lotes", href: "/pecuaria/rebanho/lotes" },
      { id: "pec-rebanho", label: "Pesagens", href: "/pecuaria/rebanho/pesagens" },
      { id: "pec-rebanho", label: "Sanidade", href: "/pecuaria/rebanho/sanidade" },
      { id: "pec-rebanho", label: "Nutrição", href: "/pecuaria/rebanho/nutricao" },
      { id: "pec-rebanho", label: "Cadastros", href: "/pecuaria/rebanho/cadastros" },
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
const RAIL_BLOCK =
  "min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:block min-[901px]:max-[1100px]:group-focus-within:block [.side-collapsed_&]:hidden";
// chevron `›` dos itens de clique único — some na faixa colapsada.
const RAIL_HIDE =
  "min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:inline min-[901px]:max-[1100px]:group-focus-within:inline [.side-collapsed_&]:hidden";

/** Item de navegação (clique único). `chevron` mostra o `›` do protótipo nos
 *  itens que abrem uma página/sub-página. `activeWhen` acende o item também
 *  quando a aba atual é uma das sub-abas dobradas nele (ex.: "Gastos" fica ativo
 *  em `caixinha`; "Configurações" em `cadastros`/`plano`/`acessos`). */
function Item({ id, label, current, onNav, nested, chevron, activeWhen, href, pathname }: {
  id: Tab; label: string; current: Tab; onNav: (t: Tab) => void; nested?: boolean; chevron?: boolean; activeWhen?: Tab[]; href?: string; pathname?: string;
}) {
  const isOn = href ? current === id && (pathname === href || (href !== "/pecuaria/rebanho" && pathname?.startsWith(`${href}/`))) : current === id || (activeWhen?.includes(current) ?? false);
  return (
    <button
      type="button"
      onClick={() => { onNav(id); if (href) navegarPara(href); }}
      title={label}
      aria-label={label}
      aria-current={isOn ? "page" : undefined}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-3 rounded-[7px] bg-transparent px-2.5 py-[9px] text-left font-sans text-[13.5px] text-[var(--mast-ink)]",
        "[&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:flex-none [&_svg]:opacity-[.82]",
        "hover:bg-[rgba(232,220,196,0.06)]",
        RAIL_ICON_BTN,
        nested && "py-[7px] pl-4 text-[13px] [&_svg]:h-[15px] [&_svg]:w-[15px]",
        // item ativo: fundo sutil + barrinha brass à esquerda (::before)
        isOn && "bg-[rgba(232,220,196,0.10)] font-semibold [&_svg]:opacity-100 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-[2px] before:bg-leite",
        isOn && RAIL_ACTIVE,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>{(href ? ICON_PECUARIA[href] : undefined) ?? ICON[id]}</svg>
      <span className={cn("flex-1", RAIL_LABEL)}>{label}</span>
      {chevron && (
        <span className={cn("flex-none text-[11px] text-[var(--side-mute,#8B8672)]", RAIL_HIDE)} aria-hidden>›</span>
      )}
    </button>
  );
}

function SearchControl({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Buscar"
      aria-label="Buscar páginas, animais e ações"
      className="order-1 grid h-8 w-8 flex-none place-items-center rounded-lg text-[var(--side-mute)] hover:bg-white/5 hover:text-mast-ink min-[901px]:max-[1100px]:order-2 [.side-collapsed_&]:order-2"
    >
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
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

/** Atalho para o trabalho em andamento, no topo da navegação, acima do
 *  Financeiro. Com rascunho de operação (`resumo`), mostra o lápis e a descrição
 *  e reabre o rascunho; sem rascunho, mostra um "+" que começa uma operação
 *  nova. `ativo` quando o formulário está na tela. É um item fino: ícone,
 *  descrição e, logo abaixo, o tipo da operação em corpo menor; valor e "salvo
 *  há" ficam no tooltip. A altura mínima é a mesma com e sem rascunho, para o
 *  item não pular quando o "+" vira rascunho. No trilho recolhido vira só o
 *  ícone; o ponto brass marca que há rascunho pendente.
 *  O `aria-current` fica só com o item "Operações" (a página de fato): o cartão
 *  anuncia o estado no próprio nome, para o leitor de tela não ouvir duas
 *  páginas atuais. */
export function TrabalhoAtivo({ resumo, ativo, onAbrir, vazio = "Nova operação" }: { resumo: ResumoTrabalhoAtivo | null; ativo: boolean; onAbrir: () => void; vazio?: string }) {
  // O "salvo há N min" do tooltip envelhece com a tela parada: re-renderiza a
  // cada minuto. O relógio é lido na renderização, para acompanhar cada autosave.
  const [, setTique] = useState(0);
  useEffect(() => {
    const intervalo = window.setInterval(() => setTique((tique) => tique + 1), 60_000);
    return () => window.clearInterval(intervalo);
  }, []);
  const salvo = resumo ? quandoSalvo(resumo.atualizadoEm, Date.now()) : null;
  const rotulo = resumo
    ? `${ativo ? "Rascunho em edição" : "Continuar rascunho"}: ${resumo.titulo}`
    : ativo ? `${vazio} em edição` : vazio;
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={rotulo}
      title={[rotulo, resumo?.detalhe, salvo].filter(Boolean).join("\n")}
      className={cn(
        "flex min-h-[38px] w-full cursor-pointer items-center gap-3 rounded-[7px] border border-[rgba(232,220,196,0.14)] bg-[rgba(232,220,196,0.05)] px-2.5 py-[3px] text-left font-sans text-[var(--mast-ink)]",
        "hover:bg-[rgba(232,220,196,0.09)] [&_svg]:h-[16px] [&_svg]:w-[16px] [&_svg]:flex-none",
        RAIL_ICON_BTN,
        // Na faixa 901–1100px, o hover expande a sidebar: volta ao layout de
        // duas linhas finas, em vez do respiro do modo ícone.
        "min-[901px]:max-[1100px]:group-hover:justify-start min-[901px]:max-[1100px]:group-hover:gap-3 min-[901px]:max-[1100px]:group-hover:px-2.5 min-[901px]:max-[1100px]:group-hover:py-[3px] min-[901px]:max-[1100px]:group-focus-within:justify-start min-[901px]:max-[1100px]:group-focus-within:gap-3 min-[901px]:max-[1100px]:group-focus-within:px-2.5 min-[901px]:max-[1100px]:group-focus-within:py-[3px]",
        ativo && "border-leite/60 bg-[rgba(232,220,196,0.10)]",
      )}
    >
      <span className="relative flex-none leading-none">
        {resumo ? <FilePenLine strokeWidth={1.7} aria-hidden /> : <Plus strokeWidth={1.7} aria-hidden />}
        {resumo && <span aria-hidden className="absolute -right-1 -top-1 h-2 w-2 rounded-full border-2 border-mast bg-leite" />}
      </span>
      <span className={cn("min-w-0 flex-1", RAIL_BLOCK)}>
        <span className="block truncate text-[13px] font-medium leading-4">{resumo ? resumo.titulo : vazio}</span>
        {resumo?.tipo && <span className="block truncate text-[11px] leading-[14px] text-[var(--side-mute)]">{resumo.tipo}</span>}
      </span>
    </button>
  );
}

const GROUP_ICON: Record<SidebarGroupId, JSX.Element> = {
  financeiro: <><path d="M12 2v20"/><path d="M17 6.5A4 4 0 0 0 13 4h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5"/></>,
  pecuaria: <><path d="M7.5 8C5 8 3.5 6.5 3 4c2.8.2 4.7 1.2 6 3M16.5 8c2.5 0 4-1.5 4.5-4-2.8.2-4.7 1.2-6 3"/><path d="M7 9.5C7 6.5 9 5 12 5s5 1.5 5 4.5V15c0 3-2 5-5 5s-5-2-5-5z"/><circle cx="9.5" cy="12" r=".65" fill="currentColor" stroke="none"/><circle cx="14.5" cy="12" r=".65" fill="currentColor" stroke="none"/><path d="M9.5 16c1.5-1 3.5-1 5 0"/></>,
};

function GroupToggle({ id, label, isOpen, onToggle }: { id: SidebarGroupId; label: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-label={`${isOpen ? "Recolher" : "Expandir"} ${label}`}
      className={cn(
        "flex w-full items-center gap-3 rounded-[7px] px-2.5 py-2 text-left font-sans text-[11px] font-semibold uppercase tracking-[0.13em] text-[rgba(232,220,196,0.72)]",
        "hover:bg-[rgba(232,220,196,0.06)] hover:text-[var(--mast-ink)] [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:flex-none [&>svg]:opacity-90",
        RAIL_ICON_BTN,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{GROUP_ICON[id]}</svg>
      <span className={cn("flex-1", RAIL_LABEL)}>{label}</span>
      <svg
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden
        className={cn("!h-[10px] !w-[10px] transition-transform duration-150", isOpen && "rotate-90", RAIL_HIDE)}
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

function MoreToggle({ context, isOpen, onToggle }: { context: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-label={`${isOpen ? "Recolher" : "Expandir"} mais opções de ${context}`}
      title={`Mais opções de ${context}`}
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
      <span className={cn("flex-1", RAIL_LABEL)}>Mais</span>
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
  current, onNav, financeiro, isAdmin, areas,
  mobileOpen, onMobileToggle, onAbrirBusca, propAtiva, onTrocarProp,
  user, colapsada, onToggleColapsar, onAcessos, onSair, trabalhoAtivo, trabalhoAtivoRelatorio,
}: {
  current: Tab; onNav: (t: Tab) => void; financeiro: { id: Tab; label: string }[];
  isAdmin: boolean;
  areas?: string[];
  mobileOpen: boolean; onMobileToggle: (open: boolean) => void;
  onAbrirBusca: () => void;
  // Contexto de fazenda/sítio — o switcher agora vive no topo da sidebar.
  propAtiva: number | null; onTrocarProp: (id: number | null) => void;
  user: User; colapsada: boolean; onToggleColapsar: () => void;
  onAcessos: () => void; onSair?: () => void;
  // Atalhos acima do Financeiro; o item de operação permanece disponível para iniciar uma nova.
  trabalhoAtivo?: { resumo: ResumoTrabalhoAtivo | null; ativo: boolean; onAbrir: () => void } | null;
  trabalhoAtivoRelatorio?: { resumo: ResumoTrabalhoAtivo; ativo: boolean; onAbrir: () => void } | null;
}) {
  const areasEfetivas = areas ?? ["pecuaria"];
  const [pathname, setPathname] = useState(() => window.location.pathname.replace(/\/$/, ""));
  useEffect(() => {
    const atualizar = () => setPathname(window.location.pathname.replace(/\/$/, ""));
    window.addEventListener("popstate", atualizar);
    return () => window.removeEventListener("popstate", atualizar);
  }, []);
  const areasVisiveis = AREAS_TRABALHO.filter(
    (area) => temAcessoArea(areasEfetivas, area.permissao as "pecuaria"),
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

  // Cabeçalho da sidebar: marca, controles do trilho e, logo abaixo da marca,
  // o contexto da fazenda. O divisor fecha o cabeçalho depois do seletor.
  const sideHead = (
    <div className="flex-none">
      <div className="border-b border-[var(--side-hair,rgba(232,220,196,0.1))] px-3.5 pb-3.5 pt-4 min-[901px]:max-[1100px]:px-2 min-[901px]:max-[1100px]:pb-2 min-[901px]:max-[1100px]:pt-3 [.side-collapsed_&]:px-2 [.side-collapsed_&]:pb-2 [.side-collapsed_&]:pt-3">
        <div className="ah-brand flex items-center gap-2.5 px-1.5 min-[901px]:max-[1100px]:flex-col min-[901px]:max-[1100px]:gap-1.5 min-[901px]:max-[1100px]:px-0 [.side-collapsed_&]:flex-col [.side-collapsed_&]:gap-1.5 [.side-collapsed_&]:px-0">
          <TerranoSymbol size={30} tone="dark" strokeWidth={4.4} className="ah-brand-symbol flex-none" />
          <span className={cn("font-serif text-[21px] font-medium leading-none tracking-[-0.01em] text-[var(--mast-ink)]", RAIL_LABEL)}>Terrano</span>
          <div className="ml-auto hidden items-center gap-1 min-[901px]:flex min-[901px]:max-[1100px]:ml-0 min-[901px]:max-[1100px]:flex-col [.side-collapsed_&]:ml-0 [.side-collapsed_&]:flex-col">
            <SearchControl onClick={abrirBusca} />
            <button type="button" onClick={onToggleColapsar} aria-label={colapsada ? "Expandir menu lateral" : "Recolher menu lateral"} title={colapsada ? "Expandir menu lateral" : "Recolher menu lateral"} className="order-2 grid h-8 w-8 flex-none place-items-center rounded-lg text-[var(--side-mute)] hover:bg-white/5 hover:text-mast-ink min-[901px]:max-[1100px]:order-1 [.side-collapsed_&]:order-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-[18px] w-[18px]" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>{colapsada ? <path d="m13 9 3 3-3 3"/> : <path d="m16 9-3 3 3 3"/>}</svg>
            </button>
          </div>
        </div>
        <div className="mt-3.5 min-[901px]:max-[1100px]:mt-1.5 [.side-collapsed_&]:mt-1.5">
          <SidebarFarmPicker propAtiva={propAtiva} onTrocarProp={onTrocarProp} onGerenciar={isAdmin ? () => nav("sitios") : undefined} />
        </div>
      </div>
    </div>
  );

  const navBody = (
    <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-3.5 pb-2 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[901px]:max-[1100px]:px-2 min-[901px]:max-[1100px]:pt-2.5 [.side-collapsed_&]:px-2 [.side-collapsed_&]:pt-2.5">
      {(trabalhoAtivo || trabalhoAtivoRelatorio) && (
        <section role="group" aria-label="Trabalhos ativos" className="mb-3 border-b border-dashed border-[rgba(232,220,196,0.16)] pb-3">
          <h2 className={cn("mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-[rgba(232,220,196,0.62)]", RAIL_LABEL)}>Trabalhos ativos</h2>
          <div className="flex flex-col gap-2">
            {trabalhoAtivo && <TrabalhoAtivo resumo={trabalhoAtivo.resumo} ativo={trabalhoAtivo.ativo} onAbrir={() => { trabalhoAtivo.onAbrir(); onMobileToggle(false); }} />}
            {trabalhoAtivoRelatorio && <TrabalhoAtivo resumo={trabalhoAtivoRelatorio.resumo} ativo={trabalhoAtivoRelatorio.ativo} onAbrir={() => { trabalhoAtivoRelatorio.onAbrir(); onMobileToggle(false); }} />}
          </div>
        </section>
      )}
      {itensFinanceiros.length > 0 && (
        <div className="flex flex-col gap-px">
          <GroupToggle id="financeiro" label="Financeiro" isOpen={!collapsedGroups.has("financeiro")} onToggle={() => toggleGroup("financeiro")} />
          {!collapsedGroups.has("financeiro") && (
            <div className="ml-[19px] mt-1 flex flex-col gap-px border-l border-[rgba(232,220,196,0.14)] pl-1 min-[901px]:max-[1100px]:ml-0 min-[901px]:max-[1100px]:border-l-0 min-[901px]:max-[1100px]:pl-0 [.side-collapsed_&]:ml-0 [.side-collapsed_&]:border-l-0 [.side-collapsed_&]:pl-0">
              {itensFinanceiros.map((t) => (
                <Item
                  key={t.id}
                  id={t.id}
                  label={t.id === "dashboard" ? "Visão geral" : t.id === "lancar" ? "Operações" : t.id === "gastos" ? "Compromissos" : t.id === "caixinha" ? "Contas e extratos" : t.id === "cadastros" ? "Configurações financeiras" : t.label}
                  current={current}
                  onNav={nav}
                  nested
                  chevron={t.id !== "dashboard" && t.id !== "lancar"}
                  activeWhen={t.id === "cadastros" ? ["plano"] : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {areasVisiveis.map((area) => {
        const isOpen = openExtras === area.id;
        const groupOpen = !collapsedGroups.has(area.id);
        return (
          <div key={area.id} className="mt-3 flex flex-col gap-px border-t border-dashed border-[rgba(232,220,196,0.16)] pt-3">
            <GroupToggle id={area.id} label={area.label} isOpen={groupOpen} onToggle={() => toggleGroup(area.id)} />
            {groupOpen && (
              <div className="ml-[19px] mt-1 flex flex-col gap-px border-l border-[rgba(232,220,196,0.14)] pl-1 min-[901px]:max-[1100px]:ml-0 min-[901px]:max-[1100px]:border-l-0 min-[901px]:max-[1100px]:pl-0 [.side-collapsed_&]:ml-0 [.side-collapsed_&]:border-l-0 [.side-collapsed_&]:pl-0">
                {area.principais.map((item) => (
                  <Item key={item.href ?? item.id} {...item} pathname={pathname} current={current} onNav={nav} nested />
                ))}
                {!!area.extras?.length && <>
                <MoreToggle
                  context={area.label.toLowerCase()}
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
                </>}
              </div>
            )}
          </div>
        );
      })}

      {temAcessoEstoque(areasEfetivas) && (
        <div className="mt-3 flex flex-col gap-px border-t border-dashed border-[rgba(232,220,196,0.16)] pt-3">
          <Item id="estoque" label="Estoque" current={current} onNav={nav} />
        </div>
      )}

      <div className="mt-3 flex flex-col gap-px border-t border-dashed border-[rgba(232,220,196,0.16)] pt-3">
        <Item id="config" label="Configurações" current={current} onNav={nav} chevron activeWhen={[...(isAdmin ? (["sitios", "acessos"] as Tab[]) : [])]} />
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
