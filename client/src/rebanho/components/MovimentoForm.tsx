import { useEffect, useState } from "react";
import { registrarMovimento, listarProdutos, listarFornecedores, listarGrupos, type ProdutoDTO, type FornecedorDTO, type GrupoDTO, type MovimentoInput } from "../api";
import { HOJE } from "../HOJE";

const TIPOS: { id: MovimentoInput["tipo"]; label: string }[] = [
  { id: "ENTRADA", label: "Entrada (compra)" },
  { id: "SAIDA", label: "Saída (consumo)" },
  { id: "AJUSTE", label: "Ajuste (inventário)" },
];

export function MovimentoForm({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorDTO[]>([]);
  const [grupos, setGrupos] = useState<GrupoDTO[]>([]);
  const [f, setF] = useState({ tipo: "ENTRADA" as MovimentoInput["tipo"], produtoId: "", data: HOJE, quantidade: "", custoUnitario: "", fornecedorId: "", grupoId: "", observacao: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    listarProdutos({ ativo: true }).then((ps) => setProdutos(ps.filter((p) => p.estocavel))).catch(() => {});
    listarFornecedores().then(setFornecedores).catch(() => {});
    listarGrupos().then(setGrupos).catch(() => {});
  }, []);

  const produtoSel = produtos.find((p) => String(p.id) === f.produtoId) || null;
  const custoHint = produtoSel?.custoUnitario != null ? `Padrão: ${produtoSel.custoUnitario}` : "Custo unitário (R$)";

  async function salvar() {
    if (!f.produtoId) { setErro("Selecione um produto."); return; }
    if (!f.quantidade || Number(f.quantidade) === 0) { setErro("Informe a quantidade."); return; }
    setSalvando(true); setErro(null);
    try {
      const payload: MovimentoInput = {
        produtoId: Number(f.produtoId),
        tipo: f.tipo,
        data: f.data,
        quantidade: Number(f.quantidade),
        custoUnitario: f.custoUnitario ? Number(f.custoUnitario) : undefined,
        fornecedorId: f.tipo === "ENTRADA" && f.fornecedorId ? Number(f.fornecedorId) : undefined,
        grupoId: f.tipo === "SAIDA" && f.grupoId ? Number(f.grupoId) : undefined,
        observacao: f.observacao || undefined,
      };
      await registrarMovimento(payload);
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer">
        <h3>Registrar movimento</h3>
        <label className="rb-fld">Tipo<select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <label className="rb-fld">Produto*
          <select value={f.produtoId} onChange={(e) => set("produtoId", e.target.value)}>
            <option value="">Selecione…</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}
          </select>
        </label>
        <label className="rb-fld">Data*<input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} /></label>
        <label className="rb-fld">Quantidade*{f.tipo === "AJUSTE" && <small style={{ textTransform: "none", letterSpacing: 0, color: "var(--ink-3)" }}> — negativo subtrai</small>}<input type="number" step="0.01" value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} /></label>
        <label className="rb-fld">Custo unitário (R$)<input type="number" min={0} step="0.01" value={f.custoUnitario} onChange={(e) => set("custoUnitario", e.target.value)} placeholder={custoHint} /></label>
        {f.tipo === "ENTRADA" && (
          <label className="rb-fld">Fornecedor
            <select value={f.fornecedorId} onChange={(e) => set("fornecedorId", e.target.value)}>
              <option value="">—</option>
              {fornecedores.map((fr) => <option key={fr.id} value={fr.id}>{fr.nome}</option>)}
            </select>
          </label>
        )}
        {f.tipo === "SAIDA" && (
          <label className="rb-fld">Lote
            <select value={f.grupoId} onChange={(e) => set("grupoId", e.target.value)}>
              <option value="">—</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </label>
        )}
        <label className="rb-fld">Observação<input value={f.observacao} onChange={(e) => set("observacao", e.target.value)} maxLength={200} /></label>
        {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
