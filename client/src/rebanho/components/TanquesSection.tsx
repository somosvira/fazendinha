import { useState } from "react";
import { useTanques, criarTanque, excluirTanque, registrarAnaliseTanque, type TanqueDTO } from "../api";
import { MiniBarChart } from "../../components/charts";

const hojeISO = () => new Date().toISOString().slice(0, 10);
const fmtData = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR");
const fmtMes = (iso: string) => {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
};

// Tanques de resfriamento + análise de tanque (qualidade do leite bulk): CCS/CBT, tendência
// e últimos valores por tanque. Complementa a análise de leite individual (#173).
export function TanquesSection() {
  const { data, loading, recarregar } = useTanques();
  const [novoAberto, setNovoAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  if (loading) return null;
  const tanques = data ?? [];

  async function salvarTanque(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro("Informe o nome do tanque."); return; }
    setErro(null);
    try {
      await criarTanque({ nome: nome.trim(), capacidadeLitros: capacidade.trim() ? Number(capacidade) : null });
      setNome(""); setCapacidade(""); setNovoAberto(false); recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao criar tanque."); }
  }
  async function removerTanque(id: number) { await excluirTanque(id); recarregar(); }

  return (
    <div className="mt-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-[11px] flex items-center justify-between">
        <h4 className="m-0 text-sm uppercase tracking-[.06em] text-ink-3">Tanques — análise de tanque</h4>
        {!novoAberto && <button onClick={() => setNovoAberto(true)} className="rounded bg-[color:var(--cafe)] px-3 py-1 text-sm font-semibold text-white">Novo tanque</button>}
      </div>

      {novoAberto && (
        <form onSubmit={salvarTanque} className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-ink-3">Nome
            <input className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Tanque 1" maxLength={80} />
          </label>
          <label className="flex flex-col text-xs text-ink-3">Capacidade (L)
            <input type="number" min={0} className="mt-0.5 w-28 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={capacidade} onChange={(e) => setCapacidade(e.target.value)} placeholder="opcional" />
          </label>
          <button type="submit" className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white">Salvar</button>
          <button type="button" onClick={() => setNovoAberto(false)} className="rounded border border-[color:var(--rule-soft)] px-3 py-1.5 text-sm text-ink-2">Cancelar</button>
        </form>
      )}
      {erro && <p className="mb-2 text-sm text-prejuizo">{erro}</p>}

      {tanques.length === 0 ? (
        !novoAberto && <p className="text-sm text-ink-3">Nenhum tanque cadastrado. Cadastre para registrar as análises de qualidade do leite bulk.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tanques.map((t) => <TanqueCard key={t.id} tanque={t} onMudou={recarregar} onExcluir={() => removerTanque(t.id)} />)}
        </div>
      )}
    </div>
  );
}

function TanqueCard({ tanque, onMudou, onExcluir }: { tanque: TanqueDTO; onMudou: () => void; onExcluir: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [ccs, setCcs] = useState("");
  const [cbt, setCbt] = useState("");
  const [gordura, setGordura] = useState("");
  const [proteina, setProteina] = useState("");
  const [salvando, setSalvando] = useState(false);
  const u = tanque.resumo.ultima;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await registrarAnaliseTanque(tanque.id, {
        data,
        ccs: ccs.trim() ? Number(ccs) : null, cbt: cbt.trim() ? Number(cbt) : null,
        gordura: gordura.trim() ? Number(gordura) : null, proteina: proteina.trim() ? Number(proteina) : null,
      });
      setCcs(""); setCbt(""); setGordura(""); setProteina(""); setAberto(false); onMudou();
    } finally { setSalvando(false); }
  }

  const trendCCS = tanque.resumo.tendenciaCCS.map((p) => ({ x: fmtMes(p.data), y: p.valor }));
  const trendCBT = tanque.resumo.tendenciaCBT.map((p) => ({ x: fmtMes(p.data), y: p.valor }));

  return (
    <div className="rounded border border-dashed border-[color:var(--rule-soft)] p-3">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-semibold text-[color:var(--ink)]">{tanque.nome}{tanque.capacidadeLitros != null ? <span className="text-ink-3"> · {tanque.capacidadeLitros.toLocaleString("pt-BR")} L</span> : null}</span>
        <span className="flex items-center gap-2 text-xs text-ink-3">
          {tanque.totalAnalises} análise(s)
          <button onClick={() => setAberto((v) => !v)} className="font-semibold text-[color:var(--cafe)] hover:underline">{aberto ? "cancelar" : "+ análise"}</button>
          <button onClick={onExcluir} className="text-ink-3 hover:text-prejuizo hover:underline" aria-label={`Excluir tanque ${tanque.nome}`}>excluir</button>
        </span>
      </div>

      {u && (
        <p className="mb-1.5 text-sm text-ink-2">
          última {fmtData(u.data)}: {u.ccs != null ? `CCS ${u.ccs} mil/mL` : ""}{u.ccs != null && u.cbt != null ? " · " : ""}{u.cbt != null ? `CBT ${u.cbt} mil UFC/mL` : ""}
          {u.gordura != null ? ` · gordura ${u.gordura}%` : ""}{u.proteina != null ? ` · proteína ${u.proteina}%` : ""}
        </p>
      )}

      {aberto && (
        <form onSubmit={salvar} className="mb-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-ink-3">Data<input type="date" className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={data} onChange={(e) => setData(e.target.value)} /></label>
          <label className="flex flex-col text-xs text-ink-3">CCS<input type="number" min={0} className="mt-0.5 w-24 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={ccs} onChange={(e) => setCcs(e.target.value)} placeholder="mil/mL" /></label>
          <label className="flex flex-col text-xs text-ink-3">CBT<input type="number" min={0} className="mt-0.5 w-24 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={cbt} onChange={(e) => setCbt(e.target.value)} placeholder="mil UFC" /></label>
          <label className="flex flex-col text-xs text-ink-3">Gordura %<input type="number" min={0} step="0.1" className="mt-0.5 w-20 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={gordura} onChange={(e) => setGordura(e.target.value)} /></label>
          <label className="flex flex-col text-xs text-ink-3">Proteína %<input type="number" min={0} step="0.1" className="mt-0.5 w-20 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={proteina} onChange={(e) => setProteina(e.target.value)} /></label>
          <button type="submit" disabled={salvando} className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Salvar análise</button>
        </form>
      )}

      {(trendCCS.length > 0 || trendCBT.length > 0) && (
        <div className="flex flex-wrap gap-6">
          {trendCCS.length > 0 && <div><p className="mb-0.5 text-xs uppercase tracking-[.06em] text-ink-3">Tendência CCS</p><MiniBarChart data={trendCCS} color="var(--cafe)" /></div>}
          {trendCBT.length > 0 && <div><p className="mb-0.5 text-xs uppercase tracking-[.06em] text-ink-3">Tendência CBT</p><MiniBarChart data={trendCBT} color="var(--outros)" /></div>}
        </div>
      )}
    </div>
  );
}
