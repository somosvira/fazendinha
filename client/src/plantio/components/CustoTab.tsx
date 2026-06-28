import { useCustoPlantio } from "../api";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const sc = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export function CustoTab() {
  const { data, loading } = useCustoPlantio();

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Lavoura · custo de produção</div>
      <div className="rb-head"><h1>Custo de produção</h1></div>

      {loading || !data ? (
        <p className="rb-sub">Carregando…</p>
      ) : (
        <>
          <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
            <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className="lab">Custo / saca</div>
              <div className="val" style={{ fontSize: 30, color: "var(--cafe)" }}>{money(data.custoSaca)}</div>
              <div className="d">custeio ÷ sacas do período</div>
            </div>
            <div className="rb-k">
              <div className="lab">Custo / ha</div>
              <div className="val" style={{ fontSize: 22 }}>{money(data.custoHa)}</div>
              <div className="d">{data.periodoMeses} meses · Atividade Café</div>
            </div>
            <div className="rb-k">
              <div className="lab">Custeio total</div>
              <div className="val" style={{ fontSize: 22 }}>{money(data.custeioTotal)}</div>
              <div className="d">últimos {data.periodoMeses} meses</div>
            </div>
            <div className="rb-k">
              <div className="lab">Sacas no período</div>
              <div className="val">{sc(data.sacasPeriodo)}<u>sc</u></div>
              <div className="d">benefício estimado</div>
            </div>
          </div>

          <h2 className="rb-sec-title">Quebra por componente</h2>
          <div className="rb-tbl-wrap"><table className="rb-tbl">
            <thead><tr><th>Categoria</th><th style={{ width: "45%" }}>Participação</th><th>Valor</th><th>%</th></tr></thead>
            <tbody>
              {data.breakdown.map((l) => (
                <tr key={l.categoria}>
                  <td className="rb-anm">{l.categoria}</td>
                  <td>
                    <div style={{ background: "var(--rb-bar-bg, rgba(0,0,0,.06))", borderRadius: 4, height: 10, overflow: "hidden" }}>
                      <div style={{ width: `${l.pct}%`, background: "var(--leite)", height: "100%" }} />
                    </div>
                  </td>
                  <td>{money(l.valor)}</td>
                  <td>{l.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td>
                </tr>
              ))}
            </tbody>
          </table></div>

          {/* Comparativo com benchmark — Conab/Cepea */}
          <div className="rb-box" style={{ marginTop: 26 }}>
            <h3 style={{ margin: "0 0 6px" }}>Comparativo com o mercado</h3>
            <p className="rb-sub" style={{ marginTop: 0 }}>
              O <b>indicador Cepea/Esalq</b> para o arábica fechou maio/2026 em torno de <b>R$ 1.880/sc</b> (tipo 6, descrito).
              Considerando o custo da fazenda em <b>{money(data.custoSaca)}/sc</b>, a margem bruta estimada é positiva — mas
              a Conab projeta safra recorde 2026 (28% acima de 2025), o que pode pressionar o preço no 2º semestre.
            </p>
            <div className="rb-kstrip" style={{ ["--cols" as any]: 3, marginTop: 8 }}>
              <div className="rb-k">
                <div className="lab">Custo Rio Novo</div>
                <div className="val" style={{ fontSize: 20 }}>{money(data.custoSaca)}</div>
                <div className="d">/saca beneficiada</div>
              </div>
              <div className="rb-k">
                <div className="lab">Cepea (referência)</div>
                <div className="val" style={{ fontSize: 20 }}>R$ 1.880</div>
                <div className="d">/saca · arábica tipo 6</div>
              </div>
              <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
                <div className="lab">Margem bruta estimada</div>
                <div className="val" style={{ fontSize: 20, color: "var(--cafe)" }}>{money(1880 - data.custoSaca)}</div>
                <div className="d">/saca · antes de impostos</div>
              </div>
            </div>
            <p className="rb-sub" style={{ marginBottom: 0 }}>{data.nota}</p>
          </div>
        </>
      )}
    </main>
  );
}
