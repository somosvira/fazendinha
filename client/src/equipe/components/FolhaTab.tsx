import { useMemo, useState } from "react";
import { useFolha, money, num, horasFmt, mesesRecentes, mesBR } from "../api";

/* Apuração da folha do mês para todos: cruza horas trabalhadas × salário e
 * mostra o valor da hora extra (50%/100%) e o total a pagar. Seletor de mês →
 * useFolha(mes) → tabela + rodapé com os totais da fazenda. */
export function FolhaTab() {
  const meses = useMemo(() => mesesRecentes(12), []);
  const [mes, setMes] = useState<string>(meses[0]); // 2026-05
  const { data, loading, erro } = useFolha(mes);

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Equipe · Folha</div>
      <div className="rb-head"><h1>Folha do mês</h1></div>

      <div className="rb-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 18px" }}>
        <label style={{ fontSize: 13, color: "var(--ink-3)" }}>Mês</label>
        <select className="rb-select" value={mes} onChange={(e) => setMes(e.target.value)}>
          {meses.map((m) => <option key={m} value={m}>{mesBR(m)}</option>)}
        </select>
      </div>

      {erro ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Não foi possível apurar a folha: {erro}</p>
      ) : loading ? (
        <p className="rb-sub">Apurando…</p>
      ) : !data || data.linhas.length === 0 ? (
        <p className="rb-sub">Nenhum funcionário com apuração em {mesBR(mes)}.</p>
      ) : (
        <>
          <div className="rb-kstrip" style={{ ["--cols" as any]: 4, marginBottom: 22 }}>
            <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className="lab">Salários</div>
              <div className="val" style={{ fontSize: 20 }}>{money(data.totais.salarios)}</div>
              <div className="d">base do mês</div>
            </div>
            <div className="rb-k">
              <div className="lab">Valor de hora extra</div>
              <div className="val" style={{ fontSize: 20, color: "var(--cafe)" }}>{money(data.totais.valorExtra)}</div>
              <div className="d">50% + 100%</div>
            </div>
            <div className="rb-k">
              <div className="lab">Total a pagar</div>
              <div className="val" style={{ fontSize: 20 }}>{money(data.totais.totalPagar)}</div>
              <div className="d">salários + extra</div>
            </div>
            <div className="rb-k">
              <div className="lab">Total de horas</div>
              <div className="val">{num(data.totais.totalHoras, 1)}<u>h</u></div>
              <div className="d">trabalhadas no mês</div>
            </div>
          </div>

          <div className="rb-tbl-wrap"><table className="rb-tbl">
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Cargo</th>
                <th style={{ textAlign: "right" }}>Salário</th>
                <th style={{ textAlign: "right" }}>Valor/hora</th>
                <th style={{ textAlign: "right" }}>Dias</th>
                <th style={{ textAlign: "right" }}>Horas</th>
                <th style={{ textAlign: "right", borderLeft: "1px solid var(--rule)" }}>Extra 50%</th>
                <th style={{ textAlign: "right" }}>Extra 100%</th>
                <th style={{ textAlign: "right" }}>Valor extra</th>
                <th style={{ textAlign: "right", borderLeft: "1px solid var(--rule)" }}>Total a pagar</th>
              </tr>
            </thead>
            <tbody>
              {data.linhas.map((l) => (
                <tr key={l.funcionarioId}>
                  <td className="rb-anm">{l.nome}</td>
                  <td>{l.cargo ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{money(l.salarioMensal)}</td>
                  <td style={{ textAlign: "right" }}>{money(l.valorHora)}</td>
                  <td style={{ textAlign: "right" }}>{l.diasTrabalhados}</td>
                  <td style={{ textAlign: "right" }}>{horasFmt(l.totalHoras)}</td>
                  <td style={{ textAlign: "right", borderLeft: "1px solid var(--rule)" }}>{l.extra50 > 0 ? `${num(l.extra50, 1)} h` : "—"}</td>
                  <td style={{ textAlign: "right" }}>{l.extra100 > 0 ? `${num(l.extra100, 1)} h` : "—"}</td>
                  <td style={{ textAlign: "right" }}>{l.valorExtra > 0 ? money(l.valorExtra) : "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, borderLeft: "1px solid var(--rule)" }}>{money(l.totalPagar)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td colSpan={5}>Total da fazenda</td>
                <td style={{ textAlign: "right" }}>{horasFmt(data.totais.totalHoras)}</td>
                <td colSpan={2} style={{ borderLeft: "1px solid var(--rule)" }}></td>
                <td style={{ textAlign: "right" }}>{money(data.totais.valorExtra)}</td>
                <td style={{ textAlign: "right", borderLeft: "1px solid var(--rule)" }}>{money(data.totais.totalPagar)}</td>
              </tr>
            </tfoot>
          </table></div>
        </>
      )}
    </main>
  );
}
