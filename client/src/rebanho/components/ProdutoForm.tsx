import { useState } from "react";
import { criarProduto, editarProduto, type ProdutoDTO, type TipoProduto } from "../api";

const TIPOS: { id: TipoProduto; label: string }[] = [
  { id: "MEDICAMENTO", label: "Medicamento" },
  { id: "RACAO", label: "Ração" },
  { id: "INSUMO", label: "Insumo" },
  { id: "MINERAL", label: "Mineral" },
  { id: "OUTRO", label: "Outro" },
];

export function ProdutoForm({ produto, onFechar, onSalvo }: { produto?: ProdutoDTO; onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({
    nome: produto?.nome ?? "",
    tipo: (produto?.tipo ?? "INSUMO") as TipoProduto,
    unidade: produto?.unidade ?? "un",
    custoUnitario: produto?.custoUnitario != null ? String(produto.custoUnitario) : "",
    carencia: produto?.carencia != null ? String(produto.carencia) : "",
    percentualMS: produto?.percentualMS != null ? String(produto.percentualMS) : "",
    estocavel: produto?.estocavel ?? true,
    minimoEstoque: produto?.minimoEstoque != null ? String(produto.minimoEstoque) : "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload = {
        nome: f.nome,
        tipo: f.tipo,
        unidade: f.unidade || "un",
        custoUnitario: f.custoUnitario ? Number(f.custoUnitario) : undefined,
        carencia: f.carencia ? Number(f.carencia) : undefined,
        percentualMS: f.percentualMS ? Number(f.percentualMS) : undefined,
        estocavel: f.estocavel,
        minimoEstoque: f.minimoEstoque ? Number(f.minimoEstoque) : undefined,
      };
      if (produto) await editarProduto(produto.id, payload);
      else await criarProduto(payload);
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer">
        <h3>{produto ? `Editar ${produto.nome}` : "Novo produto"}</h3>
        <label className="rb-fld">Nome*<input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></label>
        <label className="rb-fld">Tipo<select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <label className="rb-fld">Unidade<input value={f.unidade} onChange={(e) => set("unidade", e.target.value)} placeholder="un, kg, dose…" /></label>
        <label className="rb-fld">Custo unitário (R$)<input type="number" value={f.custoUnitario} onChange={(e) => set("custoUnitario", e.target.value)} /></label>
        <label className="rb-fld">Carência (dias)<input type="number" value={f.carencia} onChange={(e) => set("carencia", e.target.value)} /></label>
        <label className="rb-fld">% Matéria seca<input type="number" value={f.percentualMS} onChange={(e) => set("percentualMS", e.target.value)} /></label>
        <label className="rb-fld" style={{ flexDirection: "row", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
          <input type="checkbox" checked={f.estocavel} onChange={(e) => set("estocavel", e.target.checked)} style={{ width: "auto" }} />Estocável
        </label>
        <label className="rb-fld">Estoque mínimo<input type="number" value={f.minimoEstoque} onChange={(e) => set("minimoEstoque", e.target.value)} /></label>
        {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
