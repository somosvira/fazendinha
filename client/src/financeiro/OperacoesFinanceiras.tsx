import { BarraConsulta, type CriterioConsulta } from "@/financeiro/BarraConsulta";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button as UiButton } from "@/components/ui/button";
import { useRascunhoConsulta } from "./useRascunhoConsulta";
import { PainelFiltros } from "./PainelFiltros";
import { CamposFiltroOperacoes, FiltroColunaOperacoes, FILTROS_OPERACOES_VAZIOS, CAMPOS_FILTROS_OPERACOES, IMPACTOS_OPERACAO, limparCampoOperacoes, validarFiltrosOperacoes, atendeValorOperacao, type EfeitoFiltro, type FiltrosOperacoes, type CampoFiltroOperacoes } from "./FiltrosOperacoes";
import { ImpactosOperacao, ParceiroOperacao } from "./ContextoOperacao";
import "./operacoes-consulta.css";
import { Input } from "@/components/ui/input";
import { podeVerValoresFinanceiros } from "./permissoes";
import { normalizarBuscaFinanceira } from "./ListaCadastroFinanceiro";
import { AtualizandoFinanceiro } from "./CarregamentoFinanceiro";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, FilePenLine, Plus, Search, Settings2 } from "lucide-react";
import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";
import { periodoInicial } from "./lib/periodo";
import { entradaDeNovaOperacao, isNovaOperacaoFinanceira, parseOperacaoFinanceiraId, URL_NOVA_OPERACAO } from "../router";
import { descartarRascunhoOperacao, listarOperacoes, obterConfiguracoesFinanceiras, obterRascunhoOperacao, type ConfiguracoesFinanceiras, type Operacao } from "./novo-api";
import { enfileirarSalvamentoRascunho, useRascunhoAtivo } from "./rascunhoAtivo";
import { FormOperacao } from "./FormOperacao";
import { OperacaoFinanceiraDetalhe } from "./OperacaoFinanceiraDetalhe";
import { GerenciarProcedimentosServico, podeGerenciarProcedimentosServico } from "../pecuaria/rebanho/sanidade/GerenciarProcedimentosServico";
import { codigoOperacao } from "../estoque/navegacao";
import { navegarPara } from "../router";
import { linkOperacaoFinanceira, validarRetornoInterno } from "./navegacao";
import { brl, Button, type ColunaTabela, dataBR, Empty, ErrorBox, PageHeader, PaginaCarregando, PaginaFinanceira, Paginacao, Panel, StatusPill, TabelaFinanceira, TIPO_OPERACAO } from "./financeiro-ui";

function possuiEfeito(operacao: Operacao, filtro: EfeitoFiltro) {
  if (filtro === "TODOS") return true;
  const transacoes = operacao.transacoes.filter((item) => item.tipo !== "REVERSAO");
  if (filtro === "ESTOQUE") return operacao.movimentosEstoque.length > 0;
  if (filtro === "PAGAMENTO") return transacoes.some((item) => item.tipo === "PAGAMENTO");
  if (filtro === "RECEBIMENTO") return transacoes.some((item) => item.tipo === "RECEBIMENTO");
  if (filtro === "TRANSFERENCIA") return transacoes.some((item) => item.tipo === "TRANSFERENCIA");
  if (filtro === "A_PAGAR") return operacao.compromissos.some((item) => item.tipo === "PAGAR");
  if (filtro === "A_RECEBER") return operacao.compromissos.some((item) => item.tipo === "RECEBER");
  return !operacao.movimentosEstoque.length && !transacoes.length && !operacao.compromissos.length;
}

