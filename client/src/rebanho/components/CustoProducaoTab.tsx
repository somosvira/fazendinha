import { useCustoProducao, useCustoSanidade } from "../api";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const litros = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export function CustoProducaoTab() {
  const { data, loading, erro } = useCustoProducao(12);
  const { data: san, loading: sanLoading, erro: sanErro } = useCustoSanidade(12);

  const custoTxt = data?.custoVacaDia != null ? money(data.custoVacaDia) : "—";
  const custoLitroTxt = data?.custoLitro != null ? money(data.custoLitro) : "—";

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Rebanho · custo de produção</div>
      <div className="rb-head"><h1>Custo de Produção</h1></div>

      {loading ? (
        <p className="rb-sub">Carregando…</p>
      ) : (erro || !data) ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro ao carregar: {erro ?? "sem dados"}</p>
      ) : (
        <>
          {/* Headline KPIs — custo/litro (real, herói) + custeio do leite + custo vaca/dia + vacas em lactação */}
          <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
            <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className="lab">Custo / litro</div>
              <div className="val" style={{ fontSize: 30, color: "var(--cafe)" }}>{custoLitroTxt}</div>
              <div className="d">custeio do leite ÷ litros do período</div>
            </div>
            <div className="rb-k">
              <div className="lab">Custeio do leite (real)</div>
              <div className="val" style={{ fontSize: 22 }}>{money(data.custeioLeiteTotal)}</div>
              <div className="d">{data.periodoMeses} meses · Atividade Leiteira</div>
            </div>
            <div className="rb-k">
              <div className="lab">Custo vaca/dia</div>
              <div className="val">{custoTxt}</div>
              <div className="d">consumo de insumo (Estoque)</div>
            </div>
            <div className="rb-k">
              <div className="lab">Vacas em lactação</div>
              <div className="val">{data.vacasEmLactacao}</div>
              <div className="d">≈ {litros(data.litrosDia)} L/dia</div>
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

          {/* Card de transparência — como o custo/litro é calculado */}
          <div className="rb-box" style={{ marginTop: 26 }}>
            <h3 style={{ margin: "0 0 6px" }}>Como calculamos o custo/litro</h3>
            <p className="rb-sub" style={{ marginTop: 0 }}>{data.nota}</p>
            <div className="rb-kstrip" style={{ ["--cols" as any]: 3, marginTop: 8 }}>
              <div className="rb-k">
                <div className="lab">Custeio (real)</div>
                <div className="val" style={{ fontSize: 20 }}>{money(data.custeioLeiteTotal)}</div>
                <div className="d">fazenda inteira · {data.periodoMeses} meses</div>
              </div>
              <div className="rb-k">
                <div className="lab">Litros do período</div>
                <div className="val" style={{ fontSize: 20 }}>{litros(data.litrosPeriodoEstimado)} L</div>
                <div className="d">{data.vacasEmLactacao} vacas × ≈ {litros(data.litrosDia)} L/dia</div>
              </div>
              <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
                <div className="lab">Custo / litro</div>
                <div className="val" style={{ fontSize: 20, color: "var(--cafe)" }}>{custoLitroTxt}</div>
                <div className="d">custeio ÷ litros</div>
              </div>
            </div>
            <p className="rb-sub" style={{ marginBottom: 0 }}>
              Os litros são uma estimativa: a produção média atual das vacas em lactação projetada para o período. À medida que entram novos controles leiteiros, o número se aproxima da produção realizada de fato.
            </p>
          </div>
        </>
      )}

      {/* ── Custo de sanidade (Fatia 18) — sempre visível ───────────────────── */}
      <h2 className="rb-sec-title">Custo de sanidade (estimado)</h2>

      {sanLoading ? (
        <p className="rb-sub">Carregando…</p>
      ) : (sanErro || !san) ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro ao carregar: {sanErro ?? "sem dados"}</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="rb-kstrip" style={{ ["--cols" as any]: 3 }}>
            <div className="rb-k">
              <div className="lab">Gasto Medicamento (real)</div>
              <div className="val">{money(san.totalMedicamento)}</div>
            </div>
            <div className="rb-k">
              <div className="lab">Aplicações</div>
              <div className="val">{san.totalAplicacoes.toLocaleString("pt-BR")}</div>
            </div>
            <div className="rb-k">
              <div className="lab">R$ / aplicação</div>
              <div className="val">{money(san.custoPorAplicacao)}</div>
            </div>
          </div>

          {/* Ranking de animais */}
          {san.topAnimais.length > 0 && (
            <>
              <h2 className="rb-sec-title">Animais com maior custo estimado</h2>
              <table className="rb-tbl">
                <thead>
                  <tr>
                    <th>Animal</th>
                    <th style={{ width: "40%" }}>Participação</th>
                    <th>Nº aplicações</th>
                    <th>Custo estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {san.topAnimais.map((a) => {
                    const maxCusto = san.topAnimais[0].custoEstimado;
                    const pct = maxCusto > 0 ? (a.custoEstimado / maxCusto) * 100 : 0;
                    return (
                      <tr key={a.numero}>
                        <td className="rb-anm">{a.nome} #{a.numero}</td>
                        <td>
                          <div style={{ background: "var(--rb-bar-bg, rgba(0,0,0,.06))", borderRadius: 4, height: 10, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, background: "var(--leite)", height: "100%" }} />
                          </div>
                        </td>
                        <td>{a.n}</td>
                        <td>{money(a.custoEstimado)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {/* Top produtos */}
          {san.produtos.length > 0 && (
            <>
              <h2 className="rb-sec-title">Produtos mais aplicados</h2>
              <table className="rb-tbl">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Nº</th>
                    <th>Custo unit.</th>
                    <th>Custo total</th>
                  </tr>
                </thead>
                <tbody>
                  {san.produtos.map((p) => (
                    <tr key={p.produto}>
                      <td>{p.produto}</td>
                      <td>{p.n.toLocaleString("pt-BR")}</td>
                      <td>{p.custoUnitario != null ? money(p.custoUnitario) : "—"}</td>
                      <td>{p.custoExato != null ? money(p.custoExato) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="rb-sub">
                Custo exato: {money(san.custoExatoTotal)} · {san.produtosPrecificados} de {san.produtosTotais} produtos precificados — defina o custo unitário no Cadastros.
              </p>
            </>
          )}

          {/* Card de transparência */}
          <div className="rb-box" style={{ marginTop: 26 }}>
            <h3 style={{ margin: "0 0 6px" }}>Como estimamos</h3>
            <p className="rb-sub" style={{ marginTop: 0, marginBottom: 0 }}>{san.nota}</p>
          </div>
        </>
      )}
    </main>
  );
}
