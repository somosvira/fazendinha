import { useMemo, useState } from "react";
import { useFolha, money, num, horasFmt, mesesRecentes, mesBR } from "../api";
import { ToolbarSelect } from "@/components/ToolbarSelect";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebTable } from "@/components/rb/RebTable";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebMain, RebAnm } from "@/components/rb/RebPrimitives";

/* Apuração da folha do mês para todos: cruza horas trabalhadas × salário e
 * mostra o valor da hora extra (50%/100%) e o total a pagar. Seletor de mês →
 * useFolha(mes) → tabela + rodapé com os totais da fazenda. */
export function FolhaTab() {
  const meses = useMemo(() => mesesRecentes(12), []);
  const [mes, setMes] = useState<string>(meses[0]); // 2026-05
  const { data, loading, erro } = useFolha(mes);

  return (
    <RebMain>
      <RebHeader eyebrow="Equipe · Folha" title="Folha do mês" />

      <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
        <label className="text-[13px] text-ink-3">Mês</label>
        <ToolbarSelect
          value={mes}
          onChange={setMes}
          ariaLabel="Escolher mês"
          options={meses.map((m) => ({ value: m, label: mesBR(m) }))}
        />
      </div>

      {erro ? (
        <p className="text-sm text-prejuizo">Não foi possível apurar a folha: {erro}</p>
      ) : loading ? (
        <p className="text-sm text-ink-3">Apurando…</p>
      ) : !data || data.linhas.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhum funcionário com apuração em {mesBR(mes)}.</p>
      ) : (
        <>
          <RebKpiStrip cols={4} className="mb-[22px]">
            {/* célula custom: borda esquerda leite (sobrepõe o first:border-l-0 do primitivo) */}
            <div className="relative border-l-[3px] border-l-[color:var(--leite)] bg-transparent px-[22px] pt-1.5 pb-1">
              <div className="text-sm font-semibold uppercase tracking-[.06em] text-ink-2">Salários</div>
              <div className="mt-1.5 font-serif text-[20px] font-medium leading-none text-[color:var(--ink)]">{money(data.totais.salarios)}</div>
              <div className="mt-2 text-[15px] font-medium text-ink-2">base do mês</div>
            </div>
            <RebKpi lab="Valor de hora extra" val={money(data.totais.valorExtra)} valClassName="text-[20px] text-cafe" d="50% + 100%" />
            <RebKpi lab="Total a pagar" val={money(data.totais.totalPagar)} valClassName="text-[20px]" d="salários + extra" />
            <RebKpi lab="Total de horas" val={<>{num(data.totais.totalHoras, 1)}<u>h</u></>} d="trabalhadas no mês" />
          </RebKpiStrip>

          <RebTable>
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Cargo</th>
                <th className="text-right">Salário</th>
                <th className="text-right">Valor/hora</th>
                <th className="text-right">Dias</th>
                <th className="text-right">Horas</th>
                <th className="text-right" style={{ borderLeft: "1px solid var(--rule)" }}>Extra 50%</th>
                <th className="text-right">Extra 100%</th>
                <th className="text-right">Valor extra</th>
                <th className="text-right" style={{ borderLeft: "1px solid var(--rule)" }}>Total a pagar</th>
              </tr>
            </thead>
            <tbody>
              {data.linhas.map((l) => (
                <tr key={l.funcionarioId}>
                  <td><RebAnm>{l.nome}</RebAnm></td>
                  <td>{l.cargo ?? "—"}</td>
                  <td className="text-right">{money(l.salarioMensal)}</td>
                  <td className="text-right">{money(l.valorHora)}</td>
                  <td className="text-right">{l.diasTrabalhados}</td>
                  <td className="text-right">{horasFmt(l.totalHoras)}</td>
                  <td className="text-right" style={{ borderLeft: "1px solid var(--rule)" }}>{l.extra50 > 0 ? `${num(l.extra50, 1)} h` : "—"}</td>
                  <td className="text-right">{l.extra100 > 0 ? `${num(l.extra100, 1)} h` : "—"}</td>
                  <td className="text-right">{l.valorExtra > 0 ? money(l.valorExtra) : "—"}</td>
                  <td className="text-right font-semibold" style={{ borderLeft: "1px solid var(--rule)" }}>{money(l.totalPagar)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={2}>Total da fazenda</td>
                <td className="text-right">{money(data.totais.salarios)}</td>
                <td colSpan={2}></td>
                <td className="text-right">{horasFmt(data.totais.totalHoras)}</td>
                <td colSpan={2} style={{ borderLeft: "1px solid var(--rule)" }}></td>
                <td className="text-right">{money(data.totais.valorExtra)}</td>
                <td className="text-right" style={{ borderLeft: "1px solid var(--rule)" }}>{money(data.totais.totalPagar)}</td>
              </tr>
            </tfoot>
          </RebTable>
        </>
      )}
    </RebMain>
  );
}
