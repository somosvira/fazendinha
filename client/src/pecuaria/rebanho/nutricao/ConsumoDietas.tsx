import { LinkInterno } from "@/components/LinkInterno";
import { Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { consumoDasDietas, hrefProdutoEstoque, type CoberturaLote } from "./coberturaEstoque";
import { custoTexto } from "./componentes";
import { quantidadeNutricional, un } from "./quantidades";
import { ICONES_TABELA } from "../../../components/iconesTabela";

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

/** Quanto de cada produto as dietas vigentes consomem por dia, somando os lotes de animais, e a projeção do mês. */
export function ConsumoDietas({ cobertura, verValores, sitios }: { cobertura: Map<string, CoberturaLote>; verValores: boolean; sitios: Map<number, string> }) {
  const { itens } = consumoDasDietas(cobertura);
  if (!itens.length) return null;
  const variosSitios = new Set(itens.map(i => i.propriedadeId)).size > 1;
  const custoMes = itens.reduce((s, i) => s + (i.custoMes ?? 0), 0);
  return <Panel>
    <div className="nutricao-card-cabecalho consumo-cabecalho">
      <div className="consumo-cabecalho-titulo"><h2 className="h3">Consumo das dietas</h2></div>
      {verValores && custoMes > 0 && <div className="consumo-custo-previsto"><span>Custo previsto no mês</span><strong>{custoTexto(custoMes.toFixed(2))}</strong></div>}
    </div>
    {<TabelaFinanceira icone={ICONES_TABELA.consumo} rotulo="Consumo diário das dietas vigentes" itens={itens} chaveDe={i => `${i.propriedadeId}:${i.produtoId}`} colunas={[
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
