import "./relatorio-detalhe.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { navegarPara } from "../router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button as Botao } from "@/components/ui/button";
import { useEffect, useState, type ReactNode } from "react";
import { ChartNoAxesColumn, Download, FileText, Info, List, X } from "lucide-react";
import { RelatorioGerencialDocumento } from "../components/relatorio-gerencial/RelatorioGerencialDocumento";
import { templatePadrao } from "../components/relatorio-gerencial/template";
import { obterRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, type LinhaComposicaoRelatorio, type RelatorioFinanceiroDetalhe as Detalhe, type TotalGrupoRelatorio } from "./novo-api";
import { brl, Button, ErrorBox, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, StatusPill, Paginacao, TabelaFinanceira, TIPO_OPERACAO, type ColunaTabela } from "./financeiro-ui";
import { dataCurta, REGIMES_RELATORIO } from "./lib/relatorios";
import { codigoOperacao } from "../estoque/navegacao";

function OperacaoDaLinha({ linha }: { linha: LinhaComposicaoRelatorio }) {
  if (linha.operacaoNumero != null) return <>{codigoOperacao(linha.operacaoNumero)}</>;
  return null;
}

const POR_PAGINA = 15;
const percentual = (valor: number) => `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const dataHora = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
const CLASSIFICACAO: Record<string, string> = { CUSTEIO: "Custeio", INVESTIMENTO: "Investimento" };

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

type AbaRelatorio = "resumo" | "itens" | "documento";
function abaDaUrl(): AbaRelatorio {
  const aba = new URLSearchParams(window.location.search).get("aba");
  return aba === "itens" || aba === "documento" ? aba : "resumo";
}
function InformacaoRelatorio({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return <Popover open={aberto} onOpenChange={setAberto}>
    <PopoverTrigger asChild><Botao variant="ghost" size="icon" className="relatorio-info-botao h-auto" aria-label={titulo === "Informações do relatório" ? titulo : `Informações: ${titulo}`}><Info size={16} aria-hidden="true" /></Botao></PopoverTrigger>
    <PopoverContent align="start" sideOffset={8} className="relatorio-info-popover" aria-label={titulo}>
      <div className="relatorio-info-titulo"><h2>{titulo}</h2><Botao variant="ghost" size="icon" aria-label="Fechar informações" onClick={() => setAberto(false)}><X size={16} aria-hidden="true" /></Botao></div>
      {children}
    </PopoverContent>
  </Popover>;
}

function Distribuicao({ titulo, grupos }: { titulo: string; grupos: TotalGrupoRelatorio[] }) {
  return <section className="relatorio-distribuicao" aria-label={titulo}>
    <h2>{titulo}</h2>
    {grupos.length ? <ul>{grupos.map(grupo => <li key={grupo.nome}>
      <div><span>{grupo.nome}</span><strong>{brl(grupo.total)}</strong></div>
      {grupos.length > 1 && grupo.pct >= 0 && grupo.pct <= 100 && <div className="relatorio-barra" aria-hidden="true"><span style={{ width: `${grupo.pct}%` }} /></div>}
      {grupos.length > 1 && <p>{percentual(grupo.pct)} das compras e serviços</p>}
    </li>)}</ul> : <p>Nenhuma compra ou serviço no recorte.</p>}
  </section>;
}

export function RelatorioFinanceiroDetalhe({ id, podeExportar, onVoltar }: { id: string; podeExportar: boolean; onVoltar: () => void }) {
  const [dados, setDados] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [aba, setAba] = useState<AbaRelatorio>(abaDaUrl);
  useEffect(() => { const atualizar = () => setAba(abaDaUrl()); window.addEventListener("popstate", atualizar); return () => window.removeEventListener("popstate", atualizar); }, []);
  const mudarAba = (valor: string) => {
    if (valor !== "resumo" && valor !== "itens" && valor !== "documento") return;
    const parametros = new URLSearchParams(window.location.search);
    parametros.set("aba", valor);
    navegarPara(`${window.location.pathname}?${parametros}`);
  };
  useEffect(() => {
    let atual = true;
    setDados(null); setErro(null); setPagina(1); setAba(abaDaUrl());
    obterRelatorioFinanceiro(id).then((d) => { if (atual) setDados(d); }).catch((e) => { if (atual) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { atual = false; };
  }, [id]);

  if (!dados) return <PaginaSemDados titulo="Relatório financeiro" descricao="Relatório emitido e preservado no histórico." label="Carregando relatório" erro={erro} />;
  const snapshot = dados.snapshot;
  const linhas: LinhaIndexada[] = snapshot?.composicao.linhas.map((linha, indice) => ({ ...linha, indice })) ?? [];
  const periodo = `${dataCurta(dados.parametros.dataInicio)} a ${dataCurta(dados.parametros.dataFim)}`;
  const baixar = () => salvarPdfRelatorioFinanceiro(dados).catch((e) => setErro(e instanceof Error ? e.message : String(e)));
  const acao = <div className="flex flex-wrap gap-2">{podeExportar && dados.status === "CONCLUIDO" && <Button onClick={() => void baixar()}><Download size={16} strokeWidth={1.8} aria-hidden="true" /> Baixar PDF</Button>}</div>;

  const criterios = snapshot ? ([
    ["Tipos de operação", snapshot.filtros.tipos],
    ["Situação (operações e itens)", snapshot.filtros.status],
    ["Centros de custo", snapshot.filtros.centrosCusto],
    ["Parceiros", snapshot.filtros.parceiros ?? []],
    ["Categorias", snapshot.filtros.categorias],
    ["Classificação", snapshot.filtros.classificacoes],
  ] as const).filter(([, valores]) => valores.length > 0) : [];
  const leitura = snapshot ? REGIMES_RELATORIO.find(r => r.id === snapshot.configuracao.regime)?.rotulo ?? snapshot.configuracao.regime : "";
  return <PaginaFinanceira colorida>
    <nav className="fin-breadcrumb" aria-label="Caminho da página"><ol className="flex flex-wrap items-center gap-2"><li><a href="/financeiro" onClick={e => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); navegarPara("/financeiro"); } }}>Financeiro</a></li><li className="flex items-center gap-2"><span aria-hidden="true">/</span><a href="/financeiro/relatorios" onClick={e => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onVoltar(); } }}>Relatórios</a></li><li className="flex min-w-0 items-center gap-2" aria-current="page"><span aria-hidden="true">/</span>{dados.nome}</li></ol></nav>
    <PageHeader eyebrow="" titulo={dados.nome} descricao={<span className="relatorio-metadados"><span>{dados.propriedade} · {periodo}</span><span className="relatorio-data-emissao">Emitido em {dataHora(dados.geradoEm)}</span><StatusPill status={dados.status} /><InformacaoRelatorio titulo="Informações do relatório">
      <dl className="relatorio-criterios"><div><dt>Gerado por</dt><dd>{dados.autor}</dd></div><div><dt>Emissão</dt><dd>{dataHora(dados.geradoEm)}</dd></div>{dados.concluidoEm && <div><dt>Conclusão</dt><dd>{dataHora(dados.concluidoEm)}</dd></div>}{snapshot && <div><dt>Leitura</dt><dd>{leitura}</dd></div>}</dl>
      <p className="relatorio-info-texto">Os dados deste relatório foram preservados na emissão.</p>
      {criterios.length > 0 && <section className="relatorio-info-filtros"><h3>Filtros utilizados</h3><dl className="relatorio-criterios">{criterios.map(([rotulo, valores]) => <div key={rotulo}><dt>{rotulo}</dt><dd>{valores.join(", ")}</dd></div>)}</dl></section>}
    </InformacaoRelatorio></span>} acao={acao} />
    <ErrorBox erro={erro} />
    {!snapshot ? <ErrorBox erro={dados.erro ?? "Este relatório não foi concluído e não tem conteúdo salvo."} /> : <>
      <Tabs className="relatorio-abas" value={aba} onValueChange={mudarAba}>
        <TabsList aria-label="Conteúdo do relatório">
          <TabsTrigger value="resumo"><ChartNoAxesColumn aria-hidden="true" />Resumo</TabsTrigger>
          <TabsTrigger value="itens"><List aria-hidden="true" />Itens<span className="relatorio-contagem">{snapshot.composicao.totalLinhas}</span></TabsTrigger>
          <TabsTrigger value="documento"><FileText aria-hidden="true" />Documento</TabsTrigger>
        </TabsList>
        <TabsContent value="resumo">
          <Panel className="relatorio-resumo">
            <div className="relatorio-indicadores">
              <section aria-label="Compras e serviços" className="relatorio-indicador"><h2>Compras e serviços<InformacaoRelatorio titulo="Compras e serviços"><p>Itens confirmados, pela data da operação. Custeio e investimento compõem este valor.</p></InformacaoRelatorio></h2><strong>{brl(snapshot.composicao.despesas.total)}</strong>
                <dl className="relatorio-classificacao"><div><dt>Custeio</dt><dd>{brl(snapshot.composicao.despesas.custeio)}</dd></div><div><dt>Investimento</dt><dd>{brl(snapshot.composicao.despesas.investimento)}</dd></div>{Number(snapshot.composicao.despesas.semClassificacao) !== 0 && <div><dt>Não classificada</dt><dd>{brl(snapshot.composicao.despesas.semClassificacao)}</dd></div>}</dl>
              </section>
              <section aria-label={snapshot.gerencial.resumo.saidas != null ? "Pagamentos realizados" : "A pagar"} className="relatorio-indicador"><h2>{snapshot.gerencial.resumo.saidas != null ? "Pagamentos realizados" : "A pagar"}<InformacaoRelatorio titulo={snapshot.gerencial.resumo.saidas != null ? "Pagamentos realizados" : "A pagar"}><p>{snapshot.gerencial.resumo.saidas != null ? "Saídas de caixa registradas no período. Uma compra pode ser paga em outra data; compras e pagamentos não devem ser somados." : "Compromissos em aberto no recorte. O compromisso não movimenta o saldo da conta até o pagamento."}</p></InformacaoRelatorio></h2><strong>{brl(snapshot.gerencial.resumo.saidas ?? snapshot.gerencial.resumo.aPagar)}</strong></section>
            </div>

            <div className="relatorio-distribuicoes"><Distribuicao titulo="Compras por categoria" grupos={snapshot.composicao.despesas.porCategoria} /><Distribuicao titulo="Compras por centro de custo" grupos={snapshot.composicao.despesas.porCentro} /></div>

            <section className="relatorio-operacoes" aria-label="Operações no período"><div className="relatorio-secao-titulo"><h2>Operações no período<InformacaoRelatorio titulo="Operações no período"><p>Quantidade e valor das operações agrupados por tipo, conforme o relatório emitido. Esses valores não representam o saldo das contas.</p></InformacaoRelatorio></h2><span>{snapshot.composicao.porTipo.reduce((total, tipo) => total + tipo.operacoes, 0)} operações</span></div>
              {snapshot.composicao.porTipo.length ? <TabelaFinanceira compacta rotulo="Operações por tipo" itens={snapshot.composicao.porTipo} chaveDe={t => t.tipo} colunas={[
                { chave: "tipo", titulo: "Tipo de operação", principal: true, celula: t => t.rotulo },
                { chave: "quantidade", titulo: "Quantidade", alinhamento: "centro", celula: t => t.operacoes },
                { chave: "valor", titulo: "Valor das operações", alinhamento: "direita", celula: t => brl(t.total) },
              ]} /> : <p className="p-4 text-sm text-ink-3">Nenhuma operação no recorte.</p>}

            </section>

          </Panel>
        </TabsContent>
        <TabsContent value="itens">
      <Panel className="fin-painel relatorio-itens"><Cabecalho titulo="Itens das operações" descricao={snapshot.composicao.truncado ? `As primeiras ${snapshot.composicao.linhas.length} de ${snapshot.composicao.totalLinhas} linhas ficaram salvas; os totais consideram todas.` : `${snapshot.composicao.totalLinhas} linha(s), uma por item de operação no recorte.`} />
        {snapshot.composicao.linhas.length
          ? <TabelaFinanceira compacta rotulo="Itens das operações" colunas={colunasItens} itens={linhas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)} chaveDe={(l) => l.indice} />
          : <p className="p-3 text-sm text-ink-3">Nenhum item no recorte.</p>}
        {linhas.length > 0 && <Paginacao pagina={pagina} totalPaginas={Math.max(1, Math.ceil(linhas.length / POR_PAGINA))} total={linhas.length} porPagina={POR_PAGINA} rotulo="Paginação dos itens do relatório" substantivo="itens salvos" idSelect="pagina-itens-relatorio" onPagina={setPagina} />}
      </Panel>

        </TabsContent>
        <TabsContent value="documento">
      <section className="mt-3" aria-label="Leitura de caixa e compromissos">
        <h2 className="font-serif text-2xl">Leitura de caixa e compromissos</h2>
        <p className="mt-2 text-sm text-ink-3">Pagamentos rateados pelas categorias dos itens, compromissos em aberto e saldo das contas{snapshot.filtros.categorias.length + snapshot.filtros.centrosCusto.length + (snapshot.filtros.parceiros?.length ?? 0) + snapshot.filtros.tipos.length + snapshot.filtros.status.length + snapshot.filtros.classificacoes.length > 0 ? " (o saldo das contas nunca é filtrado)" : ""}.</p>
        <p className="mt-2 text-xs text-ink-3">O saldo histórico do relatório inclui todas as contas da fazenda, inclusive inativas e fora do saldo geral. A disponibilidade atual da visão geral considera somente contas ativas incluídas nesse total.</p>
        <div className="rg-previa min-w-0 overflow-x-auto"><RelatorioGerencialDocumento dto={snapshot.gerencial} template={{ ...templatePadrao(), titulo: dados.nome }} /></div>
      </section>
        </TabsContent>
      </Tabs>
    </>}
  </PaginaFinanceira>;
}
