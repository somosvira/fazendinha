import { useEffect, useRef, useState } from "react";
import { useUA } from "../api";

const catLabel = (c: string) => c.charAt(0) + c.slice(1).toLowerCase();
const num = (n: number, casas = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: casas });

// Ajuste de U.A. de referência: converte o efetivo (por categoria) em UA totais e, com área,
// UA/ha (lotação). Pesos-referência vêm dos parâmetros PESO_REF_* / PESO_UA_REF_KG — editáveis
// na tela Parâmetros. Espelha "Ajuste de U.A. de referência" (Nutrição) do IDEagri.
export function UaReferenciaSection() {
  // Área digitada (texto) e área aplicada (número) — debounce entre as duas.
  const [areaTxt, setAreaTxt] = useState("");
  const [areaHa, setAreaHa] = useState<number | undefined>(undefined);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const v = Number(areaTxt);
      setAreaHa(areaTxt.trim() !== "" && Number.isFinite(v) && v > 0 ? v : undefined);
    }, 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [areaTxt]);

  const { data, loading } = useUA(areaHa);
  if (loading && !data) return null;
  if (!data || data.totalCabecas === 0) return null;

  return (
    <div className="mt-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-[11px] flex flex-wrap items-center justify-between gap-2">
        <h4 className="m-0 text-sm uppercase tracking-[.06em] text-ink-3">Unidade animal (U.A.) · lotação</h4>
        <label className="flex items-center gap-1.5 text-xs text-ink-3">
          Área (ha)
          <input
            type="number" min={0} step="0.1" placeholder="—"
            className="w-24 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm"
            value={areaTxt} onChange={(e) => setAreaTxt(e.target.value)}
            aria-label="Área em hectares para calcular a lotação"
          />
        </label>
      </div>

      <div className="mb-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-sm text-ink-2"><b className="font-serif text-lg text-[color:var(--ink)]">{num(data.totalUA)}</b> UA totais</span>
        <span className="text-sm text-ink-3">{data.totalCabecas} cabeças</span>
        {data.uaPorHa != null && (
          <span className="text-sm text-ink-2"><b className="font-serif text-lg text-[color:var(--cafe)]">{num(data.uaPorHa)}</b> UA/ha</span>
        )}
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--rule-soft)] text-ink-3">
              <th className="py-1 pr-2 text-left font-semibold">Categoria</th>
              <th className="px-2 py-1 text-right font-semibold">Cabeças</th>
              <th className="px-2 py-1 text-right font-semibold">Peso-ref (kg)</th>
              <th className="pl-2 py-1 text-right font-semibold">UA</th>
            </tr>
          </thead>
          <tbody>
            {data.linhas.map((l) => (
              <tr key={l.categoria} className="border-b border-dashed border-[color:var(--rule-soft)]">
                <td className="py-1 pr-2 font-semibold text-[color:var(--ink)]">{catLabel(l.categoria)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-ink-2">{l.cabecas}</td>
                <td className="px-2 py-1 text-right tabular-nums text-ink-2">
                  {l.semPeso ? <span className="text-ink-3" title="Sem peso-referência nos parâmetros">s/ peso</span> : num(l.pesoRef, 0)}
                </td>
                <td className="pl-2 py-1 text-right font-semibold tabular-nums text-[color:var(--ink)]">{l.semPeso ? <span className="text-ink-3">·</span> : num(l.ua)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[color:var(--rule)]">
              <td className="py-1 pr-2 font-semibold text-ink-2">Total</td>
              <td className="px-2 py-1 text-right tabular-nums text-ink-2">{data.totalCabecas}</td>
              <td className="px-2 py-1" />
              <td className="pl-2 py-1 text-right font-semibold tabular-nums text-[color:var(--cafe)]">{num(data.totalUA)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-2 text-xs text-ink-3">
        Pesos-referência (por categoria e o peso vivo de 1 UA) são ajustáveis na tela <b>Parâmetros</b>.
        {data.linhas.some((l) => l.semPeso) ? " Categorias sem peso-referência não entram no total de UA." : ""}
      </p>
    </div>
  );
}
