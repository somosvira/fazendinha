import { useComposicaoRacial } from "../api";

// Composição do rebanho por grau de cruzamento (grau de sangue). Barra de distribuição por
// fração (1/2, 3/4, 5/8, puro…). Fonte = `grauSangue` dos animais ativos.
export function ComposicaoRacialSection() {
  const { data, loading } = useComposicaoRacial();
  if (loading) return null;
  if (!data || data.total === 0) return null;

  // paleta suave por posição (reusa as vars de atividade + neutros)
  const cores = ["var(--leite)", "var(--cafe)", "var(--outros)", "#8a8f98", "#b8a06a", "#6e7f8c", "#a67c52", "#7d8c6e"];

  return (
    <div className="mt-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Composição por grau de cruzamento</h4>

      <div className="mb-2 flex h-3 w-full overflow-hidden rounded">
        {data.distribuicao.map((d, i) => (
          <div key={d.grau} style={{ width: `${d.pct}%`, background: cores[i % cores.length] }} title={`${d.grau}: ${d.quantidade} (${d.pct}%)`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {data.distribuicao.map((d, i) => (
          <span key={d.grau} className="flex items-center gap-1.5 text-ink-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: cores[i % cores.length] }} />
            {d.grau}: <b className="tabular-nums text-[color:var(--ink)]">{d.quantidade}</b> <span className="text-ink-3">({d.pct}%)</span>
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-3">{data.total} animais ativos.</p>
    </div>
  );
}
