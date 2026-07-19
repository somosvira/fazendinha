import { MiniBarChart } from "@/components/charts";
import type { CurvaCicloDTO } from "../api";

// Curva de lactação do ciclo corrente: os controles leiteiros reais (DEL × litros/dia),
// plotados com o MiniBarChart SVG inline do projeto (sem libs novas).
export function CurvaLactacao({ curva }: { curva: CurvaCicloDTO }) {
  // Precisa de ao menos 2 pontos para desenhar uma curva com significado.
  if (curva.pontos.length < 2) return null;

  const data = curva.pontos.map((p) => ({ x: `${p.del}d`, y: p.pesoTotal }));
  const litros = curva.pontos.map((p) => p.pesoTotal);
  const ultimo = litros[litros.length - 1];
  // Pico canônico (janela DEL 15-90, do server); cai para o máximo bruto se a janela não pegou.
  const pico = curva.pico ?? Math.max(...litros);
  // Persistência Embrapa: verde ≥90%, amarelo ≥80%, vermelho abaixo. null quando amostra < 4 controles.
  const persistCor =
    curva.persistencia == null ? "" : curva.persistencia >= 90 ? "text-lucro" : curva.persistencia < 80 ? "text-prejuizo" : "text-[color:var(--ink)]";

  return (
    <div className="mb-3 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-2 flex items-baseline justify-between gap-x-3">
        <h4 className="m-0 text-sm uppercase tracking-[.06em] text-ink-3">
          Curva de lactação{curva.numero != null ? ` · ${curva.numero}ª` : ""}
        </h4>
        <span className="flex flex-wrap items-baseline justify-end gap-x-3 text-sm text-ink-2">
          <span>pico <b className="font-semibold text-[color:var(--ink)]">{pico} L</b></span>
          <span>atual <b className="font-semibold text-[color:var(--ink)]">{ultimo} L</b></span>
          {curva.persistencia != null && (
            <span
              className="rounded-[13px] border border-[color:var(--rule-soft)] px-[9px] py-[2px] font-semibold"
              title="persistência da lactação (queda pós-pico) — meta Embrapa ≥ 90%"
            >
              persist. <b className={`font-semibold ${persistCor}`}>{curva.persistencia}%</b>
            </span>
          )}
        </span>
      </div>
      <MiniBarChart data={data} color="var(--leite)" />
      <p className="mt-1 text-sm text-ink-3">
        {curva.pontos.length} controles do ciclo · eixo = dias em lactação (DEL)
      </p>
    </div>
  );
}
