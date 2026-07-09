import { useEffect, useState } from "react";
import { useSafras, useTarefas, useApontamentos, excluirTarefa, excluirApontamento } from "../api";
import type { TarefaPlanejada } from "../types";
import { TarefaForm } from "./TarefaForm";
import { ApontamentoForm } from "./ApontamentoForm";
import { ToolbarSelect } from "@/components/ToolbarSelect";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

// Pill de status — reusa .rb-pill (e .bad/.ok onde o CSS já define tons).
const STATUS_LABEL: Record<string, string> = {
  PLANEJADA: "Planejada", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluída", CANCELADA: "Cancelada",
};
function StatusPill({ status }: { status: string }) {
  const cls = status === "CONCLUIDA" ? " ok" : status === "CANCELADA" ? " bad" : "";
  return <span className={"rb-pill" + cls}>{STATUS_LABEL[status] ?? status}</span>;
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
    <main className="rb-main">
      <div className="rb-eyebrow">Lavoura · Planejamento</div>
      <div className="rb-head"><h1>Planejamento da safra</h1></div>

      {erroSafras ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Não foi possível carregar as safras: {erroSafras}</p>
      ) : loadingSafras ? (
        <p className="rb-sub">Carregando…</p>
      ) : safras.length === 0 ? (
        <p className="rb-sub">Nenhuma safra cadastrada ainda.</p>
      ) : (
        <>
          {/* Seletor de safra */}
          <div className="rb-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 18px" }}>
            <label style={{ fontSize: 13, color: "var(--ink-3)" }}>Safra</label>
            <ToolbarSelect
              value={safraId != null ? String(safraId) : ""}
              onChange={(v) => setSafraId(Number(v))}
              ariaLabel="Escolher safra"
              placeholder="Escolher safra…"
              options={safras.map((s) => ({ value: String(s.id), label: `${s.nome}${s.fechada ? " · fechada" : ""}` }))}
            />
            {safra?.centroCustoNome && <span className="rb-sub" style={{ margin: 0 }}>Centro de custo: <b>{safra.centroCustoNome}</b></span>}
          </div>

          {/* KPI strip da safra selecionada */}
          {r && (
            <div className="rb-kstrip" style={{ ["--cols" as any]: 6 }}>
              <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
                <div className="lab">Custo previsto</div>
                <div className="val" style={{ fontSize: 20 }}>{money(r.custoPrevTotal)}</div>
                <div className="d">planejado na safra</div>
              </div>
              <div className="rb-k">
                <div className="lab">Custo realizado</div>
                <div className="val" style={{ fontSize: 20, color: "var(--cafe)" }}>{money(r.custoRealTotal)}</div>
                <div className="d">apurado até hoje</div>
              </div>
              <div className="rb-k">
                <div className="lab">% concluído</div>
                <div className="val">{pctConcluido}<u>%</u></div>
                <div className="d">{r.tarefasConcluidas}/{r.tarefasTotal} tarefas</div>
              </div>
              <div className="rb-k">
                <div className="lab">Horas-máquina</div>
                <div className="val">{r.horasMaquina.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}<u>h</u></div>
                <div className="d">apontadas</div>
              </div>
              <div className="rb-k">
                <div className="lab">Horas-homem</div>
                <div className="val">{r.horasHomem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}<u>h</u></div>
                <div className="d">apontadas</div>
              </div>
              <div className="rb-k">
                <div className="lab">Custo operacional</div>
                <div className="val" style={{ fontSize: 20 }}>{money(r.custoOperacional)}</div>
                <div className="d">máquina + homem</div>
              </div>
            </div>
          )}

          {/* Tarefas: previsto × realizado */}
          <div className="rb-listhead" style={{ marginTop: 26 }}>
            <h2 className="rb-sec-title" style={{ margin: 0 }}>Tarefas — planejado × realizado</h2>
            <button className="rb-btn pri" style={{ marginLeft: "auto" }} disabled={safra?.fechada} onClick={() => setFormTarefa({ modo: "novo" })}>+ Nova tarefa</button>
          </div>

          {erroTarefas ? (
            <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro ao carregar tarefas: {erroTarefas}</p>
          ) : loadingTarefas ? (
            <p className="rb-sub">Carregando tarefas…</p>
          ) : (
            <div className="rb-tbl-wrap"><table className="rb-tbl">
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
                  <tr><td colSpan={11} className="rb-sub">Nenhuma tarefa nesta safra. Use “+ Nova tarefa”.</td></tr>
                )}
                {tarefas.map((tf) => (
                  <tr key={tf.id}>
                    <td className="rb-anm">{tf.descricao}</td>
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
                      <button className="rb-btn" disabled={safra?.fechada} onClick={() => setFormTarefa({ modo: "realizar", tarefa: tf })}>Realizar</button>
                      <button className="rb-btn" style={{ marginLeft: 6 }} disabled={safra?.fechada} onClick={() => removerTarefa(tf.id)} aria-label="Excluir tarefa">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}

          {/* Hora-máquina / hora-homem */}
          <div className="rb-listhead" style={{ marginTop: 26 }}>
            <h2 className="rb-sec-title" style={{ margin: 0 }}>Hora-máquina / hora-homem</h2>
            <button className="rb-btn pri" style={{ marginLeft: "auto" }} disabled={safra?.fechada} onClick={() => setFormApt(true)}>+ Apontar</button>
          </div>

          {loadingApt ? (
            <p className="rb-sub">Carregando apontamentos…</p>
          ) : (
            <div className="rb-tbl-wrap"><table className="rb-tbl">
              <thead><tr><th>Data</th><th>Tipo</th><th>Recurso</th><th>Operador</th><th>Horas</th><th>R$</th><th></th></tr></thead>
              <tbody>
                {apontamentos.length === 0 && (
                  <tr><td colSpan={7} className="rb-sub">Nenhum apontamento nesta safra.</td></tr>
                )}
                {apontamentos.map((a) => (
                  <tr key={a.id}>
                    <td>{dateN(a.data)}</td>
                    <td><span className="rb-pill">{a.tipo === "MAQUINA" ? "Máquina" : "Homem"}</span></td>
                    <td className="rb-anm">{a.recurso}{a.implemento ? <small> · {a.implemento}</small> : null}</td>
                    <td>{a.operador ?? "—"}</td>
                    <td>{horasFmt(a.horas)}</td>
                    <td>{moneyN(a.valorTotal)}</td>
                    <td><button className="rb-btn" disabled={safra?.fechada} onClick={() => removerApt(a.id)} aria-label="Excluir apontamento">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
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
    </main>
  );
}