const inicioMes = () => { const data = new Date(); return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-01`; };
const hojeLocal = () => { const data = new Date(); return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`; };
const EFEITOS_FILTRO = Object.keys(IMPACTOS_OPERACAO);
/** Acesso pela rastreabilidade da Base financeira (?efeito=SEM_EFEITOS). */
const efeitoInicial = (): EfeitoFiltro => {
  const valor = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("efeito");
  return (EFEITOS_FILTRO as string[]).includes(valor ?? "") ? (valor as EfeitoFiltro) : "TODOS";
};
const ITENS_POR_PAGINA = 15;
/* Colunas da lista de operações. `alinhamento` vale para o cabeçalho, para a
 * célula e para o valor no cartão — não há como cabeçalho e conteúdo divergirem. */
const COLUNAS: ColunaTabela<Operacao>[] = [
  { chave: "data", titulo: "Data", larguraMinima: 104, celula: (operacao) => <span className="whitespace-nowrap text-ink-3">{dataBR(operacao.data)}</span> },
  { chave: "operacao", titulo: "Operação", larguraMinima: 250, principal: true, celula: (operacao) => <><strong className="break-words">{operacao.descricao || TIPO_OPERACAO[operacao.tipo]}</strong><div className="mt-1 text-xs text-ink-3">{codigoOperacao(operacao.numero)}</div></> },
  { chave: "tipo", titulo: "Tipo de operação", larguraMinima: 180, celula: (operacao) => <span className="break-words text-ink-2">{TIPO_OPERACAO[operacao.tipo] ?? operacao.tipo}</span> },
  { chave: "parceiro", titulo: "Parceiro", larguraMinima: 220, celula: (operacao) => <ParceiroOperacao parceiro={operacao.parceiro} /> },
  { chave: "efeitos", titulo: "Impacto gerado", larguraMinima: 180, celula: (operacao) => <ImpactosOperacao operacao={operacao} /> },
  { chave: "status", titulo: "Status", larguraMinima: 105, celula: (operacao) => <StatusPill status={operacao.status} /> },
  { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 112, celula: (operacao) => <strong className="whitespace-nowrap font-semibold">{operacao.valorTotal == null ? "—" : brl(operacao.valorTotal)}</strong> },
];

