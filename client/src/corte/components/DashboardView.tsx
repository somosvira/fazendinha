import { Loader } from "../../components/Loading";
import type { CorteTab } from "../nav";
import { insightDaFazenda } from "../mock";
import { IaInsightBand } from "./IaInsight";
import { useDashboard } from "../api";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebMain, RebBox } from "@/components/rb/RebPrimitives";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// .rb-k — célula base da faixa de KPI (a 1ª perde a border-left dentro do grid).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)] [&_u]:ml-1 [&_u]:text-[15px] [&_u]:font-medium [&_u]:not-italic [&_u]:no-underline [&_u]:text-ink-2";
const RB_K_D = "mt-2 text-[15px] font-medium text-ink-2";

export function DashboardView({ onNav }: { onNav: (t: CorteTab) => void }) {
  const { data, loading } = useDashboard();
  const insight = insightDaFazenda("comercial");

  if (loading || !data) {
    return <RebMain><RebHeader title="Corte · Painel" /><Loader /></RebMain>;
  }
  const k = data.k;
  return (
    <RebMain>
      <RebHeader eyebrow={`Gado de corte · ${k.totalCabecas} cabeças · ${k.totalAtivos} lotes`} title="Painel da pecuária" />

      <RebKpiStrip cols={6}>
        <RebKpi lab="Plantel" val={<>{k.totalCabecas}<u>cab</u></>} d={`${k.totalAtivos} lotes ativos`} />
        <RebKpi lab="UA total" val={<>{k.uaTotal}<u>UA</u></>} d="1 UA = 450 kg" />
        <RebKpi lab="@ no estoque" val={<>{k.arrobasEstoque.toFixed(0)}<u>@</u></>} d="carcaça · rendimento 52%" />
        <RebKpi lab="@ prontas (≥ 480 kg)" val={<>{k.arrobasProntas.toFixed(0)}<u>@</u></>} d="disponíveis pra venda" tom="ok" />
        <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className={RB_K_LAB}>Valor de estoque</div>
          <div className={RB_K_VAL} style={{ fontSize: 26, color: "var(--cafe)" }}>{money(k.valorEstoque)}</div>
          <div className={RB_K_D}>@ spot R$ {k.precoArrobaSpot}</div>
        </div>
        <RebKpi lab="GMD médio" val={<>{k.gmdMedio.toFixed(2)}<u>kg/d</u></>} d="lotes em ganho" />
      </RebKpiStrip>

      {insight && <IaInsightBand insight={insight} />}

      <div className="mt-1.5 grid grid-cols-[1fr_320px] gap-5 max-[1100px]:grid-cols-1">
        <div className="grid grid-cols-2 gap-3 content-start max-[900px]:grid-cols-1">
          {data.dominios.map((d) => (
            <button
              key={d.tab}
              className="cursor-pointer rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3.5 text-left font-sans hover:bg-[color:var(--bg-card-2)]"
              onClick={() => onNav(d.tab.replace("cor-", "") as CorteTab)}
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
              onClick={() => onNav(al.tab.replace("cor-", "") as CorteTab)}
            >
              <span>{al.label}</span>
              <span className={"font-serif text-[21px] " + (al.n === 0 ? "text-lucro" : "text-prejuizo")}>{al.n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pull-quote editorial: curva B3 contango — narrativa que o produtor entende */}
      <RebBox style={{ marginTop: 26, borderLeft: "3px solid var(--leite)" }}>
        <h3 style={{ margin: "0 0 6px" }}>Janela comercial: B3 sinaliza contango</h3>
        <p className="text-sm text-ink-3" style={{ marginTop: 0 }}>
          A curva futura B3/Esalq fechou junho com <b>contango</b>: arroba spot em <b>R$ {k.precoArrobaSpot}/@</b> (MG),
          set/2026 em <b>R$ {k.precoArrobaSet}/@</b>, out/2026 em ~R$ 356. Para os {k.arrobasProntas.toFixed(0)} @ prontos
          hoje, atrasar a venda em ~60 dias renderia <b>{money(k.arrobasProntas * (k.precoArrobaSet - k.precoArrobaSpot))}</b>
          {" "}— descontando consumo de pasto e risco. Use a aba <b>Comercial</b> para simular cada lote.
        </p>
      </RebBox>
    </RebMain>
  );
}
