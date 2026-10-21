import { OrdenarConsulta, useOrdenacaoTabela } from "./OrdenarConsulta";
import "./relatorio-detalhe.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { navegarPara } from "../router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button as Botao } from "@/components/ui/button";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ChartNoAxesColumn, Download, FileText, Info, Layers, List, Maximize, Minus, Plus, X } from "lucide-react";
import { RelatorioGerencialDocumento } from "../components/relatorio-gerencial/RelatorioGerencialDocumento";
import { templatePadrao } from "../components/relatorio-gerencial/template";
import { obterRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, type LinhaComposicaoRelatorio, type RelatorioFinanceiroDetalhe as Detalhe } from "./novo-api";
import { brl, Button, ErrorBox, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, StatusPill, Paginacao, TabelaFinanceira, TIPO_OPERACAO, type ColunaTabela } from "./financeiro-ui";
import { dataCurta, REGIMES_RELATORIO } from "./lib/relatorios";
import { GraficosCaixaRelatorio, PizzaComprasRelatorio } from "./RelatorioFinanceiroGraficos";
import { RelatorioFinanceiroAnalises } from "./RelatorioFinanceiroAnalises";
import { codigoOperacao } from "../estoque/navegacao";

function OperacaoDaLinha({ linha }: { linha: LinhaComposicaoRelatorio }) {
  if (linha.operacaoNumero != null) return <>{codigoOperacao(linha.operacaoNumero)}</>;
  return null;
}

const POR_PAGINA = 15;
const dataHora = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
const CLASSIFICACAO: Record<string, string> = { CUSTEIO: "Custeio", INVESTIMENTO: "Investimento" };

type LinhaIndexada = LinhaComposicaoRelatorio & { indice: number };
const colunasItens: ColunaTabela<LinhaIndexada>[] = [
  { chave: "item", titulo: "Operação / item", principal: true, larguraMinima: 260, celula: (l) => <div className="min-w-0"><div className="break-words font-semibold">{l.item ?? l.descricao ?? <OperacaoDaLinha linha={l} />}</div><div className="mt-0.5 break-words text-xs text-ink-3"><OperacaoDaLinha linha={l} />{l.item && l.descricao ? ` · ${l.descricao}` : ""}{!l.item && l.parceiro ? ` · ${l.parceiro}` : ""}</div>{l.item && l.parceiro && <div className="mt-0.5 text-xs text-ink-3">{l.parceiro}</div>}</div> },
  { chave: "data", titulo: "Data", larguraMinima: 100, celula: (l) => dataCurta(l.data) },
  { chave: "tipo", titulo: "Tipo", larguraMinima: 105, celula: (l) => <span>{TIPO_OPERACAO[l.tipo] ?? l.tipo}{l.status !== "CONFIRMADA" && <> <StatusPill status={l.status} /></>}</span> },
  { chave: "quantidade", titulo: "Quantidade", alinhamento: "direita", larguraMinima: 110, celula: (l) => l.quantidade ? <span className="whitespace-nowrap">{l.quantidade}{l.unidade ? ` ${l.unidade}` : ""}</span> : "—" },
  { chave: "categoria", titulo: "Categoria", larguraMinima: 150, celula: (l) => l.categoria },
  { chave: "centro", titulo: "Centro de custo", larguraMinima: 150, celula: (l) => l.centroCusto },
  { chave: "classificacao", titulo: "Classificação", larguraMinima: 120, celula: (l) => l.classificacao ? <span className="relatorio-item-classificacao">{CLASSIFICACAO[l.classificacao] ?? l.classificacao}</span> : "—" },
  { chave: "valor", titulo: "Valor", alinhamento: "direita", celula: (l) => <strong className="whitespace-nowrap">{brl(l.valor)}</strong> },
];

