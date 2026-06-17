import { useEffect, useState } from "react";
import { registrarMovimento, listarProdutos, listarFornecedores, listarGrupos, listarCategorias, listarCentrosCusto, type ProdutoDTO, type FornecedorDTO, type GrupoDTO, type RefDTO, type MovimentoResult, type MovimentoInput } from "../api";
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
  const [categorias, setCategorias] = useState<RefDTO[]>([]);
  const [centros, setCentros] = useState<RefDTO[]>([]);
  const [f, setF] = useState({ tipo: "ENTRADA" as MovimentoInput["tipo"], produtoId: "", data: HOJE, quantidade: "", custoUnitario: "", fornecedorId: "", grupoId: "", observacao: "", categoriaId: "", centroCustoId: "", gerarLancamento: true });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<MovimentoResult | null>(null);
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    listarProdutos({ ativo: true }).then((ps) => setProdutos(ps.filter((p) => p.estocavel))).catch(() => {});
    listarFornecedores().then(setFornecedores).catch(() => {});
    listarGrupos().then(setGrupos).catch(() => {});
    listarCategorias().then(setCategorias).catch(() => {});
    listarCentrosCusto().then(setCentros).catch(() => {});
  }, []);

  const produtoSel = produtos.find((p) => String(p.id) === f.produtoId) || null;
  const custoHint = produtoSel?.custoUnitario != null ? `Padrão: ${produtoSel.custoUnitario}` : "Custo unitário (R$)";

  // Ao escolher/trocar o produto, pré-preenche categoria/centro com o mapeamento contábil dele.
  function escolherProduto(id: string) {
    const p = produtos.find((x) => String(x.id) === id) || null;
    setF((s) => ({
      ...s,
      produtoId: id,
      categoriaId: p?.categoriaId != null ? String(p.categoriaId) : "",
      centroCustoId: p?.centroCustoId != null ? String(p.centroCustoId) : "",
    }));
  }

  async function salvar() {
    if (!f.produtoId) { setErro("Selecione um produto."); return; }
    if (!f.quantidade || Number(f.quantidade) === 0) { setErro("Informe a quantidade."); return; }
    setSalvando(true); setErro(null);
    try {
      const ehEntrada = f.tipo === "ENTRADA";
      const payload: MovimentoInput = {
        produtoId: Number(f.produtoId),
        tipo: f.tipo,
        data: f.data,
        quantidade: Number(f.quantidade),
        custoUnitario: f.custoUnitario ? Number(f.custoUnitario) : undefined,
        fornecedorId: ehEntrada && f.fornecedorId ? Number(f.fornecedorId) : undefined,
        grupoId: f.tipo === "SAIDA" && f.grupoId ? Number(f.grupoId) : undefined,
        observacao: f.observacao || undefined,
        gerarLancamento: ehEntrada ? f.gerarLancamento : undefined,
        categoriaId: ehEntrada && f.categoriaId ? Number(f.categoriaId) : undefined,
        centroCustoId: ehEntrada && f.centroCustoId ? Number(f.centroCustoId) : undefined,
      };
      const r = await registrarMovimento(payload);
      setResultado(r); // mostra o feedback no drawer; o usuário fecha (recarrega) quando quiser
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  // Após salvar, exibe o desfecho da ponte financeira e fecha (recarregando) ao confirmar.
  if (resultado) {
    return (
      <>
        <div className="rb-drawer-bg" onClick={onSalvo} />
        <aside className="rb-drawer">
          <h3>Movimento registrado</h3>
          {resultado.lancamentoCriado
            ? <p style={{ color: "var(--leite)", fontSize: 15 }}>✓ Lançamento gerado</p>
            : <p style={{ color: "var(--ink-3)", fontSize: 14 }}>Sem lançamento: {resultado.motivo ?? "não aplicável"}</p>}
          <div className="rb-drawer-actions">
            <button className="rb-btn pri" onClick={onSalvo}>Fechar</button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer">
        <h3>Registrar movimento</h3>
        <label className="rb-fld">Tipo<select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <label className="rb-fld">Produto*
          <select value={f.produtoId} onChange={(e) => escolherProduto(e.target.value)}>
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
        {f.tipo === "ENTRADA" && (
          <>
            <label className="rb-fld">Categoria
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
            <label className="rb-fld" style={{ flexDirection: "row", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
              <input type="checkbox" checked={f.gerarLancamento} onChange={(e) => set("gerarLancamento", e.target.checked)} style={{ width: "auto" }} />Gerar lançamento financeiro
            </label>
          </>
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
