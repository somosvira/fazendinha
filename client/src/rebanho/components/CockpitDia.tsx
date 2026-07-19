import { useCockpitHoje, type CockpitContadorDTO, type WorklistRebanho } from "../api";
import { fmtBRL } from "@/components/charts";
import { ActivityPill } from "@/components/Gastos";
import type { RebanhoTab } from "../nav";

const LABEL: Record<CockpitContadorDTO["categoria"], string> = {
  repro: "Reprodução",
  sanidade: "Sanidade",
  vacina: "Vacinas",
  carencia: "Carência de leite",
  estoque: "Estoque baixo",
};
// Tab de destino no client por categoria (o server usa "nutricao" p/ estoque; a sub-aba real é "estoque").
const TAB_ALVO: Record<CockpitContadorDTO["categoria"], RebanhoTab> = {
  repro: "reproducao",
  sanidade: "sanidade",
  vacina: "sanidade",
  carencia: "producao",
  estoque: "estoque",
};

// Faixa "resumo do dia" no topo do painel do rebanho: contadores de ação + saldo do dia/mês.
// Agregador/atalho — os cards do <Alertas> logo abaixo seguem sendo a fila detalhada.
export function CockpitDia({ alertas, onNav, onAbrirWorklist }: {
  alertas: WorklistRebanho[];
  onNav: (t: RebanhoTab) => void;
  onAbrirWorklist?: (worklist: WorklistRebanho) => void;
}) {
  const { data } = useCockpitHoje();
  if (!data) return null;

  function abrir(c: CockpitContadorDTO) {
    // repro/sanidade têm worklist canônica: reusa o mesmo deep-link dos cards de <Alertas>.
    const wl = c.chave ? alertas.find((a) => a.chave === c.chave) : undefined;
    if (wl && onAbrirWorklist) onAbrirWorklist(wl);
    else onNav(TAB_ALVO[c.categoria]);
  }

  const saldoCls = (v: number) => (v < 0 ? "text-prejuizo" : "text-foreground");

  // Quebra do saldo do mês por atividade (Σ == saldoMes). Leite e café puros; outros = residual.
  const porAtividade: { atv: "leite" | "cafe" | "outros"; valor: number }[] = [
    { atv: "leite", valor: data.saldoLeite },
    { atv: "cafe", valor: data.saldoCafe },
    { atv: "outros", valor: data.saldoOutros },
  ];

  return (
    <section className="mb-5 rounded-xl border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3" aria-label="Resumo do dia">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3">Resumo do dia</span>
        {data.diaFechado ? (
          <span className="rounded-[13px] border border-[color:var(--rule-soft)] bg-[color:var(--leite-soft)] px-[9px] py-[2px] text-sm font-semibold text-lucro">
            ✓ dia fechado · 0 pendências
          </span>
        ) : (
          <span className="text-sm font-semibold text-prejuizo">{data.pendenciasTotal} pendência{data.pendenciasTotal === 1 ? "" : "s"} hoje</span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--rule-soft)] max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
        {data.contadores.map((c) => (
          <button
            key={c.categoria}
            onClick={() => abrir(c)}
            className="bg-card px-[15px] py-[13px] text-left hover:border-cafe disabled:cursor-default disabled:opacity-60"
            disabled={c.quantidade === 0}
            title={c.quantidade > 0 ? `Abrir ${LABEL[c.categoria]}` : "Nada pendente"}
          >
            <p className="min-h-8 text-xs leading-[1.3] text-ink-3">{LABEL[c.categoria]}</p>
            <p className={`mt-1.5 font-serif text-2xl font-medium tabular-nums ${c.quantidade > 0 ? "text-prejuizo" : "text-ink-3"}`}>{c.quantidade}</p>
          </button>
        ))}
        {/* Saldo do dia e do mês (fluxo financeiro; sinal preservado). */}
        <div className="bg-card px-[15px] py-[13px]">
          <p className="min-h-8 text-xs leading-[1.3] text-ink-3">Saldo hoje</p>
          <p className={`mt-1.5 font-serif text-2xl font-medium tabular-nums ${saldoCls(data.saldoDia)}`}>{fmtBRL(data.saldoDia, { compact: true })}</p>
        </div>
        <div className="bg-card px-[15px] py-[13px]">
          <p className="min-h-8 text-xs leading-[1.3] text-ink-3">Saldo no mês</p>
          <p className={`mt-1.5 font-serif text-2xl font-medium tabular-nums ${saldoCls(data.saldoMes)}`}>{fmtBRL(data.saldoMes, { compact: true })}</p>
        </div>
      </div>
      {/* Quebra do saldo do mês por atividade (leite/café/outros) — Σ == saldo no mês. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5" aria-label="Saldo do mês por atividade">
        <span className="text-[11px] uppercase tracking-[.1em] text-ink-3">No mês por atividade</span>
        {porAtividade.map(({ atv, valor }) => (
          <span key={atv} className="inline-flex items-center gap-1.5">
            <ActivityPill atv={atv} />
            <span className={`text-sm font-medium tabular-nums ${saldoCls(valor)}`}>{fmtBRL(valor, { compact: true })}</span>
          </span>
        ))}
      </div>

      {/* Sugestões do "Hoje" preditivo (V2 §5.1): top-3 por impacto R$/dia. Só aparece quando há. */}
      {data.sugestoesTop3 && data.sugestoesTop3.length > 0 && (
        <div className="mt-3 border-t border-dashed border-[color:var(--rule-soft)] pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[.1em] text-ink-3">
              Sugestões do dia{data.impactoDiaSugestoes ? ` · ${fmtBRL(data.impactoDiaSugestoes, { compact: true })}/dia em jogo` : ""}
            </span>
            <button className="text-xs font-semibold text-ink-2 hover:underline" onClick={() => onNav("sugestoes")}>ver todas →</button>
          </div>
          <ul className="flex flex-col gap-1">
            {data.sugestoesTop3.map((s) => (
              <li key={`${s.tipo}-${s.animalId}`} className="flex items-center justify-between gap-3 text-sm">
                <button className="truncate text-left hover:underline" onClick={() => onNav("sugestoes")}>{s.titulo}</button>
                <span className="shrink-0 font-medium tabular-nums text-ink-2">{fmtBRL(s.impactoDiaEstimado, { compact: true })}/dia</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
