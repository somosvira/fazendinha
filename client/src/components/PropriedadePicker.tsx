/* Seletor de propriedade/sítio (fonte única de contexto). Lista os sítios REAIS
 * (tabela Propriedade), permite trocar de sítio ou ver Consolidado, e abre o
 * cadastro via "Gerenciar propriedades".
 *   variant="header"  → pílula escura (masthead)
 *   variant="sidebar" → bloco com eyebrow FAZENDA/Sítio (mockup .farm-ctx)
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePropriedades } from "../rebanho/api";
import { GerenciarPropriedades } from "../rebanho/components/PropriedadeSelector";

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-3 w-3 opacity-70 transition-transform group-data-[state=open]:rotate-180", className)}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function PropriedadePicker({ propAtiva, onTrocarProp, variant = "header" }: {
  propAtiva: number | null;
  onTrocarProp: (id: number | null) => void;
  variant?: "header" | "sidebar";
}) {
  const { data: props, loading, recarregar } = usePropriedades();
  const [gerenciar, setGerenciar] = useState(false);
  const ativos = props.filter((p) => p.ativo);
  const sitioAtual = propAtiva != null ? ativos.find((p) => p.id === propAtiva) : null;
  const rotulo = sitioAtual ? (sitioAtual.apelido || sitioAtual.nome) : (ativos.length >= 2 ? "Consolidado" : "Rio Novo");

  const trigger =
    variant === "sidebar" ? (
      <button
        className="group flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] border border-[rgba(232,220,196,.10)] bg-[rgba(232,220,196,.05)] px-2.5 py-2 font-sans text-mast-ink hover:bg-[rgba(232,220,196,.09)]"
        aria-label="Propriedade / sítio ativo"
      >
        <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-md bg-leite text-[13px] text-[var(--mast-bg)]" aria-hidden>🥛</span>
        <span className="flex flex-1 flex-col items-start leading-[1.2]">
          <span className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-[var(--mast-ink-2)]">
            {sitioAtual ? "Sítio" : "Fazenda"}
          </span>
          <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold">{rotulo}</span>
        </span>
        <Chevron />
      </button>
    ) : (
      <button
        className="group flex cursor-pointer items-center gap-2.5 rounded-[9px] border border-[#2a3025] bg-[var(--mast-bg-2)] py-1.5 pl-2 pr-2.5 font-sans hover:bg-[#1f2521] max-[900px]:gap-2 max-[900px]:py-1 max-[900px]:pl-1.5 max-[900px]:pr-2 max-[560px]:px-1.5"
        aria-label="Propriedade / sítio ativo"
      >
        <span className="text-base leading-none max-[900px]:text-sm" aria-hidden>🥛</span>
        <span className="flex flex-col items-start leading-[1.05] max-[560px]:hidden">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mast-ink-2)] max-[900px]:hidden">
            {sitioAtual ? "Sítio" : "Fazenda"}
          </span>
          <span className="max-w-[26vw] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-mast-ink max-[900px]:text-[13px]">
            {rotulo}
          </span>
        </span>
        <Chevron />
      </button>
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[280px] max-w-[360px] rounded-[6px] p-0">
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
                  <span className="text-base" aria-hidden>🥛</span>
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
              <DropdownMenuItem
                onSelect={() => setGerenciar(true)}
                className="gap-3 rounded-none px-3.5 py-2.5 font-sans text-ink-2"
              >
                <span className="text-base" aria-hidden>＋</span>
                <span className="text-sm font-medium">Gerenciar propriedades</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {gerenciar && <GerenciarPropriedades propriedades={props} onFechar={() => setGerenciar(false)} onMudou={recarregar} />}
    </>
  );
}
