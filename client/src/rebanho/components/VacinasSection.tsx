import { useState } from "react";
import { useVacinas, agendarVacina, marcarVacinaAplicada, excluirVacina, type StatusVacina } from "../api";
import { getHojeISO } from "../../lib/hoje";
import { CampoData } from "@/components/CampoData";

const fmtData = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR") : "—");

// Cor/rótulo do status da vacina. Vencida = prejuízo (ação atrasada); próxima = âmbar; aplicada/em dia = neutro.
const STATUS: Record<StatusVacina, { label: string; cls: string }> = {
  vencida: { label: "vencida", cls: "text-prejuizo" },
  proxima: { label: "próxima", cls: "text-[color:var(--cafe)]" },
  emdia: { label: "em dia", cls: "text-ink-3" },
  aplicada: { label: "aplicada", cls: "text-lucro" },
};

export function VacinasSection({ animalId }: { animalId: string }) {
  const { data, loading, recarregar } = useVacinas(animalId);
  const [vacina, setVacina] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (loading) return null;
  const vacinas = data ?? [];

  async function agendar(e: React.FormEvent) {
    e.preventDefault();
    if (!vacina.trim() || !dataPrevista) return;
    setSalvando(true); setErro(null);
    try {
      await agendarVacina(animalId, { vacina: vacina.trim(), dataPrevista });
      setVacina(""); setDataPrevista(""); recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao agendar."); }
    finally { setSalvando(false); }
  }

  async function aplicar(id: number) { await marcarVacinaAplicada(id, getHojeISO()); recarregar(); }
  async function remover(id: number) { await excluirVacina(id); recarregar(); }

  return (
    <div className="mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Vacinação</h4>

      <form onSubmit={agendar} className="mb-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-ink-3">
          Vacina
          <input className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={vacina} onChange={(e) => setVacina(e.target.value)} placeholder="Aftosa, Brucelose…" maxLength={80} />
        </label>
        <label className="flex flex-col text-xs text-ink-3">
          Prevista para
          <CampoData variante="sublinhado" className="mt-0.5 w-36 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-[color:var(--ink)]" aria-label="Prevista para" value={dataPrevista} onChange={setDataPrevista} />
        </label>
        <button type="submit" disabled={salvando || !vacina.trim() || !dataPrevista} className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          Agendar
        </button>
      </form>
      {erro && <p className="mb-2 text-sm text-prejuizo">{erro}</p>}

      {vacinas.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhuma vacina agendada.</p>
      ) : (
        <div className="flex flex-col">
          {vacinas.map((v) => (
            <div key={v.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-dashed border-[color:var(--rule-soft)] py-[6px] text-sm last:border-0">
              <span className="shrink-0 font-semibold text-[color:var(--ink)]">{v.vacina}</span>
              <span className="flex-1 text-ink-2">
                {fmtData(v.dataPrevista)} · <b className={`font-semibold ${STATUS[v.status].cls}`}>{STATUS[v.status].label}</b>
                {v.aplicadaEm ? ` · aplicada ${fmtData(v.aplicadaEm)}` : ""}
              </span>
              <span className="flex shrink-0 gap-2">
                {v.status !== "aplicada" && (
                  <button onClick={() => aplicar(v.id)} className="text-sm font-semibold text-lucro hover:underline">marcar aplicada</button>
                )}
                <button onClick={() => remover(v.id)} className="text-sm text-ink-3 hover:text-prejuizo hover:underline" aria-label={`Excluir vacina ${v.vacina}`}>excluir</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
