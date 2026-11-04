import { AjudaCampo } from "@/components/Dica";
import { ReferenciaLeite } from "./ReferenciaLeite";
import { DistribuicaoCustoFechamento } from "./DistribuicaoCustoFechamento";
import { TabelaConsultaLocal } from "@/financeiro/TabelaConsultaLocal";
import { type ColunaTabela, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { formatarDataBR } from "../lib/rotulos";
import type { Fechamento } from "./api";
import { custoTexto, LinkNutricional, rotaNutricao, SituacaoFechamento } from "./componentes";

import { quantidadeNutricional } from "./quantidades";
import { LIMITE_DIVERGENCIA } from "./AlertasNutricao";

type Item = Fechamento["itens"][number];
const custoDoItem = (i: Item) => Number(i.quantidadeConfirmada) === 0 ? "0" : i.leite?.custoProducao ?? i.movimentoEstoque?.valorTotal ?? null;
/** Período de um dia aparece como uma data só. */
export const periodoFechamento = (f: Pick<Fechamento, "inicio" | "fim">) => f.inicio.slice(0, 10) === f.fim.slice(0, 10) ? formatarDataBR(f.inicio) : `${formatarDataBR(f.inicio)} a ${formatarDataBR(f.fim)}`;
/** Por que o custo não está completo: ingredientes ainda sem valor e a razão de cada um. */
function pendenciasCusto(f: Fechamento) {
  return f.itens.filter(i => custoDoItem(i) == null).map(i => i.leite ? `${i.produto.nome}: aguardando a apuração do custo de produção do leite` : `${i.produto.nome}: sem valor na baixa de estoque`);
}

export function DetalhesFechamento({ fechamento: f, podeLancar = false, onRecarregar }: { fechamento: Fechamento; podeLancar?: boolean; onRecarregar?: () => Promise<void> }) {
  // Até 8 ingredientes a tabela vai direta, sem busca, filtros nem ordenação.
  const colunasItens: ColunaTabela<Fechamento["itens"][number]>[] = [
        { chave: "ingrediente", titulo: "Ingrediente", principal: true, celula: (i) => <strong>{i.produto.nome}</strong> },
        { chave: "previsto", alinhamento: "direita" as const, titulo: "Previsto", celula: (i) => `${quantidadeNutricional(i.quantidadePrevista)} ${i.unidade}` },
        { chave: "conferido", alinhamento: "direita" as const, titulo: "Conferido", celula: (i) => `${quantidadeNutricional(i.quantidadeConfirmada)} ${i.unidade}` },
        { chave: "diferenca", alinhamento: "direita" as const, titulo: "Diferença", celula: (i) => { const p = Number(i.quantidadePrevista), c = Number(i.quantidadeConfirmada), d = c - p; if (Math.abs(d) < 0.0005) return <span className="nutricao-secundario">Igual ao previsto</span>; const v = p > 0 ? d / p : null; return <span className={v == null || Math.abs(v) > LIMITE_DIVERGENCIA ? "nutricao-alerta-texto" : undefined}>{d > 0 ? "+" : "−"}{quantidadeNutricional(String(Math.round(Math.abs(d) * 1000) / 1000))} {i.unidade}{v != null && ` (${d > 0 ? "+" : "−"}${Math.round(Math.abs(v) * 100)}%)`}</span>; } },
        { chave: "origem", titulo: "Origem", larguraMinima: 220, celula: (i) => <>{i.leite ? <Pill tone="green">Origens de leite produzido</Pill> : i.movimentoEstoque ? <><Pill tone="green">Baixa de estoque</Pill>{i.movimentoEstoque.alocacaoPartidaEstoques.map((a, idx) => <p className="nutricao-secundario mt-2" key={idx}>Partida {a.partida.nome || a.partida.codigo}: {quantidadeNutricional(a.quantidade)} {i.unidade}</p>)}</> : <Pill tone={Number(i.quantidadeConfirmada) === 0 ? "neutral" : "amber"}>{Number(i.quantidadeConfirmada) === 0 ? "Sem consumo" : "Sem baixa de estoque"}</Pill>}</> },
        ...(f.verValores ? [{ chave: "custo", alinhamento: "direita" as const, titulo: "Custo conhecido", celula: (i: Item) => custoTexto(custoDoItem(i)) }] : []),
      ];
  // Sem custo em nenhum animal, as colunas de custo só repetiriam "Não apurado".
  const custoAnimais = f.verValores && f.participacoes.some(p => p.custoConhecido != null);
  return <div className="nutricao-conteudo">
    <Panel className="nutricao-fechamento-resumo"><div className="nutricao-card-cabecalho"><div><h2 className="h3">Resumo do fechamento</h2><p>{periodoFechamento(f)} · {f.animalDias} animal-dias</p></div><SituacaoFechamento status={f.status} /></div><div className="nutricao-card-corpo nutricao-resumo">
      <div><span>Lote</span><LinkNutricional href={rotaNutricao({ loteId: f.lote.id })}>{f.lote.nome}</LinkNutricional></div><div><span>Sítio</span><strong>{f.propriedade.nome}</strong></div><div><span>Receita</span><strong>{f.vigencia.dieta.nome} · v{f.vigencia.dieta.versao}</strong></div><div><span>Centro de custo</span><strong>{f.centroCusto.nome}</strong></div>
    </div>{f.verValores && <dl className="nutricao-fatos nutricao-fatos-fechamento">
      <div><dt>Custo do fechamento</dt><dd>{custoTexto(f.custoConhecido)}</dd><p>{f.coberturaCustoCompleta ? "Custo integralmente apurado" : f.custoConhecido == null ? "Nenhum ingrediente com custo ainda" : "Parcial: falta o custo de parte dos ingredientes"}</p></div>
      {f.custoConhecido != null ? <div><dt>Custo por animal-dia</dt><dd>{custoTexto(f.animalDias > 0 ? String(Number(f.custoConhecido) / f.animalDias) : null)}</dd><p>Média do fechamento{f.coberturaCustoCompleta ? "" : " · parcial"}</p></div>
        : <div><dt>O que falta</dt><ul className="nutricao-motivos">{pendenciasCusto(f).map(m => <li key={m}>{m}</li>)}</ul></div>}
    </dl>}
    {f.status === "ESTORNADO" && <p className="nutricao-aviso mx-5 mb-5">Estornado · excluído dos custos atuais do lote. O consumo original permanece no histórico.{f.motivoEstorno && <> Motivo: {f.motivoEstorno}</>}</p>}</Panel>
    <Panel className="nutricao-consumo-estoque"><div className="nutricao-card-cabecalho"><div><h2 className="h3">Consumo e estoque </h2></div></div>
      <div className="nutricao-consumo-composicao"><div className="min-w-0">{f.itens.length > 8 ? <TabelaConsultaLocal camposOrdenaveis={[{chave:"previsto",rotulo:"Previsto (unidade do ingrediente)",tipo:"numero",obter:i=>i.quantidadePrevista},{chave:"conferido",rotulo:"Conferido (unidade do ingrediente)",tipo:"numero",obter:i=>i.quantidadeConfirmada}]} buscarPor={i=>i.produto.nome} definicoes={[
        {chave:"ingrediente",rotulo:"Ingrediente",tipo:"texto",obter:i=>i.produto.nome},
        ...(f.verValores?[{chave:"custo",rotulo:"Custo conhecido",tipo:"valor" as const,obter:(i: Fechamento["itens"][number])=>Number(i.quantidadeConfirmada)===0?"0":i.leite?.custoProducao??i.movimentoEstoque?.valorTotal??null,limiteSugerido:Math.max(1,...f.itens.map(i=>Number(i.leite?.custoProducao??i.movimentoEstoque?.valorTotal??0)))}]:[]),
      ]} rotulo="Ingredientes do fechamento" itens={f.itens} chaveDe={(i) => i.produtoId} colunas={colunasItens} /> : <TabelaFinanceira rotulo="Ingredientes do fechamento" itens={f.itens} chaveDe={(i) => i.produtoId} colunas={colunasItens} />}
    </div><DistribuicaoCustoFechamento fechamento={f} /></div></Panel>
    {f.itens.filter(i => i.leite).map(i => <Panel key={i.produtoId}><div className="nutricao-card-cabecalho"><h2 className="h3">Leite fornecido · {i.produto.nome}</h2></div><div className="nutricao-card-corpo"><ReferenciaLeite leite={i.leite!} propriedadeId={f.propriedadeId} verValores={f.verValores} verReferenciasComerciais={f.verReferenciasComerciais ?? false} animais={f.participacoes.map(p => ({ animalId: p.animalId, brinco: p.animal.brinco }))} podeLancar={podeLancar && f.status === "CONFIRMADO"} onRecarregar={onRecarregar} /></div></Panel>)}
    <Panel><div className="nutricao-card-cabecalho"><div><h2 className="h3">Atribuição aos animais <AjudaCampo rotulo="Sobre a atribuição aos animais" texto={"Estimativa proporcional aos dias no lote; não mede a ingestão individual."} /></h2></div><Pill>{f.participacoes.length} animais</Pill></div>
      {f.verValores && !custoAnimais && <p className="nutricao-nota px-5 pb-2">O custo de cada animal aparece quando o custo do fechamento for apurado.</p>}
      <TabelaConsultaLocal camposOrdenaveis={[{chave:"dias",rotulo:"Dias no lote",tipo:"numero",obter:p=>p.dias},...(custoAnimais?[{chave:"medio",rotulo:"Custo por animal-dia",tipo:"numero" as const,obter:(p:Fechamento["participacoes"][number])=>p.custoConhecidoPorDia}]:[])]} buscarPor={p=>p.animal.brinco} definicoes={[
        {chave:"animal",rotulo:"Animal",tipo:"texto",obter:p=>p.animal.brinco},
        ...(custoAnimais?[{chave:"custo",rotulo:"Custo conhecido",tipo:"valor" as const,obter:(p: Fechamento["participacoes"][number])=>p.custoConhecido,limiteSugerido:Math.max(1,...f.participacoes.map(p=>Number(p.custoConhecido??0)))}]:[]),
      ]} rotulo="Atribuição do consumo aos animais" itens={f.participacoes} chaveDe={(p) => p.animalId} colunas={[
        { chave: "animal", titulo: "Animal", principal: true, celula: (p) => <LinkNutricional href={`/pecuaria/rebanho/animais/${p.animalId}`}>{p.animal.brinco}</LinkNutricional> },
        { chave: "dias", alinhamento: "direita" as const, titulo: "Dias no lote", celula: (p) => p.dias },
        ...(custoAnimais ? [
          { chave: "custo", alinhamento: "direita" as const, titulo: "Custo conhecido", celula: (p: Fechamento["participacoes"][number]) => <>{custoTexto(p.custoConhecido)}{p.custoConhecido != null && !p.coberturaCustoCompleta && <p className="nutricao-secundario">Parcial</p>}</> },
          { chave: "medio", alinhamento: "direita" as const, titulo: "Por animal-dia", celula: (p: Fechamento["participacoes"][number]) => custoTexto(p.custoConhecidoPorDia) },
        ] : []),
        { chave: "consumo", titulo: "Consumo atribuído", larguraMinima: 240, celula: (p) => p.itens.length === 1 ? <span>{quantidadeNutricional(p.itens[0].quantidadeAtribuida)} {p.itens[0].unidade} <span className="nutricao-secundario">(≈ {quantidadeNutricional(p.itens[0].quantidadePorDia)} {p.itens[0].unidade}/dia)</span></span> : <details className="nutricao-consumo-atribuido"><summary>Ver ingredientes ({p.itens.length})</summary><div>{p.itens.map((i) => <p key={i.produtoId} className="nutricao-secundario mt-2">{f.itens.find((item) => item.produtoId === i.produtoId)?.produto.nome}: {quantidadeNutricional(i.quantidadeAtribuida)} {i.unidade} (≈ {quantidadeNutricional(i.quantidadePorDia)} {i.unidade}/dia){f.verValores && <> · {custoTexto(i.custoConhecido)}</>}</p>)}</div></details> },
      ]} />
    </Panel>
  </div>;
}
