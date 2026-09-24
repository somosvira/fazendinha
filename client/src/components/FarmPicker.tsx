/* Rio Novo — seletor de propriedade/sítio (context switcher de fazenda).
 *
 * Fonte única de contexto de workspace. No layout novo (handoff "Shell") ele mora
 * no TOPO da sidebar, logo abaixo da marca — trocar de fazenda é raro, mas muda
 * TODOS os dados exibidos, então fica sempre visível e discreto (padrão Slack/Linear).
 * Lista os sítios REAIS (tabela Propriedade), permite trocar de sítio ou ver
 * Consolidado e, para quem administra, leva ao cadastro em Configurações > Sítios
 * via "Gerenciar sítios".
 *
 * Migrado do Header.tsx para cá quando o switcher desceu para a sidebar. Usa o
 * primitivo shadcn `DropdownMenu` (Radix): outside-click, Escape e foco de graça. */

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePropriedades } from "../api/propriedades";

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-3 w-3 opacity-70 transition-transform group-data-[state=open]:rotate-180", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Conteúdo do menu (opções de sítio) — compartilhado por qualquer trigger. */
function FarmMenuItems({
  propAtiva, onTrocarProp, onGerenciar,
}: {
  propAtiva: number | null;
  onTrocarProp: (id: number | null) => void;
  /** Sem permissão para administrar sítios, o atalho não aparece. */
  onGerenciar?: () => void;
}) {
  const { data: props, loading } = usePropriedades();
  const ativos = props.filter((p) => p.ativo);
  return (
    <>
      <DropdownMenuLabel className="border-b border-border bg-[var(--bg-card-2)] px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
        {ativos.length >= 2 ? "Sítios da fazenda" : "Fazenda"}
      </DropdownMenuLabel>
      {loading ? (
        <div className="px-3.5 py-2.5 text-xs italic text-ink-3">Carregando…</div>
      ) : (
        <>
          {ativos.length >= 2 && (
            <DropdownMenuItem
              onSelect={() => onTrocarProp(null)}
              className={cn(
                "gap-3 rounded-none border-b border-[var(--rule-soft)] px-3.5 py-2.5 font-sans text-foreground last:border-b-0",
                propAtiva == null && "bg-[var(--bg-card-2)]",
              )}
            >
              <span className="text-base" aria-hidden>◎</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-foreground">Consolidado</span>
                <span className="text-[11px] text-ink-3">Todos os sítios juntos</span>
              </span>
              {propAtiva == null && <span className="font-bold text-lucro" aria-label="atual">✓</span>}
            </DropdownMenuItem>
          )}
          {ativos.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onSelect={() => onTrocarProp(p.id)}
              className={cn(
                "gap-3 rounded-none border-b border-[var(--rule-soft)] px-3.5 py-2.5 font-sans text-foreground last:border-b-0",
                p.id === propAtiva && "bg-[var(--bg-card-2)]",
              )}
            >
              <span className="text-base" aria-hidden>🌿</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-foreground">
                  {p.nome}{p.principal && <span className="text-ink-3"> · principal</span>}
                </span>
                {(p.cidade || p.uf) && (
                  <span className="text-[11px] text-ink-3">{[p.cidade, p.uf].filter(Boolean).join(" — ")}</span>
                )}
              </span>
              {p.id === propAtiva && <span className="font-bold text-lucro" aria-label="atual">✓</span>}
            </DropdownMenuItem>
          ))}
          {onGerenciar && (
            <DropdownMenuItem
              onSelect={onGerenciar}
              className="gap-3 rounded-none px-3.5 py-2.5 font-sans text-ink-2"
            >
              <span className="text-base" aria-hidden>＋</span>
              <span className="text-sm font-medium">Gerenciar sítios</span>
            </DropdownMenuItem>
          )}
        </>
      )}
    </>
  );
}

/** Variante da sidebar: bloco largo (context switcher) sobre o fundo escuro do
 *  masthead, com rótulo "Fazenda"/"Sítio" em cima do nome — igual ao protótipo. */
export function SidebarFarmPicker({ propAtiva, onTrocarProp, onGerenciar }: {
  propAtiva: number | null;
  onTrocarProp: (id: number | null) => void;
  onGerenciar?: () => void;
}) {
  const { data: props } = usePropriedades();
  const ativos = props.filter((p) => p.ativo);
  const sitioAtual = propAtiva != null ? ativos.find((p) => p.id === propAtiva) : null;
  const consolidado = propAtiva == null && ativos.length >= 2;
  const rotulo = sitioAtual ? (sitioAtual.apelido || sitioAtual.nome) : (ativos.length >= 2 ? "Consolidado" : "Rio Novo");
  const glyph = consolidado ? "▦" : "🌿";
  const kicker = sitioAtual ? "Sítio" : "Fazenda";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] border border-[var(--side-hair,rgba(232,220,196,0.1))] bg-[rgba(232,220,196,0.05)] px-2.5 py-2.5 font-sans text-[var(--mast-ink)] hover:bg-[rgba(232,220,196,0.09)] min-[901px]:max-[1100px]:justify-center min-[901px]:max-[1100px]:border-0 min-[901px]:max-[1100px]:bg-transparent min-[901px]:max-[1100px]:px-1.5 min-[901px]:max-[1100px]:py-1 [.side-collapsed_&]:justify-center [.side-collapsed_&]:border-0 [.side-collapsed_&]:bg-transparent [.side-collapsed_&]:px-1.5 [.side-collapsed_&]:py-1"
          aria-label="Propriedade / sítio ativo"
        >
          <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-[6px] bg-leite text-[13px] text-[var(--mast-bg)]" aria-hidden>{glyph}</span>
          <span className="flex min-w-0 flex-1 flex-col items-start leading-[1.2] text-left min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:flex min-[901px]:max-[1100px]:group-focus-within:flex [.side-collapsed_&]:hidden">
            <span className="text-[8.5px] font-normal uppercase tracking-[0.14em] text-[var(--side-mute,#8B8672)]">{kicker}</span>
            <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-[var(--mast-ink)]">{rotulo}</span>
          </span>
          <Chevron className="flex-none text-[var(--side-mute,#8B8672)] min-[901px]:max-[1100px]:hidden min-[901px]:max-[1100px]:group-hover:block min-[901px]:max-[1100px]:group-focus-within:block [.side-collapsed_&]:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[280px] max-w-[360px] rounded-[6px] p-0">
        <FarmMenuItems propAtiva={propAtiva} onTrocarProp={onTrocarProp} onGerenciar={onGerenciar} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
