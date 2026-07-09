import { useState } from "react";
import { useCustoPlantio, useCustoOperacionalCafe, useSafras } from "../api";
import { ClasseToggle, type Classe } from "../../components/ClasseToggle";
import { ToolbarSelect } from "@/components/ToolbarSelect";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
    <main className="rb-main">
      <div className="rb-eyebrow">Lavoura · custo de produção</div>
      <div className="rb-head"><h1>Custo de produção</h1></div>

      <div className="rb-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Não foi possível carregar o custo: {erro}</p>
      ) : loading || !data ? (
        <p className="rb-sub">Carregando…</p>
      ) : (
        <>
          <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
            <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className="lab">Custo / saca</div>
              <div className="val" style={{ fontSize: 30, color: "var(--cafe)" }}>{moneyN(data.custoSaca)}</div>
              <div className="d">{data.custoSaca == null ? "sem benefício no período (formação)" : "custeio ÷ sacas do período"}</div>
            </div>
            <div className="rb-k">
              <div className="lab">Custo / ha</div>
              <div className="val" style={{ fontSize: 22 }}>{moneyN(data.custoHa)}</div>
              <div className="d">{data.periodoMeses} meses · Atividade Café</div>
            </div>
            <div className="rb-k">
              <div className="lab">Total ({classe === "tudo" ? "custeio + investimento" : classe})</div>
              <div className="val" style={{ fontSize: 22 }}>{money(data.custoTotal)}</div>
              <div className="d">últimos {data.periodoMeses} meses</div>
            </div>
            <div className="rb-k">
              <div className="lab">Sacas no período</div>
              <div className="val">{sc(data.sacasPeriodo)}<u>sc</u></div>
              <div className="d">benefício estimado</div>
            </div>
          </div>

          {/* Operacional × Financeiro (Fase 1c) — o custo operacional vem das
              operações reais da safra selecionada (tarefas + hora-máquina),
              aditivo à leitura financeira acima. */}
          <div className="rb-box" style={{ marginTop: 26 }}>
            <h3 style={{ margin: "0 0 6px" }}>Operacional × Financeiro{safraAtual ? ` — ${safraAtual.nome}` : ""}</h3>
            {erroOp ? (
              <p className="rb-sub" style={{ color: "var(--neg)", marginTop: 0 }}>Não foi possível carregar o custo operacional: {erroOp}</p>
            ) : !safraAtual && !loadingSafras ? (
              <p className="rb-sub" style={{ marginTop: 0 }}>Cadastre uma safra (aba Planejamento) para ver o custo operacional das operações reais.</p>
            ) : loadingOp || !op ? (
              <p className="rb-sub" style={{ marginTop: 0 }}>Carregando…</p>
            ) : (
              <>
                <div className="rb-kstrip" style={{ ["--cols" as any]: 4, marginTop: 8 }}>
                  <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
                    <div className="lab">Custeio operacional</div>
                    <div className="val" style={{ fontSize: 20, color: "var(--cafe)" }}>{money(op.custeioTotal)}</div>
                    <div className="d">tarefas + hora-máquina da safra</div>
                  </div>
                  <div className="rb-k">
                    <div className="lab">Custo / saca (operacional)</div>
                    <div className="val" style={{ fontSize: 20 }}>{moneyN(op.custoSaca)}</div>
                    <div className="d">financeiro: {moneyN(data.custoSaca)}</div>
                  </div>
                  <div className="rb-k">
                    <div className="lab">Custo / ha (operacional)</div>
                    <div className="val" style={{ fontSize: 20 }}>{moneyN(op.custoHa)}</div>
                    <div className="d">financeiro: {moneyN(data.custoHa)}</div>
                  </div>
                  <div className="rb-k">
                    <div className="lab">Sacas na safra</div>
                    <div className="val" style={{ fontSize: 20 }}>{sc(op.sacas)}<u>sc</u></div>
                    <div className="d">{op.areaHa.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha ativos</div>
                  </div>
                </div>
                <p className="rb-sub" style={{ marginBottom: 0 }}>{op.nota}</p>
              </>
            )}
          </div>

          <h2 className="rb-sec-title">Quebra por componente</h2>
          <div className="rb-tbl-wrap"><table className="rb-tbl">
            <thead><tr><th>Categoria</th><th style={{ width: "45%" }}>Participação</th><th>Valor</th><th>%</th></tr></thead>
            <tbody>
              {data.breakdown.length === 0 && (
                <tr><td colSpan={4} className="rb-sub">Nenhum custo da Atividade Café lançado no período.</td></tr>
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

          {/* Comparativo com benchmark — Conab/Cepea (só quando há custo/saca) */}
          <div className="rb-box" style={{ marginTop: 26 }}>
            <h3 style={{ margin: "0 0 6px" }}>Comparativo com o mercado</h3>
            {data.custoSaca == null ? (
              <p className="rb-sub" style={{ marginTop: 0 }}>
                Os talhões ainda estão em <b>formação</b> — sem benefício de café no período, não há custo por saca
                para comparar com o <b>indicador Cepea/Esalq</b> (≈ R$ 1.880/sc para o arábica tipo 6 em maio/2026).
                O comparativo de margem aparece assim que a primeira colheita for lançada.
              </p>
            ) : (
              <>
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
              </>
            )}
            <p className="rb-sub" style={{ marginBottom: 0 }}>{data.nota}</p>
          </div>
        </>
      )}
    </main>
  );
}
