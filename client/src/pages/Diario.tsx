import { Fragment, useEffect, useState } from "react";
import type { RelatorioDiario } from "../types";
import { money } from "../format";
import { apiGet, download } from "../api";

export function Diario() {
  const [meses, setMeses] = useState<string[]>([]);
  const [mes, setMes] = useState<string>("");
  const [data, setData] = useState<RelatorioDiario | null>(null);

  useEffect(() => {
    apiGet<string[]>("/relatorios/meses").then((ms) => {
      setMeses(ms);
      if (ms.length) setMes(ms[ms.length - 1]);
    });
  }, []);

  useEffect(() => {
    if (!mes) return;
    apiGet<RelatorioDiario>(`/relatorios/diario/${mes}`).then(setData);
  }, [mes]);

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
          <button className="btn-export" onClick={() => download(`/relatorios/diario/${mes}/xlsx`, `Rio Novo - Diario ${mes}.xlsx`)}>
            ⬇ Exportar .xlsx
          </button>
        )}
      </div>

      {data && <p className="subtitle">{data.titulo} — {data.label}</p>}

      {data && (
        <div className="table-wrap">
          <table className="list">
            <thead>
              <tr>
                <th>Data</th>
                <th>C/D</th>
                <th>Grupo</th>
                <th>Categoria</th>
                <th>Cliente / Fornecedor</th>
                <th>Centro de Custo</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.dias.map((dia) => (
                <Fragment key={dia.data}>
                  {dia.linhas.map((l, i) => (
                    <tr key={`${dia.data}-${i}`}>
                      <td>{dia.label}</td>
                      <td>{l.natureza === "CREDITO" ? "C" : "D"}</td>
                      <td>{l.grupo}</td>
                      <td>{l.categoria}</td>
                      <td>{l.fornecedor ?? "—"}</td>
                      <td>{l.centro}</td>
                      <td className={`num ${l.valor < 0 ? "neg" : ""}`}>{money(l.valor)}</td>
                    </tr>
                  ))}
                  <tr className="subtotal">
                    <td colSpan={6}>{dia.label} — Total do dia</td>
                    <td className={`num ${dia.total < 0 ? "neg" : ""}`}>{money(dia.total)}</td>
                  </tr>
                </Fragment>
              ))}
              <tr className="grand">
                <td colSpan={6}>TOTAL GERAL</td>
                <td className="num">{money(data.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
