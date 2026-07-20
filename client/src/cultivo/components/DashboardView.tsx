import { Loader } from "../../components/Loading";
import type { MilSub } from "../CultivoContent";
import { insightDoMilho } from "../mock/insight";
import { IaInsightBand } from "./IaInsight";
import { useDashboard } from "../api";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebMain } from "@/components/rb/RebPrimitives";
import { fmtBRL } from "@/components/charts";

const money = (n: number) => fmtBRL(n, { compact: false });

export function DashboardView({ onNavMil }: { onNavMil: (s: MilSub) => void }) {
  const { data, loading } = useDashboard();
  const insight = insightDoMilho();

  // No SSR o smoke test só vê este estado de loading (o RebHeader não renderiza
  // mais título; o teste valida a casca `rb`).
  if (loading || !data) {
    return (
      <RebMain>
        <RebHeader eyebrow="Cultivo · milho" title="Painel do milho" />
        <Loader />
      </RebMain>
    );
  }
  const k = data.k;
  return (
    <RebMain>
      <RebHeader
        eyebrow={`Cultivo · milho · ${k.safrasAtivas} ${k.safrasAtivas === 1 ? "safra ativa" : "safras ativas"}`}
        title="Painel do milho"
      />

      <RebKpiStrip cols={6}>
        <RebKpi lab="Safras ativas" val={k.safrasAtivas} d={`${k.safrasFechadas} fechadas`} />
        <RebKpi lab="Área" val={k.areaHa} sufixo="ha" d="em cultivo" />
        <RebKpi lab="Grão" val={k.producaoGraoSc} sufixo="sc" d={`${k.producaoSilagemTon} t de silagem`} />
        <RebKpi lab="Custo/saca médio" val={k.custoSacaMedio != null ? money(k.custoSacaMedio) : "—"} d="custeio ÷ grão" />
        <RebKpi lab="Custeio total" val={money(k.custeioTotal)} d="lançado nas safras" />
        <RebKpi
          lab="Silos"
          val={k.silosAtivos}
          sufixo="ativos"
          d={k.siloOcupacaoPct != null ? `${k.siloOcupacaoPct}% de ocupação` : `${k.siloSaldoTotal} em estoque`}
        />
      </RebKpiStrip>

      {insight && <IaInsightBand insight={insight} />}

      <div className="mt-1.5 grid grid-cols-[1fr_320px] gap-5 max-[1100px]:grid-cols-1">
        <div className="grid grid-cols-2 gap-3 content-start max-[900px]:grid-cols-1">
          {data.dominios.map((d) => (
            <button
              key={d.tab}
              className="cursor-pointer rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3.5 text-left font-sans hover:bg-[color:var(--bg-card-2)]"
              onClick={() => onNavMil(d.tab.replace("mil-", "") as MilSub)}
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
              onClick={() => onNavMil(al.tab.replace("mil-", "") as MilSub)}
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
