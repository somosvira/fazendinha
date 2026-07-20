import { useMemo, useState } from "react";
import { useSaudeUbere, registrarExameQuarto, type Quarto, type ScoreCmt, type EstadoQuarto, type QuartoInput } from "../api";

const QUARTOS: Quarto[] = ["AE", "AD", "PE", "PD"];
const QUARTO_LABEL: Record<Quarto, string> = { AE: "Ant. Esq.", AD: "Ant. Dir.", PE: "Post. Esq.", PD: "Post. Dir." };

// Escores CMT em ordem crescente de gravidade; rótulo curto para os botões.
const SCORES: { v: ScoreCmt; label: string }[] = [
  { v: "NEGATIVO", label: "−" },
  { v: "TRACOS", label: "tr" },
  { v: "UMA_CRUZ", label: "+" },
  { v: "DUAS_CRUZES", label: "++" },
  { v: "TRES_CRUZES", label: "+++" },
];

// Cor do estado do quarto no mapa de úbere. Sadio neutro; ativo âmbar (café); crônico/perdido prejuízo.
const ESTADO: Record<EstadoQuarto, { label: string; cls: string; dot: string }> = {
  SADIO: { label: "sadio", cls: "text-ink-3", dot: "var(--rule-soft)" },
  ATIVO: { label: "ativo", cls: "text-[color:var(--cafe)]", dot: "var(--cafe)" },
  CRONICO: { label: "crônico", cls: "text-prejuizo", dot: "var(--prejuizo)" },
  PERDIDO: { label: "perdido", cls: "text-prejuizo", dot: "var(--ink-3)" },
};

const hojeISO = () => new Date().toISOString().slice(0, 10);
const fmtData = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR") : "—");

// Entrada de uma passada: por quarto, o operador escolhe o score CMT (ou marca clínica/perdido).
type Rascunho = Record<Quarto, { scoreCmt?: ScoreCmt; clinica?: boolean; perdido?: boolean; escoreTeto?: number }>;
const rascunhoVazio = (): Rascunho => ({ AE: {}, AD: {}, PE: {}, PD: {} });
const ESCORES_TETO = [1, 2, 3, 4];