export function OperacoesFinanceiras({ podeLancar = true }: { podeLancar?: boolean }) {
  const podeRascunho = podeVerValoresFinanceiros();
  const [carregou, setCarregou] = useState(false);
  const [itens, setItens] = useState<Operacao[]>([]); const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null); const { rascunho, recuperacao } = useRascunhoAtivo(); const [form, setForm] = useState(() => typeof window !== "undefined" && isNovaOperacaoFinanceira(window.location.pathname)); const [operacaoBase, setOperacaoBase] = useState<Operacao | null>(null); const [loading, setLoading] = useState(true); const [erro, setErro] = useState<string | null>(null);
  const [iniciandoNova, setIniciandoNova] = useState(false);
  const [servicoGerenciado, setServicoGerenciado] = useState<Operacao | null>(null);
  const [busca, setBusca] = useState(""); const [status, setStatus] = useState("TODOS"); const [tipo, setTipo] = useState("TODOS"); const [efeito, setEfeito] = useState<EfeitoFiltro>(efeitoInicial); const [inicio, setInicio] = useState(() => periodoInicial({ inicio: inicioMes(), fim: hojeLocal() }).inicio); const [fim, setFim] = useState(() => periodoInicial({ inicio: inicioMes(), fim: hojeLocal() }).fim);
  const [pagina, setPagina] = useState(1);
  const [parceiroId, setParceiroId] = useState("TODOS");
  const [minimo, setMinimo] = useState("");
  const [maximo, setMaximo] = useState("");
  const [modalFiltros, setModalFiltros] = useState(false);
  const filtros: FiltrosOperacoes = { busca, inicio, fim, tipo, efeito, status, parceiroId, minimo, maximo };
  const aplicarFiltros = (valores: FiltrosOperacoes) => {
    setBusca(valores.busca); setInicio(valores.inicio); setFim(valores.fim); setTipo(valores.tipo); setEfeito(valores.efeito);
    setStatus(valores.status); setParceiroId(valores.parceiroId); setMinimo(valores.minimo); setMaximo(valores.maximo); setPagina(1);
  };
  const edicaoFiltros = useRascunhoConsulta(filtros, { ...FILTROS_OPERACOES_VAZIOS, inicio, fim }, aplicarFiltros);
  const erroFiltros = validarFiltrosOperacoes(edicaoFiltros.rascunho);
  const parceiros = useMemo(() => [...new Map(itens.flatMap(op => op.parceiro ? [[op.parceiro.id, op.parceiro] as const] : [])).values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [itens]);
  const limiteValor = useMemo(() => itens.reduce((maior, op) => op.valorTotal != null && Number.isFinite(Number(op.valorTotal)) ? Math.max(maior, Number(op.valorTotal)) : maior, 1), [itens]);
  const ativos: Record<CampoFiltroOperacoes, boolean> = { data: !!inicio || !!fim, operacao: !!busca, tipo: tipo !== "TODOS", efeitos: efeito !== "TODOS", status: status !== "TODOS", parceiro: parceiroId !== "TODOS", valor: !!minimo.trim() || !!maximo.trim() };
  const criterios: CriterioConsulta[] = [
    ...(ativos.tipo ? [{ id: "tipo", rotulo: `Tipo: ${TIPO_OPERACAO[tipo] ?? tipo}`, limpar: () => { setTipo("TODOS"); setPagina(1); } }] : []),
    ...(ativos.parceiro ? [{ id: "parceiro", rotulo: `Parceiro: ${parceiroId === "SEM" ? "Sem parceiro" : parceiros.find(p => p.id === parceiroId)?.nome ?? "Selecionado"}`, limpar: () => { setParceiroId("TODOS"); setPagina(1); } }] : []),
    ...(ativos.efeitos ? [{ id: "impacto", rotulo: `Impacto: ${IMPACTOS_OPERACAO[efeito]}`, limpar: () => { setEfeito("TODOS"); setPagina(1); } }] : []),
    ...(ativos.status ? [{ id: "status", rotulo: `Status: ${status === "CONFIRMADA" ? "Confirmada" : "Cancelada"}`, limpar: () => { setStatus("TODOS"); setPagina(1); } }] : []),
    ...(ativos.valor ? [{ id: "valor", rotulo: `Valor: ${minimo || "0"} a ${maximo || "sem máximo"}`, limpar: () => { setMinimo(""); setMaximo(""); setPagina(1); } }] : []),
  ];

  useEffect(() => {
    if (window.location.pathname !== "/financeiro/operacoes") return;
    const url = new URL(window.location.href);
    efeito === "TODOS" ? url.searchParams.delete("efeito") : url.searchParams.set("efeito", efeito);
    const alvo = url.pathname + url.search + url.hash;
    if (alvo !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, "", alvo);
  }, [efeito]);
  const [detalheId, setDetalheId] = useState<string | null>(() => typeof window === "undefined" ? null : parseOperacaoFinanceiraId(window.location.pathname));
  const [retorno, setRetorno] = useState(() => validarRetornoInterno(new URLSearchParams(window.location.search).get("returnTo")));
  // O rascunho vem da store compartilhada (a mesma do atalho da sidebar):
  // obterRascunhoOperacao a atualiza, e cada autosave também.
  const carregar = useCallback(async (vigente: () => boolean = () => true) => { setLoading(true); setErro(null); try { const [ops, cfg] = await Promise.all([listarOperacoes({ inicio, fim }), podeLancar ? obterConfiguracoesFinanceiras() : Promise.resolve(null), podeLancar && podeRascunho ? obterRascunhoOperacao() : Promise.resolve(null)]); if (vigente()) { setItens(ops); setConfig(cfg); } } catch (e) { if (vigente()) setErro(e instanceof Error ? e.message : String(e)); } finally { if (vigente()) { setLoading(false); setCarregou(true); } } }, [inicio, fim, podeLancar, podeRascunho]);
  useEffect(() => { let ativo = true; void carregar(() => ativo); return () => { ativo = false; }; }, [carregar]);
  useEffect(() => {
    const onPop = (evento: PopStateEvent) => {
      setDetalheId(parseOperacaoFinanceiraId(window.location.pathname)); setForm(isNovaOperacaoFinanceira(window.location.pathname));
      setRetorno(validarRetornoInterno(new URLSearchParams(window.location.search).get("returnTo")));
      // Atalhos para o rascunho (sidebar, Compromissos) substituem uma correção em curso.
      if (entradaDeNovaOperacao(evento.state)) setOperacaoBase(null);
    };
    window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop);
  }, []);
  const filtradas = useMemo(() => itens.filter((operacao) => (status === "TODOS" || operacao.status === status) && (tipo === "TODOS" || operacao.tipo === tipo) && possuiEfeito(operacao, efeito) && (parceiroId === "TODOS" || (parceiroId === "SEM" ? !operacao.parceiro : operacao.parceiro?.id === parceiroId)) && atendeValorOperacao(operacao.valorTotal, minimo, maximo) && `${operacao.descricao} ${operacao.parceiro?.nome} ${operacao.id} ${operacao.numero} ${codigoOperacao(operacao.numero)}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").includes(normalizarBuscaFinanceira(busca))), [itens, busca, status, tipo, efeito, parceiroId, minimo, maximo]);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const operacoesDaPagina = filtradas.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);
  const colunasFiltradas = COLUNAS.map(coluna => {
    const campo = coluna.chave as CampoFiltroOperacoes;
    if (campo === "data" || campo === "operacao" || (campo === "valor" && !podeVerValoresFinanceiros())) return coluna;
    return { ...coluna, cabecalho: <FiltroColunaOperacoes titulo={coluna.titulo} ativo={ativos[campo]} iniciar={edicaoFiltros.iniciar} aplicar={edicaoFiltros.aplicar} limpar={() => { const novos = limparCampoOperacoes(edicaoFiltros.rascunho, campo); for (const chave of Object.keys(novos) as (keyof FiltrosOperacoes)[]) edicaoFiltros.editar(chave, novos[chave]); }} erro={erroFiltros}><CamposFiltroOperacoes campo={campo} valores={edicaoFiltros.rascunho} editar={edicaoFiltros.editar} parceiros={parceiros} limiteValor={limiteValor} podeVerValores={podeVerValoresFinanceiros()} compacto /></FiltroColunaOperacoes> };
  });
  const colunas: ColunaTabela<Operacao>[] = podeLancar && podeGerenciarProcedimentosServico() && operacoesDaPagina.some(op => op.tipo === "SERVICO" && op.status === "CONFIRMADA" && op.propriedadeId) ? [...colunasFiltradas, { chave: "acoes", titulo: "", larguraMinima: 48, acoes: true, celula: op => op.tipo === "SERVICO" && op.status === "CONFIRMADA" && op.propriedadeId ? <DropdownMenu><DropdownMenuTrigger asChild><UiButton type="button" variant="ghost" size="icon" aria-label={`Ações ${codigoOperacao(op.numero)}`} onClick={evento => evento.stopPropagation()}><MoreHorizontal /></UiButton></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={evento => evento.stopPropagation()} onSelect={() => setServicoGerenciado(op)}>Gerenciar procedimentos</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null }] : colunasFiltradas;
  useEffect(() => { if (pagina !== paginaAtual) setPagina(paginaAtual); }, [pagina, paginaAtual]);
  const abrirDetalhe = (id: string) => { const origem = retorno ?? (window.location.pathname === "/financeiro/operacoes" ? window.location.pathname + window.location.search : null); window.history.pushState(null, "", linkOperacaoFinanceira(id, origem ?? undefined)); setRetorno(origem); setDetalheId(id); setForm(false); };
  const voltar = () => { if (retorno) { navegarPara(retorno); return; } window.history.pushState(null, "", "/financeiro/operacoes"); setDetalheId(null); };
  const abrirFormulario = (base: Operacao | null = null) => { window.history.pushState(null, "", URL_NOVA_OPERACAO); setDetalheId(null); setOperacaoBase(base); setForm(true); };
  const abrirNovaOperacao = async () => {
    setIniciandoNova(true); setErro(null);
    try {
      if (podeRascunho && (rascunho || recuperacao)) await enfileirarSalvamentoRascunho(() => descartarRascunhoOperacao());
      abrirFormulario();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setIniciandoNova(false); }
  };
  const continuarRascunho = () => abrirFormulario();
  const corrigir = (operacao: Operacao) => abrirFormulario(operacao);

  if (detalheId != null) return <OperacaoFinanceiraDetalhe operacaoId={detalheId} onVoltar={voltar} urlVoltar={retorno ?? "/financeiro/operacoes"} rotuloVoltar={retorno?.startsWith("/pecuaria/rebanho/sanidade") ? "Voltar à Sanidade" : retorno?.startsWith("/estoque") ? "Voltar ao Estoque" : undefined} onAbrir={abrirDetalhe} onCorrigir={corrigir} podeLancar={podeLancar} />;
  if (loading && !carregou) return <PaginaCarregando label="Carregando operações" />;
  const parametrosUrl = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const compromissoInicial = parametrosUrl.get("compromisso");
  // Atalho do Estoque: /financeiro/operacoes/nova?tipo=AJUSTE_ESTOQUE&produto=<id>.
  const ajusteInicial = !operacaoBase && parametrosUrl.get("tipo") === "AJUSTE_ESTOQUE";
  const produtoAjusteInicial = ajusteInicial && parametrosUrl.get("produto") ? parametrosUrl.get("produto")! : undefined;
  // A chave separa correção de rascunho: trocar de um para o outro remonta o
  // formulário, senão o autosave gravaria os dados da correção no rascunho.
  if (form && !podeLancar) return <PaginaFinanceira colorida><PageHeader eyebrow="" titulo="Nova operação" descricao="O seu perfil pode consultar operações, mas não pode criar ou corrigir lançamentos." /><ErrorBox erro="Você não tem permissão para lançar operações financeiras." /></PaginaFinanceira>;
  if (form && config) return <FormOperacao key={operacaoBase ? `correcao-${operacaoBase.id}` : ajusteInicial ? `ajuste-${produtoAjusteInicial ?? ""}` : "rascunho"} config={config} rascunho={operacaoBase ? null : rascunho} operacaoBase={operacaoBase} condicaoInicial={compromissoInicial ? "A_PRAZO" : undefined} tipoInicial={ajusteInicial ? "AJUSTE_ESTOQUE" : compromissoInicial === "RECEBER" ? "VENDA" : compromissoInicial === "PAGAR" ? "COMPRA_CONSUMO_DIRETO" : undefined} produtoInicial={produtoAjusteInicial} onSalvo={async (operacao, aviso) => { setForm(false); setOperacaoBase(null); await carregar(); if (aviso) setErro(aviso); abrirDetalhe(operacao.id); }} />;

  const acoesCabecalho = podeLancar ? <div className="flex flex-wrap gap-2">{(rascunho || recuperacao) && <Button secondary onClick={continuarRascunho}><FilePenLine size={16} /> Continuar operação</Button>}<Button disabled={iniciandoNova} onClick={() => { void abrirNovaOperacao(); }}><Plus size={16} /> {iniciandoNova ? "Iniciando…" : "Nova operação"}</Button></div> : undefined;

  return <PaginaFinanceira colorida>
    <PageHeader eyebrow="" titulo="Operações" descricao="Consulte compras, vendas e serviços e acompanhe seus efeitos financeiros e no estoque." acao={acoesCabecalho} />
    <ErrorBox erro={erro} />
    {erro && <Button secondary disabled={loading} className="mb-4" onClick={() => { void carregar(); }}>Tentar novamente</Button>}
    {recuperacao && <p role="status" className="mb-4 rounded-lg bg-muted p-3 text-sm">{recuperacao.erro ? `Não foi possível salvar: ${recuperacao.erro} As alterações estão preservadas. Continue a operação para tentar novamente.` : "As últimas alterações estão sendo salvas. Você pode continuar a operação."}</p>}
    {/* overflow-clip (não overflow-hidden): overflow-hidden faria deste Panel o
     * contêiner de rolagem do `position: sticky` da barra de TabelaFinanceira,
     * o que a prenderia ao topo do Panel em vez de à viewport. */}
    <Panel className="operacoes-consulta overflow-clip">

      {loading && carregou && <div className="px-4 pt-3"><AtualizandoFinanceiro /></div>}
      <BarraConsulta criterios={criterios} onLimpar={() => aplicarFiltros({ ...FILTROS_OPERACOES_VAZIOS, inicio, fim })}>
        <label className="fin-filtro-busca relative w-full sm:w-auto"><Search aria-hidden size={16} className="absolute left-3 top-3 text-ink-3" /><Input aria-label="Buscar operações" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar por operação, parceiro ou número" className="h-[42px] w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm" /></label>
        <span aria-hidden="true" className="operacoes-divisor-busca" />
        <PeriodoFinanceiroControl inicio={inicio} fim={fim} allowAll showIcon onChange={(periodo) => { setInicio(periodo.inicio); setFim(periodo.fim); setPagina(1); }} />


        <UiButton type="button" variant="outline" className="consulta-mais-filtros operacoes-todos-filtros" aria-haspopup="dialog" aria-expanded={modalFiltros} onClick={() => { edicaoFiltros.iniciar(); setModalFiltros(true); }}><Settings2 size={17} aria-hidden />Filtros{criterios.length > 0 && <span className="operacoes-filtros-contagem">{criterios.length}</span>}</UiButton>
      </BarraConsulta>
      <div aria-busy={loading} {...(loading ? { inert: "" } : {})}>{erro ? <Empty>Não foi possível carregar as operações.</Empty> : filtradas.length ? <><TabelaFinanceira rotulo="Operações do período" itens={operacoesDaPagina} colunas={colunas} cartaoComLinks chaveDe={(operacao) => operacao.id} onAbrir={(operacao) => abrirDetalhe(operacao.id)} compacta barraRolagemSuperior />
        <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} total={filtradas.length} porPagina={ITENS_POR_PAGINA} rotulo="Paginação de operações" substantivo="operações" idSelect="pagina-operacoes" onPagina={setPagina} /></> : <Empty>Nenhuma operação encontrada no período e filtros selecionados.</Empty>}
    </div></Panel>
    <PainelFiltros aberto={modalFiltros} onAbertoChange={setModalFiltros} temFiltros onLimpar={edicaoFiltros.limpar} onAplicar={() => { if (!erroFiltros) { edicaoFiltros.aplicar(); setModalFiltros(false); } }}>
      {CAMPOS_FILTROS_OPERACOES.filter(campo => campo !== "valor" || podeVerValoresFinanceiros()).map(campo => <CamposFiltroOperacoes key={campo} campo={campo} valores={edicaoFiltros.rascunho} editar={edicaoFiltros.editar} parceiros={parceiros} limiteValor={limiteValor} podeVerValores={podeVerValoresFinanceiros()} />)}
      {erroFiltros && <p role="alert" className="col-span-full text-sm text-destructive">{erroFiltros}</p>}
    </PainelFiltros>
    {servicoGerenciado?.propriedadeId && <GerenciarProcedimentosServico key={servicoGerenciado.id} servicoId={servicoGerenciado.id} propriedadeId={servicoGerenciado.propriedadeId} onFechar={() => setServicoGerenciado(null)} onSalvo={async () => { setItens(await listarOperacoes({ inicio, fim })); }} />}
  </PaginaFinanceira>;
}
