import { useState } from "react";
import { Loader } from "../../components/Loading";
import { useCustoPlantio, useCustoOperacionalCafe, useSafras } from "../api";
import { ClasseToggle, type Classe } from "../../components/ClasseToggle";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebKpiStrip } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebBox, RebAnm } from "@/components/rb/RebPrimitives";
import { ToolbarSelect } from "@/components/ToolbarSelect";
import { fmtMoneyExact } from "@/components/charts";

// .rb-k — célula base da faixa de KPI (a 1ª perde a border-left dentro do grid).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)] [&_u]:ml-1 [&_u]:text-[15px] [&_u]:font-medium [&_u]:not-italic [&_u]:no-underline [&_u]:text-ink-2";
const RB_K_D = "mt-2 text-[15px] font-medium text-ink-2";

const money = fmtMoneyExact;
// Em fase de formação não há saca/ha computável — o backend devolve null e
// mostramos um travessão em vez de "R$ 0,00".
const moneyN = (n: number | null) => (n == null ? "—" : money(n));
const sc = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export function CustoTab() {
  // Toggle §6.4 — muda só o headline financeiro; custo/saca e custo/ha
  // continuam sobre custeio (o backend garante).
  const [classe, setClasse] = useState<Classe>("custeio");
  const { data, loading, erro } = useCustoPlantio(12, classe);

  // Custo OPERACIONAL por safra (padrão de seletor da PlanejamentoTab):
  // sem seleção explícita, usa a safra mais recente (primeira da listagem).
  const { data: safras, loading: loadingSafras } = useSafras();
  const [safraId, setSafraId] = useState<number | "">("");
  const safraAtual = safraId === "" ? safras[0] : safras.find((s) => s.id === safraId);
  const { data: op, loading: loadingOp, erro: erroOp } = useCustoOperacionalCafe(safraAtual?.id ?? null);

  return (
    <RebMain>
      <RebHeader eyebrow="Lavoura · custo de produção" title="Custo de produção" />

      <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
        <ToolbarSelect
          value={String(safraId)}
          onChange={(v) => setSafraId(v ? Number(v) : "")}
          ariaLabel="Escolher safra"
          options={[
            { value: "", label: safraAtual ? `${safraAtual.nome} (mais recente)` : loadingSafras ? "Carregando safras…" : "Sem safra cadastrada" },
            ...safras.map((s) => ({ value: String(s.id), label: s.nome })),
          ]}
        />
        <ClasseToggle value={classe} onChange={setClasse} />
      </div>

      {erro ? (
        <p className="text-sm text-prejuizo">Não foi possível carregar o custo: {erro}</p>
      ) : loading || !data ? (
        <Loader />
      ) : (
        <>
          <RebKpiStrip cols={4}>
            <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className={RB_K_LAB}>Custo / saca</div>
              <div className={RB_K_VAL + " !text-[30px] text-cafe"}>{moneyN(data.custoSaca)}</div>
              <div className={RB_K_D}>{data.custoSaca == null ? "sem benefício no período (formação)" : "custeio ÷ sacas do período"}</div>
            </div>
            <div className={RB_K}>
              <div className={RB_K_LAB}>Custo / ha</div>
              <div className={RB_K_VAL + " !text-[22px]"}>{moneyN(data.custoHa)}</div>
              <div className={RB_K_D}>{data.periodoMeses} meses · Atividade Café</div>
            </div>
            <div className={RB_K}>
              <div className={RB_K_LAB}>Total ({classe === "tudo" ? "custeio + investimento" : classe})</div>
              <div className={RB_K_VAL + " !text-[22px]"}>{money(data.custoTotal)}</div>
              <div className={RB_K_D}>últimos {data.periodoMeses} meses</div>
            </div>
            <div className={RB_K}>
              <div className={RB_K_LAB}>Sacas no período</div>
              <div className={RB_K_VAL}>{sc(data.sacasPeriodo)}<u>sc</u></div>
              <div className={RB_K_D}>benefício estimado</div>
            </div>
          </RebKpiStrip>

          {/* Operacional × Financeiro (Fase 1c) — o custo operacional vem das
              operações reais da safra selecionada (tarefas + hora-máquina),
              aditivo à leitura financeira acima. */}
          <RebBox className="mt-[26px]">
            <h3 className="mb-1.5 mt-0 font-serif font-medium">Operacional × Financeiro{safraAtual ? ` — ${safraAtual.nome}` : ""}</h3>
            {erroOp ? (
              <p className="mt-0 text-sm text-prejuizo">Não foi possível carregar o custo operacional: {erroOp}</p>
            ) : !safraAtual && !loadingSafras ? (
              <p className="mt-0 text-sm text-ink-3">Cadastre uma safra (aba Planejamento) para ver o custo operacional das operações reais.</p>
            ) : loadingOp || !op ? (
              <Loader />
            ) : (
              <>
                <RebKpiStrip cols={4} className="mt-2">
                  <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
                    <div className={RB_K_LAB}>Custeio operacional</div>
                    <div className={RB_K_VAL + " !text-[20px] text-cafe"}>{money(op.custeioTotal)}</div>
                    <div className={RB_K_D}>tarefas + hora-máquina da safra</div>
                  </div>
                  <div className={RB_K}>
                    <div className={RB_K_LAB}>Custo / saca (operacional)</div>
                    <div className={RB_K_VAL + " !text-[20px]"}>{moneyN(op.custoSaca)}</div>
                    <div className={RB_K_D}>financeiro: {moneyN(data.custoSaca)}</div>
                  </div>
                  <div className={RB_K}>
                    <div className={RB_K_LAB}>Custo / ha (operacional)</div>
                    <div className={RB_K_VAL + " !text-[20px]"}>{moneyN(op.custoHa)}</div>
                    <div className={RB_K_D}>financeiro: {moneyN(data.custoHa)}</div>
                  </div>
                  <div className={RB_K}>
                    <div className={RB_K_LAB}>Sacas na safra</div>
                    <div className={RB_K_VAL + " !text-[20px]"}>{sc(op.sacas)}<u>sc</u></div>
                    <div className={RB_K_D}>{op.areaHa.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha ativos</div>
                  </div>
                </RebKpiStrip>
                <p className="mb-0 text-sm text-ink-3">{op.nota}</p>
              </>
            )}
          </RebBox>

          <h2 className="mb-3 mt-6 font-serif text-xl font-medium">Quebra por componente</h2>
          <RebTable>
            <thead><tr><th>Categoria</th><th style={{ width: "45%" }}>Participação</th><th>Valor</th><th>%</th></tr></thead>
            <tbody>
              {data.breakdown.length === 0 && (
                <tr><td colSpan={4} className="text-ink-3">Nenhum custo da Atividade Café lançado no período.</td></tr>
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

          {/* Comparativo com benchmark — Conab/Cepea (só quando há custo/saca) */}
          <RebBox className="mt-[26px]">
            <h3 className="mb-1.5 mt-0 font-serif font-medium">Comparativo com o mercado</h3>
            {data.custoSaca == null ? (
              <p className="mt-0 text-sm text-ink-3">
                Os talhões ainda estão em <b>formação</b> — sem benefício de café no período, não há custo por saca
                para comparar com o <b>indicador Cepea/Esalq</b> (≈ R$ 1.880/sc para o arábica tipo 6 em maio/2026).
                O comparativo de margem aparece assim que a primeira colheita for lançada.
              </p>
            ) : (
              <>
                <p className="mt-0 text-sm text-ink-3">
                  O <b>indicador Cepea/Esalq</b> para o arábica fechou maio/2026 em torno de <b>R$ 1.880/sc</b> (tipo 6, descrito).
                  Considerando o custo da fazenda em <b>{money(data.custoSaca)}/sc</b>, a margem bruta estimada é positiva — mas
                  a Conab projeta safra recorde 2026 (28% acima de 2025), o que pode pressionar o preço no 2º semestre.
                </p>
                <RebKpiStrip cols={3} className="mt-2">
                  <div className={RB_K}>
                    <div className={RB_K_LAB}>Custo Rio Novo</div>
                    <div className={RB_K_VAL + " !text-[20px]"}>{money(data.custoSaca)}</div>
                    <div className={RB_K_D}>/saca beneficiada</div>
                  </div>
                  <div className={RB_K}>
                    <div className={RB_K_LAB}>Cepea (referência)</div>
                    <div className={RB_K_VAL + " !text-[20px]"}>R$ 1.880</div>
                    <div className={RB_K_D}>/saca · arábica tipo 6</div>
                  </div>
                  <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
                    <div className={RB_K_LAB}>Margem bruta estimada</div>
                    <div className={RB_K_VAL + " !text-[20px] text-cafe"}>{money(1880 - data.custoSaca)}</div>
                    <div className={RB_K_D}>/saca · antes de impostos</div>
                  </div>
                </RebKpiStrip>
              </>
            )}
            <p className="mb-0 text-sm text-ink-3">{data.nota}</p>
          </RebBox>
        </>
      )}
    </RebMain>
  );
}
