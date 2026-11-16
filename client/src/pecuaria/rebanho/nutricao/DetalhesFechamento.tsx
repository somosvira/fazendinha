import { AjudaCampo } from "@/components/Dica";
import { ReferenciaLeite } from "./ReferenciaLeite";
import { DistribuicaoCustoFechamento } from "./DistribuicaoCustoFechamento";
import { TabelaConsultaLocal } from "@/financeiro/TabelaConsultaLocal";
import { type ColunaTabela, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { formatarDataBR } from "../lib/rotulos";
import type { Fechamento } from "./api";
import { custoTexto, LinkNutricional, rotaNutricao, SituacaoFechamento } from "./componentes";

import { quantidadeNutricional, un } from "./quantidades";
import { LIMITE_DIVERGENCIA } from "./AlertasNutricao";

type Item = Fechamento["itens"][number];
const custoDoItem = (i: Item) => Number(i.quantidadeConfirmada) === 0 ? "0" : i.leite?.custoProducao ?? i.movimentoEstoque?.valorTotal ?? null;
/** Período de um dia aparece como uma data só. */
export const periodoFechamento = (f: Pick<Fechamento, "inicio" | "fim">) => f.inicio.slice(0, 10) === f.fim.slice(0, 10) ? formatarDataBR(f.inicio) : `${formatarDataBR(f.inicio)} a ${formatarDataBR(f.fim)}`;
/** Por que o custo não está completo: ingredientes ainda sem valor e a razão de cada um. */
function pendenciasCusto(f: Fechamento) {
  return f.itens.filter(i => custoDoItem(i) == null).map(i => i.leite ? `${i.produto.nome}: aguardando a apuração do custo de produção do leite` : `${i.produto.nome}: sem valor na baixa de estoque`);
}

export function MetadadosFechamento({ fechamento: f }: { fechamento: Fechamento }) {
  return <span className="nutricao-fechamento-metadados">
    <span>{periodoFechamento(f)} · {f.propriedade.nome} · {f.animalDias.toLocaleString("pt-BR")} animal-dias</span>
    <SituacaoFechamento status={f.status} />
  </span>;
}

function diferencaConsumo(i: Item) {
  const previsto = Number(i.quantidadePrevista);
  const diferenca = Number(i.quantidadeConfirmada) - previsto;
  if (Math.abs(diferenca) < 0.0005) return null;
  const proporcao = previsto > 0 ? diferenca / previsto : null;
  const sinal = diferenca > 0 ? "+" : "−";
  const quantidade = quantidadeNutricional(String(Math.round(Math.abs(diferenca) * 1000) / 1000));
  return {
    texto: `${sinal}${quantidade} ${un(i.unidade)}${proporcao == null ? "" : ` (${sinal}${Math.round(Math.abs(proporcao) * 100)}%)`}`,
    alerta: proporcao == null || Math.abs(proporcao) > LIMITE_DIVERGENCIA,
  };
}

function DiferencaConsumo({ item }: { item: Item }) {
  const diferenca = diferencaConsumo(item);
  return diferenca
    ? <span className={diferenca.alerta ? "nutricao-fechamento-diferenca nutricao-alerta-texto" : undefined}>{diferenca.texto}</span>
    : <span className="nutricao-secundario">Igual ao previsto</span>;
}

export function DetalhesFechamento({ fechamento: f, podeLancar = false, metadadosNoCabecalho = false, onRecarregar }: { fechamento: Fechamento; podeLancar?: boolean; metadadosNoCabecalho?: boolean; onRecarregar?: () => Promise<void> }) {
  // Até 8 ingredientes a tabela vai direta, sem busca, filtros nem ordenação.
  const colunasItens: ColunaTabela<Fechamento["itens"][number]>[] = [
        { chave: "ingrediente", titulo: "Ingrediente", principal: true, celula: (i) => <strong>{i.produto.nome}</strong> },
        { chave: "previsto", alinhamento: "direita" as const, titulo: "Previsto", celula: (i) => `${quantidadeNutricional(i.quantidadePrevista)} ${un(i.unidade)}` },
        { chave: "conferido", alinhamento: "direita" as const, titulo: "Conferido", celula: (i) => `${quantidadeNutricional(i.quantidadeConfirmada)} ${un(i.unidade)}` },
        { chave: "diferenca", alinhamento: "direita", titulo: "Diferença", celula: i => <DiferencaConsumo item={i} /> },
        { chave: "origem", titulo: "Origem", larguraMinima: 220, celula: (i) => <>{i.leite ? <Pill tone="green">Origens de leite produzido</Pill> : i.movimentoEstoque ? <><Pill tone="green">Baixa de estoque</Pill>{i.movimentoEstoque.alocacaoPartidaEstoques.map((a, idx) => <p className="nutricao-secundario mt-2" key={idx}>Partida {a.partida.nome || a.partida.codigo}: {quantidadeNutricional(a.quantidade)} {un(i.unidade)}</p>)}</> : <Pill tone={Number(i.quantidadeConfirmada) === 0 ? "neutral" : "amber"}>{Number(i.quantidadeConfirmada) === 0 ? "Sem consumo" : "Sem baixa de estoque"}</Pill>}</> },
        ...(f.verValores ? [{ chave: "custo", alinhamento: "direita" as const, titulo: "Custo conhecido", celula: (i: Item) => custoTexto(custoDoItem(i)) }] : []),
      ];
  // Sem custo em nenhum animal, as colunas de custo só repetiriam "Não apurado".
  const custoAnimais = f.verValores && f.participacoes.some(p => p.custoConhecido != null);
  return <div className="nutricao-conteudo">
    <section className="nutricao-fechamento-resumo" aria-labelledby="nutricao-resumo-fechamento">
      <h2 id="nutricao-resumo-fechamento" className="sr-only">Resumo do fechamento</h2>
      {!metadadosNoCabecalho && <MetadadosFechamento fechamento={f} />}
      <dl className="nutricao-fechamento-indicadores">
        <div>
          <dt>Consumo conferido</dt>
          {f.itens.length === 1 ? <><dd>{quantidadeNutricional(f.itens[0].quantidadeConfirmada)} {un(f.itens[0].unidade)}</dd>
            <dd>{quantidadeNutricional(f.itens[0].quantidadePrevista)} {un(f.itens[0].unidade)} previstos · <DiferencaConsumo item={f.itens[0]} /></dd>
          </> : <dd>{f.itens.length} ingredientes</dd>}
        </div>
        {f.verValores && <div>
          <dt>Custo do fechamento</dt><dd>{custoTexto(f.custoConhecido)}</dd>
          <dd>{f.coberturaCustoCompleta ? <p>Custo integralmente apurado</p> : <>
            {f.custoConhecido != null && <p>Parcial: falta o custo de parte dos ingredientes</p>}
            <ul className="nutricao-motivos">{pendenciasCusto(f).map(m => <li key={m}>{m}</li>)}</ul>
          </>}
          {f.custoConhecido != null && <p>Custo por animal-dia: <strong>{custoTexto(f.animalDias > 0 ? String(Number(f.custoConhecido) / f.animalDias) : null)}</strong></p>}</dd>
        </div>}
      </dl>
      <dl className="nutricao-fechamento-contexto">
        <div><dt>Receita</dt><dd>{f.vigencia.dieta.nome} · v{f.vigencia.dieta.versao}</dd></div>
        <div><dt>Centro de custo</dt><dd>{f.centroCusto.nome}</dd></div>
        <div><dt className="sr-only">Lote</dt><dd><LinkNutricional href={rotaNutricao({ loteId: f.lote.id })}>Ver lote</LinkNutricional></dd></div>
      </dl>
      {f.status === "ESTORNADO" && <p className="nutricao-aviso">Estornado · excluído dos custos atuais do lote. O consumo original permanece no histórico.{f.motivoEstorno && <> Motivo: {f.motivoEstorno}</>}</p>}
    </section>
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
        { chave: "consumo", titulo: "Consumo atribuído", larguraMinima: 240, celula: (p) => p.itens.length === 1 ? <span>{quantidadeNutricional(p.itens[0].quantidadeAtribuida)} {p.itens[0].unidade} <span className="nutricao-secundario">(≈ {quantidadeNutricional(p.itens[0].quantidadePorDia)} {p.itens[0].unidade}/dia)</span></span> : <div className="nutricao-consumo-atribuido">{p.itens.map((i) => <p key={i.produtoId} className="nutricao-secundario mt-2">{f.itens.find((item) => item.produtoId === i.produtoId)?.produto.nome}: {quantidadeNutricional(i.quantidadeAtribuida)} {un(i.unidade)} (≈ {quantidadeNutricional(i.quantidadePorDia)} {un(i.unidade)}/dia){f.verValores && <> · {custoTexto(i.custoConhecido)}</>}</p>)}</div> },
      ]} />
    </Panel>
  </div>;
}
