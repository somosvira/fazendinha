import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader } from "../components/Loading";
import { useSaldos, useCustoVacaDia, listarMovimentos, excluirMovimento, listarProdutos, listarCentrosCusto, type MovimentoDTO, type SaldoDTO, type ProdutoDTO, type RefDTO } from "./api";
import { MovimentoForm } from "./components/MovimentoForm";
import { ProdutoForm } from "../rebanho/components/ProdutoForm";
import { PrincipiosAtivosSection } from "./components/PrincipiosAtivosSection";
import { ComposicaoRacaoSection } from "./components/ComposicaoRacaoSection";
import { LotesProdutoSection } from "./components/LotesProdutoSection";
import { RebHeader } from "../rebanho/components/RebHeader";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { REB_FIELD_BOXED } from "@/components/rb/RebField";
import { RebSelect } from "@/components/rb/RebSelect";
import { RebMain, RebPill, RebAnm, RebEmpty, RebKv, REB_CHIP_Q } from "@/components/rb/RebPrimitives";
import { fmtMoneyExact } from "@/components/charts";

const money = fmtMoneyExact;
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const TIPO_MOV: Record<MovimentoDTO["tipo"], string> = { ENTRADA: "Entrada", SAIDA: "Saída", AJUSTE: "Ajuste" };
const SEM_CENTRO = "__sem_centro__";
function CentrosChips({ centros }: { centros: { id: number; nome: string }[] }) {
  if (!centros.length) return <RebPill style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ink-mute)", flex: "0 0 auto" }} />
    Sem centro
  </RebPill>;
  return <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
    {centros.map((c) => (
      <RebPill key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--outros)", flex: "0 0 auto" }} />
        {c.nome}
      </RebPill>
    ))}
  </span>;
}

function useMovimentos() {
  const [data, setData] = useState<MovimentoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); listarMovimentos().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

type SortKey = "nome" | "tipo" | "valor";
type SortDir = "asc" | "desc";

