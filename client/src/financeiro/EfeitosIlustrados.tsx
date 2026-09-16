/* Ilustrações animadas das prévias dos seletores do financeiro: mostram, em
 * linguagem simples, para onde vão o produto e o dinheiro (tipo de operação)
 * e quando o dinheiro se move (condição). A animação só roda quando o sistema
 * não pede movimento reduzido. */

import { ArrowRight, Banknote, CalendarClock, Package, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPLICACAO_CONDICAO, EXPLICACAO_TIPO, type Fluxo } from "./lib/explicacoes";

const ICONE = { Produto: Package, Serviço: Wrench, Dinheiro: Banknote } as const;
const COR = { Produto: "text-[color:var(--leite)]", Serviço: "text-[color:var(--leite)]", Dinheiro: "text-outros" } as const;

function Trilha({ fluxo, atraso = 0 }: { fluxo: Fluxo; atraso?: number }) {
  const Icone = ICONE[fluxo.rotulo];
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3">
        <Icone className={cn("size-3.5", COR[fluxo.rotulo])} aria-hidden="true" />
        <span>{fluxo.rotulo}</span>
      </div>
      <div className="mt-2 grid grid-cols-[auto_minmax(48px,1fr)_auto] items-center gap-2 text-xs font-medium text-ink">
        <span className="rounded-full bg-muted px-2 py-1"><span className="sr-only">de </span>{fluxo.de}</span>
        <span className="relative block h-5" aria-hidden="true">
          <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-ink-3/40" />
          <ArrowRight className="absolute right-0 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <span
            className={cn("absolute left-0 top-0.5 grid size-4 place-items-center rounded-full bg-white motion-safe:animate-[campo-fluxo_2.6s_ease-in-out_infinite]", COR[fluxo.rotulo])}
            style={{ animationDelay: `${atraso}ms` }}
          >
            <Icone className="size-3.5" />
          </span>
        </span>
        <span className="rounded-full bg-muted px-2 py-1"><span className="sr-only">para </span>{fluxo.para}</span>
      </div>
    </div>
  );
}

export function EfeitosTipoOperacao({ tipo, nome }: { tipo: string; nome: string }) {
  const explicacao = EXPLICACAO_TIPO[tipo];
  if (!explicacao) return null;
  return (
    <figure aria-label={`O que acontece em ${nome}`} className="space-y-2.5">
      <figcaption className="font-serif text-lg leading-6 text-ink">{nome}</figcaption>
      {explicacao.itens ? <Trilha fluxo={explicacao.itens} /> : null}
      {explicacao.dinheiro ? (
        <Trilha fluxo={explicacao.dinheiro} atraso={1300} />
      ) : explicacao.itens ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-border p-3 text-xs text-ink-3">
          <Banknote className="size-3.5" aria-hidden="true" /> Não mexe em dinheiro
        </div>
      ) : null}
      <p className="text-xs leading-5 text-ink-2">{explicacao.explicacao}</p>
    </figure>
  );
}

export function EfeitosCondicao({ condicao, nome }: { condicao: string; nome: string }) {
  const explicacao = EXPLICACAO_CONDICAO[condicao];
  if (!explicacao) return null;
  const hoje = Math.round(explicacao.parteHoje * 100);
  const semDinheiro = condicao === "SEM_EFEITO_FINANCEIRO";
  return (
    <figure aria-label={`Quando o dinheiro se move em ${nome}`} className="space-y-2.5">
      <figcaption className="font-serif text-lg leading-6 text-ink">{nome}</figcaption>
      <div className="grid grid-cols-2 gap-2">
        {([["Hoje", explicacao.hoje, hoje, Banknote], ["Depois", explicacao.depois, semDinheiro ? 0 : 100 - hoje, CalendarClock]] as const).map(([rotulo, texto, parte, Icone]) => (
          <div key={rotulo} className="rounded-lg border border-border bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3">
              <Icone className="size-3.5 text-outros" aria-hidden="true" /> {rotulo}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full origin-left rounded-full bg-outros motion-safe:animate-[campo-encher_900ms_ease-out_both]"
                style={{ width: `${parte}%`, animationDelay: rotulo === "Depois" ? "250ms" : undefined }}
              />
            </div>
            <p className="mt-1.5 text-xs font-medium text-ink first-letter:uppercase">{texto}</p>
          </div>
        ))}
      </div>
      <p className="text-xs leading-5 text-ink-2">{explicacao.descricao}</p>
    </figure>
  );
}
