import { useCustoProducao } from "../api";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const litros = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export function CustoProducaoTab() {
  const { data, loading, erro } = useCustoProducao(12);

  if (loading) {
    return (
      <main className="rb-main">
        <div className="rb-eyebrow">Rebanho · custo de produção</div>
        <div className="rb-head"><h1>Custo de Produção</h1></div>
        <p className="rb-sub">Carregando…</p>
      </main>
    );
  }

  if (erro || !data) {
    return (
      <main className="rb-main">
        <div className="rb-eyebrow">Rebanho · custo de produção</div>
        <div className="rb-head"><h1>Custo de Produção</h1></div>
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro ao carregar: {erro ?? "sem dados"}</p>
      </main>
    );
  }

  const custoTxt = data.custoVacaDia != null ? money(data.custoVacaDia) : "—";

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Rebanho · custo de produção</div>
      <div className="rb-head"><h1>Custo de Produção</h1></div>

      {/* Headline KPIs — custeio do leite (real, destaque) + custo vaca/dia + vacas em lactação */}
      <div className="rb-kstrip" style={{ ["--cols" as any]: 3 }}>
        <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className="lab">Custeio do leite (real)</div>
          <div className="val" style={{ fontSize: 30, color: "var(--cafe)" }}>{money(data.custeioLeiteTotal)}</div>
          <div className="d">últimos {data.periodoMeses} meses · lançamentos da Atividade Leiteira</div>
        </div>
        <div className="rb-k">
          <div className="lab">Custo vaca/dia</div>
          <div className="val">{custoTxt}</div>
          <div className="d">consumo de insumo (Estoque)</div>
        </div>
        <div className="rb-k">
          <div className="lab">Vacas em lactação</div>
          <div className="val">{data.vacasEmLactacao}</div>
          <div className="d">base do rateio</div>
        </div>
      </div>

      {/* Quebra por componente — categoria · valor · % com barra (largura = pct%) */}
      <h2 className="rb-sec-title">Quebra por componente</h2>
      {data.breakdown.length === 0 ? (
        <div className="rb-empty">Sem custeio do leite no período.</div>
      ) : (
        <table className="rb-tbl">
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
        </table>
      )}

      {/* Card de transparência — por que não há custo/litro */}
      <div className="rb-box" style={{ marginTop: 26 }}>
        <h3 style={{ margin: "0 0 6px" }}>Custo/litro — pendente</h3>
        <p className="rb-sub" style={{ marginTop: 0 }}>{data.nota}</p>
        <div className="rb-kstrip" style={{ ["--cols" as any]: 2, marginTop: 8 }}>
          <div className="rb-k">
            <div className="lab">Custeio (real)</div>
            <div className="val" style={{ fontSize: 20 }}>{money(data.custeioLeiteTotal)}</div>
            <div className="d">fazenda inteira · {data.periodoMeses} meses</div>
          </div>
          <div className="rb-k">
            <div className="lab">Produção (demonstração)</div>
            <div className="val" style={{ fontSize: 20 }}>{litros(data.litrosPeriodoEstimado)} L</div>
            <div className="d">seed de {data.vacasEmLactacao} vacas em lactação</div>
          </div>
        </div>
        <p className="rb-sub" style={{ marginBottom: 0 }}>
          Dividir o custeio da fazenda inteira pela produção do seed daria um custo/litro sem sentido. O número real só aparece quando houver produção em escala da fazenda.
        </p>
      </div>
    </main>
  );
}