export function EstoqueContent({ centroCustoIdInicial, titulo, avisoFiltro, aguardarFiltro }: { centroCustoIdInicial?: number | null; titulo?: string; avisoFiltro?: string; aguardarFiltro?: boolean } = {}) {
  const custo = useCustoVacaDia();
  const [centroFiltro, setCentroFiltro] = useState(centroCustoIdInicial != null ? String(centroCustoIdInicial) : "");
  const [agrupar, setAgrupar] = useState(false);
  // Quando `aguardarFiltro` está ligado (rebanho/plantio resolvendo o centro de
  // atividade), evita buscar saldos sem filtro e depois de novo com filtro —
  // só busca quando `centroCustoIdInicial` deixa de ser `undefined`.
  const filtroPronto = !aguardarFiltro || centroCustoIdInicial !== undefined;
  const saldos = useSaldos(centroFiltro ? { centroCustoId: centroFiltro } : undefined, filtroPronto);
  const movimentos = useMovimentos();
  const [form, setForm] = useState(false);
  const [busca, setBusca] = useState("");
  const [soAbaixoMin, setSoAbaixoMin] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "nome", dir: "asc" });
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [centros, setCentros] = useState<RefDTO[]>([]);
  const [erroProdutos, setErroProdutos] = useState<string | null>(null);
  const [erroCentros, setErroCentros] = useState<string | null>(null);
  const [cadastrandoProduto, setCadastrandoProduto] = useState(false);
  const [editando, setEditando] = useState<ProdutoDTO | null>(null);
  const [excluindo, setExcluindo] = useState<MovimentoDTO | null>(null);

  const carregarProdutos = useCallback(() => {
    listarProdutos({ ativo: true }).then((ps) => { setProdutos(ps); setErroProdutos(null); }).catch((e) => setErroProdutos(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => { carregarProdutos(); }, [carregarProdutos]);
  useEffect(() => { listarCentrosCusto().then((cs) => { setCentros(cs); setErroCentros(null); }).catch((e) => setErroCentros(e instanceof Error ? e.message : String(e))); }, []);
  useEffect(() => { if (centroCustoIdInicial != null) setCentroFiltro(String(centroCustoIdInicial)); }, [centroCustoIdInicial]);

  function trocarSort(key: SortKey) {
    setSort((s) => {
      if (s.key !== key) return { key, dir: key === "valor" ? "desc" : "asc" };
      return { key, dir: s.dir === "asc" ? "desc" : "asc" };
    });
  }

  const saldosVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = saldos.data.filter((s) => {
      if (soAbaixoMin && !s.abaixoMinimo) return false;
      if (!termo) return true;
      return s.nome.toLowerCase().includes(termo) || s.tipo.toLowerCase().includes(termo);
    });
    const mult = sort.dir === "asc" ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      switch (sort.key) {
        case "tipo": return a.tipo.localeCompare(b.tipo, "pt-BR") * mult || a.nome.localeCompare(b.nome, "pt-BR");
        case "valor": return (a.valor - b.valor) * mult;
        case "nome":
        default: return a.nome.localeCompare(b.nome, "pt-BR") * mult;
      }
    });
  }, [saldos.data, busca, soAbaixoMin, sort]);

  const nAbaixoMin = useMemo(() => saldos.data.filter((s) => s.abaixoMinimo).length, [saldos.data]);

  // Agrupamento por centro de custo para a visão "Agrupar". Produto com vários
  // centros aparece em cada grupo; sem centro cai no grupo "Sem centro".
  const gruposPorCentro = useMemo(() => {
    const map = new Map<string, { nome: string; linhas: SaldoDTO[]; valorTotal: number }>();
    for (const s of saldosVisiveis) {
      const alvos = s.centrosCusto.length ? s.centrosCusto.map((c) => ({ chave: String(c.id), nome: c.nome })) : [{ chave: SEM_CENTRO, nome: "Sem centro" }];
      for (const alvo of alvos) {
        const g = map.get(alvo.chave) ?? { nome: alvo.nome, linhas: [], valorTotal: 0 };
        g.linhas.push(s);
        g.valorTotal += s.valor;
        map.set(alvo.chave, g);
      }
    }
    return [...map.entries()]
      .map(([chave, g]) => ({ chave, ...g }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [saldosVisiveis]);

  function abrirEdicao(produtoId: number) {
    const p = produtos.find((x) => x.id === produtoId);
    if (p) setEditando(p);
  }

  const recarregarTudo = () => { custo.recarregar(); saldos.recarregar(); movimentos.recarregar(); carregarProdutos(); };

  const renderRow = (s: SaldoDTO) => (
    <tr key={s.produtoId}>
      <td><RebAnm>{s.nome} {s.abaixoMinimo && <RebPill tone="bad">⚠ abaixo do mínimo</RebPill>}</RebAnm></td>
      <td>{s.tipo}</td>
      <td><CentrosChips centros={s.centrosCusto} /></td>
      <td>{qtd(s.saldo)} {s.unidade}</td>
      <td>{money(s.valor)}</td>
      <td>{s.minimoEstoque != null ? `${qtd(s.minimoEstoque)} ${s.unidade}` : "—"}</td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <RebButton onClick={() => abrirEdicao(s.produtoId)} disabled={!produtos.find((p) => p.id === s.produtoId)}>Editar</RebButton>
      </td>
    </tr>
  );

  // exclusão real acontece dentro do modal de confirmação

  if (custo.loading && saldos.loading && movimentos.loading) {
    return <RebMain><RebHeader eyebrow="Insumos e consumo" title={titulo ?? "Estoque"} /><Loader /></RebMain>;
  }

  const c = custo.data;
  const custoTxt = c && c.custoVacaDia != null ? money(c.custoVacaDia) : "—";

  return (
    <RebMain>
      <RebHeader eyebrow="Insumos e consumo" title={titulo ?? "Estoque"} />

      {avisoFiltro && <p className="mt-[7px] text-sm text-amber-800">{avisoFiltro}</p>}
      {erroProdutos && <p className="mt-[7px] text-sm text-prejuizo">Erro ao carregar produtos: {erroProdutos}</p>}
      {erroCentros && <p className="mt-[7px] text-sm text-prejuizo">Erro ao carregar centros de custo: {erroCentros}</p>}

      {/* KPI headline — custo vaca/dia (o norte da Tássila) */}
      <RebKpiStrip cols={3}>
        <div className="relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5" style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className="text-sm font-semibold uppercase tracking-[.06em] text-ink-2">Custo vaca/dia</div>
          <div className="mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)]" style={{ fontSize: 34, color: "var(--cafe)" }}>{custoTxt}</div>
          <div className="mt-2 text-[15px] font-medium text-ink-2">{c ? `consumo dos últimos ${c.periodoDias} dias` : "—"}</div>
        </div>
        <RebKpi lab="Vacas em lactação" val={c?.vacasEmLactacao ?? "—"} d="base do rateio" />
        <RebKpi lab="Consumo no período" val={c ? money(c.totalConsumo) : "—"} valClassName="text-[20px]" d={c ? `${c.periodoDias} dias` : "—"} />
      </RebKpiStrip>
      {custo.erro && <p className="mt-[7px] text-sm text-prejuizo">Erro no custo: {custo.erro}</p>}

      {/* Saldos */}
      <div className="mt-1 mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-medium m-0">Saldos de estoque</h2>
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm text-ink-3">{saldosVisiveis.length} de {saldos.data.length} {saldos.data.length === 1 ? "produto" : "produtos"}</span>
          <div className="flex flex-col items-stretch gap-1.5">
            <RebButton variant="pri" onClick={() => setCadastrandoProduto(true)}>+ Cadastrar produto</RebButton>
            <RebButton variant="pri" onClick={() => setForm(true)}>Ajustar quantidade</RebButton>
          </div>
        </div>
      </div>
      {(saldos.data.length > 0 || centroFiltro) && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "0 0 12px", flexWrap: "wrap" }}>
          <input
            type="search"
            className={REB_FIELD_BOXED}
            placeholder="Buscar por nome ou tipo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ flex: "1 1 240px", maxWidth: 360 }}
          />
          <RebSelect
            className={`${REB_FIELD_BOXED} basis-[180px] grow-0 shrink`}
            value={centroFiltro}
            onChange={(v) => setCentroFiltro(v)}
            aria-label="Centro de custo"
          >
            <option value="">Todos os centros</option>
            <option value="0">Sem centro</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </RebSelect>
          <button
            type="button"
            className={REB_CHIP_Q}
            onClick={() => setAgrupar((v) => !v)}
            style={agrupar ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}
          >
            Agrupar por centro
          </button>
          {nAbaixoMin > 0 && (
            <button
              type="button"
              className={REB_CHIP_Q}
              onClick={() => setSoAbaixoMin((v) => !v)}
              style={soAbaixoMin ? { borderColor: "var(--neg)", color: "var(--neg)" } : undefined}
            >
              ⚠ Só abaixo do mínimo ({nAbaixoMin})
            </button>
          )}
        </div>
      )}
      {saldos.loading ? <Loader />
        : saldos.erro ? <p className="mt-[7px] text-sm text-prejuizo">Erro: {saldos.erro}</p>
        : saldos.data.length === 0 ? <RebEmpty>Nenhum produto estocável cadastrado.</RebEmpty>
        : saldosVisiveis.length === 0 ? <RebEmpty>Nenhum produto bate com a busca.</RebEmpty>
        : (
          <RebTable>
            <thead><tr>
              <th><SortBtn label="Produto" active={sort.key === "nome"} dir={sort.dir} onClick={() => trocarSort("nome")} /></th>
              <th><SortBtn label="Tipo" active={sort.key === "tipo"} dir={sort.dir} onClick={() => trocarSort("tipo")} /></th>
              <th>Centros de custo</th>
              <th>Saldo</th>
              <th><SortBtn label="Valor" active={sort.key === "valor"} dir={sort.dir} onClick={() => trocarSort("valor")} /></th>
              <th>Mínimo</th>
              <th></th>
            </tr></thead>
            {agrupar
              ? gruposPorCentro.map((g) => (
                  <tbody key={g.chave}>
                    <tr className="rb-tbl-group">
                      <td colSpan={7} style={{ background: "var(--surface-2, #f4f1ea)", fontWeight: 600 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: g.chave === SEM_CENTRO ? "var(--ink-mute)" : "var(--outros)", flex: "0 0 auto" }} />
                          {g.nome}
                          <span className="hint" style={{ fontWeight: 400 }}>· {g.linhas.length} {g.linhas.length === 1 ? "produto" : "produtos"} · {money(g.valorTotal)}</span>
                        </span>
                      </td>
                    </tr>
                    {g.linhas.map(renderRow)}
                  </tbody>
                ))
              : <tbody>{saldosVisiveis.map(renderRow)}</tbody>}
          </RebTable>
        )}

      {/* Movimentos */}
      <div className="mb-2 flex items-baseline justify-between" style={{ marginTop: 26 }}>
        <h3 className="m-0 font-serif text-lg font-medium">Movimentos recentes</h3>
      </div>
      {movimentos.loading ? <Loader />
        : movimentos.erro ? <p className="mt-[7px] text-sm text-prejuizo">Erro: {movimentos.erro}</p>
        : movimentos.data.length === 0 ? <RebEmpty>Nenhum movimento registrado ainda.</RebEmpty>
        : (
          <RebTable>
            <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtde</th><th>Valor</th><th>Origem/destino</th><th></th></tr></thead>
            <tbody>{movimentos.data.map((m) => {
              const motivoBloqueio = m.reversaoDeId != null ? "Movimento de estorno — não pode ser estornado novamente"
                : m.status === "REVERTIDO" ? "Movimento já estornado"
                  : m.origem === "NUTRICAO" ? "Baixa de consumo — estorne o período na aba Nutrição"
                    : m.origem === "SANIDADE" ? "Baixa sanitária — estorne o evento na ficha do animal"
                      : m.origem === "APLICACAO" ? "esta saída veio de uma operação agrícola — exclua a operação na timeline do talhão, não aqui"
                        : null;
              return (
              <tr key={m.id}>
                <td>{m.data}</td>
                <td><RebAnm>{m.produto}</RebAnm></td>
                <td><RebPill tone={m.tipo === "SAIDA" ? "warn" : "ok"}>{TIPO_MOV[m.tipo]}</RebPill>{m.origem === "NUTRICAO" && <RebPill style={{ marginLeft: 4, background: "var(--leite)", color: "#fff" }} title="Baixa automática do consumo de dieta">Dieta</RebPill>}{m.origem === "APLICACAO" && <RebPill style={{ marginLeft: 4, background: "var(--cafe)", color: "#fff" }} title="Aplicação agrícola">Aplicação</RebPill>}</td>
                <td>{qtd(m.quantidade)}</td>
                <td>{money(m.valorTotal)}</td>
                <td>{m.fornecedor ?? m.grupo ?? "—"}</td>
                <td style={{ textAlign: "right" }}><RebButton onClick={() => setExcluindo(m)} disabled={motivoBloqueio != null} title={motivoBloqueio ?? "Excluir"}>Excluir</RebButton></td>
              </tr>
              );
            })}</tbody>
          </RebTable>
        )}

      <PrincipiosAtivosSection />
      <ComposicaoRacaoSection />
      <LotesProdutoSection />

      {form && <MovimentoForm onFechar={() => setForm(false)} onSalvo={() => { setForm(false); recarregarTudo(); }} />}
      {cadastrandoProduto && <ProdutoForm onFechar={() => setCadastrandoProduto(false)} onSalvo={() => { setCadastrandoProduto(false); recarregarTudo(); }} />}
      {editando && <ProdutoForm produto={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); recarregarTudo(); }} />}
      {excluindo && (
        <ConfirmarExclusao
          movimento={excluindo}
          onCancelar={() => setExcluindo(null)}
          onConfirmado={() => { setExcluindo(null); recarregarTudo(); }}
        />
      )}
    </RebMain>
  );
}

