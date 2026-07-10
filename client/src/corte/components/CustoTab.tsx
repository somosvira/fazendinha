import { Loader } from "../../components/Loading";
import { useCustoCorte } from "../api";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebBox, RebAnm } from "@/components/rb/RebPrimitives";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// A economia do corte sai dos dados do próprio módulo; quando ainda não há base
// suficiente o backend devolve null e mostramos um travessão em vez de "R$ 0,00".
const moneyN = (n: number | null | undefined) => (n == null ? "—" : money(n));

// .rb-k — célula base custom (borda leite, tamanho de fonte próprio).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)]";
const RB_K_D = "mt-2 text-[15px] font-medium text-ink-2";

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
    <RebMain>
      <RebHeader eyebrow="Corte · custo de produção" title="Custo de produção" />

      {erro ? (
        <p className="text-sm text-prejuizo">Não foi possível carregar o custo: {erro}</p>
      ) : loading || !data ? (
        <Loader />
      ) : (
        <>
          <RebKpiStrip cols={4}>
            <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className={RB_K_LAB}>Custo / @</div>
              <div className={RB_K_VAL} style={{ fontSize: 30, color: "var(--cafe)" }}>{moneyN(data.custoArroba)}</div>
              <div className={RB_K_D}>{data.custoArroba == null ? "sem @ produzida no período" : "custeio ÷ @ produzidas"}</div>
            </div>
            <RebKpi lab="Custo / ha" val={moneyN(data.custoHa)} valClassName="text-[22px]" d={`${data.periodoMeses} meses · Atividade Corte`} />
            <RebKpi lab="Custeio total" val={moneyN(data.custeioTotal)} valClassName="text-[22px]" d={`últimos ${data.periodoMeses} meses`} />
            <RebKpi lab="@ produzidas" val={<>{data.arrobasProduzidas.toLocaleString("pt-BR")}<u>@</u></>} d="vendidas + ganho de peso estoque" />
          </RebKpiStrip>

          <h2 className="font-serif text-xl font-medium mb-3">Quebra por componente</h2>
          <RebTable>
            <thead><tr><th>Categoria</th><th style={{ width: "45%" }}>Participação</th><th>Valor</th><th>%</th></tr></thead>
            <tbody>
              {data.breakdown.length === 0 && (
                <tr><td colSpan={4} className="text-sm text-ink-3">Nenhum custo da Atividade Corte lançado no período.</td></tr>
              )}
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

          <RebBox style={{ marginTop: 26 }}>
            <h3 style={{ margin: "0 0 6px" }}>Comparativo com o mercado</h3>
            {data.custoArroba == null ? (
              <p className="text-sm text-ink-3" style={{ marginTop: 0 }}>
                Ainda não há <b>@ produzida</b> computável no período — sem custo por @, não há margem para
                comparar com o <b>indicador Cepea/Esalq</b> (≈ R$ {spotLabel.toLocaleString("pt-BR")}/@ em Minas Gerais).
                O comparativo aparece assim que as primeiras vendas/ganho de peso entrarem.
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-3" style={{ marginTop: 0 }}>
                  O indicador <b>Cepea/Esalq</b> para a @ em Minas Gerais fechou junho/2026 em torno de{" "}
                  <b>R$ {spotLabel.toLocaleString("pt-BR")}/@</b>. Com o custo da Rio Novo em{" "}
                  <b>{money(data.custoArroba)}/@</b>, a margem bruta estimada{margem != null && margem < 0 ? " está negativa" : " é positiva"} — mas
                  próxima do ponto de equilíbrio para a parcela de terminação intensiva (alto-grão).
                  A curva futura B3 sinaliza alta no 2º semestre, justificando atrasar venda dos prontos para set/out.
                </p>
                <RebKpiStrip cols={3} className="mt-2">
                  <RebKpi lab="Custo Rio Novo" val={money(data.custoArroba)} valClassName="text-[20px]" d="/@ produzida" />
                  <RebKpi lab="Cepea MG (jun/26)" val={<>R$ {spotLabel.toLocaleString("pt-BR")}</>} valClassName="text-[20px]" d="/@ spot" />
                  <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
                    <div className={RB_K_LAB}>Margem bruta</div>
                    <div className={RB_K_VAL} style={{ fontSize: 20, color: "var(--cafe)" }}>{moneyN(margem)}</div>
                    <div className={RB_K_D}>/@ · antes de impostos/frete</div>
                  </div>
                </RebKpiStrip>
              </>
            )}
            <p className="text-sm text-ink-3" style={{ marginBottom: 0 }}>{data.nota}</p>
          </RebBox>
        </>
      )}
    </RebMain>
  );
}
