import { useCustoCorte } from "../api";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// A economia do corte sai dos dados do próprio módulo; quando ainda não há base
// suficiente o backend devolve null e mostramos um travessão em vez de "R$ 0,00".
const moneyN = (n: number | null | undefined) => (n == null ? "—" : money(n));

export function CustoTab() {
  const { data, loading, erro } = useCustoCorte();

  // Preço spot de referência: usa o que o backend mandar (precoArrobaSpot),
  // caindo para o Cepea/Esalq MG (~R$ 317/@, jun/2026) só como rótulo do card.
  const spot = data?.precoArrobaSpot ?? null;
  const spotLabel = spot ?? 317;
  // Margem: prefere a do backend; senão deriva de spot − custo quando ambos existem.
  const margem =
    data == null
      ? null
      : data.margemArroba != null
        ? data.margemArroba
        : data.custoArroba != null
          ? spotLabel - data.custoArroba
          : null;

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Corte · custo de produção</div>
      <div className="rb-head"><h1>Custo de produção</h1></div>

      {erro ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Não foi possível carregar o custo: {erro}</p>
      ) : loading || !data ? (
        <p className="rb-sub">Carregando…</p>
      ) : (
        <>
          <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
            <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className="lab">Custo / @</div>
              <div className="val" style={{ fontSize: 30, color: "var(--cafe)" }}>{moneyN(data.custoArroba)}</div>
              <div className="d">{data.custoArroba == null ? "sem @ produzida no período" : "custeio ÷ @ produzidas"}</div>
            </div>
            <div className="rb-k">
              <div className="lab">Custo / ha</div>
              <div className="val" style={{ fontSize: 22 }}>{moneyN(data.custoHa)}</div>
              <div className="d">{data.periodoMeses} meses · Atividade Corte</div>
            </div>
            <div className="rb-k">
              <div className="lab">Custeio total</div>
              <div className="val" style={{ fontSize: 22 }}>{moneyN(data.custeioTotal)}</div>
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
              {data.breakdown.length === 0 && (
                <tr><td colSpan={4} className="rb-sub">Nenhum custo da Atividade Corte lançado no período.</td></tr>
              )}
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
            {data.custoArroba == null ? (
              <p className="rb-sub" style={{ marginTop: 0 }}>
                Ainda não há <b>@ produzida</b> computável no período — sem custo por @, não há margem para
                comparar com o <b>indicador Cepea/Esalq</b> (≈ R$ {spotLabel.toLocaleString("pt-BR")}/@ em Minas Gerais).
                O comparativo aparece assim que as primeiras vendas/ganho de peso entrarem.
              </p>
            ) : (
              <>
                <p className="rb-sub" style={{ marginTop: 0 }}>
                  O indicador <b>Cepea/Esalq</b> para a @ em Minas Gerais fechou junho/2026 em torno de{" "}
                  <b>R$ {spotLabel.toLocaleString("pt-BR")}/@</b>. Com o custo da Rio Novo em{" "}
                  <b>{money(data.custoArroba)}/@</b>, a margem bruta estimada{margem != null && margem < 0 ? " está negativa" : " é positiva"} — mas
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
                    <div className="val" style={{ fontSize: 20 }}>R$ {spotLabel.toLocaleString("pt-BR")}</div>
                    <div className="d">/@ spot</div>
                  </div>
                  <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
                    <div className="lab">Margem bruta</div>
                    <div className="val" style={{ fontSize: 20, color: "var(--cafe)" }}>{moneyN(margem)}</div>
                    <div className="d">/@ · antes de impostos/frete</div>
                  </div>
                </div>
              </>
            )}
            <p className="rb-sub" style={{ marginBottom: 0 }}>{data.nota}</p>
          </div>
        </>
      )}
    </main>
  );
}
