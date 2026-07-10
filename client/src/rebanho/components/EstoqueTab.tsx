import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader } from "../../components/Loading";
import { useSaldos, useCustoVacaDia, listarMovimentos, listarProdutos, excluirMovimento, SETORES_ESTOQUE, setorLabel, type MovimentoDTO, type ProdutoDTO, type SaldoDTO } from "../api";
import { MovimentoForm } from "./MovimentoForm";
import { ProdutoForm } from "./ProdutoForm";
import { RebHeader } from "./RebHeader";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const TIPO_MOV: Record<MovimentoDTO["tipo"], string> = { ENTRADA: "Entrada", SAIDA: "Saída", AJUSTE: "Ajuste" };
// Cor do setor via variáveis CSS já existentes (não hardcodar hex): Leite/Café têm var própria;
// Corte/Milho reusam --outros (demais atividades); Geral fica neutro.
const setorCor = (s: string) => (s === "LEITE" ? "var(--leite)" : s === "CAFE" ? "var(--cafe)" : s === "GERAL" ? "var(--ink-mute)" : "var(--outros)");
function SetorChip({ setor }: { setor: string }) {
  return (
    <span className="rb-pill" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: setorCor(setor), flex: "0 0 auto" }} />
      {setorLabel(setor)}
    </span>
  );
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

