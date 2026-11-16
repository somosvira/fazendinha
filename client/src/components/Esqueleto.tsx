/* Esqueletos de carregamento: cada um imita a silhueta do componente que vai
 * chegar (tabela, cartões, ficha, formulário, gráfico), para a tela não pular
 * quando os dados entram. Um único vocabulário para todos os módulos; o texto
 * "Carregando…" fica só para leitores de tela. */

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const LARGURAS = ["w-4/5", "w-3/5", "w-2/3", "w-1/2", "w-3/4", "w-2/5"];

/** Envelope acessível: anuncia o carregamento e esconde os blocos do leitor de tela. */
export function Esqueleto({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div role="status" aria-live="polite" aria-busy="true" aria-label={label} className={cn("esqueleto min-w-0", className)}>
    <span className="sr-only">{label}…</span>
    <div aria-hidden="true" className="grid gap-4">{children}</div>
  </div>;
}

/** Tabela: cabeçalho e linhas com as mesmas colunas; a primeira coluna ganha uma linha de apoio. */
export function EsqueletoTabelaCorpo({ colunas = 4, linhas = 6 }: { colunas?: number; linhas?: number }) {
  const grade = { gridTemplateColumns: `minmax(0,2fr) repeat(${colunas - 1}, minmax(0,1fr))` };
  return <div className="overflow-hidden rounded-xl border border-border bg-card">
    <div className="grid items-center gap-4 border-b border-border px-4 py-3" style={grade}>
      {Array.from({ length: colunas }, (_, i) => <Skeleton key={i} className={cn("h-3", LARGURAS[(i + 3) % LARGURAS.length])} />)}
    </div>
    {Array.from({ length: linhas }, (_, l) => <div key={l} className="grid items-center gap-4 border-b border-border px-4 py-3.5 last:border-0" style={grade}>
      <div className="grid gap-1.5"><Skeleton className={cn("h-4", LARGURAS[l % LARGURAS.length])} /><Skeleton className="h-3 w-2/5" /></div>
      {Array.from({ length: colunas - 1 }, (_, c) => <Skeleton key={c} className={cn("h-4", LARGURAS[(l + c + 1) % LARGURAS.length])} />)}
    </div>)}
  </div>;
}

export function EsqueletoTabela({ label, colunas, linhas, filtros = false, className }: { label: string; colunas?: number; linhas?: number; filtros?: boolean; className?: string }) {
  return <Esqueleto label={label} className={className}>
    {filtros && <div className="flex flex-wrap gap-3"><Skeleton className="h-9 w-56 max-w-full" /><Skeleton className="h-9 w-36" /><Skeleton className="h-9 w-36" /></div>}
    <EsqueletoTabelaCorpo colunas={colunas} linhas={linhas} />
  </Esqueleto>;
}

/** Cartões em grade: rótulo pequeno, título e um bloco de conteúdo. */
export function EsqueletoCartoesCorpo({ quantidade = 3 }: { quantidade?: number }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: quantidade }, (_, i) => <div key={i} className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <Skeleton className="h-3 w-20" /><Skeleton className={cn("h-5", LARGURAS[i % LARGURAS.length])} /><Skeleton className="h-14 w-full" />
    </div>)}
  </div>;
}

export function EsqueletoCartoes({ label, quantidade, className }: { label: string; quantidade?: number; className?: string }) {
  return <Esqueleto label={label} className={className}><EsqueletoCartoesCorpo quantidade={quantidade} /></Esqueleto>;
}

/** Itens empilhados (histórico, linha do tempo, lista de registros em cartão). */
export function EsqueletoListaCorpo({ itens = 4 }: { itens?: number }) {
  return <div className="grid gap-3">
    {Array.from({ length: itens }, (_, i) => <div key={i} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div className="grid flex-1 gap-2"><Skeleton className={cn("h-4", LARGURAS[i % LARGURAS.length])} /><Skeleton className="h-3 w-1/2" /></div>
      <Skeleton className="h-4 w-20 shrink-0" />
    </div>)}
  </div>;
}

export function EsqueletoLista({ label, itens, className }: { label: string; itens?: number; className?: string }) {
  return <Esqueleto label={label} className={className}><EsqueletoListaCorpo itens={itens} /></Esqueleto>;
}

