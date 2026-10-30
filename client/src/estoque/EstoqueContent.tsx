import { CartoesProdutos } from "./CartoesProdutos";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { useOrdenacaoTabela } from "@/financeiro/OrdenarConsulta";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button as Botao } from "@/components/ui/button";
import { BuscaLista } from "@/components/BuscaLista";
import { navegarPara } from "../router";
import { podeVerValoresFinanceiros } from "@/financeiro/permissoes";
import { useFiltrosTabelaLocal } from "@/financeiro/useFiltrosTabelaLocal";
import { filtrosDasColunas, type CampoConsulta } from "@/financeiro/FiltroColunaConsulta";
import { useRascunhoConsulta } from "@/financeiro/useRascunhoConsulta";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import "./estoque-theme.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Package, PackagePlus, Plus, Search, SlidersHorizontal, TriangleAlert, History, ArrowLeftRight, ChevronDown } from "lucide-react";
import { AjudaCampo } from "@/components/Dica";
import { Loader } from "../components/Loading";
import { LinkInterno } from "../components/LinkInterno";
import { rotuloUnidade, type UnidadeMedida } from "../lib/unidades";
import { fmtMoneyExact } from "@/components/charts";
import { brl, Button, type ColunaTabela, dataBR, Empty, ErrorBox, PageHeader, PaginaFinanceira, Paginacao, Panel, Pill, SelectFiltro, TabelaFinanceira } from "../financeiro/financeiro-ui";
import { TransferirEstoque } from "./TransferirEstoque";
import { FormProduto } from "../financeiro/FormProduto";
import { PeriodoFinanceiroControl } from "../financeiro/PeriodoFinanceiroControl";
import { useSaldos, listarMovimentos, listarCentrosCusto, type FiltroMovimentos, type MovimentoDTO, type OrigemMovimento, type SaldoDTO, type RefDTO } from "./api";
import { abrirAjusteEstoque, destinoDoMovimento, podeAcessarArea, podeAjustarEstoque } from "./navegacao";
import { SEM_VINCULO } from "../lib/ids";
import { ROTULO_ORIGEM } from "./rotulos";
import { getPropriedadeAtiva } from "../propriedadeScope";

const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const CAMPO = "h-10 w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm";

const TIPO_MOV: Record<MovimentoDTO["tipo"], { rotulo: string; tom: "green" | "amber" | "blue" }> = {
  ENTRADA: { rotulo: "Entrada", tom: "green" }, SAIDA: { rotulo: "Saída", tom: "amber" }, AJUSTE: { rotulo: "Ajuste", tom: "blue" },
};
// Origens que colocam produto no estoque — alimentam o card "Últimas entradas".
const ORIGENS_ENTRADA: readonly OrigemMovimento[] = ["COMPRA", "INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO"];

const ITENS_POR_PAGINA = 15;
const ENTRADAS_EXIBIDAS = 6;

const hrefMaterialGenetico = (id: string) => `/pecuaria/rebanho/cadastros?aba=material-genetico&material=${encodeURIComponent(id)}`;

type Ordem = "nome" | "categoria" | "valor";

function IconeAbaixoMinimo({ size = 16 }: { size?: number }) {
  return <TriangleAlert data-testid="icone-abaixo-minimo" size={size} aria-hidden="true" className="shrink-0 text-[var(--fin-pendente)]" />;
}

