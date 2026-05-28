import { Fragment, useEffect, useState } from "react";
import type { Relatorio as Rel, MesCol } from "../types";
import { moneyCell } from "../format";
import { apiGet, download } from "../api";

type Tipo = "REALIZADO" | "PROJECAO";

function Cell({ value }: { value: number | null | undefined }) {
  const { text, neg } = moneyCell(value);
  return <td className={`num ${neg ? "neg" : ""}`}>{text}</td>;
}

function rowCells(meses: MesCol[], valores: Record<string, number>, total: number) {
  return (
    <>
      {meses.map((m) => (
        <Cell key={m.key} value={valores[m.key]} />
      ))}
      <Cell value={total} />
    </>
  );
}

export function Relatorio() {
  const [tipo, setTipo] = useState<Tipo>("REALIZADO");
  const [data, setData] = useState<Rel | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiGet<Rel>(`/relatorios/resultado-operacional?tipo=${tipo}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [tipo]);

  const meses = data?.meses ?? [];

  return (
    <section className="card">
      <div className="toolbar">
        <div className="seg">
          <button className={tipo === "REALIZADO" ? "on" : ""} onClick={() => setTipo("REALIZADO")}>
            Realizado
          </button>
          <button className={tipo === "PROJECAO" ? "on" : ""} onClick={() => setTipo("PROJECAO")}>
            Projeção
          </button>
        </div>
        <button
          className="btn-export"
          onClick={() =>
            download(`/relatorios/resultado-operacional.xlsx?tipo=${tipo}`, `Rio Novo - ${tipo === "REALIZADO" ? "Resultado Operacional" : "Projecao"}.xlsx`)
          }
        >
          ⬇ Exportar .xlsx
        </button>
      </div>

      {data && <p className="subtitle">{data.titulo}</p>}
      {loading && <p className="muted">Carregando…</p>}

      {data && (
        <div className="table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th className="lbl">Centro / Grupo / Categoria</th>
                {meses.map((m) => (
                  <th key={m.key} className="num">
                    {m.label}
                  </th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.centros.map((centro) => (
                <FragmentCentro key={centro.centro} centro={centro} meses={meses} />
              ))}
              <tr className="grand">
                <td className="lbl">TOTAL GERAL</td>
                {rowCells(meses, data.totalGeral, data.totalGeralAcumulado)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FragmentCentro({ centro, meses }: { centro: Rel["centros"][number]; meses: MesCol[] }) {
  return (
    <>
      <tr className="centro">
        <td className="lbl" colSpan={meses.length + 2}>
          {centro.centro}
        </td>
      </tr>
      {centro.naturezas.map((nat) => (
        <Fragment key={`${centro.centro}-${nat.natureza}`}>
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
                  {rowCells(meses, c.valores, c.total)}
                </tr>
              ))}
              <tr className="subtotal">
                <td className="lbl indent1">{g.grupo} (subtotal)</td>
                {rowCells(meses, g.subtotais, g.total)}
              </tr>
            </Fragment>
          ))}
          <tr className="nat-total">
            <td className="lbl">{nat.natureza === "CREDITO" ? "Crédito Total" : "Débito Total"}</td>
            {rowCells(meses, nat.totais, nat.total)}
          </tr>
        </Fragment>
      ))}
      <tr className="centro-total">
        <td className="lbl">{centro.centro} — Resultado</td>
        {rowCells(meses, centro.totais, centro.total)}
      </tr>
    </>
  );
}
