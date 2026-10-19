import "./estoque-theme.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Package, PackagePlus, Plus, Search, SlidersHorizontal, TriangleAlert, History } from "lucide-react";
import { AjudaCampo, Dica } from "@/components/Dica";
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
  const urlEstoque = new URLSearchParams(window.location.search);
  const movimentoId = urlEstoque.get("movimentoId") ?? "";
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
    if (!movimentoId || movimentos.loading) return;
    historicoRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    historicoRef.current?.focus({ preventScroll: true });
  }, [movimentoId, movimentos.loading]);
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

  const saldosVisiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const filtrados = saldos.data.filter((s) => {
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
  }, [saldos.data, busca, soAbaixoMin, soNegativos, ordem]);

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
    { chave: "produto", titulo: "Produto", larguraMinima: 220, principal: true, celula: (s) => <span className="flex flex-wrap items-center gap-2"><strong className="break-words font-semibold"><a href={`/estoque/produtos/${s.produtoId}`} className="text-primary hover:underline">{s.nome}</a></strong>{s.materialGeneticoId && <LinkInterno href={hrefMaterialGenetico(s.materialGeneticoId)} area="pecuaria">Identidade genética</LinkInterno>}{s.abaixoMinimo && <Dica rotulo="Abaixo do mínimo" conteudo={`Abaixo do mínimo${s.minimoEstoque != null ? ` (${qtd(s.minimoEstoque)} ${rotuloUnidade(s.unidade)})` : ""}`} className="hover:opacity-80"><IconeAbaixoMinimo /></Dica>}</span> },
    { chave: "categoria", titulo: "Classificação", larguraMinima: 180, larguraFlexivel: true, celula: (s) => <><div>{s.categoria?.nome ?? "Sem categoria"}</div><div className="text-xs text-ink-3">{s.centrosCusto.map((c) => c.nome).join(" · ") || "Sem centro"}</div></> },
    { chave: "saldo", titulo: "Saldo / mínimo", alinhamento: "direita", larguraMinima: 140, celula: (s) => <><strong className={s.saldo < 0 ? "text-destructive" : s.abaixoMinimo ? "text-[var(--fin-pendente)]" : ""}>{qtd(s.saldo)} {rotuloUnidade(s.unidade)}</strong><div className="text-xs text-ink-3">Mínimo: {s.minimoEstoque != null ? `${qtd(s.minimoEstoque)} ${rotuloUnidade(s.unidade)}` : "não definido"}</div></> },
    { chave: "valor", titulo: "Valor / custo médio", alinhamento: "direita", larguraMinima: 160, celula: (s) => <><strong className="whitespace-nowrap font-semibold">{s.custoMedio != null ? brl(s.valor ?? 0) : "—"}</strong><div className="text-xs text-ink-3">Médio: {s.custoMedio != null ? fmtMoneyExact(s.custoMedio) : "—"}</div></> },
    ...(podeAjustar ? [{ chave: "acoes", titulo: "Ações", alinhamento: "esquerda" as const, larguraMinima: 90, acoes: true, celula: (s: SaldoDTO) => (
      <div className="flex items-center justify-end gap-1">
        {podeAjustar && <button type="button" onClick={() => abrirAjusteEstoque(s.produtoId)} aria-label={`Ajustar quantidade de ${s.nome}`} title="Ajustar quantidade" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"><SlidersHorizontal size={16} /></button>}
      </div>
    ) }] : []),
  ];

  const colunasMovimentos: ColunaTabela<MovimentoDTO>[] = [
    { chave: "produto", titulo: "Produto / data", larguraMinima: 220, principal: true, celula: (m) => <><strong className="break-words font-semibold"><a href={`/estoque/produtos/${m.produtoId}`} className="text-primary hover:underline">{m.produto}</a></strong><div className="mt-1 text-xs text-ink-3">{dataBR(m.data)}</div></> },
    { chave: "tipo", titulo: "Tipo", alinhamento: "esquerda", larguraMinima: 160, celula: (m) => (
      <span className="flex flex-wrap items-center justify-start gap-1.5">
        <span title={TIPO_MOV[m.tipo].rotulo}><Pill tone={TIPO_MOV[m.tipo].tom}>{ROTULO_ORIGEM[m.origem] ?? m.origem}</Pill></span>
        {m.reversaoDeId != null && <Pill tone="red">Estorno</Pill>}
        {m.status === "REVERTIDO" && <Pill tone="red">Estornado</Pill>}
      </span>
    ) },
    { chave: "qtd", titulo: "Qtde", alinhamento: "direita", larguraMinima: 110, celula: (m) => { const un = unidadePorProduto.get(m.produtoId); return <span className="whitespace-nowrap">{qtd(m.quantidade)}{un ? ` ${rotuloUnidade(un)}` : ""}</span>; } },
    { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 120, celula: (m) => <span className="whitespace-nowrap">{m.valorTotal == null ? "—" : brl(m.valorTotal)}</span> },
    { chave: "origem", titulo: "Origem / destino", alinhamento: "esquerda", larguraMinima: 220, larguraFlexivel: true, celula: (m) => {
      const destino = destinoDoMovimento(m);
      return <><div className="break-words">{destino ? <><LinkInterno href={destino.href} area={destino.area}>{destino.rotulo}</LinkInterno>{m.fornecedor && <span className="text-ink-3"> · {m.fornecedor}</span>}</> : <span className="text-ink-3">{m.fornecedor ?? "—"}</span>}</div><div className="mt-1 flex flex-wrap gap-2 text-xs">
        {m.estorno && <LinkInterno href={`/estoque?movimentoId=${encodeURIComponent(m.estorno.id)}${m.propriedadeId != null ? `&propriedadeId=${m.propriedadeId}` : ""}`} area="estoque">Ver estorno</LinkInterno>}
        {m.reversaoDeId && <LinkInterno href={`/estoque?movimentoId=${encodeURIComponent(m.reversaoDeId)}${m.propriedadeId != null ? `&propriedadeId=${m.propriedadeId}` : ""}`} area="estoque">Ver movimento original</LinkInterno>}
      </div></>;
    } },
  ];

  const filtrosAtivos = busca.trim() !== "" || soAbaixoMin || soNegativos;
  const acao = <div className="flex flex-wrap gap-2">
    {podeAjustar && <Button secondary onClick={() => setPerdendo(true)}>Registrar perda</Button>}
    {podeAjustar && <Button secondary onClick={() => setTransferindo(true)}>Transferir estoque</Button>}
    {podeAjustar && <Button secondary onClick={() => abrirAjusteEstoque()}><SlidersHorizontal size={16} /> Ajustar quantidade</Button>}
    <Button onClick={() => setCadastrandoProduto(true)}><Plus size={16} /> Cadastrar produto</Button>
  </div>;

  return <PaginaFinanceira>
    <PageHeader eyebrow="" titulo={titulo ?? "Estoque"} descricao="Saldos, reposição e movimentações dos produtos da fazenda." acao={acao} />
    {avisoFiltro && <p className="mt-4 text-sm text-amber-800">{avisoFiltro}</p>}
    <ErrorBox erro={erroCentros ? `Erro ao carregar centros de custo: ${erroCentros}` : null} />

    {/* Só dados de estoque: valor, alertas e as últimas entradas. */}
    <Panel className="estoque-panorama mt-5">
      <div className="estoque-panorama-resumo">
        <span className="fin-section-icon"><Package aria-hidden="true" /></span>
        <div><span className="text-xs text-ink-3">{valoresPendentes > 0 && valoresConhecidos > 0 ? "Valor conhecido em estoque (parcial)" : "Valor em estoque"}</span><div className="text-2xl font-semibold">{saldos.loading ? "—" : valoresPendentes > 0 && valoresConhecidos === 0 ? "—" : brl(valorTotal)}</div><p className="mt-1 text-xs text-ink-3">{saldos.loading ? "Consultando saldos…" : `${nEmEstoque} ${nEmEstoque === 1 ? "produto" : "produtos"} em estoque`}</p></div>
        {valoresPendentes > 0 && valoresConhecidos > 0 && <p className="text-xs text-ink-3" role="status">{valoresPendentes} produto(s) sem valor disponível. O total conhecido é parcial.</p>}
      </div>
      <div className="estoque-panorama-alertas" aria-label="Atenção ao estoque">
        <button type="button" aria-pressed={soAbaixoMin} onClick={() => { setSoAbaixoMin(v => !v); setSoNegativos(false); }} className={`estoque-alerta ${nAbaixoMin ? "estoque-alerta-atencao" : ""}`}><TriangleAlert size={18} aria-hidden="true" /><span><strong>{saldos.loading ? "—" : nAbaixoMin} abaixo do mínimo</strong><small>{soAbaixoMin ? "Filtro ativo · ver todos" : "Conferir reposição"}</small></span></button>
        {nNegativos > 0 && <button type="button" aria-pressed={soNegativos} onClick={() => { setSoNegativos(v => !v); setSoAbaixoMin(false); }} className="estoque-alerta estoque-alerta-negativo"><TriangleAlert size={18} aria-hidden="true" /><span><strong>{nNegativos} {nNegativos === 1 ? "produto com saldo negativo" : "produtos com saldo negativo"}</strong><small>{soNegativos ? "Filtro ativo · ver todos" : "Conferir movimentos"}</small></span></button>}
      </div>
    </Panel>
    <details className="estoque-entradas mt-3 rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer items-center gap-2 p-4 text-sm font-medium"><PackagePlus size={17} aria-hidden="true" />Últimas entradas<span className="ml-auto text-xs font-normal text-ink-3">Ver recebimentos recentes</span></summary>
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
    </details>

    <section className="mt-6" aria-label="Saldos de estoque">
      <Panel className="overflow-hidden">
      <div className="estoque-secao-cabecalho"><span className="fin-section-icon"><Boxes aria-hidden="true" /></span><h2 className="font-serif text-2xl">Saldos de estoque<AjudaCampo rotulo="Como o valor é calculado" texto="O valor corresponde ao saldo monetário remanescente. Grupos rastreados usam média do saldo; produtos sem rastreio usam aquisições mais antigas. Valores desconhecidos ficam separados." /></h2></div>
      <div className="estoque-filtros grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto]">
        <label className="relative min-w-0"><Search size={16} className="absolute left-3 top-3 text-ink-3" aria-hidden="true" /><input type="search" aria-label="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou categoria…" className={`${CAMPO} pl-9`} /></label>
        <SelectFiltro rotulo="Filtrar por centro de custo" valor={centroFiltro} onChange={setCentroFiltro} opcoes={[{ valor: "", texto: "Todos os centros" }, { valor: SEM_VINCULO, texto: "Sem centro" }, ...centros.map((c) => ({ valor: c.id, texto: c.nome }))]} className="w-full sm:!w-full" />
        <SelectFiltro rotulo="Ordenar por" valor={ordem} onChange={(valor) => setOrdem(valor as Ordem)} opcoes={[{ valor: "nome", texto: "Ordenar por nome" }, { valor: "categoria", texto: "Ordenar por categoria" }, { valor: "valor", texto: "Ordenar por maior valor" }]} className="w-full sm:!w-full" />
        <button type="button" aria-pressed={soAbaixoMin} onClick={() => setSoAbaixoMin((v) => !v)} className={`${CAMPO} inline-flex items-center gap-2 whitespace-nowrap font-medium ${soAbaixoMin ? "border-[var(--fin-pendente)] bg-[var(--fin-warning-bg)] text-[var(--fin-pendente)]" : "text-ink-2"}`}><IconeAbaixoMinimo />Só abaixo do mínimo{nAbaixoMin > 0 ? ` (${nAbaixoMin})` : ""}</button>
      </div>
      <div className="min-w-0">
        {saldos.loading ? <div className="p-6"><Loader /></div>
          : saldos.erro ? <Empty>Não foi possível consultar os saldos: {saldos.erro} <Button secondary onClick={saldos.recarregar}>Tentar novamente</Button></Empty>
          : saldos.data.length === 0 ? <Empty>Nenhum produto com movimento de estoque. Registre uma compra para estoque ou um inventário inicial.</Empty>
          : saldosVisiveis.length === 0 ? <Empty>{filtrosAtivos ? "Nenhum produto bate com a busca." : "Nenhum produto para exibir."}</Empty>
          : <>
              <TabelaFinanceira rotulo="Saldos de estoque" itens={saldosDaPagina} colunas={colunasSaldos} chaveDe={(s) => s.produtoId} classeLinha={s => s.saldo < 0 ? "bg-red-50/40" : s.abaixoMinimo ? "bg-amber-50/40" : ""} />
              <Paginacao pagina={paginaSaldosAtual} totalPaginas={totalPaginasSaldos} total={saldosVisiveis.length} porPagina={ITENS_POR_PAGINA} rotulo="Paginação de saldos" substantivo={saldosVisiveis.length === 1 ? "produto" : "produtos"} idSelect="pagina-saldos" onPagina={setPaginaSaldos} />
            </>}
      </div>
      </Panel>
    </section>

    <section ref={historicoRef} tabIndex={-1} className="mt-6 scroll-mt-4" aria-label="Histórico de movimentos">
      <Panel className="overflow-hidden">
      <div className="estoque-secao-cabecalho"><span className="fin-section-icon"><History aria-hidden="true" /></span><h2 className="font-serif text-2xl">Histórico de movimentos<AjudaCampo rotulo="Origem dos movimentos" texto="Cada movimento leva à operação ou ao fato sanitário/nutricional que o gerou." /></h2></div>
      {movimentoId && <p className="mt-2 rounded-lg border border-border bg-surface p-3 text-sm">Movimento selecionado · <a href="/estoque" className="underline">Voltar ao histórico completo</a></p>}
      <div className="estoque-filtros flex flex-wrap items-center gap-3">
        <label className="relative w-full min-w-0 flex-[2_1_260px] sm:w-auto"><Search size={16} className="absolute left-3 top-3 text-ink-3" aria-hidden="true" /><input type="search" aria-label="Buscar movimento" value={buscaMov} onChange={(e) => setBuscaMov(e.target.value)} placeholder="Buscar por produto, operação ou fornecedor…" className={`${CAMPO} w-full pl-9`} /></label>
        <SelectFiltro rotulo="Filtrar por origem" valor={origemMov} onChange={(valor) => { setOrigemMov(valor); setPaginaMov(1); }} opcoes={[{ valor: "", texto: "Todas as origens" }, ...Object.entries(ROTULO_ORIGEM).map(([valor, texto]) => ({ valor, texto }))]} className="min-w-0 flex-[1_1_160px]" />
        <SelectFiltro rotulo="Filtrar histórico por centro de custo" valor={centroMov} onChange={(valor) => { setCentroMov(valor); setPaginaMov(1); }} opcoes={[{ valor: "", texto: "Todos os centros" }, { valor: SEM_VINCULO, texto: "Sem centro" }, ...centros.map((c) => ({ valor: c.id, texto: c.nome }))]} className="min-w-0 flex-[1_1_160px]" />
        <PeriodoFinanceiroControl inicio={periodoMov.inicio} fim={periodoMov.fim} allowAll label="Período do histórico" onChange={(periodo) => { setPeriodoMov(periodo); setPaginaMov(1); }} />
      </div>
      <div className="min-w-0">
        {movimentos.loading && movimentos.data.length === 0 ? <div className="p-6"><Loader /></div>
          : movimentos.erro ? <Empty>Não foi possível consultar os movimentos: {movimentos.erro} <button type="button" className="underline" onClick={movimentos.recarregar}>Tentar novamente</button></Empty>
          : movimentos.data.length === 0 ? <Empty>{movimentoId ? "Movimento não encontrado neste sítio ou indisponível para seu acesso." : filtrosMovAtivos ? "Nenhum movimento bate com os filtros." : "Nenhum movimento registrado ainda."}</Empty>
          : <>
              <TabelaFinanceira rotulo="Histórico de movimentos" itens={movimentos.data} colunas={colunasMovimentos} chaveDe={(m) => m.id} classeLinha={(m) => m.id === movimentoId ? "bg-surface-2 outline outline-2 outline-mast -outline-offset-2" : m.status === "REVERTIDO" || m.reversaoDeId != null ? "opacity-60" : ""} />
              <Paginacao pagina={paginaMovAtual} totalPaginas={totalPaginasMov} total={movimentos.total} porPagina={ITENS_POR_PAGINA} rotulo="Paginação do histórico" substantivo={movimentos.total === 1 ? "movimento" : "movimentos"} idSelect="pagina-movimentos" onPagina={setPaginaMov} />
            </>}
      </div>
      </Panel>
    </section>

    {perdendo && <TransferirEstoque perda onFechar={() => setPerdendo(false)} onSalvo={() => { setPerdendo(false); recarregarTudo(); }} />}
    {transferindo && <TransferirEstoque onFechar={() => setTransferindo(false)} onSalvo={() => { setTransferindo(false); recarregarTudo(); }} />}
    {cadastrandoProduto && <FormProduto produto={null} onFechar={() => setCadastrandoProduto(false)} onSalvo={() => { setCadastrandoProduto(false); recarregarTudo(); }} />}
  </PaginaFinanceira>;
}
