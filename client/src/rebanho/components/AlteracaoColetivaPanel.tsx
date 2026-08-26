import { useEffect, useMemo, useState } from "react";
import {
  listarAnimais, listarGrupos, useSetores, alterarAnimaisColetivo,
  type GrupoDTO,
} from "../api";
import type { Animal, FinalidadeAnimal } from "../types";
import { AnimalIdentity } from "./AnimalIdentity";

// Alteração coletiva: filtra os animais e aplica grupo, localização e/ou finalidade produtiva.
// O backend grava movimentações quando grupo/localização mudam. Painel próprio (lista leve com
// seleção), sem mexer na lista compartilhada (HerdDomainView).
export function AlteracaoColetivaPanel({ onFechar, onAplicado }: { onFechar: () => void; onAplicado?: () => void }) {
  const [grupos, setGrupos] = useState<GrupoDTO[]>([]);
  const { data: setores } = useSetores();
  const [filtroSetor, setFiltroSetor] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [filtroFinalidade, setFiltroFinalidade] = useState("");
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [destinoGrupo, setDestinoGrupo] = useState("");
  const [destinoSetor, setDestinoSetor] = useState("");
  const [destinoFinalidade, setDestinoFinalidade] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => { listarGrupos().then(setGrupos).catch(() => setGrupos([])); }, []);

  // Carrega os animais ativos que batem com o filtro (grupo/setor).
  useEffect(() => {
    setCarregando(true); setOk(null);
    listarAnimais({ status: "ATIVO", grupoId: filtroGrupo ? Number(filtroGrupo) : undefined, setor: filtroSetor || undefined, finalidade: (filtroFinalidade || undefined) as FinalidadeAnimal | undefined })
      .then((as) => { setAnimais(as); setSel(new Set()); })
      .catch(() => setAnimais([]))
      .finally(() => setCarregando(false));
  }, [filtroGrupo, filtroSetor, filtroFinalidade]);

  const todosSelecionados = animais.length > 0 && sel.size === animais.length;
  function toggle(id: number) { setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleTodos() { setSel(todosSelecionados ? new Set() : new Set(animais.map((a) => Number(a.id)))); }

  const temDestino = destinoGrupo !== "" || destinoSetor !== "" || destinoFinalidade !== "";
  const podeAplicar = sel.size > 0 && temDestino && !salvando;

  async function aplicar() {
    if (!podeAplicar) return;
    setSalvando(true); setErro(null); setOk(null);
    try {
      const patch: { grupoId?: number | null; setor?: string | null; finalidade?: FinalidadeAnimal } = {};
      if (destinoGrupo !== "") patch.grupoId = Number(destinoGrupo);
      if (destinoSetor !== "") patch.setor = destinoSetor;
      if (destinoFinalidade !== "") patch.finalidade = destinoFinalidade as FinalidadeAnimal;
      const r = await alterarAnimaisColetivo([...sel].map(Number), patch);
      setOk(`${r.atualizados} animais alterados · ${r.movimentacoes} movimentação(ões) registrada(s).`);
      onAplicado?.();
      // recarrega a lista com o filtro atual (os animais podem ter saído do filtro)
      const as = await listarAnimais({ status: "ATIVO", grupoId: filtroGrupo ? Number(filtroGrupo) : undefined, setor: filtroSetor || undefined, finalidade: (filtroFinalidade || undefined) as FinalidadeAnimal | undefined });
      setAnimais(as); setSel(new Set());
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao aplicar."); }
    finally { setSalvando(false); }
  }

  const nomeGrupo = useMemo(() => Object.fromEntries(grupos.map((g) => [g.id, g.nome])), [grupos]);

  return (
    <div className="mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-[11px] flex items-center justify-between">
        <h4 className="m-0 text-sm uppercase tracking-[.06em] text-ink-3">Alteração coletiva</h4>
        <button onClick={onFechar} className="text-sm text-ink-3 hover:underline">fechar</button>
      </div>

      {/* Filtro de origem */}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-ink-3">Filtrar por grupo
          <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}>
            <option value="">todos</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs text-ink-3">Filtrar por localização
          <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)}>
            <option value="">todos</option>
            {(setores ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs text-ink-3">Filtrar por finalidade
          <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={filtroFinalidade} onChange={(e) => setFiltroFinalidade(e.target.value)}>
            <option value="">todas</option><option value="LEITE">leite</option><option value="CORTE">corte</option><option value="DUPLA_APTIDAO">dupla aptidão</option><option value="NAO_INFORMADA">não informada</option>
          </select>
        </label>
      </div>

      {/* Lista com seleção */}
      {carregando ? (
        <p className="text-sm text-ink-3">carregando animais…</p>
      ) : animais.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhum animal ativo com esse filtro.</p>
      ) : (
        <div className="mb-3 max-h-64 overflow-auto rounded border border-[color:var(--rule-soft)]">
          <label className="flex items-center gap-2 border-b border-[color:var(--rule-soft)] px-3 py-1.5 text-sm font-semibold text-ink-2">
            <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} /> selecionar todos ({animais.length})
          </label>
          {animais.map((a) => (
            <label key={a.id} className="flex items-center gap-2 border-b border-dashed border-[color:var(--rule-soft)] px-3 py-1 text-sm last:border-0">
              <input type="checkbox" checked={sel.has(Number(a.id))} onChange={() => toggle(Number(a.id))} />
              <AnimalIdentity numero={a.numero} nome={a.nome} />
              <span className="ml-auto text-xs text-ink-3">{a.grupoId != null ? nomeGrupo[a.grupoId] ?? "" : "sem grupo"}{a.setor ? ` · ${a.setor}` : ""}</span>
            </label>
          ))}
        </div>
      )}

      {/* Destino */}
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-ink-3">Novo grupo
          <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={destinoGrupo} onChange={(e) => setDestinoGrupo(e.target.value)}>
            <option value="">(não mexer)</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs text-ink-3">Nova localização
          <input className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={destinoSetor} onChange={(e) => setDestinoSetor(e.target.value)} placeholder="(não mexer)" list="setores-lista" maxLength={40} />
          <datalist id="setores-lista">{(setores ?? []).map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label className="flex flex-col text-xs text-ink-3">Nova finalidade
          <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={destinoFinalidade} onChange={(e) => setDestinoFinalidade(e.target.value)}>
            <option value="">(não mexer)</option><option value="LEITE">leite</option><option value="CORTE">corte</option><option value="DUPLA_APTIDAO">dupla aptidão</option><option value="NAO_INFORMADA">não informada</option>
          </select>
        </label>
        <button onClick={aplicar} disabled={!podeAplicar} className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          Aplicar a {sel.size} {sel.size === 1 ? "animal" : "animais"}
        </button>
      </div>
      {erro && <p className="text-sm text-prejuizo">{erro}</p>}
      {ok && <p className="text-sm text-[color:var(--lucro)]">{ok}</p>}
    </div>
  );
}
