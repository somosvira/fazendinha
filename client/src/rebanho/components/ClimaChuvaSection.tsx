import { useState } from "react";
import { MiniBarChart } from "../../components/charts";
import { useChuva, registrarChuva, excluirChuva } from "../api";
import { getHojeISO } from "../../lib/hoje";

const fmtData = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR");
const mm = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
// Rótulo curto do mês (YYYY-MM → "mar/26") para o eixo x do gráfico.
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m: string) => {
  const [ano, mesN] = m.split("-");
  return `${MESES[Number(mesN) - 1]}/${ano.slice(2)}`;
};

// Clima / registro de chuva (pluviômetro): mm por dia → acumulado mensal. Só o pluviômetro —
// sem estação meteorológica, sem temperatura. Espelha "Clima / registro de chuva" do IDEagri.
export function ClimaChuvaSection() {
  const { data, loading, recarregar } = useChuva();
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({ data: getHojeISO(), mm: "", observacao: "" });
  const [erro, setErro] = useState<string | null>(null);

  if (loading) return null;
  const registros = data?.registros ?? [];
  const resumo = data?.resumo;

  function set(k: keyof typeof f, v: string) { setF((s) => ({ ...s, [k]: v })); }
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.data || f.mm.trim() === "") { setErro("Informe a data e os mm de chuva."); return; }
    const valor = Number(f.mm);
    if (!Number.isFinite(valor) || valor < 0) { setErro("mm deve ser um número ≥ 0."); return; }
    setErro(null);
    try {
      await registrarChuva({ data: f.data, mm: valor, observacao: f.observacao.trim() || null });
      setF({ data: getHojeISO(), mm: "", observacao: "" }); setAberto(false); recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao registrar chuva."); }
  }
  async function excluir(id: number) { await excluirChuva(id); recarregar(); }

  const grafico = (resumo?.meses ?? []).map((m) => ({ x: rotuloMes(m.mes), y: m.total }));

  return (
    <div className="mt-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-[11px] flex items-center justify-between">
        <h4 className="m-0 text-sm uppercase tracking-[.06em] text-ink-3">Clima · registro de chuva</h4>
        {!aberto && <button onClick={() => setAberto(true)} className="rounded bg-[color:var(--cafe)] px-3 py-1 text-sm font-semibold text-white">Registrar chuva</button>}
      </div>

      {resumo && resumo.diasComChuva > 0 && (
        <p className="mb-2 text-sm text-ink-3">
          {mm(resumo.total)} mm no total · {resumo.diasComChuva} dia(s) com chuva
        </p>
      )}

      {aberto && (
        <form onSubmit={salvar} className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-ink-3">Data<input type="date" className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.data} onChange={(e) => set("data", e.target.value)} /></label>
          <label className="flex flex-col text-xs text-ink-3">Chuva (mm)<input type="number" min={0} step="0.1" className="mt-0.5 w-24 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.mm} onChange={(e) => set("mm", e.target.value)} /></label>
          <label className="flex flex-col text-xs text-ink-3">Observação<input className="mt-0.5 w-48 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm" value={f.observacao} onChange={(e) => set("observacao", e.target.value)} maxLength={200} /></label>
          <button type="submit" className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white">Salvar</button>
          <button type="button" onClick={() => setAberto(false)} className="rounded border border-[color:var(--rule-soft)] px-3 py-1.5 text-sm text-ink-2">Cancelar</button>
        </form>
      )}
      {erro && <p className="mb-2 text-sm text-prejuizo">{erro}</p>}

      {registros.length === 0 ? (
        !aberto && <p className="text-sm text-ink-3">Nenhum registro de chuva. Registre o pluviômetro para acompanhar o acumulado mensal.</p>
      ) : (
        <>
          {grafico.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs uppercase tracking-[.06em] text-ink-3">Acumulado mensal (mm)</p>
              <MiniBarChart data={grafico} color="var(--leite)" />
            </div>
          )}
          <div className="flex flex-col">
            {registros.map((r) => (
              <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-dashed border-[color:var(--rule-soft)] py-[7px] text-sm last:border-0">
                <span className="shrink-0 font-semibold text-[color:var(--ink)]">{fmtData(r.data)}</span>
                <span className="flex-1 text-ink-2">{mm(r.mm)} mm{r.observacao ? ` · ${r.observacao}` : ""}</span>
                <button onClick={() => excluir(r.id)} className="shrink-0 text-sm text-ink-3 hover:text-prejuizo hover:underline" aria-label={`Excluir registro de ${fmtData(r.data)}`}>excluir</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
