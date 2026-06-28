import { useCustoCorte } from "../api";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CustoTab() {
  const { data, loading } = useCustoCorte();

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Corte · custo de produção</div>
      <div className="rb-head"><h1>Custo de produção</h1></div>

      {loading || !data ? (
        <p className="rb-sub">Carregando…</p>
      ) : (
        <>
          <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
            <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className="lab">Custo / @</div>
              <div className="val" style={{ fontSize: 30, color: "var(--cafe)" }}>{money(data.custoArroba)}</div>
              <div className="d">custeio ÷ @ produzidas</div>
            </div>
            <div className="rb-k">
              <div className="lab">Custo / ha</div>
              <div className="val" style={{ fontSize: 22 }}>{money(data.custoHa)}</div>
              <div className="d">{data.periodoMeses} meses · Atividade Corte</div>
            </div>
            <div className="rb-k">
              <div className="lab">Custeio total</div>
              <div className="val" style={{ fontSize: 22 }}>{money(data.custeioTotal)}</div>
              <div className="d">últimos {data.periodoMeses} meses</div>
            </div>
            <div className="rb-k">
              <div className="lab">@ produzidas</div>
              <div className="val">{data.arrobasProduzidas.toLocaleString("pt-BR")}<u>@</u></div>
              <div className="d">vendidas + ganho de peso estoque</div>
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

          <div className="rb-box" style={{ marginTop: 26 }}>
            <h3 style={{ margin: "0 0 6px" }}>Comparativo com o mercado</h3>
            <p className="rb-sub" style={{ marginTop: 0 }}>
              O indicador <b>Cepea/Esalq</b> para a @ em Minas Gerais fechou junho/2026 em torno de <b>R$ 317/@</b>.
              Com o custo da Rio Novo em <b>{money(data.custoArroba)}/@</b>, a margem bruta estimada é positiva — mas
              próxima do ponto de equilíbrio para a parcela de terminação intensiva (alto-grão).
              A curva futura B3 sinaliza alta no 2º semestre, justificando atrasar venda dos prontos para set/out.
            </p>
            <div className="rb-kstrip" style={{ ["--cols" as any]: 3, marginTop: 8 }}>
              <div className="rb-k">
                <div className="lab">Custo Rio Novo</div>
                <div className="val" style={{ fontSize: 20 }}>{money(data.custoArroba)}</div>
                <div className="d">/@ produzida</div>
              </div>
              <div className="rb-k">
                <div className="lab">Cepea MG (jun/26)</div>
                <div className="val" style={{ fontSize: 20 }}>R$ 317</div>
                <div className="d">/@ spot</div>
              </div>
              <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
                <div className="lab">Margem bruta</div>
                <div className="val" style={{ fontSize: 20, color: "var(--cafe)" }}>{money(317 - data.custoArroba)}</div>
                <div className="d">/@ · antes de impostos/frete</div>
              </div>
            </div>
            <p className="rb-sub" style={{ marginBottom: 0 }}>{data.nota}</p>
          </div>
        </>
      )}
    </main>
  );
}