type AbaRelatorio = "resumo" | "analises" | "itens" | "documento";
function abaDaUrl(): AbaRelatorio {
  const aba = new URLSearchParams(window.location.search).get("aba");
  return aba === "analises" || aba === "itens" || aba === "documento" ? aba : "resumo";
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

export function RelatorioFinanceiroDetalhe({ id, podeExportar, onVoltar }: { id: string; podeExportar: boolean; onVoltar: () => void }) {
  const [dados, setDados] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const ordemItens = useOrdenacaoTabela<LinhaIndexada>([{chave:"data",rotulo:"Data",tipo:"data",obter:l=>l.data},{chave:"valor",rotulo:"Valor",tipo:"numero",obter:l=>l.valor},{chave:"quantidade",rotulo:"Quantidade (unidade do item)",tipo:"numero",obter:l=>l.quantidade}], "ordemItensRelatorio",()=>setPagina(1));
  const [secaoAnalise, setSecaoAnalise] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaRelatorio>(abaDaUrl);
  useEffect(() => { const atualizar = () => setAba(abaDaUrl()); window.addEventListener("popstate", atualizar); return () => window.removeEventListener("popstate", atualizar); }, []);
  const mudarAba = (valor: string) => {
    if (valor !== "resumo" && valor !== "analises" && valor !== "itens" && valor !== "documento") return;
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
  const linhas = ordemItens.ordenar(snapshot?.composicao.linhas.map((linha, indice) => ({ ...linha, indice })) ?? []);
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
          <TabsTrigger value="analises"><Layers aria-hidden="true" />Análises</TabsTrigger>
          <TabsTrigger value="itens"><List aria-hidden="true" />Itens<span className="relatorio-contagem">{snapshot.composicao.totalLinhas}</span></TabsTrigger>
          <TabsTrigger value="documento"><FileText aria-hidden="true" />Documento</TabsTrigger>
        </TabsList>
        <TabsContent value="resumo">
          <Panel className="relatorio-resumo">
            <section className="relatorio-caixa" aria-label="Caixa no período">
              <h2>Caixa no período<InformacaoRelatorio titulo="Caixa no período"><p>Entradas e saídas realizadas no período. O resultado do caixa é a diferença entre elas e não representa lucro; entradas podem incluir aportes. O saldo final inclui a abertura e todas as contas históricas da fazenda, inclusive inativas e fora do saldo geral, sem os filtros de operações.</p></InformacaoRelatorio></h2>
              <div className="relatorio-caixa-valores">{([
                ["Resultado do caixa", snapshot.gerencial.resumo.resultado],
                ["Entradas realizadas", snapshot.gerencial.resumo.entradas],
                ["Saídas realizadas", snapshot.gerencial.resumo.saidas],
                ["Saldo final das contas", snapshot.gerencial.resumo.saldoContasFinal],
              ] as const).map(([titulo, valor]) => <section className={`relatorio-indicador${titulo === "Resultado do caixa" ? " relatorio-indicador-destaque" : ""}`} aria-label={titulo} key={titulo}><h3>{titulo}</h3><strong>{valor == null ? "—" : brl(valor)}</strong>{valor == null && <p className="relatorio-indisponivel">Não incluído nesta leitura</p>}</section>)}</div>
            </section>
            {(snapshot.gerencial.resumo.aPagar != null || snapshot.gerencial.resumo.aReceber != null) && <div className="relatorio-compromissos-resumo">
              <h2>Compromissos<InformacaoRelatorio titulo="Compromissos"><p>Valores em aberto com vencimento no período, na posição salva na emissão. Não compõem o resultado do caixa nem o saldo das contas.</p></InformacaoRelatorio></h2>
              {snapshot.gerencial.resumo.aPagar != null && <section aria-label="A pagar"><span>A pagar</span><strong>{brl(snapshot.gerencial.resumo.aPagar)}</strong></section>}
              {snapshot.gerencial.resumo.aReceber != null && <section aria-label="A receber"><span>A receber</span><strong>{brl(snapshot.gerencial.resumo.aReceber)}</strong></section>}
              {snapshot.gerencial.compromissos && <button className="relatorio-atalho" onClick={() => { setSecaoAnalise("compromissos"); mudarAba("analises"); }}>Ver compromissos<ArrowRight size={15} aria-hidden="true" /></button>}
            </div>}
            <GraficosCaixaRelatorio dto={snapshot.gerencial} informacao={(titulo, texto) => <InformacaoRelatorio titulo={titulo}><p>{texto}</p></InformacaoRelatorio>} />
            <div className="relatorio-compras">
              <section aria-label="Compras e serviços" className="relatorio-indicador"><h2>Compras e serviços<InformacaoRelatorio titulo="Compras e serviços"><p>Itens confirmados, pela data da operação. Custeio e investimento compõem este valor.</p></InformacaoRelatorio></h2><strong>{brl(snapshot.composicao.despesas.total)}</strong>
                <dl className="relatorio-classificacao"><div><dt>Custeio</dt><dd>{brl(snapshot.composicao.despesas.custeio)}</dd></div><div><dt>Investimento</dt><dd>{brl(snapshot.composicao.despesas.investimento)}</dd></div>{Number(snapshot.composicao.despesas.semClassificacao) !== 0 && <div><dt>Não classificada</dt><dd>{brl(snapshot.composicao.despesas.semClassificacao)}</dd></div>}</dl>
                <button className="relatorio-atalho" onClick={() => { setSecaoAnalise("compras"); mudarAba("analises"); }}>Ver análise por categoria<ArrowRight size={15} aria-hidden="true" /></button>
              </section>
              <PizzaComprasRelatorio titulo="Compras por categoria" grupos={snapshot.composicao.despesas.porCategoria} />
              <PizzaComprasRelatorio centro titulo="Compras por centro de custo" grupos={snapshot.composicao.despesas.porCentro} />
            </div>
            <div className={`relatorio-tabelas-resumo${snapshot.gerencial.saldoContas ? "" : " relatorio-tabelas-resumo-unica"}`}>
            {snapshot.gerencial.saldoContas && <section className="relatorio-saldos-resumo" aria-label="Saldo por conta"><div className="relatorio-secao-titulo"><h2>Saldo por conta</h2></div>
              {snapshot.gerencial.saldoContas.contas.length ? <TabelaFinanceira compacta larguraMinimaParaTabela={420} rotulo="Saldo por conta" itens={snapshot.gerencial.saldoContas.contas} chaveDe={c => c.id} colunas={[
                { chave: "conta", titulo: "Conta", principal: true, larguraMinima: 110, celula: c => c.nome },
                { chave: "inicial", titulo: "Saldo inicial", larguraMinima: 95, alinhamento: "direita", celula: c => brl(c.saldoInicial) },
                { chave: "entradas", titulo: "Entradas", larguraMinima: 95, alinhamento: "direita", celula: c => brl(c.entradas) },
                { chave: "saidas", titulo: "Saídas", larguraMinima: 95, alinhamento: "direita", celula: c => brl(c.saidas) },
                { chave: "final", titulo: "Saldo final", larguraMinima: 95, alinhamento: "direita", celula: c => <strong>{brl(c.saldoFinal)}</strong> },
              ]} /> : <p className="relatorio-vazio">Nenhuma conta salva nesta emissão.</p>}
            </section>}
            <section className="relatorio-operacoes" aria-label="Operações no período"><div className="relatorio-secao-titulo"><h2>Operações no período<InformacaoRelatorio titulo="Operações no período"><p>Quantidade e valor das operações agrupados por tipo, conforme o relatório emitido. Esses valores não representam o saldo das contas.</p></InformacaoRelatorio></h2><div className="relatorio-secao-acoes"><span>{snapshot.composicao.porTipo.reduce((total, tipo) => total + tipo.operacoes, 0)} operações</span><button className="relatorio-atalho" onClick={() => mudarAba("itens")}>Ver itens<ArrowRight size={15} aria-hidden="true" /></button></div></div>
              {snapshot.composicao.porTipo.length ? <TabelaFinanceira compacta larguraMinimaParaTabela={420} rotulo="Operações por tipo" itens={snapshot.composicao.porTipo} chaveDe={t => t.tipo} colunas={[
                { chave: "tipo", titulo: "Tipo de operação", principal: true, celula: t => t.rotulo },
                { chave: "quantidade", titulo: "Quantidade", alinhamento: "centro", celula: t => t.operacoes },
                { chave: "valor", titulo: "Valor das operações", alinhamento: "direita", celula: t => brl(t.total) },
              ]} /> : <p className="p-4 text-sm text-ink-3">Nenhuma operação no recorte.</p>}

            </section>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="analises">
          <Panel className="relatorio-analises"><RelatorioFinanceiroAnalises snapshot={snapshot} secaoDestino={secaoAnalise} onChegar={() => setSecaoAnalise(null)} informacao={(titulo, texto) => <InformacaoRelatorio titulo={titulo}><p>{texto}</p></InformacaoRelatorio>} /></Panel>
        </TabsContent>
        <TabsContent value="itens">
      <Panel className="fin-painel relatorio-itens"><div className="relatorio-itens-cabecalho"><div><h2>Itens das operações</h2><p>Dados salvos na emissão</p></div><div className="relatorio-itens-contagem"><OrdenarConsulta controle={ordemItens.controle}/><span>{linhas.length} {linhas.length === 1 ? "item salvo" : "itens salvos"}</span><InformacaoRelatorio titulo="Itens das operações"><p>Uma linha por item de operação no recorte. Valores de tipos diferentes não representam um total de despesas ou o resultado do caixa.</p></InformacaoRelatorio></div></div>
        {snapshot.composicao.truncado && <p className="relatorio-itens-aviso" role="note">As primeiras {linhas.length} de {snapshot.composicao.totalLinhas} linhas ficaram salvas; os totais consideram todas.</p>}
        {snapshot.composicao.linhas.length
          ? <TabelaFinanceira ordenacao={ordemItens.controle} compacta rotulo="Itens das operações" colunas={colunasItens} itens={linhas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)} chaveDe={(l) => l.indice} />
          : <p className="p-3 text-sm text-ink-3">Nenhum item no recorte.</p>}
        {linhas.length > 0 && <Paginacao pagina={pagina} totalPaginas={Math.max(1, Math.ceil(linhas.length / POR_PAGINA))} total={linhas.length} porPagina={POR_PAGINA} rotulo="Paginação dos itens do relatório" substantivo="itens salvos" idSelect="pagina-itens-relatorio" onPagina={setPagina} />}
      </Panel>

        </TabsContent>
        <TabsContent value="documento">
      <PreviaDocumento informacao={<InformacaoRelatorio titulo="Prévia gerencial"><p>Prévia HTML dos dados salvos na emissão. Sua apresentação é independente do PDF exportado.</p><p>Pagamentos rateados pelas categorias dos itens, compromissos em aberto e saldo das contas (o saldo das contas nunca é filtrado).</p><p>O saldo histórico inclui todas as contas da fazenda, inclusive inativas e fora do saldo geral. A disponibilidade atual da visão geral considera somente contas ativas incluídas nesse total.</p></InformacaoRelatorio>}>
        <RelatorioGerencialDocumento dto={snapshot.gerencial} template={{ ...templatePadrao(), titulo: dados.nome }} />
      </PreviaDocumento>
        </TabsContent>
      </Tabs>
    </>}
  </PaginaFinanceira>;
}

