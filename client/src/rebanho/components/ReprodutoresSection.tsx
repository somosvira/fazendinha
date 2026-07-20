import { useEffect, useState } from "react";
import {
  useReprodutores, criarReprodutor, excluirReprodutor,
  listarCentraisSemen, criarCentralSemen, listarRacas,
  type CentralSemenDTO, type RacaDTO,
} from "../api";
import { PromptDialog } from "@/components/PromptDialog";

// Biblioteca de reprodutores (touros): nome, raça, central de sêmen e índices genéticos (PTAs).
// Base para escolha de touro e para a recomendação de acasalamento. Espelha ANIMALINFO_REPRODUTOR.
export function ReprodutoresSection() {
  const { data, loading, recarregar } = useReprodutores(true);
  const [centrais, setCentrais] = useState<CentralSemenDTO[]>([]);
  const [racas, setRacas] = useState<RacaDTO[]>([]);
  const [aberto, setAberto] = useState(false);
  const [promptCentralAberto, setPromptCentralAberto] = useState(false);
  const [f, setF] = useState({ nome: "", codigo: "", racaId: "", centralSemenId: "", ptaLeite: "", ptaGordura: "", ptaProteina: "", tpi: "" });
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { listarCentraisSemen().then(setCentrais).catch(() => setCentrais([])); listarRacas().then(setRacas).catch(() => setRacas([])); }, []);
  if (loading) return null;
  const lista = data?.reprodutores ?? [];
  const resumo = data?.resumo;

  function set(k: keyof typeof f, v: string) { setF((s) => ({ ...s, [k]: v })); }
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim()) { setErro("Informe o nome do reprodutor."); return; }
    setErro(null);
    try {
      await criarReprodutor({
        nome: f.nome.trim(), codigo: f.codigo.trim() || null,
        racaId: f.racaId ? Number(f.racaId) : null, centralSemenId: f.centralSemenId ? Number(f.centralSemenId) : null,
        ptaLeite: numOrNull(f.ptaLeite), ptaGordura: numOrNull(f.ptaGordura), ptaProteina: numOrNull(f.ptaProteina), tpi: numOrNull(f.tpi),
      });
      setF({ nome: "", codigo: "", racaId: "", centralSemenId: "", ptaLeite: "", ptaGordura: "", ptaProteina: "", tpi: "" });
      setAberto(false); recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao salvar."); }
  }
  async function excluir(id: number) { await excluirReprodutor(id); recarregar(); }
  async function confirmarNovaCentral(nome: string) {
    setPromptCentralAberto(false);
    await criarCentralSemen({ nome });
    listarCentraisSemen().then(setCentrais).catch(() => {});
  }

  return (
    <div className="mb-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-[11px] flex items-center justify-between">
        <h4 className="mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Biblioteca de reprodutores</h4>
        {!aberto && <button onClick={() => setAberto(true)} className="rounded bg-[color:var(--cafe)] px-3 py-1 text-sm font-semibold text-white">Novo reprodutor</button>}
      </div>

      {resumo && resumo.total > 0 && (
        <p className="mb-2 text-sm text-ink-3">
          {resumo.total} touros{resumo.mediaPtaLeite != null ? ` · PTA leite médio ${resumo.mediaPtaLeite}` : ""}{resumo.mediaTpi != null ? ` · TPI médio ${resumo.mediaTpi}` : ""}
        </p>
      )}

      {aberto && (
        <form onSubmit={salvar} className="mb-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-1 flex-col text-xs text-ink-3">Nome<input className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.nome} onChange={(e) => set("nome", e.target.value)} maxLength={120} /></label>
            <label className="flex flex-col text-xs text-ink-3">Código<input className="mt-0.5 w-28 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.codigo} onChange={(e) => set("codigo", e.target.value)} maxLength={60} /></label>
            <label className="flex flex-col text-xs text-ink-3">Raça
              <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.racaId} onChange={(e) => set("racaId", e.target.value)}>
                <option value="">—</option>{racas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-xs text-ink-3">Central
              <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.centralSemenId} onChange={(e) => set("centralSemenId", e.target.value)}>
                <option value="">—</option>{centrais.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => setPromptCentralAberto(true)} className="pb-1 text-xs text-[color:var(--cafe)] hover:underline">+ central</button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-ink-3">PTA leite<input type="number" className="mt-0.5 w-24 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.ptaLeite} onChange={(e) => set("ptaLeite", e.target.value)} /></label>
            <label className="flex flex-col text-xs text-ink-3">PTA gordura<input type="number" step="0.01" className="mt-0.5 w-24 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.ptaGordura} onChange={(e) => set("ptaGordura", e.target.value)} /></label>
            <label className="flex flex-col text-xs text-ink-3">PTA proteína<input type="number" step="0.01" className="mt-0.5 w-24 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.ptaProteina} onChange={(e) => set("ptaProteina", e.target.value)} /></label>
            <label className="flex flex-col text-xs text-ink-3">TPI<input type="number" className="mt-0.5 w-20 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.tpi} onChange={(e) => set("tpi", e.target.value)} /></label>
          </div>
          {erro && <p className="text-sm text-prejuizo">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white">Salvar</button>
            <button type="button" onClick={() => setAberto(false)} className="rounded border border-[color:var(--rule-soft)] px-3 py-1.5 text-sm text-ink-2">Cancelar</button>
          </div>
        </form>
      )}

      {lista.length === 0 ? (
        !aberto && <p className="text-sm text-ink-3">Nenhum reprodutor cadastrado. Cadastre touros com seus índices genéticos.</p>
      ) : (
        <div className="flex flex-col">
          {lista.map((r) => (
            <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-dashed border-[color:var(--rule-soft)] py-[7px] text-sm last:border-0">
              <span className={`shrink-0 font-semibold ${r.ativo ? "text-[color:var(--ink)]" : "text-ink-3 line-through"}`}>{r.nome}{r.codigo ? <span className="text-ink-3"> · {r.codigo}</span> : ""}</span>
              <span className="flex-1 text-ink-2">
                {[r.racaNome, r.centralNome].filter(Boolean).join(" · ")}
                {r.ptaLeite != null ? ` · leite ${r.ptaLeite}` : ""}{r.tpi != null ? ` · TPI ${r.tpi}` : ""}
              </span>
              <button onClick={() => excluir(r.id)} className="shrink-0 text-sm text-ink-3 hover:text-prejuizo hover:underline" aria-label={`Excluir ${r.nome}`}>excluir</button>
            </div>
          ))}
        </div>
      )}

      <PromptDialog
        open={promptCentralAberto}
        title="Nova central de sêmen"
        label="Nome da central"
        placeholder="Ex.: Alta Genetics · Semex"
        onConfirm={confirmarNovaCentral}
        onCancel={() => setPromptCentralAberto(false)}
      />
    </div>
  );
}