// Descarta a resposta de uma busca que já foi superada por outro filtro/página.
function useMovimentos(f: FiltroMovimentos) {
  const [data, setData] = useState<MovimentoDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f);
  const idRef = useRef(0);
  const recarregar = useCallback(() => {
    const id = ++idRef.current;
    setLoading(true); setErro(null);
    listarMovimentos(f).then((r) => { if (id === idRef.current) { setData(r.itens); setTotal(r.total); } })
      .catch((e) => { if (id === idRef.current) setErro(e.message); })
      .finally(() => { if (id === idRef.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); return () => { idRef.current++; }; }, [recarregar]);
  return { data, total, loading, erro, recarregar };
}

export function EstoqueContent({ centroCustoIdInicial, titulo, avisoFiltro }: { centroCustoIdInicial?: string | null; titulo?: string; avisoFiltro?: string } = {}) {
  const visual = useVisualizacaoConsulta("visualEstoque");
  const [consultaUrl, setConsultaUrl] = useState(() => window.location.search);
  useEffect(() => { const atualizar = () => setConsultaUrl(window.location.search); window.addEventListener("popstate", atualizar); return () => window.removeEventListener("popstate", atualizar); }, []);
  const urlEstoque = new URLSearchParams(consultaUrl);
  const movimentoId = urlEstoque.get("movimentoId") ?? "";
  const aba = urlEstoque.get("aba") === "produtos" ? "produtos" : urlEstoque.get("aba") === "movimentacoes" || movimentoId ? "movimentacoes" : "produtos";
  const mudarAba = (valor: string) => {
    if (valor !== "produtos" && valor !== "movimentacoes") return;
    const parametros = new URLSearchParams(window.location.search);
    parametros.set("aba", valor);
    navegarPara(`${window.location.pathname}?${parametros}${window.location.hash}`);
  };
  const consolidado = getPropriedadeAtiva() == null;
  const sitioEfetivo = getPropriedadeAtiva() ?? undefined;
  const sitioHistorico = Number(urlEstoque.get("propriedadeId")) || undefined;
  const sitioMovimento = movimentoId && consolidado ? sitioHistorico : sitioEfetivo;
  // O menu `/estoque` começa sem filtro; atalhos podem informar um centro inicial.
  const [centroFiltro, setCentroFiltro] = useState(centroCustoIdInicial != null ? String(centroCustoIdInicial) : "");
  const saldos = useSaldos({ ...(centroFiltro ? { centroCustoId: centroFiltro } : {}), ...(sitioEfetivo ? { propriedadeId: sitioEfetivo } : {}) });
  useEffect(() => {
    if (!sitioHistorico || (movimentoId && consolidado)) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("propriedadeId");
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`);
  }, [consolidado, movimentoId, sitioHistorico]);
  // Histórico: filtros e paginação vão para o servidor (a lista cresce sem limite).
  const [buscaMov, setBuscaMov] = useState("");
  const [buscaMovAplicada, setBuscaMovAplicada] = useState("");
  const [origemMov, setOrigemMov] = useState("");
  const [centroMov, setCentroMov] = useState("");
  const [periodoMov, setPeriodoMov] = useState({ inicio: "", fim: "" });
  const [paginaMov, setPaginaMov] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setBuscaMovAplicada(buscaMov.trim()); setPaginaMov(1); }, 300);
    return () => clearTimeout(t);
  }, [buscaMov]);
  const movimentos = useMovimentos({ movimentoId: movimentoId || undefined, propriedadeId: sitioMovimento, q: movimentoId ? undefined : buscaMovAplicada, origem: movimentoId ? undefined : origemMov, centroCustoId: movimentoId ? undefined : centroMov, de: movimentoId ? undefined : periodoMov.inicio, ate: movimentoId ? undefined : periodoMov.fim, pagina: paginaMov, porPagina: ITENS_POR_PAGINA });
  const historicoRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (aba !== "movimentacoes" || !movimentoId || movimentos.loading) return;
    historicoRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    historicoRef.current?.focus({ preventScroll: true });
  }, [aba, movimentoId, movimentos.loading]);
  const entradas = useMovimentos({ tipo: "ENTRADA", propriedadeId: sitioEfetivo, porPagina: 100 });
  const [paginaSaldos, setPaginaSaldos] = useState(1);
  const [busca, setBusca] = useState("");
  const [soAbaixoMin, setSoAbaixoMin] = useState(false);
  const [soNegativos, setSoNegativos] = useState(false);
  const [ordem, setOrdem] = useState<Ordem>("nome");
  useEffect(() => { setPaginaSaldos(1); }, [busca, centroFiltro, ordem, soAbaixoMin, soNegativos]);
  const [centros, setCentros] = useState<RefDTO[]>([]);
  const [erroCentros, setErroCentros] = useState<string | null>(null);
  const [perdendo, setPerdendo] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [cadastrandoProduto, setCadastrandoProduto] = useState(false);
  // O ajuste é uma operação financeira: exige a área financeiro e a permissão `lancar`.
  const podeAjustar = podeAjustarEstoque();

  useEffect(() => { listarCentrosCusto().then((cs) => { setCentros(cs); setErroCentros(null); }).catch((e) => setErroCentros(e instanceof Error ? e.message : String(e))); }, []);

  const consultaSaldos = useFiltrosTabelaLocal<SaldoDTO>([
    { chave: "produto", naBarra: true, rotulo: "Produto", tipo: "texto", obter: s => s.nome },
    { chave: "categoria", naBarra: true, rotulo: "Categoria", tipo: "texto", obter: s => s.categoria?.nome },
    ...(podeVerValoresFinanceiros() ? [{ chave: "valor", rotulo: "Valor em estoque", tipo: "valor" as const, obter: (s: SaldoDTO) => s.custoMedio == null ? null : s.valor, limiteSugerido: Math.max(1, ...saldos.data.map(s => s.valor ?? 0)) }] : []),
  ], () => setPaginaSaldos(1));
  const ordenacaoSaldos = useOrdenacaoTabela<SaldoDTO>([{chave:"produto",rotulo:"Produto",tipo:"texto",obter:s=>s.nome},{chave:"saldo",rotulo:"Disponível (unidade do produto)",tipo:"numero",obter:s=>s.saldo},...(podeVerValoresFinanceiros()?[{chave:"valor",rotulo:"Valor em estoque",tipo:"numero" as const,obter:(s:SaldoDTO)=>s.custoMedio == null ? null : s.valor}]:[])],"ordemSaldos",()=>setPaginaSaldos(1));
  const saldosBase = (() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const filtrados = consultaSaldos.filtrar(saldos.data).filter((s) => {
      if (soAbaixoMin && !s.abaixoMinimo) return false;
      if (soNegativos && s.saldo >= 0) return false;
      if (!termo) return true;
      return s.nome.toLocaleLowerCase("pt-BR").includes(termo) || (s.categoria?.nome ?? "").toLocaleLowerCase("pt-BR").includes(termo);
    });
    return [...filtrados].sort((a, b) => {
      if (ordem === "valor") return (b.valor ?? 0) - (a.valor ?? 0) || a.nome.localeCompare(b.nome, "pt-BR");
      if (ordem === "categoria") return (a.categoria?.nome ?? "").localeCompare(b.categoria?.nome ?? "", "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR");
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  })();

  const saldosVisiveis = ordenacaoSaldos.ordenar(saldosBase);
  const totalPaginasSaldos = Math.max(1, Math.ceil(saldosVisiveis.length / ITENS_POR_PAGINA));
  const paginaSaldosAtual = Math.min(paginaSaldos, totalPaginasSaldos);
  const saldosDaPagina = saldosVisiveis.slice((paginaSaldosAtual - 1) * ITENS_POR_PAGINA, paginaSaldosAtual * ITENS_POR_PAGINA);
  const totalPaginasMov = Math.max(1, Math.ceil(movimentos.total / ITENS_POR_PAGINA));
  const paginaMovAtual = Math.min(paginaMov, totalPaginasMov);
  // Total encolheu (estorno, novo filtro no servidor): volta à última página existente.
  useEffect(() => { if (!movimentos.loading && paginaMov > totalPaginasMov) setPaginaMov(totalPaginasMov); }, [movimentos.loading, paginaMov, totalPaginasMov]);
  const filtrosMovAtivos = buscaMovAplicada !== "" || origemMov !== "" || centroMov !== "" || periodoMov.inicio !== "" || periodoMov.fim !== "";
  const valorTotal = useMemo(() => saldos.data.reduce((soma, s) => soma + Math.max(0, s.valor ?? 0), 0), [saldos.data]);
  const valoresPendentes = saldos.data.filter(s => s.valor == null).length;
  const valoresConhecidos = saldos.data.length - valoresPendentes;
  const nNegativos = useMemo(() => saldos.data.filter((s) => s.saldo < 0).length, [saldos.data]);
  const nAbaixoMin = useMemo(() => saldos.data.filter((s) => s.abaixoMinimo).length, [saldos.data]);
  const nEmEstoque = useMemo(() => saldos.data.filter((s) => s.saldo > 0).length, [saldos.data]);
  const prioridadeReposicao = saldosVisiveis.filter(s => s.abaixoMinimo || s.saldo < 0).sort((a, b) => Number(b.saldo < 0) - Number(a.saldo < 0) || ((a.minimoEstoque ?? 0) > 0 ? a.saldo / a.minimoEstoque! : Infinity) - ((b.minimoEstoque ?? 0) > 0 ? b.saldo / b.minimoEstoque! : Infinity) || a.nome.localeCompare(b.nome, "pt-BR"))[0];
  const unidadePorProduto = useMemo(() => new Map<string, UnidadeMedida>(saldos.data.map((s) => [s.produtoId, s.unidade] as const)), [saldos.data]);

  // Últimas entradas: o movimento de ENTRADA (compra/inventário/bonificação/produção,
  // não estornado) mais recente de cada produto listado — os 6 primeiros.
  const ultimasEntradas = useMemo(() => {
    const listados = new Set(saldos.data.map((s) => s.produtoId));
    const vistos = new Set<string>();
    const lista: MovimentoDTO[] = [];
    for (const m of entradas.data) {
      if (m.tipo !== "ENTRADA" || m.status !== "CONFIRMADO" || m.reversaoDeId != null || !ORIGENS_ENTRADA.includes(m.origem)) continue;
      if (!listados.has(m.produtoId) || vistos.has(m.produtoId)) continue;
      vistos.add(m.produtoId);
      lista.push(m);
      if (lista.length === ENTRADAS_EXIBIDAS) break;
    }
    return lista;
  }, [entradas.data, saldos.data]);

  const recarregarTudo = () => { saldos.recarregar(); movimentos.recarregar(); entradas.recarregar(); };

  const colunasSaldos: ColunaTabela<SaldoDTO>[] = [
    { chave: "produto", titulo: "Produto", larguraMinima: 280, principal: true, celula: (s) => <span className="flex flex-wrap items-center gap-2"><strong className="break-words font-semibold"><a href={`/estoque/produtos/${s.produtoId}`} className="text-primary hover:underline">{s.nome}</a></strong>{s.materialGeneticoId && <LinkInterno href={hrefMaterialGenetico(s.materialGeneticoId)} area="pecuaria">Identidade genética</LinkInterno>}</span> },
    { chave: "categoria", titulo: "Categoria / centro", larguraMinima: 180, larguraFlexivel: true, celula: (s) => <><div>{s.categoria?.nome ?? "Sem categoria"}</div><div className="text-xs text-ink-3">{s.centrosCusto.map((c) => c.nome).join(" · ") || "Sem centro"}</div></> },
    { chave: "saldo", titulo: "Disponível", alinhamento: "direita", larguraMinima: 220, celula: (s) => <><strong className={s.saldo < 0 ? "text-destructive" : s.abaixoMinimo ? "text-[var(--fin-pendente)]" : ""}>{qtd(s.saldo)} {rotuloUnidade(s.unidade)}</strong><div className={`text-xs ${s.abaixoMinimo ? "estoque-reposicao" : "text-ink-3"}`}>{s.abaixoMinimo && <><IconeAbaixoMinimo size={13} />Abaixo do mínimo · </>}Mín. {s.minimoEstoque != null ? `${qtd(s.minimoEstoque)} ${rotuloUnidade(s.unidade)}` : "não definido"}</div></> },
    { chave: "valor", titulo: "Valor em estoque", alinhamento: "direita", larguraMinima: 160, celula: (s) => <><strong className="whitespace-nowrap font-semibold">{s.custoMedio != null ? brl(s.valor ?? 0) : "—"}</strong>{s.custoMedio != null && <div className="text-xs text-ink-3">Médio: {fmtMoneyExact(s.custoMedio)}</div>}</> },
    ...(podeAjustar ? [{ chave: "acoes", titulo: "Ações", alinhamento: "esquerda" as const, larguraMinima: 90, acoes: true, celula: (s: SaldoDTO) => (
      <div className="flex items-center justify-end gap-1">
        {podeAjustar && <button type="button" onClick={() => abrirAjusteEstoque(s.produtoId)} aria-label={`Ajustar quantidade de ${s.nome}`} title="Ajustar quantidade" className="estoque-acao-produto rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"><SlidersHorizontal size={16} /></button>}
      </div>
    ) }] : []),
  ];

  const colunasMovimentos: ColunaTabela<MovimentoDTO>[] = [
    { chave: "produto", titulo: "Produto / data", larguraMinima: 220, principal: true, celula: (m) => <><strong className="break-words font-semibold"><a href={`/estoque/produtos/${m.produtoId}`} className="text-primary hover:underline">{m.produto}</a></strong><div className="mt-1 text-xs text-ink-3">{dataBR(m.data)}</div></> },
    { chave: "tipo", titulo: "Movimento", alinhamento: "esquerda", larguraMinima: 160, celula: (m) => (
      <span className="flex flex-wrap items-center justify-start gap-1.5">
        <Pill tone={TIPO_MOV[m.tipo].tom}>{TIPO_MOV[m.tipo].rotulo}</Pill>
        {m.reversaoDeId != null && <Pill tone="red">Estorno</Pill>}
        {m.status === "REVERTIDO" && <Pill tone="red">Estornado</Pill>}
      </span>
    ) },
    { chave: "qtd", titulo: "Qtde", alinhamento: "direita", larguraMinima: 110, celula: (m) => { const un = unidadePorProduto.get(m.produtoId); return <span className="whitespace-nowrap">{qtd(m.quantidade)}{un ? ` ${rotuloUnidade(un)}` : ""}</span>; } },
    { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 120, celula: (m) => <span className="whitespace-nowrap">{m.valorTotal == null ? "—" : brl(m.valorTotal)}</span> },
    { chave: "origem", titulo: "Origem / vínculo", alinhamento: "esquerda", larguraMinima: 220, larguraFlexivel: true, celula: (m) => {
      const destino = destinoDoMovimento(m);
      return <>{destino?.rotulo !== (ROTULO_ORIGEM[m.origem] ?? m.origem) && <div className="text-xs text-ink-3">{ROTULO_ORIGEM[m.origem] ?? m.origem}</div>}<div className="break-words">{destino ? <><LinkInterno href={destino.href} area={destino.area}>{destino.rotulo}</LinkInterno>{m.fornecedor && <span className="text-ink-3"> · {m.fornecedor}</span>}</> : <span className="text-ink-3">{m.fornecedor ?? "—"}</span>}</div><div className="mt-1 flex flex-wrap gap-2 text-xs">
        {m.estorno && <LinkInterno href={`/estoque?movimentoId=${encodeURIComponent(m.estorno.id)}${m.propriedadeId != null ? `&propriedadeId=${m.propriedadeId}` : ""}`} area="estoque">Ver estorno</LinkInterno>}
        {m.reversaoDeId && <LinkInterno href={`/estoque?movimentoId=${encodeURIComponent(m.reversaoDeId)}${m.propriedadeId != null ? `&propriedadeId=${m.propriedadeId}` : ""}`} area="estoque">Ver movimento original</LinkInterno>}
      </div></>;
    } },
  ];

  const filtrosAtivos = busca.trim() !== "" || soAbaixoMin || soNegativos;
  const acao = <div className="flex flex-wrap gap-2">
    {podeAjustar && <DropdownMenu><DropdownMenuTrigger asChild><Botao variant="outline"><ArrowLeftRight size={16} aria-hidden="true" />Movimentar estoque<ChevronDown size={14} aria-hidden="true" /></Botao></DropdownMenuTrigger><DropdownMenuContent align="end" className="estoque-menu-acoes"><DropdownMenuItem onSelect={() => setTransferindo(true)}>Transferir estoque</DropdownMenuItem><DropdownMenuItem onSelect={() => abrirAjusteEstoque()}>Ajustar quantidade</DropdownMenuItem><DropdownMenuItem onSelect={() => setPerdendo(true)}>Registrar perda</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
    <Button onClick={() => setCadastrandoProduto(true)}><Plus size={16} /> Cadastrar produto</Button>
  </div>;

  const edicaoSaldos = useRascunhoConsulta({ centro: centroFiltro, ordem, abaixo: soAbaixoMin, negativos: soNegativos }, { centro: "", ordem: "nome" as Ordem, abaixo: false, negativos: false }, v => { setCentroFiltro(v.centro); setOrdem(v.ordem); setSoAbaixoMin(v.abaixo); setSoNegativos(v.negativos); setPaginaSaldos(1); });
  const edicaoCompletaSaldos = { iniciar: () => { edicaoSaldos.iniciar(); consultaSaldos.edicao.iniciar(); }, limpar: () => { edicaoSaldos.limpar(); consultaSaldos.edicao.limpar(); }, aplicar: () => { edicaoSaldos.aplicar(); consultaSaldos.edicao.aplicar(); } };
  const campoAlertas: CampoConsulta = { chave: "saldo", ativo: soAbaixoMin || soNegativos, limpar: () => { edicaoSaldos.editar("abaixo", false); edicaoSaldos.editar("negativos", false); }, conteudo: <div className="grid gap-3"><label className="flex items-center gap-2"><input type="checkbox" checked={edicaoSaldos.rascunho.abaixo} onChange={e => { edicaoSaldos.editar("abaixo", e.target.checked); edicaoSaldos.editar("negativos", false); }} /><IconeAbaixoMinimo />Só abaixo do mínimo ({nAbaixoMin})</label><label className="flex items-center gap-2"><input type="checkbox" checked={edicaoSaldos.rascunho.negativos} onChange={e => { edicaoSaldos.editar("negativos", e.target.checked); edicaoSaldos.editar("abaixo", false); }} />Saldo negativo ({nNegativos})</label></div> };
  const camposSaldos = [...consultaSaldos.campos, campoAlertas];
  const edicaoHistorico = useRascunhoConsulta({ centro: centroMov, origem: origemMov, busca: buscaMov }, { centro: "", origem: "", busca: "" }, v => { setCentroMov(v.centro); setOrigemMov(v.origem); setBuscaMov(v.busca); setPaginaMov(1); });
  const camposHistorico: CampoConsulta[] = [
    { chave: "tipo", colunas: ["origem"], ativo: !!origemMov, limpar: () => edicaoHistorico.editar("origem", ""), conteudo: <label>Origem<SelectFiltro rotulo="Filtrar por origem" valor={edicaoHistorico.rascunho.origem} onChange={v => edicaoHistorico.editar("origem", v)} opcoes={[{ valor: "", texto: "Todas as origens" }, ...Object.entries(ROTULO_ORIGEM).map(([valor, texto]) => ({ valor, texto }))]} /></label> },
    { chave: "produto", naBarra: true, ativo: !!buscaMov, limpar: () => edicaoHistorico.editar("busca", ""), conteudo: <label>Produto, operação ou fornecedor<input aria-label="Buscar movimento no filtro" className={CAMPO} value={edicaoHistorico.rascunho.busca} onChange={e => edicaoHistorico.editar("busca", e.target.value)} /></label> },
  ];
  return <PaginaFinanceira>
    <PageHeader eyebrow="" titulo={<span className="rotina-titulo"><span><Package/></span>{titulo ?? "Estoque"}</span>} acao={acao} />
    {avisoFiltro && <p className="mt-4 text-sm text-amber-800">{avisoFiltro}</p>}
    <ErrorBox erro={erroCentros ? `Erro ao carregar centros de custo: ${erroCentros}` : null} />

    <Panel className="estoque-resumo-consulta mt-5">
      <div className="estoque-resumo-produtos"><Package size={24} aria-hidden="true" /><strong>{saldos.loading ? "Consultando saldos…" : `${nEmEstoque} ${nEmEstoque === 1 ? "produto" : "produtos"} em estoque`}</strong></div>
      {nAbaixoMin > 0 && <button type="button" className="estoque-resumo-alerta" aria-label={`${nAbaixoMin} abaixo do mínimo`} aria-describedby="estoque-prioridade-reposicao" aria-pressed={soAbaixoMin} onClick={() => { setSoAbaixoMin(!soAbaixoMin); setSoNegativos(false); mudarAba("produtos"); }}><IconeAbaixoMinimo /><span><strong>{nAbaixoMin} abaixo do mínimo</strong><span id="estoque-prioridade-reposicao" className="estoque-resumo-prioridade">{prioridadeReposicao ? <>{prioridadeReposicao.nome}{prioridadeReposicao.minimoEstoque != null ? ` · faltam ${qtd(Math.max(0, prioridadeReposicao.minimoEstoque - prioridadeReposicao.saldo))} ${rotuloUnidade(prioridadeReposicao.unidade)}` : ` · saldo ${qtd(prioridadeReposicao.saldo)} ${rotuloUnidade(prioridadeReposicao.unidade)}`}</> : "Ver produtos para reposição"}</span></span></button>}
      {nNegativos > 0 && <button type="button" className="estoque-resumo-alerta estoque-resumo-negativo" aria-pressed={soNegativos} onClick={() => { setSoNegativos(!soNegativos); setSoAbaixoMin(false); mudarAba("produtos"); }}>{nNegativos} com saldo negativo</button>}
      <div className="estoque-resumo-valor"><span>{valoresPendentes > 0 && valoresConhecidos > 0 ? "Valor conhecido em estoque (parcial)" : "Valor em estoque"}<AjudaCampo rotulo="Como o valor é calculado" texto="O valor corresponde ao saldo monetário remanescente. Grupos rastreados usam média do saldo; produtos sem rastreio usam aquisições mais antigas. Valores desconhecidos ficam separados." /></span><strong>{saldos.loading ? "—" : saldos.erro ? "Indisponível" : valoresPendentes > 0 && valoresConhecidos === 0 ? "Indisponível" : brl(valorTotal)}</strong>{valoresPendentes > 0 && valoresConhecidos > 0 && <span role="status">{valoresPendentes} produto(s) sem valor disponível. O total conhecido é parcial.</span>}</div>
    </Panel>
    <Tabs className="estoque-consulta-abas" value={aba} onValueChange={mudarAba}>
      <TabsList aria-label="Consultas de estoque"><TabsTrigger value="produtos"><Package aria-hidden="true" />Produtos</TabsTrigger><TabsTrigger value="movimentacoes"><History aria-hidden="true" />Movimentações</TabsTrigger></TabsList>
      <TabsContent value="produtos" forceMount hidden={aba !== "produtos"}>

    <section className="mt-6" aria-label="Saldos de estoque">
      <Panel className="fin-painel overflow-hidden">

      <BarraConsulta ordenacao={ordenacaoSaldos.controle} campos={camposSaldos} erroFiltros={consultaSaldos.erro} edicaoFiltros={edicaoCompletaSaldos} adicionais={<><label>Centro de custo<SelectFiltro rotulo="Filtrar por centro de custo" valor={edicaoSaldos.rascunho.centro} onChange={v => edicaoSaldos.editar("centro", v)} opcoes={[{ valor: "", texto: "Todos os centros" }, { valor: SEM_VINCULO, texto: "Sem centro" }, ...centros.map((c) => ({ valor: c.id, texto: c.nome }))]} className="w-full sm:!w-full" /></label>
<label>Ordenar por<SelectFiltro rotulo="Ordenar por" valor={edicaoSaldos.rascunho.ordem} onChange={v => edicaoSaldos.editar("ordem", v as Ordem)} opcoes={[{ valor: "nome", texto: "Ordenar por nome" }, { valor: "categoria", texto: "Ordenar por categoria" }, { valor: "valor", texto: "Ordenar por maior valor" }]} className="w-full sm:!w-full" /></label>
</>} criterios={[...consultaSaldos.criterios, ...(soAbaixoMin ? [{id:"abaixo",rotulo:"Só abaixo do mínimo",limpar:()=>setSoAbaixoMin(false)}] : []), ...(soNegativos ? [{id:"negativos",rotulo:"Saldo negativo",limpar:()=>setSoNegativos(false)}] : []), ...(centroFiltro ? [{id:"centro",rotulo:`Centro: ${centros.find(c=>c.id===centroFiltro)?.nome ?? "Sem centro"}`,limpar:()=>setCentroFiltro("")}] : []), ...(ordem !== "nome" ? [{id:"ordem",rotulo:`Ordenação: ${ordem === "valor" ? "Maior valor" : "Categoria"}`,limpar:()=>setOrdem("nome")}] : [])]} onLimpar={()=>{consultaSaldos.limpar();setBusca("");setCentroFiltro("");setOrdem("nome");setSoAbaixoMin(false);setSoNegativos(false);}}>
        <BuscaLista rotulo="Buscar produto" placeholder="Buscar por produto ou categoria" valor={busca} onChange={setBusca} />


      </BarraConsulta>
      <div className="consulta-visual-barra"><span>{saldosVisiveis.length} produtos no recorte</span><AlternarVisualizacaoConsulta rotulo="Visualização dos produtos" {...visual}/></div>
      <div className="min-w-0">
        {saldos.loading ? <div className="p-6"><Loader /></div>
          : saldos.erro ? <Empty>Não foi possível consultar os saldos: {saldos.erro} <Button secondary onClick={saldos.recarregar}>Tentar novamente</Button></Empty>
          : saldos.data.length === 0 ? <Empty>Nenhum produto com movimento de estoque. Registre uma compra para estoque ou um inventário inicial.</Empty>
          : saldosVisiveis.length === 0 ? <Empty>{filtrosAtivos ? "Nenhum produto bate com a busca." : "Nenhum produto para exibir."}</Empty>
          : <>
              {visual.modo === "visual" ? <CartoesProdutos itens={saldosDaPagina} propriedadeId={sitioEfetivo} verValores={podeVerValoresFinanceiros()} acoes={s=><>{s.materialGeneticoId&&<LinkInterno href={hrefMaterialGenetico(s.materialGeneticoId)} area="pecuaria">Identidade genética</LinkInterno>}{colunasSaldos.find(c=>c.chave==="acoes")?.celula(s)}</>}/> : <TabelaFinanceira ordenacao={ordenacaoSaldos.controle} compacta filtrosColunas={filtrosDasColunas(camposSaldos, edicaoCompletaSaldos, consultaSaldos.erro)} rotulo="Saldos de estoque" itens={saldosDaPagina} colunas={colunasSaldos} chaveDe={(s) => s.produtoId} classeLinha={s => s.saldo < 0 ? "bg-red-50/40" : s.abaixoMinimo ? "bg-amber-50/40" : ""} />}
              <Paginacao pagina={paginaSaldosAtual} totalPaginas={totalPaginasSaldos} total={saldosVisiveis.length} porPagina={ITENS_POR_PAGINA} rotulo="Paginação de saldos" substantivo={saldosVisiveis.length === 1 ? "produto" : "produtos"} idSelect="pagina-saldos" onPagina={setPaginaSaldos} />
            </>}
      </div>
      </Panel>
    </section>

      </TabsContent>
      <TabsContent value="movimentacoes" forceMount hidden={aba !== "movimentacoes"}>
    <section ref={historicoRef} tabIndex={-1} className="mt-6 scroll-mt-4" aria-label="Histórico de movimentos">
      <Panel className="fin-painel overflow-hidden">

      {movimentoId && <p className="mt-2 rounded-lg border border-border bg-surface p-3 text-sm">Movimento selecionado · <a href="/estoque" className="underline">Voltar ao histórico completo</a></p>}
      <BarraConsulta campos={camposHistorico} edicaoFiltros={edicaoHistorico} adicionais={<><label>Centro de custo<SelectFiltro rotulo="Filtrar histórico por centro de custo" valor={edicaoHistorico.rascunho.centro} onChange={v => edicaoHistorico.editar("centro", v)} opcoes={[{ valor: "", texto: "Todos os centros" }, { valor: SEM_VINCULO, texto: "Sem centro" }, ...centros.map((c) => ({ valor: c.id, texto: c.nome }))]} className="min-w-0 flex-[1_1_160px]" /></label>
</>} criterios={centroMov ? [{id:"centro",rotulo:`Centro: ${centros.find(c=>c.id===centroMov)?.nome ?? "Sem centro"}`,limpar:()=>{setCentroMov("");setPaginaMov(1);}}] : []} onLimpar={()=>{setCentroMov("");setOrigemMov("");setBuscaMov("");setPaginaMov(1);}}>
        <label className="relative w-full min-w-0 flex-[2_1_260px] sm:w-auto"><Search size={16} className="absolute left-3 top-3 text-ink-3" aria-hidden="true" /><input type="search" aria-label="Buscar movimento" value={buscaMov} onChange={(e) => setBuscaMov(e.target.value)} placeholder="Buscar por produto, operação ou fornecedor…" className={`${CAMPO} w-full pl-9`} /></label>


        <PeriodoFinanceiroControl inicio={periodoMov.inicio} fim={periodoMov.fim} allowAll label="Período do histórico" onChange={(periodo) => { setPeriodoMov(periodo); setPaginaMov(1); }} />
      </BarraConsulta>
      <div className="min-w-0">
        {movimentos.loading && movimentos.data.length === 0 ? <div className="p-6"><Loader /></div>
          : movimentos.erro ? <Empty>Não foi possível consultar os movimentos: {movimentos.erro} <button type="button" className="underline" onClick={movimentos.recarregar}>Tentar novamente</button></Empty>
          : movimentos.data.length === 0 ? <Empty>{movimentoId ? "Movimento não encontrado neste sítio ou indisponível para seu acesso." : filtrosMovAtivos ? "Nenhum movimento bate com os filtros." : "Nenhum movimento registrado ainda."}</Empty>
          : <>
              <TabelaFinanceira compacta filtrosColunas={filtrosDasColunas(camposHistorico, edicaoHistorico)} rotulo="Histórico de movimentos" itens={movimentos.data} colunas={colunasMovimentos} chaveDe={(m) => m.id} classeLinha={(m) => m.id === movimentoId ? "bg-surface-2 outline outline-2 outline-mast -outline-offset-2" : m.status === "REVERTIDO" || m.reversaoDeId != null ? "opacity-60" : ""} />
              <Paginacao pagina={paginaMovAtual} totalPaginas={totalPaginasMov} total={movimentos.total} porPagina={ITENS_POR_PAGINA} rotulo="Paginação do histórico" substantivo={movimentos.total === 1 ? "movimento" : "movimentos"} idSelect="pagina-movimentos" onPagina={setPaginaMov} />
            </>}
      </div>
      </Panel>
    </section>

    <section className="estoque-entradas mt-3 rounded-xl border border-border bg-card" aria-label="Últimas entradas">
      <h2 className="flex items-center gap-2 px-4 pt-4 text-base font-semibold"><PackagePlus size={17} aria-hidden="true" />Últimas entradas</h2>
      <div className="border-t border-border p-4">
        {entradas.loading && ultimasEntradas.length === 0 ? <p className="mt-3 text-xs text-ink-3">Carregando…</p>
          : ultimasEntradas.length === 0 ? <p className="mt-3 text-xs text-ink-3">Nenhuma entrada registrada ainda.</p>
          : <ul className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">{ultimasEntradas.map((m) => {
              const destino = destinoDoMovimento(m);
              const un = unidadePorProduto.get(m.produtoId);
              return <li key={m.id} className="min-w-0 text-sm leading-5">
                <div className="min-w-0 truncate font-semibold">{destino ? <LinkInterno href={destino.href} area={destino.area}>{m.produto}</LinkInterno> : m.produto}</div>
                <div className="text-xs text-ink-3">{dataBR(m.data)} · {qtd(m.quantidade)}{un ? ` ${rotuloUnidade(un)}` : ""}</div>
              </li>;
            })}</ul>}
      </div>
    </section>

      </TabsContent>
    </Tabs>

    {perdendo && <TransferirEstoque perda onFechar={() => setPerdendo(false)} onSalvo={() => { setPerdendo(false); recarregarTudo(); }} />}
    {transferindo && <TransferirEstoque onFechar={() => setTransferindo(false)} onSalvo={() => { setTransferindo(false); recarregarTudo(); }} />}
    {cadastrandoProduto && <FormProduto produto={null} onFechar={() => setCadastrandoProduto(false)} onSalvo={() => { setCadastrandoProduto(false); recarregarTudo(); }} />}
  </PaginaFinanceira>;
}
