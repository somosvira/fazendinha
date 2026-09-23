import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { AlertTriangle, Boxes, CircleHelp, PackagePlus, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import { Loader } from "../components/Loading";
import { navegarPara } from "../router";
import { rotuloUnidade } from "../lib/unidades";
import { fmtMoneyExact } from "@/components/charts";
import { brl, Button, type ColunaTabela, dataBR, Empty, ErrorBox, Metric, PageHeader, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../financeiro/financeiro-ui";
import { FormProduto } from "../financeiro/FormProduto";
import { useSaldos, listarMovimentos, listarProdutos, listarCentrosCusto, type MovimentoDTO, type OrigemMovimento, type SaldoDTO, type ProdutoDTO, type RefDTO } from "./api";
import { abrirAjusteEstoque, destinoDoMovimento, podeAcessarArea, podeAjustarEstoque } from "./navegacao";

const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const CAMPO = "rounded-lg border border-border bg-white px-3 py-2 text-sm";
const SEM_ACESSO = "Sem acesso a esta área";

const TIPO_MOV: Record<MovimentoDTO["tipo"], { rotulo: string; tom: "green" | "amber" | "blue" }> = {
  ENTRADA: { rotulo: "Entrada", tom: "green" }, SAIDA: { rotulo: "Saída", tom: "amber" }, AJUSTE: { rotulo: "Ajuste", tom: "blue" },
};
const ROTULO_ORIGEM: Record<OrigemMovimento, string> = {
  COMPRA: "Compra", CONSUMO_DIRETO: "Consumo direto", TRANSFERENCIA: "Transferência", PRODUCAO: "Produção própria", DEVOLUCAO: "Devolução",
  BONIFICACAO: "Bonificação", INVENTARIO_INICIAL: "Inventário inicial", NUTRICAO: "Dieta", SANIDADE: "Sanidade", PERDA: "Perda",
  AJUSTE_INVENTARIO: "Ajuste de estoque", APLICACAO: "Aplicação agrícola",
};
// Origens que colocam produto no estoque — alimentam o card "Últimas entradas".
const ORIGENS_ENTRADA: readonly OrigemMovimento[] = ["COMPRA", "INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO"];

type Ordem = "nome" | "categoria" | "valor";

/* Link interno sem recarregar a página (mesmo padrão de LinkOperacaoFinanceira);
 * sem acesso à área de destino vira texto puro com o motivo no `title`. */
function LinkInterno({ href, area, children }: { href: string; area: Parameters<typeof podeAcessarArea>[0]; children: React.ReactNode }) {
  if (!podeAcessarArea(area)) return <span title={SEM_ACESSO} className="text-ink-2">{children}</span>;
  const navegar = (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.stopPropagation();
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    navegarPara(href);
  };
  return <a href={href} onClick={navegar} className="font-semibold text-green-800 underline underline-offset-4 hover:text-green-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{children}</a>;
}

function useMovimentos(f?: { tipo?: string }) {
  const [data, setData] = useState<MovimentoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const tipo = f?.tipo;
  const recarregar = useCallback(() => { setLoading(true); setErro(null); listarMovimentos(tipo ? { tipo } : undefined).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, [tipo]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function EstoqueContent({ centroCustoIdInicial, titulo, avisoFiltro }: { centroCustoIdInicial?: number | null; titulo?: string; avisoFiltro?: string } = {}) {
  // `centroCustoIdInicial` já chega resolvido: quem chama com um centro de
  // atividade (rebanho/plantio) só monta este componente depois de resolver o
  // centro (ver RebanhoContent/PlantioContent, que usam `key` para remontar);
  // o menu `/estoque` chama sem prop nenhuma (undefined = sem filtro).
  const [centroFiltro, setCentroFiltro] = useState(centroCustoIdInicial != null ? String(centroCustoIdInicial) : "");
  const saldos = useSaldos(centroFiltro ? { centroCustoId: centroFiltro } : undefined);
  const movimentos = useMovimentos();
  const entradas = useMovimentos({ tipo: "ENTRADA" });
  const [busca, setBusca] = useState("");
  const [soAbaixoMin, setSoAbaixoMin] = useState(false);
  const [soNegativos, setSoNegativos] = useState(false);
  const [ordem, setOrdem] = useState<Ordem>("nome");
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [centros, setCentros] = useState<RefDTO[]>([]);
  const [erroProdutos, setErroProdutos] = useState<string | null>(null);
  const [erroCentros, setErroCentros] = useState<string | null>(null);
  const [cadastrandoProduto, setCadastrandoProduto] = useState(false);
  const [editando, setEditando] = useState<ProdutoDTO | null>(null);
  // O ajuste é uma operação financeira: exige a área financeiro e a permissão `lancar`.
  const podeAjustar = podeAjustarEstoque();

  const carregarProdutos = useCallback(() => {
    listarProdutos({ ativo: true }).then((ps) => { setProdutos(ps); setErroProdutos(null); }).catch((e) => setErroProdutos(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => { carregarProdutos(); }, [carregarProdutos]);
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
      if (ordem === "valor") return b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR");
      if (ordem === "categoria") return (a.categoria?.nome ?? "").localeCompare(b.categoria?.nome ?? "", "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR");
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [saldos.data, busca, soAbaixoMin, soNegativos, ordem]);

  const valorTotal = useMemo(() => saldos.data.reduce((soma, s) => soma + Math.max(0, s.valor), 0), [saldos.data]);
  const nNegativos = useMemo(() => saldos.data.filter((s) => s.saldo < 0).length, [saldos.data]);
  const nAbaixoMin = useMemo(() => saldos.data.filter((s) => s.abaixoMinimo).length, [saldos.data]);
  // Sem preço no cadastro: o custo só existe depois de uma entrada valorizada no sítio.
  const nSemCusto = useMemo(() => saldos.data.filter((s) => s.custoMedio == null).length, [saldos.data]);
  const unidadePorProduto = useMemo(() => new Map(saldos.data.map((s) => [s.produtoId, s.unidade] as const)), [saldos.data]);

  // Últimas entradas: o movimento de ENTRADA (compra/inventário/bonificação/produção,
  // não estornado) mais recente de cada produto listado — os 3 primeiros.
  const ultimasEntradas = useMemo(() => {
    const listados = new Set(saldos.data.map((s) => s.produtoId));
    const vistos = new Set<number>();
    const lista: MovimentoDTO[] = [];
    for (const m of entradas.data) {
      if (m.tipo !== "ENTRADA" || m.status !== "CONFIRMADO" || m.reversaoDeId != null || !ORIGENS_ENTRADA.includes(m.origem)) continue;
      if (!listados.has(m.produtoId) || vistos.has(m.produtoId)) continue;
      vistos.add(m.produtoId);
      lista.push(m);
      if (lista.length === 3) break;
    }
    return lista;
  }, [entradas.data, saldos.data]);

  function abrirEdicao(produtoId: number) {
    const p = produtos.find((x) => x.id === produtoId);
    if (p) setEditando(p);
  }
  const recarregarTudo = () => { saldos.recarregar(); movimentos.recarregar(); entradas.recarregar(); carregarProdutos(); };

  const colunasSaldos: ColunaTabela<SaldoDTO>[] = [
    { chave: "produto", titulo: "Produto", larguraMinima: 220, principal: true, celula: (s) => <span className="flex flex-wrap items-center gap-2"><strong className="break-words font-semibold">{s.nome}</strong>{s.abaixoMinimo && <Pill tone="red">Abaixo do mínimo</Pill>}</span> },
    { chave: "categoria", titulo: "Categoria", larguraMinima: 140, celula: (s) => s.categoria?.nome ?? "Sem categoria" },
    { chave: "centros", titulo: "Centros de custo", larguraMinima: 180, celula: (s) => <span className="break-words text-ink-3">{s.centrosCusto.map((c) => c.nome).join(" · ") || "Sem centro"}</span> },
    { chave: "saldo", titulo: "Saldo", alinhamento: "direita", larguraMinima: 110, celula: (s) => <span className="whitespace-nowrap">{qtd(s.saldo)} {rotuloUnidade(s.unidade)}</span> },
    { chave: "custo", titulo: "Custo médio", alinhamento: "direita", larguraMinima: 120, celula: (s) => <span className="whitespace-nowrap">{s.custoMedio != null ? fmtMoneyExact(s.custoMedio) : "—"}</span> },
    { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 120, celula: (s) => <strong className="whitespace-nowrap font-semibold">{s.custoMedio != null ? brl(s.valor) : "—"}</strong> },
    { chave: "minimo", titulo: "Mínimo", alinhamento: "direita", larguraMinima: 110, celula: (s) => <span className="whitespace-nowrap">{s.minimoEstoque != null ? `${qtd(s.minimoEstoque)} ${rotuloUnidade(s.unidade)}` : "—"}</span> },
    { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (s) => (
      <div className="flex items-center justify-end gap-1">
        {podeAjustar && <button type="button" onClick={() => abrirAjusteEstoque(s.produtoId)} aria-label={`Ajustar quantidade de ${s.nome}`} title="Ajustar quantidade" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"><SlidersHorizontal size={16} /></button>}
        <button type="button" onClick={() => abrirEdicao(s.produtoId)} disabled={!produtos.some((p) => p.id === s.produtoId)} aria-label={`Editar ${s.nome}`} title="Editar produto" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"><Pencil size={16} /></button>
      </div>
    ) },
  ];

  const colunasMovimentos: ColunaTabela<MovimentoDTO>[] = [
    { chave: "data", titulo: "Data", larguraMinima: 100, celula: (m) => <span className="whitespace-nowrap">{dataBR(m.data)}</span> },
    { chave: "produto", titulo: "Produto", larguraMinima: 200, principal: true, celula: (m) => <strong className="break-words font-semibold">{m.produto}</strong> },
    { chave: "tipo", titulo: "Tipo", larguraMinima: 190, celula: (m) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Pill tone={TIPO_MOV[m.tipo].tom}>{TIPO_MOV[m.tipo].rotulo}</Pill>
        <span className="text-xs text-ink-3">{ROTULO_ORIGEM[m.origem] ?? m.origem}</span>
        {m.reversaoDeId != null && <Pill tone="red">Estorno</Pill>}
        {m.status === "REVERTIDO" && <Pill tone="red">Estornado</Pill>}
      </span>
    ) },
    { chave: "qtd", titulo: "Qtde", alinhamento: "direita", larguraMinima: 110, celula: (m) => { const un = unidadePorProduto.get(m.produtoId); return <span className="whitespace-nowrap">{qtd(m.quantidade)}{un ? ` ${rotuloUnidade(un)}` : ""}</span>; } },
    { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 120, celula: (m) => <span className="whitespace-nowrap">{brl(m.valorTotal)}</span> },
    { chave: "origem", titulo: "Origem / destino", larguraMinima: 220, celula: (m) => {
      const destino = destinoDoMovimento(m);
      if (!destino) return <span className="break-words text-ink-3">{m.fornecedor ?? m.grupo ?? "—"}</span>;
      return <span className="break-words"><LinkInterno href={destino.href} area={destino.area}>{destino.rotulo}</LinkInterno>{m.fornecedor && <span className="text-ink-3"> · {m.fornecedor}</span>}</span>;
    } },
  ];

  const filtrosAtivos = busca.trim() !== "" || soAbaixoMin || soNegativos;
  const acao = <div className="flex flex-wrap gap-2">
    {podeAjustar && <Button secondary onClick={() => abrirAjusteEstoque()}><SlidersHorizontal size={16} /> Ajustar quantidade</Button>}
    <Button onClick={() => setCadastrandoProduto(true)}><Plus size={16} /> Cadastrar produto</Button>
  </div>;

  return <PaginaFinanceira>
    <PageHeader eyebrow="Estoque" titulo={titulo ?? "Estoque"} descricao="Saldos e custo médio dos produtos. Quem põe um produto no estoque é a operação: compra, inventário, produção ou ajuste." acao={acao} />
    {avisoFiltro && <p className="mt-4 text-sm text-amber-800">{avisoFiltro}</p>}
    <ErrorBox erro={erroProdutos ? `Erro ao carregar produtos: ${erroProdutos}` : null} />
    <ErrorBox erro={erroCentros ? `Erro ao carregar centros de custo: ${erroCentros}` : null} />

    {/* Só dados de estoque: valor, alertas e as últimas entradas. */}
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="flex flex-col gap-1.5">
        <Metric label="Valor em estoque" valor={brl(valorTotal)} detalhe={`${saldos.data.length} ${saldos.data.length === 1 ? "produto" : "produtos"} com movimento`} icon={Boxes} />
        {nNegativos > 0 && <button type="button" aria-pressed={soNegativos} onClick={() => setSoNegativos((v) => !v)} className="self-start text-left text-xs text-red-800 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{nNegativos} {nNegativos === 1 ? "produto com saldo negativo" : "produtos com saldo negativo"}{soNegativos ? " — filtro ativo, clique para ver todos" : ""}</button>}
      </div>
      {nAbaixoMin > 0
        ? <button type="button" aria-pressed={soAbaixoMin} onClick={() => setSoAbaixoMin((v) => !v)} className="block rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            <Metric label="Itens abaixo do mínimo" valor={String(nAbaixoMin)} detalhe={soAbaixoMin ? "Filtro ativo — clique para ver todos" : "Clique para filtrar a lista"} icon={AlertTriangle} tone="red" />
          </button>
        : <Metric label="Itens abaixo do mínimo" valor="0" detalhe="Nenhum produto abaixo do mínimo" icon={AlertTriangle} tone="green" />}
      <Metric label="Produtos sem custo apurado" valor={String(nSemCusto)} detalhe={nSemCusto > 0 ? "Registre uma compra ou um inventário inicial com valor." : "Todos os produtos têm custo médio"} icon={CircleHelp} />
      <Panel className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3">Últimas entradas</div>
          <div className="shrink-0 rounded-lg bg-[#eef1e9] p-2.5 text-mast"><PackagePlus size={18} /></div>
        </div>
        {entradas.loading && ultimasEntradas.length === 0 ? <p className="mt-3 text-xs text-ink-3">Carregando…</p>
          : ultimasEntradas.length === 0 ? <p className="mt-3 text-xs text-ink-3">Nenhuma entrada registrada ainda.</p>
          : <ul className="mt-3 space-y-2">{ultimasEntradas.map((m) => {
              const destino = destinoDoMovimento(m);
              const un = unidadePorProduto.get(m.produtoId);
              return <li key={m.id} className="text-sm leading-5">
                <div className="min-w-0 truncate font-semibold">{destino ? <LinkInterno href={destino.href} area={destino.area}>{m.produto}</LinkInterno> : m.produto}</div>
                <div className="text-xs text-ink-3">{dataBR(m.data)} · {qtd(m.quantidade)}{un ? ` ${rotuloUnidade(un)}` : ""}</div>
              </li>;
            })}</ul>}
      </Panel>
    </div>

    <section className="mt-8" aria-label="Saldos de estoque">
      <h2 className="font-serif text-xl">Saldos de estoque</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto]">
        <input type="search" aria-label="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou categoria…" className={CAMPO} />
        <select aria-label="Filtrar por centro de custo" value={centroFiltro} onChange={(e) => setCentroFiltro(e.target.value)} className={CAMPO}>
          <option value="">Todos os centros</option>
          <option value="0">Sem centro</option>
          {centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select aria-label="Ordenar por" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className={CAMPO}>
          <option value="nome">Ordenar por nome</option>
          <option value="categoria">Ordenar por categoria</option>
          <option value="valor">Ordenar por maior valor</option>
        </select>
        <button type="button" aria-pressed={soAbaixoMin} onClick={() => setSoAbaixoMin((v) => !v)} className={`${CAMPO} whitespace-nowrap font-medium ${soAbaixoMin ? "border-red-700 text-red-800" : "text-ink-2"}`}>Só abaixo do mínimo{nAbaixoMin > 0 ? ` (${nAbaixoMin})` : ""}</button>
      </div>
      <p className="mt-2 text-xs text-ink-3">{saldosVisiveis.length} de {saldos.data.length} {saldos.data.length === 1 ? "produto" : "produtos"}. O custo médio é a média ponderada das entradas neste sítio; valor = saldo × custo médio.</p>
      <Panel className="mt-3 overflow-hidden">
        {saldos.loading ? <div className="p-6"><Loader /></div>
          : saldos.erro ? <Empty>Erro: {saldos.erro}</Empty>
          : saldos.data.length === 0 ? <Empty>Nenhum produto com movimento de estoque. Registre uma compra para estoque ou um inventário inicial.</Empty>
          : saldosVisiveis.length === 0 ? <Empty>{filtrosAtivos ? "Nenhum produto bate com a busca." : "Nenhum produto para exibir."}</Empty>
          : <TabelaFinanceira rotulo="Saldos de estoque" itens={saldosVisiveis} colunas={colunasSaldos} chaveDe={(s) => s.produtoId} />}
      </Panel>
    </section>

    <section className="mt-8" aria-label="Movimentos recentes">
      <h2 className="font-serif text-xl">Movimentos recentes</h2>
      <p className="mt-1 text-xs text-ink-3">Cada movimento leva à operação que o gerou; saídas automáticas levam ao lote, animal ou talhão de origem.</p>
      <Panel className="mt-3 overflow-hidden">
        {movimentos.loading ? <div className="p-6"><Loader /></div>
          : movimentos.erro ? <Empty>Erro: {movimentos.erro}</Empty>
          : movimentos.data.length === 0 ? <Empty>Nenhum movimento registrado ainda.</Empty>
          : <TabelaFinanceira rotulo="Movimentos de estoque" itens={movimentos.data} colunas={colunasMovimentos} chaveDe={(m) => m.id} classeLinha={(m) => m.status === "REVERTIDO" || m.reversaoDeId != null ? "opacity-60" : ""} />}
      </Panel>
    </section>

    {cadastrandoProduto && <FormProduto produto={null} onFechar={() => setCadastrandoProduto(false)} onSalvo={() => { setCadastrandoProduto(false); recarregarTudo(); }} />}
    {editando && <FormProduto produto={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); recarregarTudo(); }} />}
  </PaginaFinanceira>;
}
