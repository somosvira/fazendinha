import { useEffect, useState } from "react";
import {
  usePrincipiosAtivos, criarPrincipioAtivo, atualizarPrincipioAtivo, excluirPrincipioAtivo,
  listarProdutos, obterComposicaoProduto, definirComposicaoProduto,
  type PrincipioAtivoDTO, type ProdutoDTO, type ComposicaoProdutoDTO,
} from "../api";

// Catálogo de princípios ativos + composição de medicamentos. Base para carência/antibiótico:
// um medicamento tem 1+ princípios; a carência efetiva do leite/carne deriva da composição.
export function PrincipiosAtivosSection() {
  const { data, loading, recarregar } = usePrincipiosAtivos(true);
  const [aberto, setAberto] = useState<number | "novo" | null>(null);
  const [nome, setNome] = useState("");
  const [ehAntibiotico, setEhAntibiotico] = useState(false);
  const [carLeite, setCarLeite] = useState("");
  const [carCarne, setCarCarne] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (loading) return null;
  const lista = data ?? [];

  function abrirNovo() { setAberto("novo"); setNome(""); setEhAntibiotico(false); setCarLeite(""); setCarCarne(""); setErro(null); }
  function abrirEdicao(p: PrincipioAtivoDTO) {
    setAberto(p.id); setNome(p.nome); setEhAntibiotico(p.ehAntibiotico);
    setCarLeite(p.carenciaLeiteHoras != null ? String(p.carenciaLeiteHoras) : "");
    setCarCarne(p.carenciaCarneDias != null ? String(p.carenciaCarneDias) : ""); setErro(null);
  }
  function fechar() { setAberto(null); setErro(null); }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro("Informe o nome do princípio ativo."); return; }
    setSalvando(true); setErro(null);
    try {
      const body = {
        nome: nome.trim(), ehAntibiotico,
        carenciaLeiteHoras: carLeite.trim() === "" ? null : Number(carLeite),
        carenciaCarneDias: carCarne.trim() === "" ? null : Number(carCarne),
      };
      if (aberto === "novo") await criarPrincipioAtivo(body);
      else if (typeof aberto === "number") await atualizarPrincipioAtivo(aberto, body);
      fechar(); recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao salvar."); }
    finally { setSalvando(false); }
  }

  async function excluir(id: number) { await excluirPrincipioAtivo(id); recarregar(); }
  async function toggleAtivo(p: PrincipioAtivoDTO) { await atualizarPrincipioAtivo(p.id, { ativo: !p.ativo }); recarregar(); }

  return (
    <div className="mt-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-[11px] flex items-center justify-between">
        <h4 className="mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Princípios ativos</h4>
        {aberto === null && <button onClick={abrirNovo} className="rounded bg-[color:var(--cafe)] px-3 py-1 text-sm font-semibold text-white">Novo princípio</button>}
      </div>

      {aberto !== null ? (
        <form onSubmit={salvar} className="mb-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-1 flex-col text-xs text-ink-3">Nome
              <input className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Amoxicilina" maxLength={120} />
            </label>
            <label className="flex flex-col text-xs text-ink-3">Carência leite (h)
              <input type="number" min={0} className="mt-0.5 w-28 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={carLeite} onChange={(e) => setCarLeite(e.target.value)} placeholder="—" />
            </label>
            <label className="flex flex-col text-xs text-ink-3">Carência carne (d)
              <input type="number" min={0} className="mt-0.5 w-28 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={carCarne} onChange={(e) => setCarCarne(e.target.value)} placeholder="—" />
            </label>
            <label className="flex items-center gap-1.5 pb-1.5 text-sm text-ink-2">
              <input type="checkbox" checked={ehAntibiotico} onChange={(e) => setEhAntibiotico(e.target.checked)} /> Antibiótico
            </label>
          </div>
          {erro && <p className="text-sm text-prejuizo">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={salvando} className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Salvar</button>
            <button type="button" onClick={fechar} className="rounded border border-[color:var(--rule-soft)] px-3 py-1.5 text-sm text-ink-2">Cancelar</button>
          </div>
        </form>
      ) : lista.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhum princípio ativo cadastrado. Cadastre para compor os medicamentos e calcular a carência.</p>
      ) : (
        <div className="mb-3 flex flex-col">
          {lista.map((p) => (
            <div key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-dashed border-[color:var(--rule-soft)] py-[7px] text-sm last:border-0">
              <span className={`shrink-0 font-semibold ${p.ativo ? "text-[color:var(--ink)]" : "text-ink-3 line-through"}`}>
                {p.nome}{p.ehAntibiotico && <span className="ml-1.5 rounded bg-[#FBEDEB] px-1.5 py-0.5 text-xs font-semibold text-[color:var(--prejuizo)]">ATB</span>}
              </span>
              <span className="flex-1 text-ink-2">
                {p.carenciaLeiteHoras != null ? `leite ${p.carenciaLeiteHoras}h` : ""}{p.carenciaLeiteHoras != null && p.carenciaCarneDias != null ? " · " : ""}{p.carenciaCarneDias != null ? `carne ${p.carenciaCarneDias}d` : ""}
                {p.usoEmProdutos > 0 ? <span className="text-ink-3"> · em {p.usoEmProdutos} produto(s)</span> : ""}
              </span>
              <span className="flex shrink-0 gap-2">
                <button onClick={() => abrirEdicao(p)} className="text-sm font-semibold text-[color:var(--cafe)] hover:underline">editar</button>
                <button onClick={() => toggleAtivo(p)} className="text-sm text-ink-3 hover:underline">{p.ativo ? "inativar" : "reativar"}</button>
                <button onClick={() => excluir(p.id)} className="text-sm text-ink-3 hover:text-prejuizo hover:underline" aria-label={`Excluir ${p.nome}`}>excluir</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <ComposicaoEditor principios={lista.filter((p) => p.ativo)} onMudou={recarregar} />
    </div>
  );
}

// Editor da composição de um produto: escolhe um medicamento, marca seus princípios ativos e
// vê a carência sugerida derivada (o máximo entre os princípios).
function ComposicaoEditor({ principios, onMudou }: { principios: PrincipioAtivoDTO[]; onMudou: () => void }) {
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [produtoId, setProdutoId] = useState("");
  const [comp, setComp] = useState<ComposicaoProdutoDTO | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { listarProdutos({ tipo: "MEDICAMENTO", ativo: true }).then(setProdutos).catch(() => setProdutos([])); }, []);
  useEffect(() => {
    if (!produtoId) { setComp(null); setSel(new Set()); return; }
    obterComposicaoProduto(Number(produtoId)).then((c) => { setComp(c); setSel(new Set(c.principios.map((p) => p.principioAtivoId))); }).catch(() => setComp(null));
  }, [produtoId]);

  function toggle(id: number) {
    setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function salvar() {
    if (!produtoId) return;
    setSalvando(true);
    try {
      const c = await definirComposicaoProduto(Number(produtoId), [...sel].map((principioAtivoId) => ({ principioAtivoId })));
      setComp(c); onMudou();
    } catch { /* erro silencioso; a lista fica como está */ }
    finally { setSalvando(false); }
  }

  return (
    <div className="border-t border-[color:var(--rule-soft)] pt-3">
      <p className="mb-2 text-xs uppercase tracking-[.06em] text-ink-3">Composição de um medicamento</p>
      <select className="mb-2 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
        <option value="">selecione um medicamento…</option>
        {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>

      {produtoId && (
        <>
          {principios.length === 0 ? (
            <p className="text-sm text-ink-3">Cadastre princípios ativos acima para compor este medicamento.</p>
          ) : (
            <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
              {principios.map((p) => (
                <label key={p.id} className="flex items-center gap-1.5 text-sm text-ink-2">
                  <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} /> {p.nome}
                </label>
              ))}
            </div>
          )}
          {comp && (
            <p className="mb-2 text-sm text-ink-3">
              {comp.ehAntibiotico ? <b className="text-[color:var(--prejuizo)]">Antibiótico</b> : "Não antibiótico"}
              {comp.carenciaLeiteHorasSugerida != null ? ` · carência leite sugerida ${comp.carenciaLeiteHorasSugerida}h` : ""}
              {comp.carenciaCarneDiasSugerida != null ? ` · carne ${comp.carenciaCarneDiasSugerida}d` : ""}
            </p>
          )}
          <button onClick={salvar} disabled={salvando} className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Salvar composição</button>
        </>
      )}
    </div>
  );
}