export function EstoqueTab() {
  const custo = useCustoVacaDia();
  const [setorFiltro, setSetorFiltro] = useState("");
  const [agrupar, setAgrupar] = useState(false);
  const saldos = useSaldos(setorFiltro ? { setor: setorFiltro } : undefined);
  const movimentos = useMovimentos();
  const [form, setForm] = useState(false);
  const [busca, setBusca] = useState("");
  const [soAbaixoMin, setSoAbaixoMin] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "nome", dir: "asc" });
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [editando, setEditando] = useState<ProdutoDTO | null>(null);
  const [excluindo, setExcluindo] = useState<MovimentoDTO | null>(null);

  const carregarProdutos = useCallback(() => {
    listarProdutos({ ativo: true }).then(setProdutos).catch(() => {});
  }, []);
  useEffect(() => { carregarProdutos(); }, [carregarProdutos]);

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

  // Agrupamento por setor operacional (Leite/Café/Corte/Milho/Geral) para a visão "Agrupar".
  const gruposPorSetor = useMemo(() => {
    const map = new Map<string, { linhas: SaldoDTO[]; valorTotal: number }>();
    for (const s of saldosVisiveis) {
      const g = map.get(s.setor) ?? { linhas: [], valorTotal: 0 };
      g.linhas.push(s);
      g.valorTotal += s.valor;
      map.set(s.setor, g);
    }
    return [...map.entries()]
      .map(([setor, g]) => ({ setor, ...g }))
      .sort((a, b) => setorLabel(a.setor).localeCompare(setorLabel(b.setor), "pt-BR"));
  }, [saldosVisiveis]);

  function abrirEdicao(produtoId: number) {
    const p = produtos.find((x) => x.id === produtoId);
    if (p) setEditando(p);
  }

  const recarregarTudo = () => { custo.recarregar(); saldos.recarregar(); movimentos.recarregar(); carregarProdutos(); };

  const renderRow = (s: SaldoDTO) => (
    <tr key={s.produtoId}>
      <td className="rb-anm">{s.nome} {s.abaixoMinimo && <span className="rb-pill bad">⚠ abaixo do mínimo</span>}</td>
      <td>{s.tipo}</td>
      <td><SetorChip setor={s.setor} /></td>
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
    return <main className="rb-main"><RebHeader eyebrow="Rebanho" title="Estoque" /><Loader /></main>;
  }

  const c = custo.data;
  const custoTxt = c && c.custoVacaDia != null ? money(c.custoVacaDia) : "—";

  return (
    <main className="rb-main">
      <RebHeader eyebrow="Rebanho · insumos e consumo" title="Estoque" />

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
      <div className="mt-1 mb-2 flex items-baseline justify-between">
        <h2 className="font-serif text-xl font-medium m-0">Saldos de estoque</h2>
        <span className="text-sm text-ink-3">{saldosVisiveis.length} de {saldos.data.length} {saldos.data.length === 1 ? "produto" : "produtos"}</span>
      </div>
      {(saldos.data.length > 0 || setorFiltro) && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "0 0 12px", flexWrap: "wrap" }}>
          <input
            type="search"
            className="rb-fld"
            placeholder="Buscar por nome ou tipo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ flex: "1 1 240px", maxWidth: 360 }}
          />
          <select
            className="rb-fld"
            value={setorFiltro}
            onChange={(e) => setSetorFiltro(e.target.value)}
            style={{ flex: "0 1 180px" }}
            aria-label="Filtrar por setor"
          >
            <option value="">Todos os setores</option>
            {SETORES_ESTOQUE.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button
            type="button"
            className={"rb-chip-q" + (agrupar ? " on" : "")}
            onClick={() => setAgrupar((v) => !v)}
            style={agrupar ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}
          >
            Agrupar por setor
          </button>
          {nAbaixoMin > 0 && (
            <button
              type="button"
              className={"rb-chip-q" + (soAbaixoMin ? " on" : "")}
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
        : saldos.data.length === 0 ? <div className="rb-empty">Nenhum produto estocável cadastrado.</div>
        : saldosVisiveis.length === 0 ? <div className="rb-empty">Nenhum produto bate com a busca.</div>
        : (
          <RebTable>
            <thead><tr>
              <th><SortBtn label="Produto" active={sort.key === "nome"} dir={sort.dir} onClick={() => trocarSort("nome")} /></th>
              <th><SortBtn label="Tipo" active={sort.key === "tipo"} dir={sort.dir} onClick={() => trocarSort("tipo")} /></th>
              <th>Setor</th>
              <th>Saldo</th>
              <th><SortBtn label="Valor" active={sort.key === "valor"} dir={sort.dir} onClick={() => trocarSort("valor")} /></th>
              <th>Mínimo</th>
              <th></th>
            </tr></thead>
            {agrupar
              ? gruposPorSetor.map((g) => (
                  <tbody key={g.setor}>
                    <tr className="rb-tbl-group">
                      <td colSpan={7} style={{ background: "var(--surface-2, #f4f1ea)", fontWeight: 600 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: setorCor(g.setor), flex: "0 0 auto" }} />
                          {setorLabel(g.setor)}
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
        <RebButton variant="pri" onClick={() => setForm(true)}>+ Registrar movimento</RebButton>
      </div>
      {movimentos.loading ? <Loader />
        : movimentos.erro ? <p className="mt-[7px] text-sm text-prejuizo">Erro: {movimentos.erro}</p>
        : movimentos.data.length === 0 ? <div className="rb-empty">Nenhum movimento registrado ainda.</div>
        : (
          <RebTable>
            <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtde</th><th>Valor</th><th>Origem/destino</th><th></th></tr></thead>
            <tbody>{movimentos.data.map((m) => (
              <tr key={m.id}>
                <td>{m.data}</td>
                <td className="rb-anm">{m.produto}</td>
                <td><span className={"rb-pill" + (m.tipo === "SAIDA" ? " warn" : "")}>{TIPO_MOV[m.tipo]}</span>{m.origem === "NUTRICAO" && <span className="rb-pill" style={{ marginLeft: 4, background: "var(--leite)", color: "#fff" }} title="Baixa automática do consumo de dieta">Dieta</span>}</td>
                <td>{qtd(m.quantidade)}</td>
                <td>{money(m.valorTotal)}</td>
                <td>{m.fornecedor ?? m.grupo ?? "—"}</td>
                <td style={{ textAlign: "right" }}><RebButton onClick={() => setExcluindo(m)} disabled={m.origem === "NUTRICAO"} title={m.origem === "NUTRICAO" ? "Baixa de consumo — estorne o período na aba Nutrição" : "Excluir"}>Excluir</RebButton></td>
              </tr>
            ))}</tbody>
          </RebTable>
        )}

      {form && <MovimentoForm onFechar={() => setForm(false)} onSalvo={() => { setForm(false); recarregarTudo(); }} />}
      {editando && <ProdutoForm produto={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); recarregarTudo(); }} />}
      {excluindo && (
        <ConfirmarExclusao
          movimento={excluindo}
          onCancelar={() => setExcluindo(null)}
          onConfirmado={() => { setExcluindo(null); recarregarTudo(); }}
        />
      )}
    </main>
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
      <div className="rb-confirm-icon">
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

      <div className="rb-confirm-recibo">
        <div className="rb-kv"><span>Data</span><b>{dataFmt}</b></div>
        <div className="rb-kv"><span>Produto</span><b>{movimento.produto}</b></div>
        <div className="rb-kv"><span>Tipo</span><b>{TIPO_MOV[movimento.tipo]}</b></div>
        <div className="rb-kv"><span>Quantidade</span><b>{qtd(movimento.quantidade)}</b></div>
        <div className="rb-kv"><span>Valor</span><b>{money(movimento.valorTotal)}</b></div>
      </div>

      <div className="rb-confirm-warn">
        <span>⚠</span>
        <div>
          <b>Cascata financeira:</b> se este movimento gerou um lançamento no fluxo de caixa, ele <b>também será removido</b>.
          Movimentos em mês fechado não podem ser excluídos.
        </div>
      </div>

      <label className="rb-confirm-ack">
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
