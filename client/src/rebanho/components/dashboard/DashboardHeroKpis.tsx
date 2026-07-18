import type { DashboardData, IndicadorHeroDashboard } from "../../api";
import { DashboardSparkline } from "./DashboardSparkline";

const fmt = (valor: number | null, casas = 0) => valor == null ? "—" : valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function Hero({ label, indicador, casas = 0, neutro = false }: { label: string; indicador: IndicadorHeroDashboard; casas?: number; neutro?: boolean }) {
  const delta = indicador.variacaoPercentual;
  const comparacao = indicador.comparavel && delta != null
    ? `${delta > 0 ? "+" : ""}${fmt(delta, 1)}% ${delta > 0 ? "↑" : delta < 0 ? "↓" : "—"}`
    : "Sem base anterior";
  const tom = neutro || delta === 0 || delta == null ? "text-ink-3" : delta > 0 ? "text-lucro" : "text-prejuizo";
  return (
    <article className="relative min-w-0 bg-card px-5 py-[18px]">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="font-serif text-[clamp(30px,3vw,40px)] font-medium leading-none tabular-nums text-foreground">
            {fmt(indicador.valor, casas)}{indicador.valor != null && <span className="ml-1 text-base font-normal text-ink-3">{indicador.unidade}</span>}
          </div>
          <p className={`mt-2 text-xs font-semibold ${tom}`} title={indicador.motivoIndisponivel ?? undefined}>{comparacao}</p>
        </div>
        <DashboardSparkline serie={indicador.serie} label={`${label}: ${comparacao}`} />
      </div>
    </article>
  );
}

export function DashboardHeroKpis({ data }: { data: DashboardData }) {
  return (
    <section className="mb-[22px] grid grid-cols-4 gap-px overflow-hidden rounded-xl border border-[color:var(--rule-soft)] bg-[color:var(--rule-soft)] max-[1080px]:grid-cols-2 max-[620px]:grid-cols-1" aria-label="Indicadores principais">
      <Hero label="Vacas em lactação" indicador={data.herois.vacasEmLactacao} neutro />
      <Hero label="Produção média por vaca" indicador={data.herois.producaoMediaVaca} casas={1} />
      <Hero label="Produção total por dia" indicador={data.herois.producaoTotalDia} casas={0} />
      <Hero label="Vacas do plantel em lactação" indicador={data.herois.percentualVacasLactacao} casas={1} neutro />
    </section>
  );
}
