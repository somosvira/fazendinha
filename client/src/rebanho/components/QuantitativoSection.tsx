import { useQuantitativo, FAIXAS_ETARIAS, type FaixaEtaria } from "../api";

const FAIXA_LABEL: Record<FaixaEtaria, string> = {
  "0-6": "0–6m", "6-12": "6–12m", "12-24": "12–24m", "24-36": "24–36m", "36+": "36m+", "sem-idade": "s/ idade",
};
const catLabel = (c: string) => c.charAt(0) + c.slice(1).toLowerCase();

// Rebanho quantitativo: efetivo ativo por categoria × faixa etária (a "foto" do plantel).
export function QuantitativoSection() {
  const { data, loading } = useQuantitativo();
  if (loading) return null;
  if (!data || data.total === 0) return null;

  return (
    <div className="mt-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Rebanho quantitativo</h4>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--rule-soft)] text-ink-3">
              <th className="py-1 pr-2 text-left font-semibold">Categoria</th>
              {FAIXAS_ETARIAS.map((f) => <th key={f} className="px-2 py-1 text-right font-semibold">{FAIXA_LABEL[f]}</th>)}
              <th className="pl-2 py-1 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.linhas.map((l) => (
              <tr key={l.categoria} className="border-b border-dashed border-[color:var(--rule-soft)]">
                <td className="py-1 pr-2 font-semibold text-[color:var(--ink)]">{catLabel(l.categoria)}</td>
                {FAIXAS_ETARIAS.map((f) => <td key={f} className="px-2 py-1 text-right tabular-nums text-ink-2">{l.faixas[f] || <span className="text-ink-3">·</span>}</td>)}
                <td className="pl-2 py-1 text-right font-semibold tabular-nums text-[color:var(--ink)]">{l.totalCategoria}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[color:var(--rule)]">
              <td className="py-1 pr-2 font-semibold text-ink-2">Total</td>
              {FAIXAS_ETARIAS.map((f) => <td key={f} className="px-2 py-1 text-right tabular-nums text-ink-2">{data.totalPorFaixa[f] || "·"}</td>)}
              <td className="pl-2 py-1 text-right font-semibold tabular-nums text-[color:var(--cafe)]">{data.total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
