import { Loader } from "../../components/Loading";
import type { PlantioTab } from "../nav";
import { insightDaLavoura } from "../mock";
import { IaInsightBand } from "./IaInsight";
import { useDashboard } from "../api";
import { FASES_LABEL } from "../lib/fenologia";
import { RebHeader } from "@/components/rb/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebMain } from "@/components/rb/RebPrimitives";

export function DashboardView({ onNav }: { onNav: (t: PlantioTab) => void }) {
  const { data, loading } = useDashboard();
  const insight = insightDaLavoura("colheita");
  if (loading || !data) {
    return <RebMain><RebHeader title="Lavoura · Painel" /><Loader /></RebMain>;
  }
  const k = data.k;
  return (
    <RebMain>
      <RebHeader eyebrow={`Plantio · café · ${k.areaTotal} ha · ${k.talhoesAtivos} talhões`} title="Painel da lavoura" />

      <RebKpiStrip cols={6}>
        <RebKpi lab="Área" val={k.areaTotal} sufixo="ha" d={`${k.talhoesAtivos} talhões ativos`} />
        <RebKpi lab="Fase predominante" val={FASES_LABEL[k.fase]} valClassName="!text-[24px] pt-1" d="na lavoura toda" />
        <RebKpi lab="Sacas esperadas" val={k.sacasEsperadas.toLocaleString("pt-BR")} sufixo="sc" d="safra 2026 (estimado)" />
        <RebKpi lab="Já colhidas" val={k.sacasJaColhidas.toLocaleString("pt-BR")} sufixo="sc" d="benefício parcial" />
        <RebKpi lab="Produtividade média" val={k.produtividadeMedia} sufixo="sc/ha" d={`${k.variedades} variedades`} />
        <RebKpi
          lab="Em alerta fito"
          val={k.alertaFito}
          sufixo="talhões"
          d={k.alertaFito > 0 ? "acima do limiar MIP" : "dentro do limiar"}
          tom={k.alertaFito > 0 ? "up" : "ok"}
        />
      </RebKpiStrip>

      {insight && <IaInsightBand insight={insight} />}

      <div className="mt-1.5 grid grid-cols-[1fr_320px] gap-5 max-[1100px]:grid-cols-1">
        <div className="grid grid-cols-2 gap-3 content-start max-[900px]:grid-cols-1">
          {data.dominios.map((d) => (
            <button
              key={d.tab}
              className="cursor-pointer rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3.5 text-left font-sans hover:bg-[color:var(--bg-card-2)]"
              onClick={() => onNav(d.tab.replace("pla-", "") as PlantioTab)}
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
          <h4 className="mb-2 mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Talhões em situação de alerta</h4>
          {data.alertas.map((al) => (
            <button
              key={al.label}
              className="flex w-full cursor-pointer items-center justify-between border-0 border-b border-[color:var(--rule-soft)] bg-transparent py-2.5 text-left font-sans text-sm text-ink-2 last:border-b-0"
              onClick={() => onNav(al.tab.replace("pla-", "") as PlantioTab)}
            >
              <span>{al.label}</span>
              <span className={"font-serif text-[21px] " + (al.n === 0 ? "text-lucro" : al.tom === "bad" ? "text-prejuizo" : "text-ink-3")}>{al.n}</span>
            </button>
          ))}
        </div>
      </div>
    </RebMain>
  );
}
