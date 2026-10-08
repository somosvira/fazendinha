import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Boxes, Package, PackagePlus, Plus, Search, SlidersHorizontal } from "lucide-react";
import { AjudaCampo, Dica } from "@/components/Dica";
import { Loader } from "../components/Loading";
import { navegarPara } from "../router";
import { rotuloUnidade, type UnidadeMedida } from "../lib/unidades";
import { fmtMoneyExact } from "@/components/charts";
import { brl, Button, type ColunaTabela, dataBR, Empty, ErrorBox, Metric, PageHeader, PaginaFinanceira, Paginacao, Panel, Pill, TabelaFinanceira } from "../financeiro/financeiro-ui";
import { TransferirEstoque } from "./TransferirEstoque";
import { FormProduto } from "../financeiro/FormProduto";
import { PeriodoFinanceiroControl } from "../financeiro/PeriodoFinanceiroControl";
import { useSaldos, listarMovimentos, listarCentrosCusto, type FiltroMovimentos, type MovimentoDTO, type OrigemMovimento, type SaldoDTO, type RefDTO } from "./api";
import { abrirAjusteEstoque, destinoDoMovimento, podeAcessarArea, podeAjustarEstoque } from "./navegacao";
import { SEM_VINCULO } from "../lib/ids";
import { ROTULO_ORIGEM } from "./rotulos";
import { listarPropriedades, type PropriedadeDTO } from "../api/propriedades";
import { getPropriedadeAtiva } from "../propriedadeScope";

const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const CAMPO = "rounded-lg border border-border bg-white px-3 py-2 text-sm";
const SEM_ACESSO = "Sem acesso a esta área";

const TIPO_MOV: Record<MovimentoDTO["tipo"], { rotulo: string; tom: "green" | "amber" | "blue" }> = {
  ENTRADA: { rotulo: "Entrada", tom: "green" }, SAIDA: { rotulo: "Saída", tom: "amber" }, AJUSTE: { rotulo: "Ajuste", tom: "blue" },
};
// Origens que colocam produto no estoque — alimentam o card "Últimas entradas".
const ORIGENS_ENTRADA: readonly OrigemMovimento[] = ["COMPRA", "INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO"];

const ITENS_POR_PAGINA = 15;
const ENTRADAS_EXIBIDAS = 6;

const hrefMaterialGenetico = (id: string) => `/pecuaria/rebanho/cadastros?aba=material-genetico&material=${encodeURIComponent(id)}`;

type Ordem = "nome" | "categoria" | "valor";

/* Triângulo vermelho com exclamação amarela — sinal de "abaixo do mínimo", usado
 * na linha do produto e no botão do filtro. */
function IconeAbaixoMinimo({ size = 16 }: { size?: number }) {
  return <svg data-testid="icone-abaixo-minimo" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="shrink-0">
    <path d="M12 3 22 20.5H2Z" className="fill-red-600 stroke-red-600" strokeWidth="2" strokeLinejoin="round" />
    <path d="M12 9.5v4.5" className="stroke-amber-300" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <circle cx="12" cy="17.2" r="1.25" className="fill-amber-300" />
  </svg>;
}

/* Link interno sem recarregar a página (mesmo padrão de LinkOperacaoFinanceira);
 * sem acesso à área de destino vira texto puro com o motivo no `title`. */
