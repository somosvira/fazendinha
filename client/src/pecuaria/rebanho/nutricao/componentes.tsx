import type { ReactNode } from "react";
import { Button, ErrorBox, Panel, Pill } from "../../../financeiro/financeiro-ui";
import { fmtMoneyExact } from "../../../components/charts";
import { navegarPara } from "../../../router";
import { Skeleton } from "../../../components/ui/skeleton";
import type { ResumoNutricional } from "./api";

export const custoTexto = (valor: string | null) => valor == null ? "Não apurado" : fmtMoneyExact(Number(valor));
export function rotaNutricao(params: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return `/pecuaria/nutricao${query.size ? `?${query}` : ""}`;
}
export function LinkNutricional({ href, children, className = "nutricao-link" }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} className={className} onClick={(e) => { e.stopPropagation(); if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); navegarPara(href); } }}>{children}</a>;
}
type EstruturaCarregamentoNutricional = "lista" | "panorama" | "cartoes" | "detalhe";

function SkeletonConsultaNutricional({ estrutura, label }: { estrutura: EstruturaCarregamentoNutricional; label: string }) {
  const linhas = estrutura === "cartoes" ? 3 : 5;
  return <div role="status" aria-live="polite" aria-busy="true" aria-label={label} className="py-5">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="grid gap-3">
      {estrutura === "panorama" && <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-xl border border-border p-5"><Skeleton className="h-5 w-44" /><Skeleton className="mt-4 h-32 w-full rounded-full" /></div><div className="rounded-xl border border-border p-5"><Skeleton className="h-5 w-36" /><Skeleton className="mt-4 h-32 w-full" /></div></div>}
      {estrutura === "detalhe" && <div className="rounded-xl border border-border p-5"><Skeleton className="h-6 w-2/5" /><Skeleton className="mt-3 h-4 w-3/5" /><div className="mt-6 grid gap-3 sm:grid-cols-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div></div>}
      {estrutura === "cartoes" ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: linhas }, (_, indice) => <div key={indice} className="rounded-xl border border-border p-5"><Skeleton className="h-3 w-20" /><Skeleton className="mt-4 h-6 w-3/5" /><Skeleton className="mt-5 h-16 w-full" /></div>)}</div> : estrutura !== "detalhe" && <div className="overflow-hidden rounded-xl border border-border"><div className="grid grid-cols-3 gap-4 border-b border-border p-4"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>{Array.from({ length: linhas }, (_, indice) => <div key={indice} className="grid grid-cols-3 gap-4 border-b border-border p-4 last:border-0"><Skeleton className="h-5 w-4/5" /><Skeleton className="h-5 w-3/5" /><Skeleton className="h-5 w-2/5" /></div>)}</div>}
    </div>
  </div>;
}

export function EstadoConsulta({ erro, carregando, recarregar, estrutura = "lista", label = "Carregando nutrição…" }: { erro: string | null; carregando: boolean; recarregar: () => Promise<void>; estrutura?: EstruturaCarregamentoNutricional; label?: string }) {
  return <><ErrorBox erro={erro} />{erro && <Button secondary onClick={() => void recarregar()}>Tentar novamente</Button>}{!erro && carregando && <SkeletonConsultaNutricional estrutura={estrutura} label={label} />}</>;
}
export function SituacaoFechamento({ status }: { status: "CONFIRMADO" | "ESTORNADO" }) {
  return <Pill tone={status === "CONFIRMADO" ? "green" : "neutral"}>{status === "CONFIRMADO" ? "Confirmado" : "Estornado"}</Pill>;
}
export function CustosLote({ resumo: r }: { resumo: ResumoNutricional }) {
  return <Panel className="nutricao-consumo-resumo"><div className="nutricao-card-cabecalho"><div><h2 className="h3">Consumo confirmado</h2><p>{r.custos.animalDias} animal-dias · {r.custos.fechamentos} fechamento(s) · todo o histórico, estornos excluídos</p></div></div>
    {r.verValores && <><dl className="nutricao-fatos">
      <div><dt>Custo total da nutrição</dt><dd>{custoTexto(r.custos.custoConhecido)}</dd><p>{r.custos.custoConhecido == null ? "Sem custo conhecido nos fechamentos confirmados" : r.custos.coberturaCustoCompleta ? "Cobertura completa" : "Valor parcial · há consumo sem custo apurado"}</p></div>
      <div><dt>Custo médio por animal-dia</dt><dd>{custoTexto(r.custos.custoPorAnimalDia)}</dd><p>{r.custos.custoPorAnimalDia == null ? "Sem base para a média" : `Média ponderada${r.custos.coberturaCustoCompleta ? "" : " · parcial"}`}</p></div>
    </dl><p className="nutricao-nota nutricao-fatos-nota">A média divide o custo conhecido pelos animal-dias dos mesmos fechamentos.</p></>}
  </Panel>;
}
