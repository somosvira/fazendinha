import { CustoMedioNutricao } from "./CustoMedioNutricao";
import { rotaOperacaoNutricional } from "./navegacao";
import { CalendarDays, ChevronRight, Leaf, MapPin, Package, Wallet } from "lucide-react";
import { VacaIcon } from "@/components/icons/VacaIcon";
import { Pill } from "@/financeiro/financeiro-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { DIAS_ATENCAO, ingredientesEmFalta, textoCobertura, type CoberturaLote } from "./coberturaEstoque";
import type { ResumoNutricional } from "./api";
import { custoTexto, LinkNutricional, rotaNutricao } from "./componentes";
import { formatarDataBR } from "../lib/rotulos";
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

/** Cartões no mesmo padrão de Lotes e Estoque: nome e sítio, situação no canto, a dieta em destaque e as medidas do lote. */
export function CartoesNutricao({ lotes, verValores, podeLancar = false, cobertura }: { lotes: ResumoNutricional[]; verValores: boolean; podeLancar?: boolean; cobertura?: Map<string, CoberturaLote> | null }) {
  return <div className="consulta-cartoes dietas-cartoes">{lotes.map(r => {
    const c = cobertura?.get(r.lote.id);
    const curto = c?.dias != null && c.dias < DIAS_ATENCAO;
    return <article className="consulta-cartao dieta-cartao" key={r.lote.id}>
      <header><div><h2><LinkNutricional className="dietas-cartao-link" href={rotaNutricao({ loteId: r.lote.id })}>{r.lote.nome}</LinkNutricional></h2><p className="consulta-cartao-meta"><MapPin size={14} aria-hidden />{r.lote.propriedade.nome}</p></div><Pill tone={r.vigente ? "green" : "amber"}>{r.vigente ? "Com dieta" : "Sem dieta"}</Pill></header>
      <div className="dieta-cartao-destaque">
        <span className="dieta-cartao-rotulo"><Leaf size={14} aria-hidden />Dieta vigente</span>
        {r.vigente ? <><strong>{r.vigente.dieta.nome}</strong><small>v{r.vigente.dieta.versao} · desde {formatarDataBR(r.vigente.desde)}</small></> : <strong className="dieta-cartao-vazia">Nenhuma dieta atribuída</strong>}
      </div>
      <dl className="dieta-cartao-medidas">
        <div><dt><VacaIcon width={15} height={15} aria-hidden />Animais</dt><dd>{r.lote.animaisAtivos}</dd></div>
        {verValores && r.vigente && <div><dt><CalendarDays size={14} aria-hidden />Custo diário</dt><dd>{textoCustoDia(c, cobertura)}</dd>{c?.custoParcial && <small>Parcial</small>}</div>}
        {verValores && <div><dt><Wallet size={14} aria-hidden />Custo histórico</dt><dd>{r.custos.fechamentos === 0 ? "Sem fechamentos" : custoTexto(r.custos.custoConhecido)}</dd>{r.custos.custoConhecido != null && !r.custos.coberturaCustoCompleta && <small>Parcial</small>}</div>}
      </dl>
      {r.vigente && <p className="dieta-cartao-estoque"><Package size={14} aria-hidden /><span>Estoque para <strong className={curto ? "dieta-cartao-alerta" : undefined}>{cobertura === undefined ? "…" : c ? textoCobertura(c.dias) : "—"}</strong>{c?.limitante && c.dias != null && <> · {c.limitante.nome} acaba primeiro</>}</span></p>}
      {r.programada && <p className="dietas-programada">Próxima dieta: <strong>{r.programada.dieta.nome}</strong> em {formatarDataBR(r.programada.desde)}</p>}
      <footer><LinkNutricional href={rotaNutricao({ loteId: r.lote.id })}>Ver lote</LinkNutricional>{podeLancar && <LinkNutricional className={r.vigente ? "nutricao-botao-secundario" : "nutricao-botao"} href={rotaOperacaoNutricional("atribuir", r.lote.id)}>{r.vigente ? "Trocar dieta" : "Atribuir dieta"}</LinkNutricional>}</footer>
    </article>;
  })}</div>;
}
