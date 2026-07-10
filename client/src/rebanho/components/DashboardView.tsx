import { Loader } from "../../components/Loading";
import type { RebanhoTab } from "../nav";
import { insightDoRebanho } from "../mock";
import { IaInsightBand } from "./IaInsight";
import { useDashboard } from "../api";
import { RebHeader } from "./RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";

export function DashboardView({ onNav }: { onNav: (t: RebanhoTab) => void }) {
  const { data, loading, erro } = useDashboard();
  const insight = insightDoRebanho("reproducao");
  if (loading) return <main className="rb-main"><RebHeader title="Dashboard" /><Loader /></main>;
  if (erro || !data) return <main className="rb-main"><RebHeader title="Dashboard" /><p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p></main>;
  const k = data.kpis;
  const pctLactacao = k.rebanhoAtivo > 0 ? Math.round((k.emLactacao / k.rebanhoAtivo) * 100) : 0;
  return (
    <main className="rb-main">
      <RebHeader eyebrow={`Sítio São Francisco · ${k.rebanhoAtivo} animais`} title="Dashboard" />
      <RebKpiStrip cols={6}>
        <RebKpi lab="Rebanho ativo" val={k.rebanhoAtivo} d="Total da fazenda" />
        <RebKpi lab="Em lactação" val={k.emLactacao} sufixo="vacas" d={`${pctLactacao}% do rebanho`} />
        <RebKpi lab="Secas" val={k.secas} sufixo="vacas" d="Em preparo para o próximo parto" />
        <RebKpi lab="Produção média" val={k.producaoMedia ?? "—"} sufixo="L/vaca·dia" d="Média do rebanho em lactação" />
        <RebKpi lab="Gestantes" val={k.gestantes} sufixo="prenhes" d="Próximos partos no calendário" />
        <RebKpi
          lab="Prenhez"
          val={k.prenhez}
          sufixo="%"
          d={k.prenhez >= 35 ? "Acima da meta" : k.prenhez >= 25 ? "Dentro do esperado" : "Abaixo da meta"}
          tom={k.prenhez >= 35 ? "ok" : k.prenhez >= 25 ? undefined : "up"}
        />
      </RebKpiStrip>
      {insight && <IaInsightBand insight={insight} />}
      <div className="mt-1.5 grid grid-cols-[1fr_320px] gap-5 max-[1100px]:grid-cols-1">
        <div className="grid grid-cols-2 gap-3 content-start max-[900px]:grid-cols-1">
          {data.dominios.map((d) => (
            <button
              key={d.tab}
              className="cursor-pointer rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3.5 text-left font-sans hover:bg-[color:var(--bg-card-2)]"
              onClick={() => onNav(d.tab as RebanhoTab)}
            >
              <h4 className="mb-[9px] mt-0 flex items-baseline justify-between font-serif text-[17px] font-medium">
                {d.titulo}<span className="text-sm font-semibold text-cafe">ver →</span>
              </h4>
              <ul className="m-0 list-none p-0">
                {d.linhas.map((l, i) => (
                  <li key={i} className="border-b border-dashed border-[color:var(--rule-soft)] py-1 text-sm text-ink-2 last:border-0">{l}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
        <div className="self-start rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3.5">
          <h4 className="mb-2 mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Animais em situação de alerta</h4>
          {data.alertas.map((al) => (
            <button
              key={al.label}
              className="flex w-full cursor-pointer items-center justify-between border-0 border-b border-[color:var(--rule-soft)] bg-transparent py-2.5 text-left font-sans text-sm text-ink-2 last:border-b-0"
              onClick={() => onNav(al.tab as RebanhoTab)}
            >
              <span>{al.label}</span>
              <span className={"font-serif text-[21px] " + (al.n === 0 ? "text-lucro" : al.tom === "ok" ? "text-lucro" : "text-prejuizo")}>{al.n}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
