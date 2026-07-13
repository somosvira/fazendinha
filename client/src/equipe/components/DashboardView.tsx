import { Loader } from "../../components/Loading";
import type { EqpSub } from "../EquipeContent";
import { insightDaEquipe } from "../mock/insight";
import { IaInsightBand } from "./IaInsight";
import { useDashboard, money, num } from "../api";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebMain } from "@/components/rb/RebPrimitives";

export function DashboardView({ onNavEqp }: { onNavEqp: (s: EqpSub) => void }) {
  const { data, loading } = useDashboard();
  const insight = insightDaEquipe();

  // Loading shell PRECISA conter "Equipe ·" (o smoke test SSR só vê este estado).
  if (loading || !data) {
    return (
      <RebMain>
        <RebHeader eyebrow="Equipe · Painel" title="Painel da equipe" />
        <Loader />
      </RebMain>
    );
  }
  const k = data.k;
  return (
    <RebMain>
      <RebHeader
        eyebrow={`Equipe · Painel · ${k.funcionariosAtivos} ${k.funcionariosAtivos === 1 ? "ativo" : "ativos"}`}
        title="Painel da equipe"
      />

      <RebKpiStrip cols={6}>
        <RebKpi lab="Ativos" val={k.funcionariosAtivos} d={`${k.setores} setores`} />
        <RebKpi lab="Custo de MO/mês" val={money(k.custoMOMes)} d="salários do quadro ativo" />
        <RebKpi lab="Folha a pagar" val={money(k.folhaTotalPagar)} d="salários + extras" />
        <RebKpi lab="Hora extra" val={money(k.valorExtra)} d="no mês" />
        <RebKpi lab="Horas apuradas" val={num(k.totalHoras, 0)} sufixo="h" d="total trabalhado" />
        <RebKpi
          lab="Maior setor"
          val={k.maiorSetor ? k.maiorSetor.nome : "—"}
          d={k.maiorSetor ? `${k.maiorSetor.qtd} pessoas` : "sem setores"}
        />
      </RebKpiStrip>

      {insight && <IaInsightBand insight={insight} />}

      <div className="mt-1.5 grid grid-cols-[1fr_320px] gap-5 max-[1100px]:grid-cols-1">
        <div className="grid grid-cols-2 gap-3 content-start max-[900px]:grid-cols-1">
          {data.dominios.map((d) => (
            <button
              key={d.tab}
              className="cursor-pointer rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3.5 text-left font-sans hover:bg-[color:var(--bg-card-2)]"
              onClick={() => onNavEqp(d.tab.replace("eqp-", "") as EqpSub)}
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
          <h4 className="mb-2 mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Alertas e oportunidades</h4>
          {data.alertas.map((al) => (
            <button
              key={al.label}
              className="flex w-full cursor-pointer items-center justify-between border-0 border-b border-[color:var(--rule-soft)] bg-transparent py-2.5 text-left font-sans text-sm text-ink-2 last:border-b-0"
              onClick={() => onNavEqp(al.tab.replace("eqp-", "") as EqpSub)}
            >
              <span>{al.label}</span>
              <span className={"font-serif text-[21px] " + (al.n === 0 ? "text-lucro" : "text-prejuizo")}>{al.n}</span>
            </button>
          ))}
        </div>
      </div>
    </RebMain>
  );
}
