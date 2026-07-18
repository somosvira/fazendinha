import type { DashboardData, IndicadorDashboard, WorklistRebanho } from "../../api";
import type { RebanhoTab } from "../../nav";

// Paleta categórica validada (CVD) para os quatro estados; rótulos diretos
// permanecem visíveis, então a leitura nunca depende somente da cor.
const CORES = ["#2a78d6", "#008300", "#e87ba4", "#eda100"];
const fmt = (v: number | null, casas = 0) => v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas });

export function CardPainel({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-xl border border-[color:var(--rule-soft)] bg-card px-6 py-[22px] max-[620px]:px-4"><header className="mb-[18px] flex items-center justify-between gap-3"><h2 className="m-0 font-serif text-xl font-medium tracking-[-.01em]">{titulo}</h2>{acao}</header>{children}</section>;
}

export function EstadoReprodutivo({ data, onNav }: { data: DashboardData; onNav: (t: RebanhoTab) => void }) {
  const segs = data.estadosReprodutivos.segmentos;
  return <CardPainel titulo="Estado reprodutivo do plantel" acao={<button className="text-xs font-semibold text-cafe" onClick={() => onNav("reproducao")}>Ver animais →</button>}>
    {data.estadosReprodutivos.totalElegiveis > 0 ? <>
      <div className="flex h-9 gap-0.5 overflow-hidden rounded-md bg-[color:var(--rule-soft)] p-0.5" role="img" aria-label={segs.map((s) => `${s.label}: ${s.quantidade}`).join(", ")}>
        {segs.map((s, i) => <div key={s.chave} style={{ width: `${s.percentual ?? 0}%`, background: CORES[i % CORES.length] }} className="flex min-w-0 items-center justify-center rounded-[4px] text-xs font-semibold text-white">{(s.percentual ?? 0) >= 8 ? s.quantidade : ""}</div>)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-6 max-[620px]:grid-cols-1">{segs.map((s, i) => <div key={s.chave} className="flex items-center gap-2.5 border-b border-[color:var(--rule-soft)] py-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CORES[i % CORES.length] }} /><span className="flex-1 text-sm text-ink-2">{s.label}</span><strong className="font-serif text-lg font-medium tabular-nums">{s.quantidade}</strong><span className="w-10 text-right text-xs text-ink-3">{fmt(s.percentual, 0)}%</span></div>)}</div>
    </> : <p className="text-sm text-ink-3">Sem estado reprodutivo disponível.</p>}
  </CardPainel>;
}

function GrupoIndicadores({ titulo, itens }: { titulo: string; itens: IndicadorDashboard[] }) {
  return <div className="mb-5 last:mb-0"><div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3"><span>{titulo}</span><span className="h-px flex-1 bg-[color:var(--rule-soft)]" /></div><div className="grid grid-cols-4 gap-px overflow-hidden rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--rule-soft)] max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">{itens.map((i) => <div key={i.chave} className="bg-card px-[15px] py-[13px]" title={i.detalhe ?? undefined}><p className="min-h-8 text-xs leading-[1.3] text-ink-3">{i.label}</p><p className="mt-1.5 font-serif text-2xl font-medium tabular-nums">{fmt(i.valor, Number.isInteger(i.valor) ? 0 : 1)}{i.valor != null && i.unidade && <span className="ml-1 text-xs font-normal text-ink-3">{i.unidade}</span>}</p></div>)}</div></div>;
}

export function Indicadores({ data }: { data: DashboardData }) {
  return <CardPainel titulo="Indicadores"><GrupoIndicadores titulo="Produção" itens={data.indicadores.producao} /><GrupoIndicadores titulo="Reprodução" itens={data.indicadores.reproducao} /><GrupoIndicadores titulo="Rebanho" itens={data.indicadores.rebanho} /></CardPainel>;
}

export function Alertas({ data, onNav, onAbrirWorklist }: { data: DashboardData; onNav: (t: RebanhoTab) => void; onAbrirWorklist?: (worklist: WorklistRebanho) => void }) {
  const ordem = { critico: 0, atencao: 1, informativo: 2 };
  const ativos = data.alertas.filter((a) => a.quantidade > 0).sort((a, b) => ordem[a.severidade] - ordem[b.severidade] || b.quantidade - a.quantidade);
  const visiveis = ativos.slice(0, 4);
  return <CardPainel titulo="Precisa de atenção">
    <p className="-mt-2 mb-4 text-xs text-ink-3">{ativos.length ? `${ativos.length} situações abertas, por prioridade.` : "Nenhuma ação urgente no momento."}</p>
    <div className="flex flex-col gap-2">{visiveis.map((a) => <button key={a.chave} onClick={() => onAbrirWorklist ? onAbrirWorklist(a) : onNav(a.tab as RebanhoTab)} className="flex w-full items-center gap-3 rounded-[9px] border border-[color:var(--rule-soft)] border-l-[3px] border-l-prejuizo bg-[color:var(--bg)] px-[15px] py-3 text-left hover:border-cafe"><strong className="w-10 text-center font-serif text-[26px] font-medium tabular-nums text-prejuizo">{a.quantidade}</strong><span className="flex-1"><span className="block text-sm font-semibold text-foreground">{a.label}</span><span className="mt-0.5 block text-xs text-ink-3">{a.detalhe}</span></span><span aria-hidden className="text-ink-3">→</span></button>)}</div>
    {ativos.length > 4 && <p className="mt-3 text-xs text-ink-3">Mais {ativos.length - 4} {ativos.length - 4 === 1 ? "situação" : "situações"} no módulo.</p>}
    {!ativos.length && <div className="rounded-[9px] border border-dashed border-[color:var(--rule-soft)] bg-[color:var(--bg)] px-4 py-3 text-sm text-ink-2">✓ Indicadores operacionais em dia.</div>}
  </CardPainel>;
}

export function Grupos({ data, onNav }: { data: DashboardData; onNav: (t: RebanhoTab) => void }) {
  const max = Math.max(1, ...data.grupos.map((g) => g.animaisAtivos));
  return <CardPainel titulo="Animais por grupo" acao={<span className="text-xs text-ink-3">{data.atualizacao.animaisAtivos} no total</span>}><div className="flex flex-col gap-3">{data.grupos.map((g) => <button key={`${g.grupoId}-${g.nome}`} onClick={() => onNav("animal")} className="grid grid-cols-[minmax(100px,140px)_1fr_36px] items-center gap-3 text-left"><span className="truncate text-xs text-ink-2" title={g.nome}>{g.nome}</span><span className="h-3.5 overflow-hidden rounded bg-[color:var(--rule-soft)]"><span className="block h-full rounded bg-leite" style={{ width: `${(g.animaisAtivos / max) * 100}%` }} /></span><strong className="text-right font-serif text-base font-medium tabular-nums">{g.animaisAtivos}</strong></button>)}</div></CardPainel>;
}
