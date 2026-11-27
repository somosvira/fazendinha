import { CustoMedioNutricao } from "./CustoMedioNutricao";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DIAS_ATENCAO, ingredientesEmFalta, textoCobertura, type CoberturaLote } from "./coberturaEstoque";
import type { ResumoNutricional } from "./api";
import { custoTexto, LinkNutricional, rotaNutricao } from "./componentes";
import { quantidadeNutricional, un } from "./quantidades";
import "./panorama-dietas.css";

/** Faixa de números do topo: cobertura de dietas com o efetivo, e o custo médio. Clicar em "sem dieta" filtra a lista abaixo. */
export function PanoramaDietas({ lotes, situacao, filtrar, verValores = false, cobertura }: { verValores?: boolean; lotes: ResumoNutricional[]; situacao: string; filtrar: (valor: string) => void; cobertura?: Map<string, CoberturaLote> | null }) {
  const faltas = cobertura ? ingredientesEmFalta(cobertura, lotes) : [];
  const alerta = faltas[0];
  const estoqueCurto = alerta?.dias != null && alerta.dias < DIAS_ATENCAO;
  const com = lotes.filter(r => r.vigente).length;
  const sem = lotes.length - com;
  const animais = lotes.reduce((soma,r) => soma+r.lote.animaisAtivos,0);
  if (!lotes.length) return null;
  return <dl className="dietas-resumo">
    <div>
      <dt>Lotes com dieta</dt>
      <dd className="dietas-resumo-valor">{com} de {lotes.length}</dd>
      {sem > 0 && <dd><button type="button" className="dietas-resumo-filtro" aria-pressed={situacao === "sem"}
        onClick={() => filtrar(situacao === "sem" ? "" : "sem")}>
        {sem} {sem === 1 ? "lote sem dieta" : "lotes sem dieta"} <ChevronRight size={14} aria-hidden />
      </button></dd>}
      <dd aria-label="Efetivo nos lotes">{animais.toLocaleString("pt-BR")} animais ativos nos lotes</dd>
    </div>
    {lotes.some(r => r.vigente) && <div><dt>Estoque das dietas</dt>
      {cobertura === undefined ? <dd><Skeleton className="h-7 w-24" /></dd> : cobertura === null ? <dd>Indisponível</dd> : alerta ? <>
        <dd className="dietas-resumo-valor dieta-cartao-alerta">{estoqueCurto
          ? alerta.dias === 0 ? "Sem saldo" : `Estoque para ${textoCobertura(alerta.dias)}`
          : `${quantidadeNutricional(String(alerta.vencendo))} ${un(alerta.unidade)} ${alerta.vencendo === 1 ? "vence" : "vencem"} antes do uso`}</dd>
        <dd>{alerta.nome}{faltas.length > 1 ? ` · e mais ${faltas.length - 1}` : ""}</dd>
        <dd><LinkNutricional className="dietas-resumo-filtro" href={rotaNutricao({ aba: "alertas" })}>
          {faltas.length === 1 ? "Ver alerta" : "Ver alertas"} <ChevronRight size={14} aria-hidden />
        </LinkNutricional></dd>
      </> : <><dd className="dietas-resumo-valor">Em dia</dd><dd>Todos os ingredientes cobrem pelo menos {DIAS_ATENCAO} dias</dd></>}
    </div>}
    {verValores && <CustoMedioNutricao lotes={lotes} cobertura={cobertura} />}
  </dl>;
}

/** Custo previsto por dia do lote, pelas baixas diárias valorizadas no custo médio do estoque. */
export const textoCustoDia = (c: CoberturaLote | undefined, cobertura: Map<string, CoberturaLote> | null | undefined) =>
  cobertura === undefined ? "…" : c?.custoDia == null ? "Sem custo" : custoTexto(c.custoDia.toFixed(2));

