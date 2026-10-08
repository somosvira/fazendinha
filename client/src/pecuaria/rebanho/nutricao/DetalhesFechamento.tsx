import { CalendarDays, Banknote, Users, CircleDollarSign } from "lucide-react";
import { Metric, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { formatarDataBR } from "../lib/rotulos";
import type { Fechamento } from "./api";
import { custoTexto, LinkNutricional, rotaNutricao, SituacaoFechamento } from "./componentes";

export function DetalhesFechamento({ fechamento: f }: { fechamento: Fechamento }) {
  return <div className="nutricao-conteudo">
    <Panel><div className="nutricao-card-cabecalho"><div><h2 className="h3">Resumo do fechamento</h2><p>{formatarDataBR(f.inicio)} – {formatarDataBR(f.fim)}</p></div><SituacaoFechamento status={f.status} /></div><div className="nutricao-card-corpo nutricao-resumo">
      <div><span>Lote</span><LinkNutricional href={rotaNutricao({ loteId: f.lote.id })}>{f.lote.nome}</LinkNutricional></div><div><span>Sítio</span><strong>{f.propriedade.nome}</strong></div><div><span>Receita</span><strong>{f.vigencia.dieta.nome} · v{f.vigencia.dieta.versao}</strong></div><div><span>Centro de custo</span><strong>{f.centroCusto.nome}</strong></div>
    </div>{f.status === "ESTORNADO" && <p className="nutricao-aviso mx-5 mb-5">Estornado · excluído dos custos atuais do lote. O consumo original permanece no histórico.{f.motivoEstorno && <> Motivo: {f.motivoEstorno}</>}</p>}</Panel>
    <div className="nutricao-metricas">{f.verValores && <><Metric icon={Banknote} label="Custo conhecido" valor={custoTexto(f.custoConhecido)} detalhe={f.coberturaCustoCompleta ? "Cobertura completa" : "Cobertura incompleta · valor parcial"} /><Metric icon={CircleDollarSign} label="Custo por animal-dia" valor={custoTexto(f.custoConhecido != null && f.animalDias > 0 ? String(Number(f.custoConhecido) / f.animalDias) : null)} detalhe={`Média do fechamento${f.coberturaCustoCompleta ? "" : " · parcial"}`} /></>}<Metric icon={CalendarDays} label="Animal-dias" valor={String(f.animalDias)} detalhe="Permanência no período confirmado" /><Metric icon={Users} label="Participantes" valor={String(f.participacoes.length)} detalhe="Animais com permanência no período" /></div>
    <Panel><div className="nutricao-card-cabecalho"><div><h2 className="h3">Consumo e estoque</h2><p>Quantidade prevista, conferida e origem dos ingredientes.</p></div></div>
      <TabelaFinanceira rotulo="Ingredientes do fechamento" itens={f.itens} chaveDe={(i) => i.produtoId} colunas={[
        { chave: "ingrediente", titulo: "Ingrediente", principal: true, celula: (i) => <strong>{i.produto.nome}</strong> },
        { chave: "previsto", titulo: "Previsto", celula: (i) => `${i.quantidadePrevista} ${i.unidade}` },
        { chave: "conferido", titulo: "Conferido", celula: (i) => `${i.quantidadeConfirmada} ${i.unidade}` },
        { chave: "origem", titulo: "Origem", larguraMinima: 220, celula: (i) => <>{i.movimentoEstoque ? <><Pill tone="green">Baixa de estoque</Pill>{i.movimentoEstoque.alocacaoPartidaEstoques.map((a, idx) => <p className="nutricao-secundario mt-2" key={idx}>lote {a.partida.nome || a.partida.codigo}: {a.quantidade} {i.unidade}</p>)}</> : <Pill tone={Number(i.quantidadeConfirmada) === 0 ? "neutral" : "amber"}>{Number(i.quantidadeConfirmada) === 0 ? "Sem consumo" : "Sem baixa de estoque"}</Pill>}</> },
        ...(f.verValores ? [{ chave: "custo", titulo: "Custo conhecido", celula: (i: Fechamento["itens"][number]) => custoTexto(Number(i.quantidadeConfirmada) === 0 ? "0" : i.movimentoEstoque?.valorTotal ?? null) }] : []),
      ]} />
    </Panel>
    <Panel><div className="nutricao-card-cabecalho"><div><h2 className="h3">Atribuição aos animais</h2><p>Estimativa proporcional aos dias no lote; não mede a ingestão individual.</p></div><Pill>{f.participacoes.length} animais</Pill></div>
      <TabelaFinanceira rotulo="Atribuição do consumo aos animais" itens={f.participacoes} chaveDe={(p) => p.animalId} colunas={[
        { chave: "animal", titulo: "Animal", principal: true, celula: (p) => <LinkNutricional href={`/pecuaria/rebanho/animais/${p.animalId}`}>{p.animal.brinco}</LinkNutricional> },
        { chave: "dias", titulo: "Dias no lote", celula: (p) => p.dias },
        ...(f.verValores ? [
          { chave: "custo", titulo: "Custo conhecido", celula: (p: Fechamento["participacoes"][number]) => <>{custoTexto(p.custoConhecido)}{p.custoConhecido != null && !p.coberturaCustoCompleta && <p className="nutricao-secundario">Parcial</p>}</> },
          { chave: "medio", titulo: "Por animal-dia", celula: (p: Fechamento["participacoes"][number]) => custoTexto(p.custoConhecidoPorDia) },
        ] : []),
        { chave: "consumo", titulo: "Consumo atribuído", larguraMinima: 240, celula: (p) => <details><summary className="nutricao-link cursor-pointer">Ver ingredientes</summary>{p.itens.map((i) => <p key={i.produtoId} className="nutricao-secundario mt-2">{f.itens.find((item) => item.produtoId === i.produtoId)?.produto.nome}: {i.quantidadeAtribuida} {i.unidade} (≈ {i.quantidadePorDia} {i.unidade}/dia){f.verValores && <> · {custoTexto(i.custoConhecido)}</>}</p>)}</details> },
      ]} />
    </Panel>
  </div>;
}