/** Números de resumo lado a lado (rótulo + valor). */
export function EsqueletoMetricasCorpo({ quantidade = 4 }: { quantidade?: number }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
    {Array.from({ length: quantidade }, (_, i) => <div key={i} className="grid gap-2.5 rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-3 w-3/5" /><Skeleton className="h-7 w-4/5" /><Skeleton className="h-3 w-2/5" />
    </div>)}
  </div>;
}

/** Ficha de detalhe: título, subtítulo e pares rótulo/valor em duas colunas. */
export function EsqueletoFichaCorpo({ campos = 6 }: { campos?: number }) {
  return <div className="rounded-xl border border-border bg-card p-5">
    <Skeleton className="h-6 w-2/5" /><Skeleton className="mt-3 h-4 w-3/5" />
    <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {Array.from({ length: campos }, (_, i) => <div key={i} className="grid gap-1.5"><Skeleton className="h-3 w-24" /><Skeleton className={cn("h-4", LARGURAS[i % LARGURAS.length])} /></div>)}
    </div>
  </div>;
}

export function EsqueletoFicha({ label, campos, className }: { label: string; campos?: number; className?: string }) {
  return <Esqueleto label={label} className={className}><EsqueletoFichaCorpo campos={campos} /></Esqueleto>;
}

/** Formulário: rótulos com campos e o botão principal. */
export function EsqueletoFormulario({ label, campos = 4, className }: { label: string; campos?: number; className?: string }) {
  return <Esqueleto label={label} className={className}>
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: campos }, (_, i) => <div key={i} className="grid gap-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-10 w-full" /></div>)}
    </div>
    <Skeleton className="h-10 w-36" />
  </Esqueleto>;
}

/** Gráfico com título e legenda. */
export function EsqueletoGraficoCorpo({ altura = 220 }: { altura?: number }) {
  return <div className="grid gap-3 rounded-xl border border-border bg-card p-5">
    <Skeleton className="h-4 w-40" />
    <Skeleton className="w-full" style={{ height: altura }} />
    <div className="flex gap-4"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /></div>
  </div>;
}

/** Painel: números de resumo, gráfico e tabela, como as visões gerais. */
export function EsqueletoPainel({ label, className }: { label: string; className?: string }) {
  return <Esqueleto label={label} className={className}>
    <EsqueletoMetricasCorpo />
    <EsqueletoGraficoCorpo />
    <EsqueletoTabelaCorpo linhas={4} />
  </Esqueleto>;
}

/** Página inteira: cabeçalho com ação e o conteúdo informado. */
export function EsqueletoCabecalho() {
  return <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="grid gap-3"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-72 max-w-full" /></div>
    <Skeleton className="h-10 w-36" />
  </div>;
}

/** Linhas de texto curtas, para trechos pequenos dentro de um cartão. */
export function EsqueletoLinhas({ label, linhas = 3, className }: { label: string; linhas?: number; className?: string }) {
  return <Esqueleto label={label} className={className}>
    <div className="grid gap-2.5">{Array.from({ length: linhas }, (_, i) => <Skeleton key={i} className={cn("h-4", LARGURAS[i % LARGURAS.length])} />)}</div>
  </Esqueleto>;
}

/** Página inteira: cabeçalho, barra de filtros e tabela. */
export function EsqueletoPagina({ label, className }: { label: string; className?: string }) {
  return <Esqueleto label={label} className={className}>
    <EsqueletoCabecalho />
    <div className="flex flex-wrap gap-3"><Skeleton className="h-9 w-56 max-w-full" /><Skeleton className="h-9 w-36" /></div>
    <EsqueletoTabelaCorpo />
  </Esqueleto>;
}

/** Calendário mensal: título e grade de sete colunas. */
export function EsqueletoCalendario({ label, className }: { label: string; className?: string }) {
  return <Esqueleto label={label} className={className}>
    <Skeleton className="h-6 w-44" />
    <div className="grid grid-cols-7 gap-1.5">{Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
  </Esqueleto>;
}

/** Um único campo (seletor de sítio, busca) enquanto as opções chegam. */
export function EsqueletoCampo({ label, className }: { label: string; className?: string }) {
  return <Esqueleto label={label} className={className}><Skeleton className="h-10 w-64 max-w-full" /></Esqueleto>;
}
