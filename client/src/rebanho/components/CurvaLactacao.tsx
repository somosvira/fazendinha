import { MiniBarChart } from "@/components/charts";
import type { CurvaCicloDTO } from "../api";

// Curva de lactação do ciclo corrente: os controles leiteiros reais (DEL × litros/dia),
// plotados com o MiniBarChart SVG inline do projeto (sem libs novas).
export function CurvaLactacao({ curva }: { curva: CurvaCicloDTO }) {
  // Precisa de ao menos 2 pontos para desenhar uma curva com significado.
  if (curva.pontos.length < 2) return null;

  const data = curva.pontos.map((p) => ({ x: `${p.del}d`, y: p.pesoTotal }));
  const litros = curva.pontos.map((p) => p.pesoTotal);
  const pico = Math.max(...litros);
  const ultimo = litros[litros.length - 1];

  return (
    <div className="mb-3 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="m-0 text-sm uppercase tracking-[.06em] text-ink-3">
          Curva de lactação{curva.numero != null ? ` · ${curva.numero}ª` : ""}
        </h4>
        <span className="text-sm text-ink-2">
          pico <b className="font-semibold text-[color:var(--ink)]">{pico} L</b> · atual{" "}
          <b className="font-semibold text-[color:var(--ink)]">{ultimo} L</b>
        </span>
      </div>
      <MiniBarChart data={data} color="var(--leite)" />
      <p className="mt-1 text-sm text-ink-3">
        {curva.pontos.length} controles do ciclo · eixo = dias em lactação (DEL)
      </p>
    </div>
  );
}
