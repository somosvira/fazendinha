import { LinkInterno } from "@/components/LinkInterno";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { CalendarDays, MapPin, Wallet } from "lucide-react";
import { Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { consumoDasDietas, hrefProdutoEstoque, type CoberturaLote } from "./coberturaEstoque";
import { custoTexto } from "./componentes";
import { quantidadeNutricional, un } from "./quantidades";

const qtd = (n: number) => quantidadeNutricional(String(Math.round(n * 1000) / 1000));
type Item = ReturnType<typeof consumoDasDietas>["itens"][number];
type Grupo = { produtoId: string; nome: string; unidade: string; porDia: number; custoMes: number | null; semCusto: boolean; sitios: Item[] };

/** Um cartão por ingrediente: os sítios ficam dentro, cada um com o saldo contra o previsto no mês. */
function agrupar(itens: Item[]): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const i of itens) {
    const g = grupos.get(i.produtoId) ?? { produtoId: i.produtoId, nome: i.nome, unidade: i.unidade, porDia: 0, custoMes: null, semCusto: false, sitios: [] };
    g.porDia += i.consumoSitioDia;
    if (i.custoMes == null) g.semCusto = true; else g.custoMes = (g.custoMes ?? 0) + i.custoMes;
    g.sitios.push(i);
    grupos.set(i.produtoId, g);
  }
  return [...grupos.values()].sort((a, b) => (b.custoMes ?? -1) - (a.custoMes ?? -1) || a.nome.localeCompare(b.nome, "pt-BR"));
}

function CartoesConsumo({ itens, verValores, sitios, variosSitios }: { itens: Item[]; verValores: boolean; sitios: Map<number, string>; variosSitios: boolean }) {
  return <div className="consulta-cartoes dietas-cartoes consumo-cartoes">{agrupar(itens).map(g => {
    const falta = g.sitios.some(s => s.saldo < s.mesPrevisto);
    return <article className="consulta-cartao dieta-cartao consumo-cartao" key={g.produtoId}>
      <header><div><h3><LinkInterno area="estoque" href={hrefProdutoEstoque(g.produtoId)}>{g.nome}</LinkInterno></h3>
        {variosSitios && <p className="consulta-cartao-meta"><MapPin size={14} aria-hidden />{g.sitios.length} {g.sitios.length === 1 ? "sítio" : "sítios"}</p>}</div></header>
      <dl className="dieta-cartao-medidas">
        <div><dt><CalendarDays size={14} aria-hidden />Por dia</dt><dd>{qtd(g.porDia)} {un(g.unidade)}</dd></div>
        {verValores && <div><dt><Wallet size={14} aria-hidden />Custo no mês</dt><dd>{g.custoMes == null ? "Sem custo" : custoTexto(g.custoMes.toFixed(2))}</dd>{g.custoMes != null && g.semCusto && <small>Parcial</small>}</div>}
      </dl>
      <ul className="consumo-cartao-sitios" aria-label={`Saldo de ${g.nome} contra o previsto no mês`}>{g.sitios.map(s => {
        const cobre = s.mesPrevisto > 0 ? Math.min(1, s.saldo / s.mesPrevisto) : 1;
        const curto = s.saldo < s.mesPrevisto;
        return <li key={s.propriedadeId}>
          <div className="consumo-cartao-linha">{variosSitios && <span>{sitios.get(s.propriedadeId)}</span>}<strong className={curto ? "dieta-cartao-alerta" : undefined}>{curto ? `faltam ${qtd(s.mesPrevisto - s.saldo)} ${un(s.unidade)}` : "cobre o mês"}</strong></div>
          <div className="consumo-cartao-barra" data-curto={curto || undefined}><span style={{ width: `${Math.round(cobre * 100)}%` }} /></div>
          <small>Estoque {qtd(s.saldo)} {un(s.unidade)} · mês {qtd(s.mesPrevisto)} {un(s.unidade)}</small>
        </li>;
      })}</ul>
      {falta && <p className="dieta-cartao-estoque">O saldo de algum sítio não cobre o previsto no mês.</p>}
    </article>;
  })}</div>;
}

/** Quanto de cada produto as dietas vigentes consomem por dia, somando os lotes de animais, e a projeção do mês. */
export function ConsumoDietas({ cobertura, verValores, sitios }: { cobertura: Map<string, CoberturaLote>; verValores: boolean; sitios: Map<number, string> }) {
  const visualizacao = useVisualizacaoConsulta("consumo", "nutricao", "visual");
  const { itens } = consumoDasDietas(cobertura);
  if (!itens.length) return null;
  const variosSitios = new Set(itens.map(i => i.propriedadeId)).size > 1;
  const custoMes = itens.reduce((s, i) => s + (i.custoMes ?? 0), 0);
  return <Panel>
    <div className="nutricao-card-cabecalho consumo-cabecalho">
      <div className="consumo-cabecalho-titulo"><h2 className="h3">Consumo das dietas</h2><AlternarVisualizacaoConsulta {...visualizacao} rotulo="Visualização do consumo das dietas" /></div>
      {verValores && custoMes > 0 && <div className="consumo-custo-previsto"><span>Custo previsto no mês</span><strong>{custoTexto(custoMes.toFixed(2))}</strong></div>}
    </div>
    {visualizacao.modo === "visual" ? <CartoesConsumo itens={itens} verValores={verValores} sitios={sitios} variosSitios={variosSitios} /> : <TabelaFinanceira rotulo="Consumo diário das dietas vigentes" itens={itens} chaveDe={i => `${i.propriedadeId}:${i.produtoId}`} colunas={[
      { chave: "produto", titulo: "Ingrediente", principal: true, celula: (i: Item) => <><LinkInterno area="estoque" href={hrefProdutoEstoque(i.produtoId)}>{i.nome}</LinkInterno>{variosSitios && <p className="nutricao-secundario">{sitios.get(i.propriedadeId)}</p>}</> },
      { chave: "dia", titulo: "Por dia", alinhamento: "direita", celula: (i: Item) => `${qtd(i.consumoSitioDia)} ${un(i.unidade)}` },
      { chave: "mes", titulo: "Previsto no mês", alinhamento: "direita", celula: (i: Item) => `${qtd(i.mesPrevisto)} ${un(i.unidade)}` },
      { chave: "saldo", titulo: "Saldo", alinhamento: "direita", celula: (i: Item) => <span className={i.saldo < i.mesPrevisto ? "nutricao-alerta-texto" : undefined}>{qtd(i.saldo)} {un(i.unidade)}</span> },
      ...(verValores ? [
        { chave: "custoDia", titulo: "Custo por dia", alinhamento: "direita" as const, celula: (i: Item) => i.custoDia == null ? <span className="nutricao-secundario">Sem custo no estoque</span> : custoTexto(i.custoDia.toFixed(2)) },
        { chave: "custoMes", titulo: "Custo no mês", alinhamento: "direita" as const, celula: (i: Item) => i.custoMes == null ? <span className="nutricao-secundario">—</span> : custoTexto(i.custoMes.toFixed(2)) },
      ] : []),
    ]} />}
  </Panel>;
}
