import { useEffect, useMemo, useState } from "react";
import { Loader } from "../../components/Loading";
import { criarDieta, editarDieta, excluirDieta, salvarItensDieta, useItensDieta, useProdutos, type DietaDTO, type DietaItemInput } from "../api";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Props = {
  dieta?: DietaDTO | null;
  onFechar: () => void;
  onSalvo: (d: DietaDTO) => void;
  onExcluido?: () => void;
};

export function DietaForm({ dieta, onFechar, onSalvo, onExcluido }: Props) {
  const [f, setF] = useState({
    nome: dieta?.nome ?? "",
    descricao: dieta?.descricao ?? "",
    pb: dieta?.pb != null ? String(dieta.pb) : "",
    edMcal: dieta?.edMcal != null ? String(dieta.edMcal) : "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const editando = !!dieta;

  async function salvar() {
    if (!f.nome.trim()) { setErro("Informe o nome da dieta."); return; }
    setSalvando(true); setErro(null);
    try {
      const payload = {
        nome: f.nome.trim(),
        descricao: f.descricao || undefined,
        pb: f.pb ? Number(f.pb) : undefined,
        edMcal: f.edMcal ? Number(f.edMcal) : undefined,
      };
      const d = editando ? await editarDieta(dieta!.id, payload) : await criarDieta(payload);
      onSalvo(d);
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  async function confirmarExcluir() {
    if (!dieta) return;
    setSalvando(true); setErro(null);
    try {
      await excluirDieta(dieta.id);
      onExcluido?.();
    } catch (e: any) { setErro(e.message); setConfirmandoExcluir(false); } finally { setSalvando(false); }
  }

  if (confirmandoExcluir && dieta) {
    return (
      <RebModal
        title=""
        showClose={false}
        onClose={() => !salvando && setConfirmandoExcluir(false)}
        className="max-w-[460px]"
        actions={
          <div className="flex w-full justify-between">
            <RebButton onClick={() => setConfirmandoExcluir(false)} disabled={salvando}>Cancelar</RebButton>
            <RebButton variant="danger" onClick={confirmarExcluir} disabled={salvando}>{salvando ? "Excluindo…" : "Excluir dieta"}</RebButton>
          </div>
        }
      >
        <div className="rb-confirm-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3 style={{ margin: "10px 0 6px", textAlign: "center" }}>Excluir dieta {dieta.nome}?</h3>
        <p style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 13.5, margin: "0 0 18px" }}>
          Só é possível excluir se a dieta não estiver atribuída a nenhum lote.
        </p>
        {erro && <p style={{ color: "var(--neg)", fontSize: 13, marginTop: 10, textAlign: "center" }}>{erro}</p>}
      </RebModal>
    );
  }

  return (
    <RebModal
      title={editando ? `Editar ${dieta!.nome}` : "Nova dieta"}
      onClose={onFechar}
      actions={
        <div className="flex w-full items-center justify-between">
          {editando ? (
            <RebButton variant="danger" onClick={() => setConfirmandoExcluir(true)} disabled={salvando}>Excluir</RebButton>
          ) : <span />}
          <span style={{ display: "flex", gap: 8 }}>
            <RebButton onClick={onFechar} disabled={salvando}>Cancelar</RebButton>
            <RebButton variant="pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
          </span>
        </div>
      }
    >
      <label className="rb-fld">Nome*<input value={f.nome} onChange={(e) => set("nome", e.target.value)} autoFocus /></label>
      <label className="rb-fld">Descrição<input value={f.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="ex.: silagem + concentrado 22%" /></label>
      <label className="rb-fld">% Proteína bruta<input type="number" step="0.1" min={0} max={999.9} value={f.pb} onChange={(e) => set("pb", e.target.value)} placeholder="ex.: 18" /></label>
      <label className="rb-fld">Energia (Mcal/kg)<input type="number" step="0.01" min={0} max={99.99} value={f.edMcal} onChange={(e) => set("edMcal", e.target.value)} placeholder="ex.: 2.8 (típico: 2–4)" /></label>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      {editando && <ComposicaoDieta dietaId={dieta!.id} />}
    </RebModal>
  );
}

// Composição da dieta: produtos × qtd/cabeça/dia. Só aparece ao editar uma dieta
// já criada (o PUT precisa do id). Salva independente do nome/macros da dieta.
function ComposicaoDieta({ dietaId }: { dietaId: number }) {
  const { data: itens, loading, recarregar } = useItensDieta(dietaId);
  const { data: produtos } = useProdutos({ ativo: true });
  const estocaveis = useMemo(() => produtos.filter((p) => p.estocavel), [produtos]);
  const prodPorId = useMemo(() => new Map(estocaveis.map((p) => [p.id, p])), [estocaveis]);

  const [linhas, setLinhas] = useState<{ produtoId: number; qtd: string }[]>([]);
  const [novoProduto, setNovoProduto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  // Sincroniza a lista de trabalho com o que veio do servidor (carga inicial e
  // após salvar). A key só muda quando os itens salvos mudam — não atrapalha a digitação.
  const itensKey = itens.map((i) => `${i.produtoId}:${i.qtdPorCabecaDia}`).join("|");
  useEffect(() => {
    setLinhas(itens.map((i) => ({ produtoId: i.produtoId, qtd: String(i.qtdPorCabecaDia) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itensKey]);

  const disponiveis = estocaveis.filter((p) => !linhas.some((l) => l.produtoId === p.id));
  const totalCusto = linhas.reduce((acc, l) => {
    const p = prodPorId.get(l.produtoId);
    const q = Number(l.qtd);
    return p?.custoUnitario && Number.isFinite(q) ? acc + q * p.custoUnitario : acc;
  }, 0);

  function adicionar() {
    const id = Number(novoProduto);
    if (!id || linhas.some((l) => l.produtoId === id)) return;
    setLinhas((s) => [...s, { produtoId: id, qtd: "" }]);
    setNovoProduto("");
  }
  const setQtd = (produtoId: number, v: string) => setLinhas((s) => s.map((l) => (l.produtoId === produtoId ? { ...l, qtd: v } : l)));
  const remover = (produtoId: number) => setLinhas((s) => s.filter((l) => l.produtoId !== produtoId));

  async function salvar() {
    const payload: DietaItemInput[] = linhas.map((l) => ({ produtoId: l.produtoId, qtdPorCabecaDia: Number(l.qtd) }));
    if (payload.some((p) => !(p.qtdPorCabecaDia > 0))) { setMsg({ tom: "erro", texto: "Informe uma quantidade maior que zero em cada produto." }); return; }
    setSalvando(true); setMsg(null);
    try {
      await salvarItensDieta(dietaId, payload);
      setMsg({ tom: "ok", texto: "Composição salva." });
      recarregar();
    } catch (e: any) { setMsg({ tom: "erro", texto: e.message }); } finally { setSalvando(false); }
  }

  return (
    <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <h4 style={{ margin: "0 0 4px" }}>Composição</h4>
      <p className="rb-sub" style={{ margin: "0 0 10px", fontSize: 12.5 }}>Quanto de cada produto cada cabeça consome por dia. Alimenta a baixa de estoque e o custo por vaca/dia.</p>

      {loading ? <Loader /> : (
        <>
          {linhas.length === 0 ? <p className="rb-sub" style={{ fontStyle: "italic" }}>Nenhum produto na composição ainda.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {linhas.map((l) => {
                const p = prodPorId.get(l.produtoId);
                return (
                  <div key={l.produtoId} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 13.5 }}>{p?.nome ?? `#${l.produtoId}`}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="number" step="0.0001" min={0} value={l.qtd} onChange={(e) => setQtd(l.produtoId, e.target.value)} style={{ width: 66 }} placeholder="qtd" />
                      <span style={{ fontSize: 12, color: "var(--ink-3)", minWidth: 22 }}>{p?.unidade}</span>
                    </span>
                    <RebButton type="button" onClick={() => remover(l.produtoId)} title="Remover">✕</RebButton>
                  </div>
                );
              })}
            </div>
          )}

          {disponiveis.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <select value={novoProduto} onChange={(e) => setNovoProduto(e.target.value)} style={{ flex: 1 }}>
                <option value="">+ Adicionar produto…</option>
                {disponiveis.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}
              </select>
              <RebButton type="button" disabled={!novoProduto} onClick={adicionar}>Adicionar</RebButton>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13 }}>Custo estimado: <b>{money(totalCusto)}</b>/cab/dia</span>
            <RebButton variant="pri" type="button" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar composição"}</RebButton>
          </div>
          {msg && <p style={{ fontSize: 13, marginTop: 8, color: msg.tom === "ok" ? "var(--pos)" : "var(--neg)" }}>{msg.texto}</p>}
        </>
      )}
    </div>
  );
}
