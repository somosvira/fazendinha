import { Loader } from "../../components/Loading";
import { useCustoProducao, useCustoSanidade } from "../api";
import { RebHeader } from "./RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebBox, RebAnm, RebEmpty } from "@/components/rb/RebPrimitives";
import { fmtMoneyExact } from "@/components/charts";

const money = fmtMoneyExact;
const litros = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export function CustoProducaoTab() {
  const { data, loading, erro } = useCustoProducao(12);
  const { data: san, loading: sanLoading, erro: sanErro } = useCustoSanidade(12);

  const custoTxt = data?.custoVacaDia != null ? money(data.custoVacaDia) : "—";
  const custoLitroTxt = data?.custoLitro != null ? money(data.custoLitro) : "—";

  return (
    <RebMain>
      <RebHeader eyebrow="Rebanho · custo de produção" title="Custo de Produção" />

      {loading ? (
        <Loader />
      ) : (erro || !data) ? (
        <p className="mt-[7px] text-sm text-prejuizo">Erro ao carregar: {erro ?? "sem dados"}</p>
      ) : (
        <>
          {/* Headline KPIs — custo/litro (real, herói) + custeio do leite + custo vaca/dia + vacas em lactação */}
          <RebKpiStrip cols={4}>
            <div className="relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5" style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className="text-sm font-semibold uppercase tracking-[.06em] text-ink-2">Custo / litro</div>
              <div className="mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)]" style={{ fontSize: 30, color: "var(--cafe)" }}>{custoLitroTxt}</div>
              <div className="mt-2 text-[15px] font-medium text-ink-2">custeio do leite ÷ litros do período</div>
            </div>
            <RebKpi lab="Custeio do leite (real)" val={money(data.custeioLeiteTotal)} valClassName="text-[22px]" d={`${data.periodoMeses} meses · Atividade Leiteira`} />
            <RebKpi lab="Custo vaca/dia" val={custoTxt} d="consumo de insumo (Estoque)" />
            <RebKpi lab="Vacas em lactação" val={data.vacasEmLactacao} d={<>≈ {litros(data.litrosDia)} L/dia</>} />
          </RebKpiStrip>

          {/* Quebra por componente — categoria · valor · % com barra (largura = pct%) */}
          <h2 className="font-serif text-xl font-medium mb-3">Quebra por componente</h2>
          {data.breakdown.length === 0 ? (
            <RebEmpty>Sem custeio do leite no período.</RebEmpty>
          ) : (
            <RebTable>
              <thead><tr><th>Categoria</th><th style={{ width: "45%" }}>Participação</th><th>Valor</th><th>%</th></tr></thead>
              <tbody>
                {data.breakdown.map((l) => (
                  <tr key={l.categoria}>
                    <td><RebAnm>{l.categoria}</RebAnm></td>
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
            </RebTable>
          )}

          {/* Card de transparência — como o custo/litro é calculado */}
          <RebBox style={{ marginTop: 26 }}>
            <h3 style={{ margin: "0 0 6px" }}>Como calculamos o custo/litro</h3>
            <p className="mt-0 text-sm text-ink-3">{data.nota}</p>
            <RebKpiStrip cols={3} className="mt-2">
              <RebKpi lab="Custeio (real)" val={money(data.custeioLeiteTotal)} valClassName="text-[20px]" d={`fazenda inteira · ${data.periodoMeses} meses`} />
              <RebKpi lab="Litros do período" val={<>{litros(data.litrosPeriodoEstimado)} L</>} valClassName="text-[20px]" d={<>{data.vacasEmLactacao} vacas × ≈ {litros(data.litrosDia)} L/dia</>} />
              <div className="relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5" style={{ borderLeft: "3px solid var(--leite)" }}>
                <div className="text-sm font-semibold uppercase tracking-[.06em] text-ink-2">Custo / litro</div>
                <div className="mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)]" style={{ fontSize: 20, color: "var(--cafe)" }}>{custoLitroTxt}</div>
                <div className="mt-2 text-[15px] font-medium text-ink-2">custeio ÷ litros</div>
              </div>
            </RebKpiStrip>
            <p className="mb-0 text-sm text-ink-3">
              Os litros são uma estimativa: a produção média atual das vacas em lactação projetada para o período. À medida que entram novos controles leiteiros, o número se aproxima da produção realizada de fato.
            </p>
          </RebBox>
        </>
      )}

      {/* ── Custo de sanidade (Fatia 18) — sempre visível ───────────────────── */}
      <h2 className="font-serif text-xl font-medium mb-3">Custo de sanidade (estimado)</h2>

      {sanLoading ? (
        <Loader />
      ) : (sanErro || !san) ? (
        <p className="mt-[7px] text-sm text-prejuizo">Erro ao carregar: {sanErro ?? "sem dados"}</p>
      ) : (
        <>
          {/* KPIs */}
          <RebKpiStrip cols={3}>
            <RebKpi lab="Gasto Medicamento (real)" val={money(san.totalMedicamento)} />
            <RebKpi lab="Aplicações" val={san.totalAplicacoes.toLocaleString("pt-BR")} />
            <RebKpi lab="R$ / aplicação" val={money(san.custoPorAplicacao)} />
          </RebKpiStrip>

          {/* Ranking de animais */}
          {san.topAnimais.length > 0 && (
            <>
              <h2 className="font-serif text-xl font-medium mb-3">Animais com maior custo estimado</h2>
              <RebTable>
                <thead>
                  <tr>
                    <th>Animal</th>
                    <th style={{ width: "40%" }}>Participação</th>
                    <th>Nº aplicações</th>
                    <th>Custo estimado</th>
                    <th>Custo exato</th>
                  </tr>
                </thead>
                <tbody>
                  {san.topAnimais.map((a) => {
                    const maxCusto = san.topAnimais[0].custoEstimado;
                    const pct = maxCusto > 0 ? (a.custoEstimado / maxCusto) * 100 : 0;
                    return (
                      <tr key={a.numero}>
                        <td><RebAnm>{a.nome} #{a.numero}</RebAnm></td>
                        <td>
                          <div style={{ background: "var(--rb-bar-bg, rgba(0,0,0,.06))", borderRadius: 4, height: 10, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, background: "var(--leite)", height: "100%" }} />
                          </div>
                        </td>
                        <td>{a.n}</td>
                        <td>{money(a.custoEstimado)}</td>
                        <td>{a.custoExato > 0 ? money(a.custoExato) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </RebTable>
            </>
          )}

          {/* Top produtos */}
          {san.produtos.length > 0 && (
            <>
              <h2 className="font-serif text-xl font-medium mb-3">Produtos mais aplicados</h2>
              <RebTable>
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
              </RebTable>
              <p className="mt-[7px] text-sm text-ink-3">
                Custo exato: {money(san.custoExatoTotal)} · {san.produtosPrecificados} de {san.produtosTotais} produtos precificados — defina o custo unitário no Cadastros.
              </p>
            </>
          )}

          {/* Card de transparência */}
          <RebBox style={{ marginTop: 26 }}>
            <h3 style={{ margin: "0 0 6px" }}>Como estimamos</h3>
            <p className="mt-0 mb-0 text-sm text-ink-3">{san.nota}</p>
          </RebBox>
        </>
      )}
    </RebMain>
  );
}
