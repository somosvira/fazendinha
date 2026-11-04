import { AjudaCampo } from "@/components/Dica";
import { Esqueleto, EsqueletoCartoesCorpo, EsqueletoFichaCorpo, EsqueletoMetricasCorpo, EsqueletoTabelaCorpo } from "@/components/Esqueleto";
import type { ReactNode } from "react";
import { Button, ErrorBox, Panel, Pill } from "../../../financeiro/financeiro-ui";
import { fmtMoneyExact } from "../../../components/charts";
import { navegarPara } from "../../../router";
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
  return <Esqueleto label={label} className="py-5">
    {estrutura === "panorama" && <EsqueletoMetricasCorpo />}
    {estrutura === "detalhe" ? <EsqueletoFichaCorpo /> : estrutura === "cartoes" ? <EsqueletoCartoesCorpo /> : <EsqueletoTabelaCorpo colunas={3} linhas={5} />}
  </Esqueleto>;
}

export function EstadoConsulta({ erro, carregando, recarregar, estrutura = "lista", label = "Carregando nutrição…" }: { erro: string | null; carregando: boolean; recarregar: () => Promise<void>; estrutura?: EstruturaCarregamentoNutricional; label?: string }) {
  return <><ErrorBox erro={erro} />{erro && <Button secondary onClick={() => void recarregar()}>Tentar novamente</Button>}{!erro && carregando && <SkeletonConsultaNutricional estrutura={estrutura} label={label} />}</>;
}
export function SituacaoFechamento({ status }: { status: "CONFIRMADO" | "ESTORNADO" }) {
  return <Pill tone={status === "CONFIRMADO" ? "green" : "neutral"}>{status === "CONFIRMADO" ? "Confirmado" : "Estornado"}</Pill>;
}
export function CustosLote({ resumo: r }: { resumo: ResumoNutricional }) {
  return <Panel className={`nutricao-consumo-resumo${r.custos.fechamentos === 0 ? " nutricao-consumo-vazio" : ""}`}><div className="nutricao-card-cabecalho"><div><h2 className="h3">Consumo confirmado</h2><p>{r.custos.animalDias} animal-dias · {r.custos.fechamentos} {r.custos.fechamentos === 1 ? "fechamento" : "fechamentos"} · todo o histórico, estornos excluídos</p></div></div>
    {r.verValores && <><dl className="nutricao-fatos">
      <div><dt>Custo conhecido da nutrição</dt><dd>{custoTexto(r.custos.custoConhecido)}</dd><p>{r.custos.fechamentos === 0 ? "Nenhum consumo registrado" : r.custos.custoConhecido == null ? "Sem custo conhecido nos fechamentos confirmados" : r.custos.coberturaCustoCompleta ? "Custo integralmente apurado" : "Valor parcial · há consumo sem custo apurado"}</p></div>
      <div><dt>Custo médio por animal-dia <AjudaCampo rotulo="Sobre o custo médio por animal-dia" texto={"A média divide o custo conhecido pelos animal-dias dos mesmos fechamentos."} /></dt><dd>{custoTexto(r.custos.custoPorAnimalDia)}</dd><p>{r.custos.custoPorAnimalDia == null ? "Sem base para a média" : `Média ponderada${r.custos.coberturaCustoCompleta ? "" : " · parcial"}`}</p></div>
    </dl></>}
  </Panel>;
}
