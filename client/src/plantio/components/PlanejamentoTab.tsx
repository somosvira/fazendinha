import { useEffect, useState } from "react";
import { Loader } from "../../components/Loading";
import { useSafras, useTarefas, useApontamentos, excluirTarefa, excluirApontamento } from "../api";
import type { TarefaPlanejada } from "../types";
import { TarefaForm } from "./TarefaForm";
import { ApontamentoForm } from "./ApontamentoForm";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebButton } from "@/components/rb/RebButton";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebPill, RebAnm } from "@/components/rb/RebPrimitives";
import { ToolbarSelect } from "@/components/ToolbarSelect";
import { fmtMoneyExact } from "@/components/charts";

// .rb-k — célula base da faixa de KPI (a 1ª perde a border-left dentro do grid).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)] [&_u]:ml-1 [&_u]:text-[15px] [&_u]:font-medium [&_u]:not-italic [&_u]:no-underline [&_u]:text-ink-2";
const RB_K_D = "mt-2 text-[15px] font-medium text-ink-2";

const money = fmtMoneyExact;
const moneyN = (n: number | null | undefined) => (n == null ? "—" : money(n));
const numN = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
const dateN = (s: string | null | undefined) => (s ? s.split("-").reverse().join("/") : "—");
const horasFmt = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;

// Rótulos amigáveis pro TipoOperacao (cobre os usados; cai no próprio código senão).
const TIPO_LABEL: Record<string, string> = {
  ADUBACAO_SOLO: "Adubação solo", ADUBACAO_FOLIAR: "Adubação foliar",
  CALAGEM: "Calagem", GESSAGEM: "Gessagem",
  APLICACAO_FUNGICIDA: "Fungicida", APLICACAO_INSETICIDA: "Inseticida", APLICACAO_HERBICIDA: "Herbicida",
  ROCAGEM_MECANICA: "Roçagem", CAPINA_MANUAL: "Capina",
  PODA_RECEPA: "Recepa", PODA_DECOTE: "Decote", PODA_ESQUELETAMENTO: "Esqueletamento", PODA_DESPONTE: "Desponte",
  DESBROTA: "Desbrota", IRRIGACAO: "Irrigação", REPLANTIO: "Replantio",
  AMOSTRAGEM_SOLO: "Amostr. solo", AMOSTRAGEM_FOLIAR: "Amostr. foliar", MONITORAMENTO_MIP: "Inspeção MIP",
};
const tipoLabel = (t: string) => TIPO_LABEL[t] ?? t.replace(/_/g, " ").toLowerCase();

// Pill de status — RebPill; tom "bad" p/ cancelada, default p/ os demais.
const STATUS_LABEL: Record<string, string> = {
  PLANEJADA: "Planejada", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluída", CANCELADA: "Cancelada",
};
function StatusPill({ status }: { status: string }) {
  return <RebPill tone={status === "CANCELADA" ? "bad" : "ok"}>{STATUS_LABEL[status] ?? status}</RebPill>;
}

