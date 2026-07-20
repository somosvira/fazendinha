import { useAgenda, type AgendaItemDTO } from "../api";

const fmtData = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR");
const TIPO_LABEL: Record<AgendaItemDTO["tipo"], string> = { VACINA: "Vacina", IATF: "IATF" };

// Agenda unificada de manejos futuros: vacinas agendadas + próximas etapas de IATF de lote,
// num só calendário ordenado por data. Atrasados destacados no topo.
export function AgendaSection() {
  const { data, loading } = useAgenda();
  if (loading) return null;
  const itens = data ?? [];
  if (itens.length === 0) return null;

  const atrasados = itens.filter((i) => i.status === "atrasado");
  const futuros = itens.filter((i) => i.status === "futuro");

  const linha = (i: AgendaItemDTO, idx: number) => (
    <li key={`${i.tipo}-${i.data}-${i.alvo}-${idx}`} className="flex flex-wrap items-baseline gap-x-2 border-b border-dashed border-[color:var(--rule-soft)] py-[6px] text-sm last:border-0">
      <span className="w-24 shrink-0 tabular-nums text-ink-2">{fmtData(i.data)}</span>
      <span className="shrink-0 rounded bg-[color:var(--rule-soft)] px-1.5 py-0.5 text-xs uppercase tracking-[.04em] text-ink-3">{TIPO_LABEL[i.tipo]}</span>
      <span className="flex-1 text-[color:var(--ink)]">{i.titulo} <span className="text-ink-3">· {i.alvo}</span></span>
      <span className={`shrink-0 text-xs ${i.status === "atrasado" ? "font-semibold text-prejuizo" : "text-ink-3"}`}>
        {i.status === "atrasado" ? `${Math.abs(i.diasParaData)}d de atraso` : i.diasParaData === 0 ? "hoje" : `em ${i.diasParaData}d`}
      </span>
    </li>
  );

  return (
    <div className="mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Agenda de manejos</h4>
      {atrasados.length > 0 && (
        <>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[.06em] text-prejuizo">Atrasados ({atrasados.length})</p>
          <ol className="mb-3 flex flex-col">{atrasados.map(linha)}</ol>
        </>
      )}
      {futuros.length > 0 && (
        <>
          <p className="mb-1 text-xs uppercase tracking-[.06em] text-ink-3">Próximos</p>
          <ol className="flex flex-col">{futuros.map(linha)}</ol>
        </>
      )}
    </div>
  );
}