function PreviaDocumento({ children, informacao }: { children: ReactNode; informacao: ReactNode }) {
  const canvas = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(1008);
  const [zoomManual, setZoomManual] = useState<number | null>(null);
  useEffect(() => {
    const elemento = canvas.current;
    if (!elemento) return;
    const medir = () => setLargura(elemento.clientWidth);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  const zoom = zoomManual ?? Math.min(1, Math.max(.25, (largura - 48) / 960));
  const alterar = (passo: number) => setZoomManual(Math.min(1.5, Math.max(.5, Math.round((zoom + passo) * 100) / 100)));
  return <section className="relatorio-documento" aria-label="Leitura de caixa e compromissos">
    <div className="relatorio-documento-barra"><div className="relatorio-documento-titulo"><h2>Prévia gerencial</h2>{informacao}</div>
      <div className="relatorio-documento-controles" role="group" aria-label="Ampliação da prévia">
        <Botao variant="outline" size="icon" aria-label="Diminuir ampliação" disabled={zoom <= .5} onClick={() => alterar(-.1)}><Minus size={16} /></Botao>
        <output aria-label="Ampliação atual" aria-live="polite">{Math.round(zoom * 100)}%</output>
        <Botao variant="outline" size="icon" aria-label="Aumentar ampliação" disabled={zoom >= 1.5} onClick={() => alterar(.1)}><Plus size={16} /></Botao>
        <Botao variant="outline" onClick={() => setZoomManual(null)}><Maximize size={16} aria-hidden="true" />Ajustar à largura</Botao>
      </div>
    </div>
    <div ref={canvas} className="relatorio-documento-canvas" tabIndex={0} role="region" aria-label="Documento gerencial ampliável">
      <div className="relatorio-documento-papel" style={{ zoom }}>{children}</div>
    </div>
  </section>;
}
