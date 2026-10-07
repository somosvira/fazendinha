import { fmtMoneyExact } from "../../../components/charts";
import { formatarDataBR } from "../lib/rotulos";
import type { Fechamento } from "./api";

export function DetalhesFechamento({ fechamento: f }: { fechamento: Fechamento }) {
  return <div className="mt-3 space-y-2 text-sm">
    <p>{f.lote.nome} · {formatarDataBR(f.inicio)} – {formatarDataBR(f.fim)} · {f.status === "CONFIRMADO" ? "Confirmado" : "Estornado — fora do consumo atual"}</p>
    <p>{f.vigencia.dieta.nome} v{f.vigencia.dieta.versao} · centro {f.centroCusto.nome}</p>
    {f.verValores && <p>Custo conhecido: {f.custoConhecido == null ? "não apurado" : fmtMoneyExact(Number(f.custoConhecido))} · {f.coberturaCustoCompleta ? "cobertura completa" : "cobertura incompleta"}</p>}
    {f.itens.map((i) => <p key={i.produtoId}>{i.produto.nome}: conferido {i.quantidadeConfirmada} {i.unidade} · previsto {i.quantidadePrevista} {i.unidade}
      {f.verValores && <> · custo {i.movimentoEstoque?.valorTotal == null ? (Number(i.quantidadeConfirmada) === 0 ? fmtMoneyExact(0) : "não apurado") : fmtMoneyExact(Number(i.movimentoEstoque.valorTotal))}</>}
      {i.movimentoEstoque?.alocacaoPartidaEstoques.map((a) => ` · lote ${a.partida.nome || a.partida.codigo}: ${a.quantidade} ${i.unidade}`).join("")}</p>)}
    <p className="font-semibold">Atribuído por permanência</p>
    <p className="text-ink-3">Estimativa proporcional aos dias no lote; não mede a ingestão individual. Estornos permanecem no histórico.</p>
    {f.participacoes.map((p) => <div key={p.animalId} className="rounded-lg border border-border p-3">
      <a className="font-semibold underline" href={`/pecuaria/rebanho/animais/${p.animalId}`}>{p.animal.brinco}</a>: {p.dias} dias
      {f.verValores && <> · custo conhecido {p.custoConhecido == null ? "não apurado" : fmtMoneyExact(Number(p.custoConhecido))}{!p.coberturaCustoCompleta && " (incompleto)"}</>}
      {f.verValores && p.custoConhecidoPorDia != null && <p>≈ {fmtMoneyExact(Number(p.custoConhecidoPorDia))}/animal-dia</p>}
      {p.itens.map((i) => <p key={i.produtoId}>{f.itens.find((item) => item.produtoId === i.produtoId)?.produto.nome}: {i.quantidadeAtribuida} {i.unidade} (≈ {i.quantidadePorDia} {i.unidade}/dia)
        {f.verValores && <> · {i.custoConhecido == null ? "custo não apurado" : fmtMoneyExact(Number(i.custoConhecido))}</>}</p>)}
    </div>)}
  </div>;
}