function ConfirmarExclusao({ movimento, onCancelar, onConfirmado }: { movimento: MovimentoDTO; onCancelar: () => void; onConfirmado: () => void }) {
  const [aceito, setAceito] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setExcluindo(true); setErro(null);
    try {
      await excluirMovimento(movimento.id);
      onConfirmado();
    } catch (e: any) {
      setErro(e.message ?? "Erro ao excluir.");
      setExcluindo(false);
    }
  }

  const dataFmt = new Date(movimento.data).toLocaleDateString("pt-BR");

  return (
    <RebModal
      title=""
      onClose={excluindo ? () => {} : onCancelar}
      showClose={false}
      className="max-w-[460px]"
      actions={
        <div className="flex w-full justify-between">
          <RebButton onClick={onCancelar} disabled={excluindo}>Cancelar</RebButton>
          <RebButton variant="danger" onClick={confirmar} disabled={!aceito || excluindo}>
            {excluindo ? "Excluindo…" : "Excluir definitivamente"}
          </RebButton>
        </div>
      }
    >
      <div className="mt-0.5 flex justify-center [&>svg]:h-11 [&>svg]:w-11 [&>svg]:text-prejuizo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <h3 id="rb-confirm-title" style={{ margin: "10px 0 6px", textAlign: "center" }}>Excluir movimento?</h3>
      <p style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 13.5, margin: "0 0 18px" }}>
        Esta ação <b style={{ color: "var(--ink-2)" }}>não pode ser desfeita</b> — é um registro financeiro.
      </p>

      <div className="mb-3.5 rounded-[10px] border border-[color:var(--rule-soft)] bg-card px-4 py-3">
        <RebKv className="py-1.5"><span>Data</span><b>{dataFmt}</b></RebKv>
        <RebKv className="py-1.5"><span>Produto</span><b>{movimento.produto}</b></RebKv>
        <RebKv className="py-1.5"><span>Tipo</span><b>{TIPO_MOV[movimento.tipo]}</b></RebKv>
        <RebKv className="py-1.5"><span>Quantidade</span><b>{qtd(movimento.quantidade)}</b></RebKv>
        <RebKv className="py-1.5"><span>Valor</span><b>{money(movimento.valorTotal)}</b></RebKv>
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-md border-l-[3px] border-prejuizo bg-[color-mix(in_srgb,var(--prejuizo)_8%,transparent)] px-3.5 py-3 text-sm leading-[1.45] text-ink-2 [&>span]:flex-none [&>span]:text-base [&>span]:leading-none [&>span]:text-prejuizo [&_b]:font-semibold [&_b]:text-foreground">
        <span>⚠</span>
        <div>
          <b>Cascata financeira:</b> se este movimento gerou um lançamento no fluxo de caixa, ele <b>também será removido</b>.
          Movimentos em mês fechado não podem ser excluídos.
        </div>
      </div>

      <label className="flex cursor-pointer select-none items-start gap-2.5 py-2.5 font-sans text-sm text-ink-2 [&_input]:mt-px [&_input]:h-[18px] [&_input]:w-[18px] [&_input]:flex-none [&_input]:cursor-pointer [&_input]:accent-[color:var(--prejuizo)]">
        <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} disabled={excluindo} />
        Entendo que esta exclusão é permanente.
      </label>

      {erro && <p className="text-prejuizo" style={{ fontSize: 13, marginTop: 10, textAlign: "center" }}>{erro}</p>}
    </RebModal>
  );
}

function SortBtn({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", color: "inherit", font: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      {label}
      <span style={{ fontSize: 10, opacity: active ? 1 : 0.35, color: active ? "var(--cafe)" : "var(--ink-mute)", lineHeight: 1 }}>
        {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </button>
  );
}
