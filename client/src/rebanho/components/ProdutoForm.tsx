import { useEffect, useState } from "react";
import { criarProduto, editarProduto, listarCategorias, listarCentrosCusto, type ProdutoDTO, type RefDTO, type TipoProduto } from "../api";

const TIPOS: { id: TipoProduto; label: string }[] = [
  { id: "MEDICAMENTO", label: "Medicamento" },
  { id: "RACAO", label: "Ração" },
  { id: "INSUMO", label: "Insumo" },
  { id: "MINERAL", label: "Mineral" },
  { id: "OUTRO", label: "Outro" },
];

export function ProdutoForm({ produto, onFechar, onSalvo, stacked = false }: { produto?: ProdutoDTO; onFechar: () => void; onSalvo: (criado?: ProdutoDTO) => void; stacked?: boolean }) {
  const [f, setF] = useState({
    nome: produto?.nome ?? "",
    tipo: (produto?.tipo ?? "INSUMO") as TipoProduto,
    unidade: produto?.unidade ?? "un",
    custoUnitario: produto?.custoUnitario != null ? String(produto.custoUnitario) : "",
    estocavel: produto?.estocavel ?? true,
    minimoEstoque: produto?.minimoEstoque != null ? String(produto.minimoEstoque) : "",
    categoriaId: produto?.categoriaId != null ? String(produto.categoriaId) : "",
    centroCustoId: produto?.centroCustoId != null ? String(produto.centroCustoId) : "",
  });
  const [categorias, setCategorias] = useState<RefDTO[]>([]);
  const [centros, setCentros] = useState<RefDTO[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {});
    listarCentrosCusto().then(setCentros).catch(() => {});
  }, []);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload = {
        nome: f.nome,
        tipo: f.tipo,
        unidade: f.unidade || "un",
        custoUnitario: f.custoUnitario ? Number(f.custoUnitario) : undefined,
        estocavel: f.estocavel,
        minimoEstoque: f.minimoEstoque ? Number(f.minimoEstoque) : undefined,
        categoriaId: f.categoriaId ? Number(f.categoriaId) : null,
        centroCustoId: f.centroCustoId ? Number(f.centroCustoId) : null,
      };
      if (produto) { await editarProduto(produto.id, payload); onSalvo(); }
      else { const criado = await criarProduto(payload); onSalvo(criado); }
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <>
      <div className={"rb-drawer-bg" + (stacked ? " rb-stacked" : "")} onClick={onFechar} />
      <aside className={"rb-drawer" + (stacked ? " rb-stacked" : "")}>
        <h3>{produto ? `Editar ${produto.nome}` : "Novo produto"}</h3>
        <label className="rb-fld">Nome*<input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></label>
        <label className="rb-fld">Tipo<select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <label className="rb-fld">Unidade<input value={f.unidade} onChange={(e) => set("unidade", e.target.value)} placeholder="un, kg, dose…" /></label>
        <label className="rb-fld">Custo unitário (R$)<input type="number" value={f.custoUnitario} onChange={(e) => set("custoUnitario", e.target.value)} /></label>
        <label className="rb-fld">Categoria contábil
          <select value={f.categoriaId} onChange={(e) => set("categoriaId", e.target.value)}>
            <option value="">—</option>
            {categorias.map((cat) => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
          </select>
        </label>
        <label className="rb-fld">Centro de custo
          <select value={f.centroCustoId} onChange={(e) => set("centroCustoId", e.target.value)}>
            <option value="">—</option>
            {centros.map((cc) => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
          </select>
        </label>
        <label className="rb-fld">Estoque mínimo<input type="number" step="0.01" min={0} value={f.minimoEstoque} onChange={(e) => set("minimoEstoque", e.target.value)} placeholder="dispara alerta abaixo desse valor" /></label>
        <label className="rb-fld" style={{ flexDirection: "row", alignItems: "center", gap: 8, fontStyle: "normal", marginTop: 4 }}>
          <input type="checkbox" checked={f.estocavel} onChange={(e) => set("estocavel", e.target.checked)} style={{ width: "auto" }} />Estocável
        </label>
        {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
