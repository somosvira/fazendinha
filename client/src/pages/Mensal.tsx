import { Fragment, useEffect, useState } from "react";
import type { RelatorioMensal } from "../types";
import { moneyCell } from "../format";
import { apiGet, download } from "../api";

function Cell({ value }: { value: number | null | undefined }) {
  const { text, neg } = moneyCell(value);
  return <td className={`num ${neg ? "neg" : ""}`}>{text}</td>;
}

export function Mensal() {
  const [meses, setMeses] = useState<string[]>([]);
  const [mes, setMes] = useState<string>("");
  const [data, setData] = useState<RelatorioMensal | null>(null);

  useEffect(() => {
    apiGet<string[]>("/relatorios/meses").then((ms) => {
      setMeses(ms);
      if (ms.length) setMes(ms[ms.length - 1]);
    });
  }, []);

  useEffect(() => {
    if (!mes) return;
    apiGet<RelatorioMensal>(`/relatorios/mensal/${mes}`).then(setData);
  }, [mes]);

  const centros = data?.centros ?? [];
  const cells = (vals: Record<string, number>, total: number) => (
    <>
      {centros.map((c) => (
        <Cell key={c} value={vals[c]} />
      ))}
      <Cell value={total} />
    </>
  );

  return (
    <section className="card">
      <div className="toolbar">
        <label className="inline-field">
          Mês
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            {meses.map((m) => (
              <option key={m} value={m}>
                {m.split("-").reverse().join("/")}
              </option>
            ))}
          </select>
        </label>
        {mes && (
          <button className="btn-export" onClick={() => download(`/relatorios/mensal/${mes}/xlsx`, `Rio Novo - ${mes}.xlsx`)}>
            ⬇ Exportar .xlsx
          </button>
        )}
      </div>

      {data && <p className="subtitle">{data.titulo} — {data.label}</p>}

      {data && (
        <div className="table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th className="lbl">Grupo / Categoria</th>
                {centros.map((c) => (
                  <th key={c} className="num">{c}</th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.naturezas.map((nat) => (
                <Fragment key={nat.natureza}>
                  {nat.grupos.map((g) => (
                    <Fragment key={`${nat.natureza}-${g.grupo}`}>
                      {g.categorias.map((c) => (
                        <tr key={`${nat.natureza}-${g.grupo}-${c.categoria}`}>
                          <td className="lbl indent2">
                            <span className={`tag ${nat.natureza === "CREDITO" ? "credito" : "debito"}`}>
                              {nat.natureza === "CREDITO" ? "C" : "D"}
                            </span>
                            {g.grupo} › {c.categoria}
                          </td>
                          {cells(c.porCentro, c.total)}
                        </tr>
                      ))}
                      <tr className="subtotal">
                        <td className="lbl indent1">{g.grupo} (subtotal)</td>
                        {cells(g.subtotais, g.total)}
                      </tr>
                    </Fragment>
                  ))}
                  <tr className="nat-total">
                    <td className="lbl">{nat.natureza === "CREDITO" ? "Crédito Total" : "Débito Total"}</td>
                    {cells(nat.totais, nat.total)}
                  </tr>
                </Fragment>
              ))}
              <tr className="grand">
                <td className="lbl">TOTAL GERAL</td>
                {cells(data.totalGeral, data.totalGeralAcumulado)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