export function SaudeUbereSection({ animalId }: { animalId: string }) {
  const { data, loading, recarregar } = useSaudeUbere(animalId);
  const [aberto, setAberto] = useState(false);
  const [data_, setData_] = useState(hojeISO());
  const [rascunho, setRascunho] = useState<Rascunho>(rascunhoVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const quartosPreenchidos = useMemo(
    () => QUARTOS.filter((q) => rascunho[q].scoreCmt != null || rascunho[q].clinica || rascunho[q].perdido || rascunho[q].escoreTeto != null),
    [rascunho],
  );

  if (loading) return null;
  const porQuarto = data?.porQuarto;
  // Último escore de teto registrado por quarto (exames vêm ordenados por data desc).
  const escoreTetoPorQuarto: Partial<Record<Quarto, number>> = {};
  for (const ex of data?.exames ?? []) {
    if (ex.escoreTeto != null && escoreTetoPorQuarto[ex.quarto] == null) escoreTetoPorQuarto[ex.quarto] = ex.escoreTeto;
  }

  function setScore(q: Quarto, v: ScoreCmt) {
    setRascunho((r) => ({ ...r, [q]: { ...r[q], scoreCmt: r[q].scoreCmt === v ? undefined : v } }));
  }
  function toggle(q: Quarto, campo: "clinica" | "perdido") {
    setRascunho((r) => ({ ...r, [q]: { ...r[q], [campo]: !r[q][campo] } }));
  }
  function setEscoreTeto(q: Quarto, v: number) {
    setRascunho((r) => ({ ...r, [q]: { ...r[q], escoreTeto: r[q].escoreTeto === v ? undefined : v } }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!quartosPreenchidos.length) return;
    setSalvando(true); setErro(null);
    try {
      const quartos: QuartoInput[] = quartosPreenchidos.map((q) => ({ quarto: q, ...rascunho[q] }));
      await registrarExameQuarto(animalId, { data: data_, quartos });
      setRascunho(rascunhoVazio()); setAberto(false); recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao registrar."); }
    finally { setSalvando(false); }
  }

  return (
    <div className="mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-[11px] flex items-center justify-between">
        <h4 className="m-0 text-sm uppercase tracking-[.06em] text-ink-3">Saúde de úbere</h4>
        <button onClick={() => setAberto((v) => !v)} className="text-sm font-semibold text-[color:var(--cafe)] hover:underline">
          {aberto ? "cancelar" : "+ CMT"}
        </button>
      </div>

      {/* Mapa de úbere: 4 quadrantes com o estado atual de cada quarto. */}
      <div className="mb-3 grid grid-cols-2 gap-1.5" style={{ maxWidth: 260 }}>
        {QUARTOS.map((q) => {
          const est = porQuarto?.[q];
          const meta = ESTADO[est?.estado ?? "SADIO"];
          return (
            <div key={q} className="rounded-[8px] border border-[color:var(--rule-soft)] px-2.5 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[color:var(--ink)]">{QUARTO_LABEL[q]}</span>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: meta.dot }} aria-hidden />
              </div>
              <div className={`mt-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</div>
              {est && (est.positivos12m > 0 || est.ultimoPositivo) && (
                <div className="mt-0.5 text-[11px] text-ink-3">
                  {est.positivos12m}+/12m{est.ultimoPositivo ? ` · ${fmtData(est.ultimoPositivo)}` : ""}
                </div>
              )}
              {escoreTetoPorQuarto[q] != null && (
                <div className="mt-0.5 text-[11px] text-ink-3">escore teto {escoreTetoPorQuarto[q]}</div>
              )}
            </div>
          );
        })}
      </div>
      {data && (data.quartosCronicos > 0 || data.quartosPerdidos > 0) && (
        <p className="mb-3 text-sm text-prejuizo">
          {data.quartosCronicos > 0 && <b>{data.quartosCronicos} quarto(s) crônico(s) — cogite secar/tratar.</b>}
          {data.quartosPerdidos > 0 && ` ${data.quartosPerdidos} perdido(s).`}
        </p>
      )}

      {/* Entrada rápida: grade das 4 tetas (o "CMT via tablet"). */}
      {aberto && (
        <form onSubmit={salvar} className="mb-3 rounded-[8px] border border-dashed border-[color:var(--rule-soft)] px-3 py-2.5">
          <label className="mb-2 flex items-center gap-2 text-xs text-ink-3">
            Data
            <input type="date" className="rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={data_} onChange={(e) => setData_(e.target.value)} />
          </label>
          <div className="flex flex-col gap-1.5">
            {QUARTOS.map((q) => (
              <div key={q} className="flex flex-wrap items-center gap-1.5">
                <span className="w-[68px] shrink-0 text-xs font-semibold text-[color:var(--ink)]">{QUARTO_LABEL[q]}</span>
                {SCORES.map((s) => (
                  <button key={s.v} type="button" onClick={() => setScore(q, s.v)}
                    className={`min-w-[34px] rounded border px-2 py-1 text-sm ${rascunho[q].scoreCmt === s.v ? "border-[color:var(--cafe)] bg-[color:var(--cafe)] font-semibold text-white" : "border-[color:var(--rule-soft)] text-ink-2"}`}>
                    {s.label}
                  </button>
                ))}
                <button type="button" onClick={() => toggle(q, "clinica")}
                  className={`rounded border px-2 py-1 text-xs ${rascunho[q].clinica ? "border-prejuizo bg-prejuizo font-semibold text-white" : "border-[color:var(--rule-soft)] text-ink-3"}`}>clínica</button>
                <button type="button" onClick={() => toggle(q, "perdido")}
                  className={`rounded border px-2 py-1 text-xs ${rascunho[q].perdido ? "border-[color:var(--ink-3)] bg-[color:var(--ink-3)] font-semibold text-white" : "border-[color:var(--rule-soft)] text-ink-3"}`}>perdido</button>
                <span className="ml-1 text-[11px] text-ink-3">teto:</span>
                {ESCORES_TETO.map((n) => (
                  <button key={n} type="button" onClick={() => setEscoreTeto(q, n)} aria-label={`Escore de teto ${n} para ${QUARTO_LABEL[q]}`}
                    className={`min-w-[26px] rounded border px-1.5 py-1 text-xs ${rascunho[q].escoreTeto === n ? "border-[color:var(--cafe)] bg-[color:var(--cafe)] font-semibold text-white" : "border-[color:var(--rule-soft)] text-ink-3"}`}>{n}</button>
                ))}
              </div>
            ))}
          </div>
          {erro && <p className="mt-2 text-sm text-prejuizo">{erro}</p>}
          <button type="submit" disabled={salvando || !quartosPreenchidos.length}
            className="mt-2.5 rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {salvando ? "Salvando…" : `Salvar passada (${quartosPreenchidos.length})`}
          </button>
        </form>
      )}
    </div>
  );
}
