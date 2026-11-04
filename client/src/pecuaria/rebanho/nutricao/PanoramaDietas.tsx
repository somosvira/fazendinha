import { CustoMedioNutricao } from "./CustoMedioNutricao";
import { rotaOperacaoNutricional } from "./navegacao";
import { Pill } from "@/financeiro/financeiro-ui";
import type { ResumoNutricional } from "./api";
import { custoTexto, LinkNutricional, rotaNutricao } from "./componentes";
import { formatarDataBR } from "../lib/rotulos";
import "./panorama-dietas.css";

/** Faixa de números do topo: cobertura de dietas com o efetivo, e o custo médio. Clicar em "sem dieta" filtra a lista abaixo. */
export function PanoramaDietas({ lotes, situacao, filtrar, verValores = false }: { verValores?: boolean; lotes: ResumoNutricional[]; situacao: string; filtrar: (valor: string) => void }) {
  const com = lotes.filter(r => r.vigente).length;
  const sem = lotes.length - com;
  const animais = lotes.reduce((soma,r) => soma+r.lote.animaisAtivos,0);
  if (!lotes.length) return null;
  return <dl className="dietas-resumo">
    <div><dt>Lotes com dieta</dt><dd>{com} de {lotes.length}</dd><small aria-label="Efetivo nos lotes">{animais.toLocaleString("pt-BR")} animais ativos nos lotes</small>{sem > 0 ? <button type="button" className="dietas-resumo-filtro" aria-pressed={situacao === "sem"} onClick={() => filtrar(situacao === "sem" ? "" : "sem")}>{sem} {sem === 1 ? "lote sem dieta" : "lotes sem dieta"}</button> : <small>Todos com dieta vigente</small>}</div>
    {verValores && <CustoMedioNutricao />}
  </dl>;
}

export function CartoesNutricao({ lotes, verValores, podeLancar = false }: { lotes: ResumoNutricional[]; verValores: boolean; podeLancar?: boolean }) {
  return <div className="dietas-cartoes">{lotes.map(r=><article className="dietas-cartao" key={r.lote.id}><header><div className="dietas-cartao-identidade"><h3><LinkNutricional className="dietas-cartao-link" href={rotaNutricao({loteId:r.lote.id})}>{r.lote.nome}</LinkNutricional></h3><p>{r.lote.propriedade.nome}</p></div></header><dl><div><dt>Animais</dt><dd className="dietas-cartao-efetivo">{r.lote.animaisAtivos} {r.lote.animaisAtivos === 1 ? "animal" : "animais"}</dd></div><div><dt>Dieta vigente</dt><dd>{r.vigente ? <><strong>{r.vigente.dieta.nome}</strong><small>v{r.vigente.dieta.versao} · desde {formatarDataBR(r.vigente.desde)}</small></> : <Pill tone="amber">Sem dieta vigente</Pill>}</dd></div>{verValores && <div><dt>Custo histórico</dt><dd>{r.custos.fechamentos === 0 ? "Sem fechamentos" : custoTexto(r.custos.custoConhecido)}{r.custos.custoConhecido != null && !r.custos.coberturaCustoCompleta && <small>Parcial</small>}</dd></div>}</dl>{r.programada && <p className="dietas-programada">Próxima dieta: <strong>{r.programada.dieta.nome}</strong> em {formatarDataBR(r.programada.desde)}</p>}<footer className="dietas-cartao-acoes">{podeLancar && <LinkNutricional className={r.vigente ? "nutricao-botao-secundario" : "nutricao-botao"} href={rotaOperacaoNutricional("atribuir", r.lote.id)}>{r.vigente ? "Trocar dieta" : "Atribuir dieta"}</LinkNutricional>}</footer></article>)}</div>;
}
