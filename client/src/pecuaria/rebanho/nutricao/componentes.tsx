import type { ReactNode } from "react";
import { Banknote, CalendarDays, CircleDollarSign, Users } from "lucide-react";
import { Button, ErrorBox, Metric, Pill } from "../../../financeiro/financeiro-ui";
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
  return <a href={href} className={className} onClick={(e) => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); navegarPara(href); } }}>{children}</a>;
}
export function EstadoConsulta({ erro, carregando, recarregar }: { erro: string | null; carregando: boolean; recarregar: () => Promise<void> }) {
  return <><ErrorBox erro={erro} />{erro && <Button secondary onClick={() => void recarregar()}>Tentar novamente</Button>}{carregando && <p role="status" className="py-6 text-sm text-ink-3">Carregando nutrição…</p>}</>;
}
export function SituacaoFechamento({ status }: { status: "CONFIRMADO" | "ESTORNADO" }) {
  return <Pill tone={status === "CONFIRMADO" ? "green" : "neutral"}>{status === "CONFIRMADO" ? "Confirmado" : "Estornado"}</Pill>;
}
export function CustosLote({ resumo: r }: { resumo: ResumoNutricional }) {
  return <><div className="nutricao-metricas">
    {r.verValores && <>
      <Metric icon={Banknote} label="Custo total da nutrição" valor={custoTexto(r.custos.custoConhecido)} detalhe={r.custos.custoConhecido == null ? "Sem custo conhecido nos fechamentos confirmados" : r.custos.coberturaCustoCompleta ? "Todo o histórico confirmado · cobertura completa" : "Valor parcial · há consumo sem custo apurado"} />
      <Metric icon={CircleDollarSign} label="Custo médio por animal-dia" valor={custoTexto(r.custos.custoPorAnimalDia)} detalhe={r.custos.custoPorAnimalDia == null ? "Sem base para a média" : `${r.custos.animalDias} animal-dias · média ponderada${r.custos.coberturaCustoCompleta ? "" : " parcial"}`} />
    </>}
    <Metric icon={CalendarDays} label="Animal-dias confirmados" valor={String(r.custos.animalDias)} detalhe={`${r.custos.fechamentos} fechamento(s) · estornos excluídos`} />
    <Metric icon={Users} label="Animais no lote hoje" valor={String(r.lote.animaisAtivos)} detalhe="Animais ativos · composição atual do lote" />
  </div>{r.verValores && <p className="nutricao-nota">Custos do consumo confirmado em todo o histórico, sem estornos. A média divide o custo conhecido pelos animal-dias dos mesmos fechamentos.</p>}</>;
}
