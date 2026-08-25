import { useState } from "react";
import { Loader } from "../../components/Loading";
import { RebButton } from "@/components/rb/RebButton";
import { RebEmpty, RebMain } from "@/components/rb/RebPrimitives";
import type { RebanhoTab } from "../nav";
import { type PeriodoDashboard, type WorklistRebanho, useDashboard } from "../api";
import { DashboardHeroKpis } from "./dashboard/DashboardHeroKpis";
import { Alertas, EstadoReprodutivo, Grupos, Indicadores } from "./dashboard/DashboardSections";
import { CockpitDia } from "./CockpitDia";
import { baixarDashboardCsv } from "./dashboard/dashboardExport";

const PERIODOS: { chave: PeriodoDashboard; label: string }[] = [
  { chave: "hoje", label: "Hoje" },
  { chave: "7d", label: "7 dias" },
  { chave: "30d", label: "30 dias" },
];

function formatarAtualizacao(iso: string | null) {
  if (!iso) return "sem produção registrada no período";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `dados até ${iso}`;
  return `dados até ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
}

export function DashboardView({ onNav, onAbrirWorklist }: { onNav: (t: RebanhoTab) => void; onAbrirWorklist?: (worklist: WorklistRebanho) => void }) {
  const [periodo, setPeriodo] = useState<PeriodoDashboard>("7d");
  const { data, loading, atualizando, erro, recarregar } = useDashboard(periodo);

  if (loading && !data) return <RebMain><Loader /></RebMain>;
  if (!data) return <RebMain><RebEmpty className="flex items-center justify-between gap-4"><span>Não foi possível carregar o painel{erro ? `: ${erro}` : "."}</span><RebButton onClick={recarregar}>Tentar novamente</RebButton></RebEmpty></RebMain>;
  if (data.atualizacao.animaisAtivos === 0) return <RebMain><RebEmpty><h1 className="mb-2 font-serif text-2xl text-foreground">Seu rebanho começa aqui</h1><p>Cadastre o primeiro animal para acompanhar produção, reprodução e alertas.</p><RebButton className="mt-4" variant="pri" onClick={() => onNav("animal")}>Cadastrar animal</RebButton></RebEmpty></RebMain>;

  return (
    <RebMain>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-5 border-b border-[color:var(--rule-soft)] pb-[18px]">
        <div>
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[.14em] text-leite">Atividades · Pecuária</p>
          <h1 className="mb-0 mt-1.5 font-serif text-[clamp(29px,3vw,35px)] font-medium tracking-[-.02em] text-foreground">Painel do rebanho</h1>
          <p className="mb-0 mt-1.5 text-sm text-ink-3">{formatarAtualizacao(data.atualizacao.dadoMaisRecenteEm)} · {data.atualizacao.animaisAtivos} animais ativos</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex overflow-hidden rounded-lg border border-border bg-card" aria-label="Período do painel">{PERIODOS.map((p) => <button key={p.chave} aria-pressed={periodo === p.chave} onClick={() => setPeriodo(p.chave)} className="border-0 border-l border-[color:var(--rule-soft)] bg-transparent px-[13px] py-2 text-xs text-ink-3 first:border-l-0 aria-pressed:bg-mast aria-pressed:font-semibold aria-pressed:text-mast-ink">{p.label}</button>)}</div>
          <RebButton onClick={() => baixarDashboardCsv(data)}>↓ Exportar</RebButton>
        </div>
      </header>

      {(erro || data.atualizacao.avisos.length > 0) && <div className="mb-4 rounded-lg border border-[color:var(--rule-soft)] bg-[color:var(--bg-card-2)] px-4 py-2 text-xs text-ink-3">{erro ? <>Não foi possível atualizar: {erro}. <button className="font-semibold text-cafe" onClick={recarregar}>Tentar novamente</button></> : data.atualizacao.avisos.join(" · ")}</div>}
      <CockpitDia alertas={data.alertas} onNav={onNav} onAbrirWorklist={onAbrirWorklist} />
      <div className={atualizando ? "opacity-70 transition-opacity" : "transition-opacity"} aria-busy={atualizando}>
        <DashboardHeroKpis data={data} />
        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)] items-start gap-[22px] max-[1080px]:grid-cols-1">
          <div className="grid gap-[22px]"><EstadoReprodutivo data={data} onNav={onNav} /><Indicadores data={data} /></div>
          <div className="grid gap-[22px]"><Alertas data={data} onNav={onNav} onAbrirWorklist={onAbrirWorklist} /><Grupos data={data} onNav={onNav} /></div>
        </div>
      </div>
    </RebMain>
  );
}
