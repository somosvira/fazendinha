import { useState } from "react";
import {
  useAplicacoesIatf, useProtocolosIatf, aplicarProtocoloIatf, excluirAplicacaoIatf, executarEtapaIatf,
  type EtapaIatfStatusDTO,
} from "../api";
import { getHojeISO } from "../../lib/hoje";
import { CampoData } from "@/components/CampoData";
import { SelectBusca } from "@/components/SelectBusca";

// Gatilhos no mesmo look de caixa pequena dos inputs vizinhos.
const CAIXA_SELECT = "mt-0.5 w-auto min-w-44 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-[color:var(--ink)]";
const CAIXA_DATA = "mt-0.5 w-36 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-[color:var(--ink)]";

const fmtData = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR");

function statusLabel(et: EtapaIatfStatusDTO): string {
  if (et.status === "CONCLUIDA") return "feita";
  if (et.status === "PULADA") return "pulada";
  if (et.atrasada) return "atrasada";
  return "pendente";
}

// Aplica um protocolo IATF do catálogo a um animal com uma data de início (o D0)
// e permite marcar cada etapa como feita/pulada (execução real).
export function IatfSection({ animalId }: { animalId: string }) {
  const { data: aplicacoes, loading, recarregar } = useAplicacoesIatf(animalId);
  const { data: protocolos, loading: loadingProto } = useProtocolosIatf();
  const [protocoloId, setProtocoloId] = useState("");
  const [dataInicio, setDataInicio] = useState(getHojeISO());
  const [usoCidr, setUsoCidr] = useState(false);
  const [estimulo, setEstimulo] = useState("");
  const [perdaImplante, setPerdaImplante] = useState(false);
  const [detalhes, setDetalhes] = useState<Record<number, { produto: string; dose: string; observacao: string }>>({});
  const [salvando, setSalvando] = useState(false);
  const [busyExec, setBusyExec] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (loading || loadingProto) return null;
  const lista = aplicacoes ?? [];
  const protos = protocolos ?? [];

  async function aplicar(e: React.FormEvent) {
    e.preventDefault();
    if (!protocoloId || !dataInicio) return;
    setSalvando(true); setErro(null);
    try {
      await aplicarProtocoloIatf(animalId, {
        protocoloId: Number(protocoloId),
        dataInicio,
        usoCidr,
        estimulo: estimulo.trim() || undefined,
        perdaImplante,
      });
      setProtocoloId(""); setUsoCidr(false); setEstimulo(""); setPerdaImplante(false); recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao aplicar protocolo."); }
    finally { setSalvando(false); }
  }

  async function remover(id: number) { await excluirAplicacaoIatf(id); recarregar(); }

  function editarDetalhe(et: EtapaIatfStatusDTO, campo: "produto" | "dose" | "observacao", valor: string) {
    if (et.execucaoId == null) return;
    setDetalhes((atuais) => ({
      ...atuais,
      [et.execucaoId!]: {
        produto: atuais[et.execucaoId!]?.produto ?? et.produto ?? "",
        dose: atuais[et.execucaoId!]?.dose ?? et.dose ?? "",
        observacao: atuais[et.execucaoId!]?.observacao ?? et.observacao ?? "",
        [campo]: valor,
      },
    }));
  }

  async function marcar(execucaoId: number | null, status: "CONCLUIDA" | "PULADA" | "PENDENTE") {
    if (execucaoId == null) {
      setErro("Esta aplicação ainda não tem etapas materializadas. Reaplique o protocolo.");
      return;
    }
    setBusyExec(execucaoId); setErro(null);
    try {
      const detalhe = detalhes[execucaoId];
      await executarEtapaIatf(execucaoId, {
        status,
        dataExecucao: status === "PENDENTE" ? undefined : getHojeISO(),
        ...(detalhe ? {
          produto: detalhe.produto.trim() || null,
          dose: detalhe.dose.trim() || null,
          observacao: detalhe.observacao.trim() || null,
        } : {}),
      });
      setDetalhes((atuais) => { const proximo = { ...atuais }; delete proximo[execucaoId]; return proximo; });
      recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao atualizar etapa."); }
    finally { setBusyExec(null); }
  }

  return (
    <div className="mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Protocolo IATF</h4>

      {protos.length === 0 ? (
        <p className="mb-3 text-sm text-ink-3">
          Nenhum protocolo cadastrado. Cadastre em <b>Reprodução → Protocolos IATF</b> para aplicar aqui.
        </p>
      ) : (
        <form onSubmit={aplicar} className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-ink-3">
            Protocolo
            <SelectBusca variante="sublinhado" className={CAIXA_SELECT} aria-label="Protocolo" value={protocoloId} onValueChange={setProtocoloId} placeholder="selecione…" buscaPlaceholder="Buscar protocolo…" options={protos.map((p) => ({ value: String(p.id), label: p.nome }))} />
          </label>
          <label className="flex flex-col text-xs text-ink-3">
            Início (D0)
            <CampoData variante="sublinhado" className={CAIXA_DATA} aria-label="Início (D0)" value={dataInicio} onChange={setDataInicio} />
          </label>
          <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ink-3">
            <input type="checkbox" checked={usoCidr} onChange={(e) => setUsoCidr(e.target.checked)} /> CIDR
          </label>
          <label className="flex flex-col text-xs text-ink-3">
            Estímulo
            <input className="mt-0.5 w-28 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={estimulo} onChange={(e) => setEstimulo(e.target.value)} placeholder="eCG" maxLength={80} />
          </label>
          <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ink-3">
            <input type="checkbox" checked={perdaImplante} onChange={(e) => setPerdaImplante(e.target.checked)} /> perda implante
          </label>
          <button type="submit" disabled={salvando || !protocoloId || !dataInicio} className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            Aplicar
          </button>
        </form>
      )}
      {erro && <p className="mb-2 text-sm text-prejuizo">{erro}</p>}

      {lista.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhum protocolo aplicado a este animal.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((a) => (
            <div key={a.id} className="rounded border border-dashed border-[color:var(--rule-soft)] p-3">
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold text-[color:var(--ink)]">{a.protocoloNome}</span>
                <span className="flex items-center gap-2 text-xs text-ink-3">
                  início {fmtData(a.dataInicio)}
                  {" · "}
                  {a.progresso.concluido
                    ? "concluído"
                    : a.progresso.proxima
                      ? `próxima ${a.progresso.proxima.rotulo}`
                      : "sem etapas"}
                  {" · "}
                  {a.progresso.resolvidas}/{a.progresso.total}
                  <button onClick={() => remover(a.id)} className="text-ink-3 hover:text-prejuizo hover:underline" aria-label={`Excluir aplicação ${a.protocoloNome}`}>excluir</button>
                </span>
              </div>
              {(a.usoCidr || a.estimulo || a.perdaImplante) && (
                <p className="mb-1.5 text-xs text-ink-3">
                  {[a.usoCidr && "CIDR", a.estimulo && `estímulo ${a.estimulo}`, a.perdaImplante && "perda de implante"].filter(Boolean).join(" · ")}
                </p>
              )}
              <ol className="flex flex-col gap-1">
                {a.etapas.map((et) => {
                  const busy = busyExec === et.execucaoId;
                  const done = et.status === "CONCLUIDA";
                  const skipped = et.status === "PULADA";
                  const detalhe = et.execucaoId == null ? undefined : detalhes[et.execucaoId];
                  return (
                    <li key={`${et.dia}-${et.ordem}`} className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${done || skipped ? "opacity-70" : ""}`}>
                      <b className="w-9 shrink-0 font-semibold text-[color:var(--cafe)]">{et.rotulo}</b>
                      <span className={`w-24 shrink-0 tabular-nums ${et.atrasada ? "font-semibold text-prejuizo" : "text-ink-2"}`}>
                        {fmtData(et.dataEfetiva)}
                      </span>
                      <span className={`min-w-[4.5rem] shrink-0 text-xs uppercase tracking-[.04em] ${et.atrasada ? "text-prejuizo" : "text-ink-3"}`}>
                        {statusLabel(et)}
                      </span>
                      <span className={`flex-1 text-[color:var(--ink)] ${done || skipped ? "line-through" : ""}`}>
                        {et.acao}{et.hormonio ? <span className="text-ink-3"> · {et.hormonio}</span> : null}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {detalhe && (
                          <button type="button" disabled={busy} onClick={() => marcar(et.execucaoId, et.status)}
                            className="rounded border border-[color:var(--rule-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--cafe)] hover:bg-[color:var(--rule-soft)] disabled:opacity-50">
                            salvar detalhes
                          </button>
                        )}
                        {et.status !== "CONCLUIDA" && (
                          <button type="button" disabled={busy} onClick={() => marcar(et.execucaoId, "CONCLUIDA")}
                            className="rounded border border-[color:var(--rule-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--cafe)] hover:bg-[color:var(--rule-soft)] disabled:opacity-50">
                            feita
                          </button>
                        )}
                        {et.status !== "PULADA" && (
                          <button type="button" disabled={busy} onClick={() => marcar(et.execucaoId, "PULADA")}
                            className="rounded border border-[color:var(--rule-soft)] px-2 py-0.5 text-xs text-ink-2 hover:bg-[color:var(--rule-soft)] disabled:opacity-50">
                            pular
                          </button>
                        )}
                        {et.status !== "PENDENTE" && (
                          <button type="button" disabled={busy} onClick={() => marcar(et.execucaoId, "PENDENTE")}
                            className="rounded border border-[color:var(--rule-soft)] px-2 py-0.5 text-xs text-ink-3 hover:underline disabled:opacity-50">
                            reabrir
                          </button>
                        )}
                      </span>
                      {et.execucaoId != null && (
                        <div className="ml-11 grid w-[calc(100%-2.75rem)] grid-cols-1 gap-1.5 border-l border-[color:var(--rule-soft)] pl-2 sm:grid-cols-[1fr_8rem_2fr]">
                          <input
                            aria-label={`Produto da etapa ${et.rotulo}`}
                            className="rounded border border-[color:var(--rule-soft)] px-2 py-1 text-xs text-[color:var(--ink)]"
                            value={detalhe?.produto ?? et.produto ?? ""}
                            onChange={(e) => editarDetalhe(et, "produto", e.target.value)}
                            placeholder="produto"
                          />
                          <input
                            aria-label={`Dose da etapa ${et.rotulo}`}
                            className="rounded border border-[color:var(--rule-soft)] px-2 py-1 text-xs text-[color:var(--ink)]"
                            value={detalhe?.dose ?? et.dose ?? ""}
                            onChange={(e) => editarDetalhe(et, "dose", e.target.value)}
                            placeholder="dose"
                          />
                          <input
                            aria-label={`Observação da etapa ${et.rotulo}`}
                            className="rounded border border-[color:var(--rule-soft)] px-2 py-1 text-xs text-[color:var(--ink)]"
                            value={detalhe?.observacao ?? et.observacao ?? ""}
                            onChange={(e) => editarDetalhe(et, "observacao", e.target.value)}
                            placeholder="observação"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
