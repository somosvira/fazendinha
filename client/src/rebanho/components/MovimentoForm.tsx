import { useEffect, useState } from "react";
import { registrarMovimento, listarProdutos, listarFornecedores, listarGrupos, type ProdutoDTO, type FornecedorDTO, type GrupoDTO, type MovimentoResult, type MovimentoInput } from "../api";
import { HOJE } from "../HOJE";
import { ProdutoForm } from "./ProdutoForm";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";

const TIPOS: { id: MovimentoInput["tipo"]; label: string }[] = [
  { id: "ENTRADA", label: "Entrada (compra)" },
  { id: "SAIDA", label: "Saída (consumo)" },
  { id: "AJUSTE", label: "Ajuste (inventário)" },
];

function money(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export function MovimentoForm({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorDTO[]>([]);
  const [grupos, setGrupos] = useState<GrupoDTO[]>([]);
  const [f, setF] = useState({ tipo: "ENTRADA" as MovimentoInput["tipo"], produtoId: "", data: HOJE, quantidade: "", fornecedorId: "", grupoId: "", observacao: "", gerarLancamento: true });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<MovimentoResult | null>(null);
  const [novoProduto, setNovoProduto] = useState(false);
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  async function carregarProdutos(selecionarId?: number) {
    const ps = await listarProdutos({ ativo: true });
    const estocaveis = ps.filter((p) => p.estocavel);
    setProdutos(estocaveis);
    if (selecionarId) setF((s) => ({ ...s, produtoId: String(selecionarId) }));
  }

  useEffect(() => {
    carregarProdutos().catch(() => {});
    listarFornecedores().then(setFornecedores).catch(() => {});
    listarGrupos().then(setGrupos).catch(() => {});
  }, []);

  const produtoSel = produtos.find((p) => String(p.id) === f.produtoId) || null;
  const semContabil = produtoSel && f.tipo === "ENTRADA" && (produtoSel.categoriaId == null || produtoSel.centroCustoId == null);

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
        fornecedorId: ehEntrada && f.fornecedorId ? Number(f.fornecedorId) : undefined,
        grupoId: f.tipo === "SAIDA" && f.grupoId ? Number(f.grupoId) : undefined,
        observacao: f.observacao || undefined,
        gerarLancamento: ehEntrada ? f.gerarLancamento : undefined,
      };
      const r = await registrarMovimento(payload);
      setResultado(r);
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  // Após salvar, mostra um recibo claro do que aconteceu.
  if (resultado) {
    const tipoLabel = TIPOS.find((t) => t.id === f.tipo)?.label.split(" ")[0] ?? f.tipo;
    const qtdNum = Number(f.quantidade);
    const valorTotal = produtoSel?.custoUnitario != null ? Number(produtoSel.custoUnitario) * Math.abs(qtdNum) : null;
    return (
      <RebModal
        title=""
        showClose={false}
        onClose={onSalvo}
        className="max-w-[440px]"
        actions={
          <div className="flex w-full justify-center">
            <RebButton variant="pri" onClick={onSalvo} style={{ minWidth: 140 }}>Fechar</RebButton>
          </div>
        }
      >
        <div className="rb-success-check">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="24" cy="24" r="21" />
            <path d="M15 24l7 7 12-14" />
          </svg>
        </div>
        <h3 style={{ textAlign: "center", margin: "14px 0 6px" }}>Movimento registrado</h3>
        <p style={{ textAlign: "center", color: "var(--ink-2)", fontSize: 14, margin: "0 0 18px" }}>
          <b style={{ color: "var(--ink)" }}>{tipoLabel}</b> de <b style={{ color: "var(--ink)" }}>{Math.abs(qtdNum).toLocaleString("pt-BR")} {produtoSel?.unidade}</b> de <b style={{ color: "var(--ink)" }}>{produtoSel?.nome}</b>
          {valorTotal != null && f.tipo === "ENTRADA" && <> · {money(valorTotal)}</>}
        </p>
        <div className="rb-success-line">
          {resultado.lancamentoCriado ? (
            <>
              <span className="rb-success-dot ok">✓</span>
              <div>
                <b>Lançamento financeiro gerado</b>
                <div style={{ color: "var(--ink-3)", fontSize: 12.5 }}>O custo foi registrado no fluxo de caixa.</div>
              </div>
            </>
          ) : (
            <>
              <span className="rb-success-dot off">—</span>
              <div>
                <b>Sem lançamento financeiro</b>
                <div style={{ color: "var(--ink-3)", fontSize: 12.5 }}>{resultado.motivo ?? "não aplicável pra esse tipo de movimento"}</div>
              </div>
            </>
          )}
        </div>
      </RebModal>
    );
  }

  return (
    <>
      <RebModal
        title="Registrar movimento"
        onClose={onFechar}
        actions={
          <>
            <RebButton onClick={onFechar}>Cancelar</RebButton>
            <RebButton variant="pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
          </>
        }
      >
        <label className="rb-fld">Tipo<select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>

        <div className="rb-fld">
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            Produto*
            <button type="button" onClick={() => setNovoProduto(true)} style={{ background: "transparent", border: 0, color: "var(--cafe)", fontSize: 12.5, fontFamily: "var(--sans)", fontStyle: "normal", cursor: "pointer", padding: 0 }}>+ novo produto</button>
          </span>
          <select value={f.produtoId} onChange={(e) => set("produtoId", e.target.value)}>
            <option value="">Selecione…</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}
          </select>
        </div>

        {produtoSel && (
          <div style={{ marginTop: -6, marginBottom: 14, fontSize: 12.5, color: "var(--ink-3)", fontFamily: "var(--sans)" }}>
            {produtoSel.custoUnitario != null
              ? <>Custo cadastrado: <b style={{ color: "var(--ink-2)" }}>{money(Number(produtoSel.custoUnitario))}</b> / {produtoSel.unidade}</>
              : <span style={{ color: "var(--neg)" }}>Sem custo cadastrado — edite o produto pra definir.</span>}
            {semContabil && <span style={{ display: "block", color: "var(--neg)", marginTop: 4 }}>Falta categoria ou centro de custo no produto — o lançamento financeiro pode não ser gerado.</span>}
          </div>
        )}

        <label className="rb-fld">Data*<input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} /></label>
        <label className="rb-fld">Quantidade*{f.tipo === "AJUSTE" && <small style={{ color: "var(--ink-3)", fontStyle: "normal", marginLeft: 4 }}>— negativo subtrai</small>}<input type="number" step="0.01" value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} /></label>
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
          <label className="rb-fld" style={{ flexDirection: "row", alignItems: "center", gap: 8, fontStyle: "normal" }}>
            <input type="checkbox" checked={f.gerarLancamento} onChange={(e) => set("gerarLancamento", e.target.checked)} style={{ width: "auto" }} />Gerar lançamento financeiro
          </label>
        )}
        <label className="rb-fld">Observação<input value={f.observacao} onChange={(e) => set("observacao", e.target.value)} maxLength={200} /></label>
        {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      </RebModal>
      {novoProduto && (
        <ProdutoForm
          stacked
          onFechar={() => setNovoProduto(false)}
          onSalvo={(criado) => { setNovoProduto(false); carregarProdutos(criado?.id).catch(() => {}); }}
        />
      )}
    </>
  );
}
