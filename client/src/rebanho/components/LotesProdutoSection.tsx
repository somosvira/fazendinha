import { useEffect, useState } from "react";
import {
  useLotesProduto, criarLoteProduto, excluirLoteProduto,
  listarLocaisArmazenamento, criarLocalArmazenamento, listarProdutos,
  type LocalArmazenamentoDTO, type ProdutoDTO, type StatusValidadeLote,
} from "../api";

const fmtData = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR");
const STATUS_COR: Record<StatusValidadeLote, string> = { vencido: "var(--prejuizo)", "a-vencer": "var(--atencao)", ok: "var(--lucro)", "sem-validade": "var(--ink-mute)" };
const STATUS_LABEL: Record<StatusValidadeLote, string> = { vencido: "vencido", "a-vencer": "a vencer", ok: "ok", "sem-validade": "s/ validade" };

// Lotes de produto (código + validade + local) com status de validade. Cadastro paralelo — não é
// o razão de estoque. Locais de armazenamento geríveis inline.
export function LotesProdutoSection() {
  const { data, loading, recarregar } = useLotesProduto();
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [locais, setLocais] = useState<LocalArmazenamentoDTO[]>([]);
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({ produtoId: "", codigo: "", validade: "", localId: "", quantidade: "" });
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarProdutos({ ativo: true }).then(setProdutos).catch(() => setProdutos([]));
    listarLocaisArmazenamento().then(setLocais).catch(() => setLocais([]));
  }, []);
  if (loading) return null;
  const lotes = data?.lotes ?? [];
  const r = data?.resumo;

  function set(k: keyof typeof f, v: string) { setF((s) => ({ ...s, [k]: v })); }
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.produtoId || !f.codigo.trim()) { setErro("Escolha o produto e informe o código do lote."); return; }
    setErro(null);
    try {
      await criarLoteProduto({
        produtoId: Number(f.produtoId), codigo: f.codigo.trim(),
        validade: f.validade || null, localId: f.localId ? Number(f.localId) : null,
        quantidade: f.quantidade.trim() ? Number(f.quantidade) : null,
      });
      setF({ produtoId: "", codigo: "", validade: "", localId: "", quantidade: "" }); setAberto(false); recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao salvar lote."); }
  }
  async function excluir(id: number) { await excluirLoteProduto(id); recarregar(); }
  async function novoLocal() {
    const nome = window.prompt("Nome do local de armazenamento:");
    if (!nome || !nome.trim()) return;
    await criarLocalArmazenamento({ nome: nome.trim() });
    listarLocaisArmazenamento().then(setLocais).catch(() => {});
  }

  return (
    <div className="mt-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-[11px] flex items-center justify-between">
        <h4 className="m-0 text-sm uppercase tracking-[.06em] text-ink-3">Lotes de produto / validade</h4>
        {!aberto && <button onClick={() => setAberto(true)} className="rounded bg-[color:var(--cafe)] px-3 py-1 text-sm font-semibold text-white">Novo lote</button>}
      </div>

      {r && r.total > 0 && (
        <p className="mb-2 text-sm text-ink-3">
          {r.total} lotes{r.vencido > 0 ? <span className="text-prejuizo"> · {r.vencido} vencido(s)</span> : ""}{r["a-vencer"] > 0 ? <span style={{ color: "var(--atencao)" }}> · {r["a-vencer"]} a vencer</span> : ""}
        </p>
      )}

      {aberto && (
        <form onSubmit={salvar} className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-ink-3">Produto
            <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.produtoId} onChange={(e) => set("produtoId", e.target.value)}>
              <option value="">selecione…</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs text-ink-3">Código<input className="mt-0.5 w-28 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.codigo} onChange={(e) => set("codigo", e.target.value)} maxLength={60} /></label>
          <label className="flex flex-col text-xs text-ink-3">Validade<input type="date" className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.validade} onChange={(e) => set("validade", e.target.value)} /></label>
          <label className="flex flex-col text-xs text-ink-3">Local
            <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.localId} onChange={(e) => set("localId", e.target.value)}>
              <option value="">—</option>{locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </label>
          <button type="button" onClick={novoLocal} className="pb-1 text-xs text-[color:var(--cafe)] hover:underline">+ local</button>
          <label className="flex flex-col text-xs text-ink-3">Qtde<input type="number" min={0} className="mt-0.5 w-24 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} /></label>
          <button type="submit" className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white">Salvar</button>
          <button type="button" onClick={() => setAberto(false)} className="rounded border border-[color:var(--rule-soft)] px-3 py-1.5 text-sm text-ink-2">Cancelar</button>
        </form>
      )}
      {erro && <p className="mb-2 text-sm text-prejuizo">{erro}</p>}

      {lotes.length === 0 ? (
        !aberto && <p className="text-sm text-ink-3">Nenhum lote cadastrado. Cadastre lotes com validade para acompanhar vencimentos.</p>
      ) : (
        <div className="flex flex-col">
          {lotes.map((l) => (
            <div key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-dashed border-[color:var(--rule-soft)] py-[7px] text-sm last:border-0">
              <span className="shrink-0 font-semibold text-[color:var(--ink)]">{l.produtoNome} <span className="text-ink-3">· lote {l.codigo}</span></span>
              <span className="flex-1 text-ink-2">
                {l.validade ? `val. ${fmtData(l.validade)}` : "sem validade"}{l.localNome ? ` · ${l.localNome}` : ""}{l.quantidade != null ? ` · ${l.quantidade}` : ""}
              </span>
              <span className="shrink-0 text-xs font-semibold" style={{ color: STATUS_COR[l.status] }}>{STATUS_LABEL[l.status]}</span>
              <button onClick={() => excluir(l.id)} className="shrink-0 text-sm text-ink-3 hover:text-prejuizo hover:underline" aria-label={`Excluir lote ${l.codigo}`}>excluir</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