export function PlanejamentoTab() {
  const { data: safras, loading: loadingSafras, erro: erroSafras } = useSafras();
  const [safraId, setSafraId] = useState<number | null>(null);

  // Default: primeira safra (backend devolve mais recente primeiro).
  useEffect(() => {
    if (safraId == null && safras.length) setSafraId(safras[0].id);
  }, [safras, safraId]);

  const { data: tarefas, loading: loadingTarefas, erro: erroTarefas, recarregar: recTarefas } = useTarefas(safraId);
  const { data: apontamentos, loading: loadingApt, recarregar: recApt } = useApontamentos(safraId);

  const [formTarefa, setFormTarefa] = useState<{ modo: "novo" | "realizar"; tarefa?: TarefaPlanejada } | null>(null);
  const [formApt, setFormApt] = useState(false);

  const safra = safras.find((s) => s.id === safraId) ?? null;
  const r = safra?.resumo;
  const pctConcluido = r && r.tarefasTotal > 0 ? Math.round((r.tarefasConcluidas / r.tarefasTotal) * 100) : 0;

  async function removerTarefa(id: number) {
    if (!confirm("Excluir esta tarefa?")) return;
    try { await excluirTarefa(id); recTarefas(); } catch (e: any) { alert(e?.message ?? "Erro ao excluir."); }
  }
  async function removerApt(id: number) {
    if (!confirm("Excluir este apontamento?")) return;
    try { await excluirApontamento(id); recApt(); } catch (e: any) { alert(e?.message ?? "Erro ao excluir."); }
  }

  return (
    <RebMain>
      <RebHeader eyebrow="Lavoura · Planejamento" title="Planejamento da safra" />

      {erroSafras ? (
        <p className="text-sm text-prejuizo">Não foi possível carregar as safras: {erroSafras}</p>
      ) : loadingSafras ? (
        <Loader />
      ) : safras.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhuma safra cadastrada ainda.</p>
      ) : (
        <>
          {/* Seletor de safra */}
          <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
            <label className="text-sm text-ink-3">Safra</label>
            <ToolbarSelect
              value={safraId != null ? String(safraId) : ""}
              onChange={(v) => setSafraId(Number(v))}
              ariaLabel="Escolher safra"
              placeholder="Escolher safra…"
              options={safras.map((s) => ({ value: String(s.id), label: `${s.nome}${s.fechada ? " · fechada" : ""}` }))}
            />
            {safra?.centroCustoNome && <span className="text-sm text-ink-3">Centro de custo: <b>{safra.centroCustoNome}</b></span>}
          </div>

          {/* KPI strip da safra selecionada */}
          {r && (
            <RebKpiStrip cols={6}>
              <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
                <div className={RB_K_LAB}>Custo previsto</div>
                <div className={RB_K_VAL + " !text-[20px]"}>{money(r.custoPrevTotal)}</div>
                <div className={RB_K_D}>planejado na safra</div>
              </div>
              <div className={RB_K}>
                <div className={RB_K_LAB}>Custo realizado</div>
                <div className={RB_K_VAL + " !text-[20px] text-cafe"}>{money(r.custoRealTotal)}</div>
                <div className={RB_K_D}>apurado até hoje</div>
              </div>
              <div className={RB_K}>
                <div className={RB_K_LAB}>% concluído</div>
                <div className={RB_K_VAL}>{pctConcluido}<u>%</u></div>
                <div className={RB_K_D}>{r.tarefasConcluidas}/{r.tarefasTotal} tarefas</div>
              </div>
              <div className={RB_K}>
                <div className={RB_K_LAB}>Horas-máquina</div>
                <div className={RB_K_VAL}>{r.horasMaquina.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}<u>h</u></div>
                <div className={RB_K_D}>apontadas</div>
              </div>
              <div className={RB_K}>
                <div className={RB_K_LAB}>Horas-homem</div>
                <div className={RB_K_VAL}>{r.horasHomem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}<u>h</u></div>
                <div className={RB_K_D}>apontadas</div>
              </div>
              <div className={RB_K}>
                <div className={RB_K_LAB}>Custo operacional</div>
                <div className={RB_K_VAL + " !text-[20px]"}>{money(r.custoOperacional)}</div>
                <div className={RB_K_D}>máquina + homem</div>
              </div>
            </RebKpiStrip>
          )}

          {/* Tarefas: previsto × realizado */}
          <div className="mb-2 mt-[26px] flex items-baseline justify-between">
            <h2 className="m-0 font-serif text-xl font-medium">Tarefas — planejado × realizado</h2>
            <RebButton variant="pri" className="ml-auto" disabled={safra?.fechada} onClick={() => setFormTarefa({ modo: "novo" })}>+ Nova tarefa</RebButton>
          </div>

          {erroTarefas ? (
            <p className="text-sm text-prejuizo">Erro ao carregar tarefas: {erroTarefas}</p>
          ) : loadingTarefas ? (
            <Loader label="Carregando tarefas…" />
          ) : (
            <RebTable>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Talhão / Lavoura</th>
                  <th colSpan={3} style={{ textAlign: "center", borderLeft: "1px solid var(--rule)" }}>Previsto</th>
                  <th colSpan={3} style={{ textAlign: "center", borderLeft: "1px solid var(--rule)" }}>Realizado</th>
                  <th>Status</th>
                  <th></th>
                </tr>
                <tr>
                  <th></th><th></th><th></th>
                  <th style={{ borderLeft: "1px solid var(--rule)" }}>Qtd/ha</th><th>Data</th><th>R$</th>
                  <th style={{ borderLeft: "1px solid var(--rule)" }}>Qtd/ha</th><th>Data</th><th>R$</th>
                  <th></th><th></th>
                </tr>
              </thead>
              <tbody>
                {tarefas.length === 0 && (
                  <tr><td colSpan={11} className="text-ink-3">Nenhuma tarefa nesta safra. Use “+ Nova tarefa”.</td></tr>
                )}
                {tarefas.map((tf) => (
                  <tr key={tf.id}>
                    <td><RebAnm>{tf.descricao}</RebAnm></td>
                    <td>{tipoLabel(tf.tipo)}</td>
                    <td>{tf.talhaoCodigo ?? tf.lavouraNome ?? "—"}</td>
                    <td style={{ borderLeft: "1px solid var(--rule)" }}>{numN(tf.qtdHaPrev)}</td>
                    <td>{dateN(tf.dataPrevista)}</td>
                    <td>{moneyN(tf.custoPrev)}</td>
                    <td style={{ borderLeft: "1px solid var(--rule)" }}>{numN(tf.qtdHaReal)}</td>
                    <td>{dateN(tf.dataRealizada)}</td>
                    <td>{moneyN(tf.custoReal)}</td>
                    <td><StatusPill status={tf.status} /></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <RebButton disabled={safra?.fechada} onClick={() => setFormTarefa({ modo: "realizar", tarefa: tf })}>Realizar</RebButton>
                      <RebButton className="ml-1.5" disabled={safra?.fechada} onClick={() => removerTarefa(tf.id)} aria-label="Excluir tarefa">×</RebButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </RebTable>
          )}

          {/* Hora-máquina / hora-homem */}
          <div className="mb-2 mt-[26px] flex items-baseline justify-between">
            <h2 className="m-0 font-serif text-xl font-medium">Hora-máquina / hora-homem</h2>
            <RebButton variant="pri" className="ml-auto" disabled={safra?.fechada} onClick={() => setFormApt(true)}>+ Apontar</RebButton>
          </div>

          {loadingApt ? (
            <Loader label="Carregando apontamentos…" />
          ) : (
            <RebTable>
              <thead><tr><th>Data</th><th>Tipo</th><th>Recurso</th><th>Operador</th><th>Horas</th><th>R$</th><th></th></tr></thead>
              <tbody>
                {apontamentos.length === 0 && (
                  <tr><td colSpan={7} className="text-ink-3">Nenhum apontamento nesta safra.</td></tr>
                )}
                {apontamentos.map((a) => (
                  <tr key={a.id}>
                    <td>{dateN(a.data)}</td>
                    <td><RebPill>{a.tipo === "MAQUINA" ? "Máquina" : "Homem"}</RebPill></td>
                    <td><RebAnm>{a.recurso}{a.implemento ? <small> · {a.implemento}</small> : null}</RebAnm></td>
                    <td>{a.operador ?? "—"}</td>
                    <td>{horasFmt(a.horas)}</td>
                    <td>{moneyN(a.valorTotal)}</td>
                    <td><RebButton disabled={safra?.fechada} onClick={() => removerApt(a.id)} aria-label="Excluir apontamento">×</RebButton></td>
                  </tr>
                ))}
              </tbody>
            </RebTable>
          )}
        </>
      )}

      {formTarefa && safraId != null && (
        <TarefaForm
          modo={formTarefa.modo}
          safraId={safraId}
          tarefa={formTarefa.tarefa}
          onFechar={() => setFormTarefa(null)}
          onSalvo={() => { setFormTarefa(null); recTarefas(); }}
        />
      )}
      {formApt && safraId != null && (
        <ApontamentoForm
          safraId={safraId}
          onFechar={() => setFormApt(false)}
          onSalvo={() => { setFormApt(false); recApt(); }}
        />
      )}
    </RebMain>
  );
}
