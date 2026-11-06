import { LinkInterno } from "@/components/LinkInterno";
import { hoje, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { consumoDasDietas, hrefProdutoEstoque, type CoberturaLote } from "./coberturaEstoque";
import { custoTexto } from "./componentes";
import { quantidadeNutricional, un } from "./quantidades";

const qtd = (n: number) => quantidadeNutricional(String(Math.round(n * 1000) / 1000));
type Item = ReturnType<typeof consumoDasDietas>["itens"][number];

/** Quanto de cada produto as dietas vigentes consomem por dia, somando os lotes de animais, e a projeção do mês. */
export function ConsumoDietas({ cobertura, verValores, sitios }: { cobertura: Map<string, CoberturaLote>; verValores: boolean; sitios: Map<number, string> }) {
  const { diasNoMes, itens } = consumoDasDietas(cobertura);
  if (!itens.length) return null;
  const variosSitios = new Set(itens.map(i => i.propriedadeId)).size > 1;
  const custoMes = itens.reduce((s, i) => s + (i.custoMes ?? 0), 0);
  return <Panel>
    <div className="nutricao-card-cabecalho"><div><h2 className="h3">Consumo das dietas</h2><p>Soma de todas as dietas vigentes com o efetivo de hoje. O mês tem {diasNoMes} dias{verValores && custoMes > 0 ? <>; custo previsto de <strong>{custoTexto(custoMes.toFixed(2))}</strong> no mês</> : ""}.</p></div></div>
    <TabelaFinanceira rotulo="Consumo diário das dietas vigentes" itens={itens} chaveDe={i => `${i.propriedadeId}:${i.produtoId}`} colunas={[
      { chave: "produto", titulo: "Ingrediente", principal: true, celula: (i: Item) => <><LinkInterno area="estoque" href={hrefProdutoEstoque(i.produtoId)}>{i.nome}</LinkInterno>{variosSitios && <p className="nutricao-secundario">{sitios.get(i.propriedadeId)}</p>}</> },
      { chave: "dia", titulo: "Por dia", alinhamento: "direita", celula: (i: Item) => `${qtd(i.consumoSitioDia)} ${un(i.unidade)}` },
      { chave: "mes", titulo: "Previsto no mês", alinhamento: "direita", celula: (i: Item) => `${qtd(i.mesPrevisto)} ${un(i.unidade)}` },
      { chave: "saldo", titulo: "Saldo", alinhamento: "direita", celula: (i: Item) => <span className={i.saldo < i.mesPrevisto ? "nutricao-alerta-texto" : undefined}>{qtd(i.saldo)} {un(i.unidade)}</span> },
      ...(verValores ? [
        { chave: "custoDia", titulo: "Custo por dia", alinhamento: "direita" as const, celula: (i: Item) => i.custoDia == null ? <span className="nutricao-secundario">Sem custo no estoque</span> : custoTexto(i.custoDia.toFixed(2)) },
        { chave: "custoMes", titulo: "Custo no mês", alinhamento: "direita" as const, celula: (i: Item) => i.custoMes == null ? <span className="nutricao-secundario">—</span> : custoTexto(i.custoMes.toFixed(2)) },
      ] : []),
    ]} />
    <p className="nutricao-nota px-5 pb-4">Projeção do mês inteiro; hoje é dia {Number(hoje().slice(8))}. Saldo em vermelho não cobre o previsto no mês.</p>
  </Panel>;
}
