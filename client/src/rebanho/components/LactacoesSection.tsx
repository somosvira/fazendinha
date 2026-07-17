import { useLactacoes } from "../api";

const fmtL = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("pt-BR")} L`);
const fmtDias = (v: number | null) => (v == null ? "—" : `${v} d`);
const fmtData = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export function LactacoesSection({ animalId }: { animalId: string }) {
  const { data, loading } = useLactacoes(animalId);
  if (loading) return null;
  const lacts = data?.lactacoes ?? [];
  if (lacts.length === 0) return null;
  const r = data!.resumo;

  return (
    <div className="mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Lactações</h4>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
        <span><b className="font-semibold text-[color:var(--ink)]">{r.total}</b> lactações</span>
        <span>vida produtiva <b className="font-semibold text-[color:var(--ink)]">{fmtDias(r.vidaProdutivaDias)}</b></span>
        <span>média/ciclo <b className="font-semibold text-[color:var(--ink)]">{fmtL(r.producaoMediaCiclo)}</b></span>
        {r.emCurso && (
          <span className="rounded-[13px] border border-[#E0CF9E] bg-[color:var(--leite-soft)] px-[9px] py-[2px] text-sm font-semibold text-[#6e5a26]">
            em curso · DEL {fmtDias(r.delAtual)}
          </span>
        )}
      </div>
      <div className="flex flex-col">
        {lacts.map((l) => (
          <div
            key={l.id}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-dashed border-[color:var(--rule-soft)] py-[6px] text-sm last:border-0"
          >
            <span className="shrink-0 font-semibold text-[color:var(--ink)]">
              {l.numero}ª{l.emCurso ? " · em curso" : ""}
            </span>
            <span className="flex-1 text-ink-2">
              {fmtData(l.dtInicio)} → {l.dtFim ? fmtData(l.dtFim) : "hoje"} · {fmtDias(l.duracaoDias)}
              {l.motivoSecagem ? ` · ${l.motivoSecagem}` : ""}
            </span>
            {l.producaoTotal != null ? (
              <span className="shrink-0 text-right text-ink-2">
                {fmtL(l.producaoTotal)}
                {l.producao305 != null ? ` · 305d ${fmtL(l.producao305)}` : ""}
              </span>
            ) : l.producaoControles != null ? (
              // estimado dos controles leiteiros do ciclo (não medido pelo Ideagri)
              <span
                className="shrink-0 text-right text-ink-3"
                title={`estimado de ${l.nControles} controle${l.nControles === 1 ? "" : "s"} leiteiro${l.nControles === 1 ? "" : "s"}`}
              >
                ~{fmtL(l.producaoControles)}
                <span className="sr-only">
                  {` — estimativa baseada em ${l.nControles} controle${l.nControles === 1 ? "" : "s"} leiteiro${l.nControles === 1 ? "" : "s"}`}
                </span>
              </span>
            ) : (
              <span className="shrink-0 text-right text-ink-2">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
