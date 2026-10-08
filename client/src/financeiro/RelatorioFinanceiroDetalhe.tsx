import { SecaoFinanceira } from "./SecaoFinanceira";
import { useEffect, useState } from "react";
import { ArrowLeft, CircleDollarSign, Download, Hammer, Sprout, TrendingDown, WalletCards } from "lucide-react";
import { RelatorioGerencialDocumento } from "../components/relatorio-gerencial/RelatorioGerencialDocumento";
import { templatePadrao } from "../components/relatorio-gerencial/template";
import { obterRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, type LinhaComposicaoRelatorio, type RelatorioFinanceiroDetalhe as Detalhe, type TotalGrupoRelatorio } from "./novo-api";
import { brl, Button, ErrorBox, Metric, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, StatusPill, TabelaFinanceira, TIPO_OPERACAO, type ColunaTabela } from "./financeiro-ui";
import { dataCurta, REGIMES_RELATORIO } from "./lib/relatorios";
import { codigoOperacao } from "../estoque/navegacao";

function OperacaoDaLinha({ linha }: { linha: LinhaComposicaoRelatorio }) {
  if (linha.operacaoNumero != null) return <>{codigoOperacao(linha.operacaoNumero)}</>;
  return null;
}

const LINHAS_INICIAIS = 200;
const percentual = (valor: number) => `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const dataHora = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
const CLASSIFICACAO: Record<string, string> = { CUSTEIO: "Custeio", INVESTIMENTO: "Investimento" };

type Categoria = TotalGrupoRelatorio & { custeio: string; investimento: string; semClassificacao: string };
const colunasCategoria: ColunaTabela<Categoria>[] = [
  { chave: "nome", titulo: "Categoria", principal: true, larguraMinima: 200, celula: (c) => <strong>{c.nome}</strong> },
  { chave: "custeio", titulo: "Custeio", alinhamento: "direita", celula: (c) => brl(c.custeio) },
  { chave: "investimento", titulo: "Investimento", alinhamento: "direita", celula: (c) => brl(c.investimento) },
  { chave: "sem", titulo: "Não classificada", alinhamento: "direita", larguraMinima: 140, celula: (c) => brl(c.semClassificacao) },
  { chave: "total", titulo: "Total", alinhamento: "direita", celula: (c) => <strong className="whitespace-nowrap">{brl(c.total)}</strong> },
  { chave: "pct", titulo: "%", alinhamento: "direita", larguraMinima: 70, celula: (c) => percentual(c.pct) },
];
const colunasCentro: ColunaTabela<TotalGrupoRelatorio>[] = [
  { chave: "nome", titulo: "Centro de custo", principal: true, larguraMinima: 220, celula: (c) => <strong>{c.nome}</strong> },
  { chave: "total", titulo: "Total", alinhamento: "direita", celula: (c) => <strong className="whitespace-nowrap">{brl(c.total)}</strong> },
  { chave: "pct", titulo: "%", alinhamento: "direita", larguraMinima: 70, celula: (c) => percentual(c.pct) },
];
type LinhaIndexada = LinhaComposicaoRelatorio & { indice: number };
const colunasItens: ColunaTabela<LinhaIndexada>[] = [
  { chave: "item", titulo: "Operação / item", principal: true, larguraMinima: 240, celula: (l) => <div className="min-w-0"><div className="break-words font-semibold">{l.item ?? l.descricao ?? <OperacaoDaLinha linha={l} />}</div><div className="mt-0.5 break-words text-xs text-ink-3"><OperacaoDaLinha linha={l} />{l.item && l.descricao ? ` · ${l.descricao}` : ""}{l.parceiro ? ` · ${l.parceiro}` : ""}</div></div> },
  { chave: "data", titulo: "Data", larguraMinima: 100, celula: (l) => dataCurta(l.data) },
  { chave: "tipo", titulo: "Tipo", larguraMinima: 160, celula: (l) => <span>{TIPO_OPERACAO[l.tipo] ?? l.tipo}{l.status !== "CONFIRMADA" && <> <StatusPill status={l.status} /></>}</span> },
  { chave: "quantidade", titulo: "Quantidade", alinhamento: "direita", larguraMinima: 110, celula: (l) => l.quantidade ? <span className="whitespace-nowrap">{l.quantidade}{l.unidade ? ` ${l.unidade}` : ""}</span> : "—" },
  { chave: "categoria", titulo: "Categoria", larguraMinima: 150, celula: (l) => l.categoria },
  { chave: "centro", titulo: "Centro de custo", larguraMinima: 150, celula: (l) => l.centroCusto },
  { chave: "classificacao", titulo: "Classificação", larguraMinima: 120, celula: (l) => l.classificacao ? CLASSIFICACAO[l.classificacao] : "—" },
  { chave: "valor", titulo: "Valor", alinhamento: "direita", celula: (l) => <strong className="whitespace-nowrap">{brl(l.valor)}</strong> },
];

function Cabecalho({ titulo, descricao }: { titulo: string; descricao: string }) {
  return <div className="fin-cabecalho border-b border-border p-4"><h2 className="font-serif text-xl">{titulo}</h2><p className="mt-1 text-xs text-ink-3">{descricao}</p></div>;
}

export function RelatorioFinanceiroDetalhe({ id, podeExportar, onVoltar }: { id: string; podeExportar: boolean; onVoltar: () => void }) {
  const [dados, setDados] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [todas, setTodas] = useState(false);
  useEffect(() => {
    let atual = true;
    obterRelatorioFinanceiro(id).then((d) => { if (atual) setDados(d); }).catch((e) => { if (atual) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { atual = false; };
  }, [id]);

  if (!dados) return <PaginaSemDados titulo="Relatório financeiro" descricao="Relatório emitido e preservado no histórico." label="Carregando relatório" erro={erro} />;
  const snapshot = dados.snapshot;
  const linhas: LinhaIndexada[] = snapshot?.composicao.linhas.map((linha, indice) => ({ ...linha, indice })) ?? [];
  const periodo = `${dataCurta(dados.parametros.dataInicio)} a ${dataCurta(dados.parametros.dataFim)}`;
  const baixar = () => salvarPdfRelatorioFinanceiro(dados).catch((e) => setErro(e instanceof Error ? e.message : String(e)));
  const acao = <div className="flex flex-wrap gap-2"><Button secondary onClick={onVoltar}><ArrowLeft size={16} /> Relatórios</Button>{podeExportar && dados.status === "CONCLUIDO" && <Button onClick={() => void baixar()}><Download size={16} /> Baixar PDF</Button>}</div>;

  return <PaginaFinanceira colorida>
    <PageHeader compacto titulo={dados.nome} descricao={`${dados.propriedade} · ${periodo} · gerado em ${dataHora(dados.geradoEm)} por ${dados.autor}`} acao={acao} />
    <ErrorBox erro={erro} />
    {!snapshot ? <ErrorBox erro={dados.erro ?? "Este relatório não foi concluído e não tem conteúdo salvo."} /> : <>
      <Panel tom="info" className="mt-3 p-4">
        <div className="flex flex-wrap items-center gap-2"><h2 className="font-serif text-xl">{dados.nome}</h2><StatusPill status={dados.status} /></div>
        <p className="mt-2 text-xs text-ink-3">{dados.propriedade} · {periodo} · gerado em {dataHora(dados.geradoEm)} por {dados.autor}</p>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {([
            ["Leitura", REGIMES_RELATORIO.find((r) => r.id === snapshot.configuracao.regime)?.rotulo ?? snapshot.configuracao.regime],
            ["Tipos de operação", snapshot.filtros.tipos.join(", ") || "Todos"],
            ["Situação (operações e itens)", snapshot.filtros.status.join(", ") || "Todas"],
            ["Centros de custo", snapshot.filtros.centrosCusto.join(", ") || "Todos"],
            ["Parceiros", snapshot.filtros.parceiros?.join(", ") || "Todos"],
            ["Categorias", snapshot.filtros.categorias.join(", ") || "Todas"],
            ["Classificação", snapshot.filtros.classificacoes.join(", ") || "Todas"],
          ] as const).map(([rotulo, valor]) => <div key={rotulo} className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-[.1em] text-ink-3">{rotulo}</dt><dd className="mt-1 break-words">{valor}</dd></div>)}
        </dl>
      </Panel>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric tom="saida" label="Compras e serviços" valor={brl(snapshot.composicao.despesas.total)} detalhe="Itens confirmados, pela data da operação" icon={CircleDollarSign} />
        <Metric tom="saida" label="Custeio" valor={brl(snapshot.composicao.despesas.custeio)} detalhe="Itens classificados como custeio" icon={Sprout} />
        <Metric tom="info" label="Investimento" valor={brl(snapshot.composicao.despesas.investimento)} detalhe="Itens classificados como investimento" icon={Hammer} />
        {snapshot.gerencial.resumo.saidas != null
          ? <Metric tom="saida" label="Pagamentos" valor={brl(snapshot.gerencial.resumo.saidas)} detalhe="Saídas de caixa no recorte" icon={TrendingDown} tone="red" />
          : <Metric tom="pendente" label="A pagar" valor={brl(snapshot.gerencial.resumo.aPagar)} detalhe="Compromissos em aberto no recorte" icon={WalletCards} />}
      </div>

      <div className="mt-3 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel><Cabecalho titulo="Compras e serviços por categoria" descricao="Cada item conta na própria categoria" />
          {snapshot.composicao.despesas.porCategoria.length ? <TabelaFinanceira compacta rotulo="Compras e serviços por categoria" colunas={colunasCategoria} itens={snapshot.composicao.despesas.porCategoria} chaveDe={(c) => c.nome} /> : <p className="p-3 text-sm text-ink-3">Nenhuma compra ou serviço no recorte.</p>}
        </Panel>
        <Panel><Cabecalho titulo="Por centro de custo" descricao="Compras e serviços confirmados" />
          {snapshot.composicao.despesas.porCentro.length ? <TabelaFinanceira compacta rotulo="Compras e serviços por centro de custo" colunas={colunasCentro} itens={snapshot.composicao.despesas.porCentro} chaveDe={(c) => c.nome} /> : <p className="p-3 text-sm text-ink-3">Nenhuma compra ou serviço no recorte.</p>}
          {snapshot.composicao.porTipo.length > 0 && <div className="border-t border-border p-5"><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Operações por tipo</h3><div className="mt-3 space-y-2 text-sm">{snapshot.composicao.porTipo.map((t) => <div key={t.tipo} className="flex justify-between gap-4"><span className="min-w-0 break-words">{t.rotulo} <span className="text-ink-3">({t.operacoes})</span></span><strong className="shrink-0 whitespace-nowrap">{brl(t.total)}</strong></div>)}</div></div>}
        </Panel>
      </div>

      <Panel className="mt-3"><Cabecalho titulo="Itens das operações" descricao={snapshot.composicao.truncado ? `As primeiras ${snapshot.composicao.linhas.length} de ${snapshot.composicao.totalLinhas} linhas ficaram salvas; os totais consideram todas.` : `${snapshot.composicao.totalLinhas} linha(s), uma por item de operação no recorte.`} />
        {snapshot.composicao.linhas.length
          ? <TabelaFinanceira compacta rotulo="Itens das operações" colunas={colunasItens} itens={todas ? linhas : linhas.slice(0, LINHAS_INICIAIS)} chaveDe={(l) => l.indice} />
          : <p className="p-3 text-sm text-ink-3">Nenhum item no recorte.</p>}
        {!todas && snapshot.composicao.linhas.length > LINHAS_INICIAIS && <div className="border-t border-border p-4 text-center"><Button secondary onClick={() => setTodas(true)}>Mostrar todas as {snapshot.composicao.linhas.length} linhas</Button></div>}
      </Panel>

      <section className="mt-3" aria-label="Leitura de caixa e compromissos">
        <h2 className="font-serif text-2xl">Leitura de caixa e compromissos</h2>
        <p className="mt-2 text-sm text-ink-3">Pagamentos rateados pelas categorias dos itens, compromissos em aberto e saldo das contas{snapshot.filtros.categorias.length + snapshot.filtros.centrosCusto.length + (snapshot.filtros.parceiros?.length ?? 0) + snapshot.filtros.tipos.length + snapshot.filtros.status.length + snapshot.filtros.classificacoes.length > 0 ? " (o saldo das contas nunca é filtrado)" : ""}.</p>
        <p className="mt-2 text-xs text-ink-3">O saldo histórico do relatório inclui todas as contas da fazenda, inclusive inativas e fora do saldo geral. A disponibilidade atual da visão geral considera somente contas ativas incluídas nesse total.</p>
        <SecaoFinanceira titulo="Prévia do documento gerencial"><div className="rg-previa min-w-0 overflow-x-auto"><RelatorioGerencialDocumento dto={snapshot.gerencial} template={{ ...templatePadrao(), titulo: dados.nome }} /></div></SecaoFinanceira>
      </section>
    </>}
  </PaginaFinanceira>;
}
