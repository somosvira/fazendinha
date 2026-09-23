import { useEffect, useState } from "react";
import { listarProdutos, obterComposicaoRacao, definirComposicaoRacao, type ProdutoDTO, type ComposicaoRacaoDTO } from "../api";

type ItemEdit = { ingredienteId: string; proporcao: string };

// Composição / receita de uma ração formulada: escolhe um produto → lista de ingredientes (outros
// produtos) com proporção %. Mostra a soma e alerta se ≠ 100%. Espelha "Composição de produto".
export function ComposicaoRacaoSection() {
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [produtoId, setProdutoId] = useState("");
  const [itens, setItens] = useState<ItemEdit[]>([]);
  const [comp, setComp] = useState<ComposicaoRacaoDTO | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { listarProdutos({ ativo: true }).then(setProdutos).catch(() => setProdutos([])); }, []);
  useEffect(() => {
    if (!produtoId) { setComp(null); setItens([]); return; }
    obterComposicaoRacao(Number(produtoId))
      .then((c) => { setComp(c); setItens(c.itens.map((i) => ({ ingredienteId: String(i.ingredienteId), proporcao: String(i.proporcao) }))); })
      .catch(() => { setComp(null); setItens([]); });
  }, [produtoId]);

  function setItem(i: number, patch: Partial<ItemEdit>) { setItens((es) => es.map((e, j) => (j === i ? { ...e, ...patch } : e))); }
  function addItem() { setItens((es) => [...es, { ingredienteId: "", proporcao: "" }]); }
  function removeItem(i: number) { setItens((es) => es.filter((_, j) => j !== i)); }

  const soma = itens.reduce((s, i) => s + (i.proporcao.trim() ? Number(i.proporcao) : 0), 0);
  const somaArred = Math.round(soma * 1000) / 1000;
  const outros = produtos.filter((p) => String(p.id) !== produtoId);

  async function salvar() {
    if (!produtoId) return;
    setSalvando(true); setErro(null);
    try {
      const limpos = itens
        .filter((i) => i.ingredienteId && i.proporcao.trim() !== "")
        .map((i) => ({ ingredienteId: Number(i.ingredienteId), proporcao: Number(i.proporcao) }));
      const c = await definirComposicaoRacao(Number(produtoId), limpos);
      setComp(c);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar receita."); }
    finally { setSalvando(false); }
  }

  return (
    <div className="mt-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Composição de ração (receita)</h4>

      <select className="mb-3 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
        <option value="">selecione o produto (ração)…</option>
        {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>

      {produtoId && (
        <>
          <div className="mb-2 flex flex-col gap-1.5">
            {itens.map((it, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select className="min-w-[180px] flex-1 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={it.ingredienteId} onChange={(e) => setItem(i, { ingredienteId: e.target.value })} aria-label={`Ingrediente ${i + 1}`}>
                  <option value="">ingrediente…</option>
                  {outros.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <input type="number" min={0} max={100} step="0.1" className="w-24 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={it.proporcao} onChange={(e) => setItem(i, { proporcao: e.target.value })} placeholder="%" aria-label={`Proporção ${i + 1}`} />
                <button type="button" onClick={() => removeItem(i)} className="text-sm text-ink-3 hover:text-prejuizo" aria-label={`Remover ingrediente ${i + 1}`}>×</button>
              </div>
            ))}
            <button type="button" onClick={addItem} className="self-start text-sm font-semibold text-[color:var(--cafe)] hover:underline">+ ingrediente</button>
          </div>

          <p className={`mb-2 text-sm ${Math.abs(somaArred - 100) <= 0.5 ? "text-[color:var(--lucro)]" : "text-prejuizo"}`}>
            Soma: <b className="tabular-nums">{somaArred}%</b> {Math.abs(somaArred - 100) <= 0.5 ? "✓" : "(deveria fechar em 100%)"}
          </p>
          {erro && <p className="mb-2 text-sm text-prejuizo">{erro}</p>}
          <button onClick={salvar} disabled={salvando} className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Salvar receita</button>
          {comp && <p className="mt-2 text-xs text-ink-3">{comp.resumo.nIngredientes} ingrediente(s) salvos.</p>}
        </>
      )}
    </div>
  );
}
