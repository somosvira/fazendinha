import { useCockpitHoje, type CockpitContadorDTO, type WorklistRebanho } from "../api";
import { fmtBRL } from "@/components/charts";
import type { RebanhoTab } from "../nav";

const LABEL: Record<CockpitContadorDTO["categoria"], string> = {
  repro: "Reprodução",
  sanidade: "Sanidade",
  carencia: "Carência de leite",
  estoque: "Estoque baixo",
};
// Tab de destino no client por categoria (o server usa "nutricao" p/ estoque; a sub-aba real é "estoque").
const TAB_ALVO: Record<CockpitContadorDTO["categoria"], RebanhoTab> = {
  repro: "reproducao",
  sanidade: "sanidade",
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

  return (
    <section className="mb-5 rounded-xl border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3" aria-label="Resumo do dia">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3">Resumo do dia</div>
      <div className="grid grid-cols-6 gap-px overflow-hidden rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--rule-soft)] max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
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
    </section>
  );
}