function LinkInterno({ href, area, children }: { href: string; area: Parameters<typeof podeAcessarArea>[0] | "estoque"; children: React.ReactNode }) {
  const permitido = area === "estoque" ? podeAcessarArea("financeiro") || podeAcessarArea("pecuaria") : podeAcessarArea(area);
  if (!permitido) return <span title={SEM_ACESSO} className="text-ink-2">{children}</span>;
  const navegar = (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.stopPropagation();
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    navegarPara(href);
  };
  return <a href={href} onClick={navegar} className="font-semibold text-green-800 underline underline-offset-4 hover:text-green-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{children}</a>;
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
  const [sitioFiltro, setSitioFiltro] = useState(() => Number(urlEstoque.get("propriedadeId")) || undefined);
  const [sitios, setSitios] = useState<PropriedadeDTO[]>([]);
  const consolidado = getPropriedadeAtiva() == null;
  const sitioEfetivo = consolidado ? sitioFiltro : getPropriedadeAtiva() ?? undefined;
  const sitioMovimento = sitioEfetivo;
  // O menu `/estoque` começa sem filtro; atalhos podem informar um centro inicial.
  const [centroFiltro, setCentroFiltro] = useState(centroCustoIdInicial != null ? String(centroCustoIdInicial) : "");
  const saldos = useSaldos({ ...(centroFiltro ? { centroCustoId: centroFiltro } : {}), ...(sitioEfetivo ? { propriedadeId: sitioEfetivo } : {}) });
  useEffect(() => {
    if (consolidado || sitioFiltro == null || sitioFiltro === sitioEfetivo) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("propriedadeId");
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`);
    setSitioFiltro(undefined);
  }, [consolidado, sitioFiltro, sitioEfetivo]);
  useEffect(() => {
    let vivo = true;
    listarPropriedades().then((dados) => { if (vivo) setSitios(dados); }).catch(() => { if (vivo) setSitios([]); });
    const restaurar = () => setSitioFiltro(Number(new URLSearchParams(window.location.search).get("propriedadeId")) || undefined);
    window.addEventListener("popstate", restaurar);
    return () => { vivo = false; window.removeEventListener("popstate", restaurar); };
  }, []);
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
    { chave: "produto", titulo: "Produto", larguraMinima: 220, principal: true, celula: (s) => <span className="flex flex-wrap items-center gap-2"><strong className="break-words font-semibold"><a href={`/estoque/produtos/${s.produtoId}`} className="underline">{s.nome}</a></strong>{s.materialGeneticoId && <LinkInterno href={hrefMaterialGenetico(s.materialGeneticoId)} area="pecuaria">Identidade genética</LinkInterno>}{s.abaixoMinimo && <Dica rotulo="Abaixo do mínimo" conteudo={`Abaixo do mínimo${s.minimoEstoque != null ? ` (${qtd(s.minimoEstoque)} ${rotuloUnidade(s.unidade)})` : ""}`} className="hover:opacity-80"><IconeAbaixoMinimo /></Dica>}</span> },
    { chave: "categoria", titulo: "Categoria", alinhamento: "centro", larguraMinima: 140, celula: (s) => s.categoria?.nome ?? "Sem categoria" },
    { chave: "centros", titulo: "Centros de custo", alinhamento: "centro", larguraMinima: 180, celula: (s) => <span className="break-words text-ink-3">{s.centrosCusto.map((c) => c.nome).join(" · ") || "Sem centro"}</span> },
    { chave: "saldo", titulo: "Saldo", alinhamento: "centro", larguraMinima: 110, celula: (s) => <span className="whitespace-nowrap">{qtd(s.saldo)} {rotuloUnidade(s.unidade)}</span> },
    { chave: "custo", titulo: "Custo médio", alinhamento: "centro", larguraMinima: 120, celula: (s) => <span className="whitespace-nowrap">{s.custoMedio != null ? fmtMoneyExact(s.custoMedio) : "—"}</span> },
    { chave: "valor", titulo: "Valor", alinhamento: "centro", larguraMinima: 120, celula: (s) => <strong className="whitespace-nowrap font-semibold">{s.custoMedio != null ? brl(s.valor ?? 0) : "—"}</strong> },
    { chave: "minimo", titulo: "Mínimo", alinhamento: "centro", larguraMinima: 110, celula: (s) => <span className="whitespace-nowrap">{s.minimoEstoque != null ? `${qtd(s.minimoEstoque)} ${rotuloUnidade(s.unidade)}` : "—"}</span> },
    ...(podeAjustar ? [{ chave: "acoes", titulo: "Ações", alinhamento: "centro" as const, larguraMinima: 90, acoes: true, celula: (s: SaldoDTO) => (
      <div className="flex items-center justify-center gap-1">
        {podeAjustar && <button type="button" onClick={() => abrirAjusteEstoque(s.produtoId)} aria-label={`Ajustar quantidade de ${s.nome}`} title="Ajustar quantidade" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"><SlidersHorizontal size={16} /></button>}
      </div>
    ) }] : []),
  ];

  const colunasMovimentos: ColunaTabela<MovimentoDTO>[] = [
    { chave: "data", titulo: "Data", alinhamento: "centro", larguraMinima: 100, celula: (m) => <span className="whitespace-nowrap">{dataBR(m.data)}</span> },
    { chave: "produto", titulo: "Produto", larguraMinima: 200, principal: true, celula: (m) => <strong className="break-words font-semibold"><a href={`/estoque/produtos/${m.produtoId}`} className="underline">{m.produto}</a></strong> },
    { chave: "tipo", titulo: "Tipo", alinhamento: "centro", larguraMinima: 190, celula: (m) => (
      <span className="flex flex-wrap items-center justify-center gap-1.5">
        <span title={TIPO_MOV[m.tipo].rotulo}><Pill tone={TIPO_MOV[m.tipo].tom}>{ROTULO_ORIGEM[m.origem] ?? m.origem}</Pill></span>
        {m.reversaoDeId != null && <Pill tone="red">Estorno</Pill>}
        {m.status === "REVERTIDO" && <Pill tone="red">Estornado</Pill>}
        {m.estorno && <LinkInterno href={`/estoque?movimentoId=${encodeURIComponent(m.estorno.id)}${m.propriedadeId != null ? `&propriedadeId=${m.propriedadeId}` : ""}`} area="estoque">Ver estorno</LinkInterno>}
        {m.reversaoDeId && <LinkInterno href={`/estoque?movimentoId=${encodeURIComponent(m.reversaoDeId)}${m.propriedadeId != null ? `&propriedadeId=${m.propriedadeId}` : ""}`} area="estoque">Ver movimento original</LinkInterno>}
      </span>
    ) },
    { chave: "qtd", titulo: "Qtde", alinhamento: "centro", larguraMinima: 110, celula: (m) => { const un = unidadePorProduto.get(m.produtoId); return <span className="whitespace-nowrap">{qtd(m.quantidade)}{un ? ` ${rotuloUnidade(un)}` : ""}</span>; } },
    { chave: "valor", titulo: "Valor", alinhamento: "centro", larguraMinima: 120, celula: (m) => <span className="whitespace-nowrap">{m.valorTotal == null ? "—" : brl(m.valorTotal)}</span> },
    { chave: "origem", titulo: "Origem / destino", alinhamento: "centro", larguraMinima: 220, celula: (m) => {
      const destino = destinoDoMovimento(m);
      if (!destino) return <span className="break-words text-ink-3">{m.fornecedor ?? "—"}</span>;
      return <span className="break-words"><LinkInterno href={destino.href} area={destino.area}>{destino.rotulo}</LinkInterno>{m.fornecedor && <span className="text-ink-3"> · {m.fornecedor}</span>}</span>;
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
    <PageHeader eyebrow="" titulo={titulo ?? "Estoque"} descricao="Saldos, lotes e movimentações por sítio." acao={acao} />
    {consolidado && <label className="mt-4 flex items-center gap-3 text-sm">Sítio no estoque<select aria-label="Sítio no estoque" className={CAMPO} value={sitioFiltro ?? ""} onChange={(e) => {
      const sitio = Number(e.target.value) || undefined;
      setSitioFiltro(sitio); setPaginaMov(1); setPaginaSaldos(1);
      const params = new URLSearchParams(window.location.search);
      if (sitio) params.set("propriedadeId", String(sitio)); else params.delete("propriedadeId");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }}><option value="">Todos os sítios</option>{sitios.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>}
    {avisoFiltro && <p className="mt-4 text-sm text-amber-800">{avisoFiltro}</p>}
    <ErrorBox erro={erroCentros ? `Erro ao carregar centros de custo: ${erroCentros}` : null} />

    {/* Só dados de estoque: valor, alertas e as últimas entradas. */}
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Metric label="Valor em estoque" valor={saldos.data.length > 0 && saldos.data.every((s) => s.valor == null) ? "—" : brl(valorTotal)} icon={Boxes} />
          {nNegativos > 0 && <button type="button" aria-pressed={soNegativos} onClick={() => setSoNegativos((v) => !v)} className="self-start text-left text-xs text-red-800 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{nNegativos} {nNegativos === 1 ? "produto com saldo negativo" : "produtos com saldo negativo"}{soNegativos ? " — filtro ativo, clique para ver todos" : ""}</button>}
        </div>
        <Metric label="Produtos em estoque" valor={String(nEmEstoque)} icon={Package} />
      </div>
      <Panel className="p-5 lg:col-span-2">
        <div className="flex items-start justify-between gap-4">
          <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3">Últimas entradas</div>
          <div className="shrink-0 rounded-lg bg-[#eef1e9] p-2.5 text-mast"><PackagePlus size={18} /></div>
        </div>
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
      </Panel>
    </div>

    <section className="mt-10" aria-label="Saldos de estoque">
      <h2 className="font-serif text-2xl">Saldos de estoque<AjudaCampo rotulo="Como o valor é calculado" texto="O custo médio é a média ponderada das entradas neste sítio; valor = saldo × custo médio." /></h2>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto]">
        <input type="search" aria-label="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou categoria…" className={CAMPO} />
        <select aria-label="Filtrar por centro de custo" value={centroFiltro} onChange={(e) => setCentroFiltro(e.target.value)} className={CAMPO}>
          <option value="">Todos os centros</option>
          <option value={SEM_VINCULO}>Sem centro</option>
          {centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select aria-label="Ordenar por" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className={CAMPO}>
          <option value="nome">Ordenar por nome</option>
          <option value="categoria">Ordenar por categoria</option>
          <option value="valor">Ordenar por maior valor</option>
        </select>
        <button type="button" aria-pressed={soAbaixoMin} onClick={() => setSoAbaixoMin((v) => !v)} className={`${CAMPO} inline-flex items-center gap-2 whitespace-nowrap font-medium ${soAbaixoMin ? "border-red-700 text-red-800" : "text-ink-2"}`}><IconeAbaixoMinimo />Só abaixo do mínimo{nAbaixoMin > 0 ? ` (${nAbaixoMin})` : ""}</button>
      </div>
      <Panel className="mt-3 overflow-hidden">
        {saldos.loading ? <div className="p-6"><Loader /></div>
          : saldos.erro ? <Empty>Erro: {saldos.erro}</Empty>
          : saldos.data.length === 0 ? <Empty>Nenhum produto com movimento de estoque. Registre uma compra para estoque ou um inventário inicial.</Empty>
          : saldosVisiveis.length === 0 ? <Empty>{filtrosAtivos ? "Nenhum produto bate com a busca." : "Nenhum produto para exibir."}</Empty>
          : <>
              <TabelaFinanceira rotulo="Saldos de estoque" itens={saldosDaPagina} colunas={colunasSaldos} chaveDe={(s) => s.produtoId} barraRolagemSuperior />
              <Paginacao pagina={paginaSaldosAtual} totalPaginas={totalPaginasSaldos} total={saldosVisiveis.length} porPagina={ITENS_POR_PAGINA} rotulo="Paginação de saldos" substantivo={saldosVisiveis.length === 1 ? "produto" : "produtos"} idSelect="pagina-saldos" onPagina={setPaginaSaldos} />
            </>}
      </Panel>
    </section>

    <section ref={historicoRef} tabIndex={-1} className="mt-10 scroll-mt-4" aria-label="Histórico de movimentos">
      <h2 className="font-serif text-2xl">Histórico de movimentos<AjudaCampo rotulo="Origem dos movimentos" texto="Cada movimento leva à operação ou ao fato sanitário/nutricional que o gerou." /></h2>
      {movimentoId && <p className="mt-2 rounded-lg border border-border bg-surface p-3 text-sm">Movimento selecionado · <a href="/estoque" className="underline">Voltar ao histórico completo</a></p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="relative w-full min-w-0 flex-[2_1_260px] sm:w-auto"><Search size={16} className="absolute left-3 top-3 text-ink-3" aria-hidden="true" /><input type="search" aria-label="Buscar movimento" value={buscaMov} onChange={(e) => setBuscaMov(e.target.value)} placeholder="Buscar por produto, operação ou fornecedor…" className={`${CAMPO} w-full pl-9`} /></label>
        <select aria-label="Filtrar por origem" value={origemMov} onChange={(e) => { setOrigemMov(e.target.value); setPaginaMov(1); }} className={`${CAMPO} min-w-0 flex-[1_1_160px]`}>
          <option value="">Todas as origens</option>
          {Object.entries(ROTULO_ORIGEM).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}
        </select>
        <select aria-label="Filtrar histórico por centro de custo" value={centroMov} onChange={(e) => { setCentroMov(e.target.value); setPaginaMov(1); }} className={`${CAMPO} min-w-0 flex-[1_1_160px]`}>
          <option value="">Todos os centros</option>
          <option value={SEM_VINCULO}>Sem centro</option>
          {centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <PeriodoFinanceiroControl inicio={periodoMov.inicio} fim={periodoMov.fim} allowAll label="Período do histórico" onChange={(periodo) => { setPeriodoMov(periodo); setPaginaMov(1); }} />
      </div>
      <Panel className="mt-3 overflow-hidden">
        {movimentos.loading && movimentos.data.length === 0 ? <div className="p-6"><Loader /></div>
          : movimentos.erro ? <Empty>Não foi possível consultar os movimentos: {movimentos.erro} <button type="button" className="underline" onClick={movimentos.recarregar}>Tentar novamente</button></Empty>
          : movimentos.data.length === 0 ? <Empty>{movimentoId ? "Movimento não encontrado neste sítio ou indisponível para seu acesso." : filtrosMovAtivos ? "Nenhum movimento bate com os filtros." : "Nenhum movimento registrado ainda."}</Empty>
          : <>
              <TabelaFinanceira rotulo="Histórico de movimentos" itens={movimentos.data} colunas={colunasMovimentos} chaveDe={(m) => m.id} classeLinha={(m) => m.id === movimentoId ? "bg-surface-2 outline outline-2 outline-mast -outline-offset-2" : m.status === "REVERTIDO" || m.reversaoDeId != null ? "opacity-60" : ""} barraRolagemSuperior />
              <Paginacao pagina={paginaMovAtual} totalPaginas={totalPaginasMov} total={movimentos.total} porPagina={ITENS_POR_PAGINA} rotulo="Paginação do histórico" substantivo={movimentos.total === 1 ? "movimento" : "movimentos"} idSelect="pagina-movimentos" onPagina={setPaginaMov} />
            </>}
      </Panel>
    </section>

    {perdendo && <TransferirEstoque perda onFechar={() => setPerdendo(false)} onSalvo={() => { setPerdendo(false); recarregarTudo(); }} />}
    {transferindo && <TransferirEstoque onFechar={() => setTransferindo(false)} onSalvo={() => { setTransferindo(false); recarregarTudo(); }} />}
    {cadastrandoProduto && <FormProduto produto={null} onFechar={() => setCadastrandoProduto(false)} onSalvo={() => { setCadastrandoProduto(false); recarregarTudo(); }} />}
  </PaginaFinanceira>;
}
