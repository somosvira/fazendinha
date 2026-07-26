import { useEffect, useMemo, useState } from "react";
import {
  useProgramacoesIatf,
  useProtocolosIatf,
  criarProgramacaoIatf,
  detalheProgramacaoIatf,
  executarEtapaLoteIatf,
  excluirProgramacaoIatf,
  listarAnimais,
  listarGrupos,
  type GrupoDTO,
  type ProgramacaoIatfLoteDetalheDTO,
} from "../api";
import type { Animal } from "../types";
import { getHojeISO } from "../../lib/hoje";
import { alternarExcecaoAnimal, rotuloResumoEtapa } from "../lib/iatf-lote";

const fmtData = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR");

// Programa um protocolo para um lote e opera cada etapa em massa, preservando
// exceções por animal. O progresso vem das execuções reais, não do calendário.
export function ProgramacaoIatfLote() {
  const { data: programacoes, loading, recarregar } = useProgramacoesIatf();
  const { data: protocolos, loading: loadingProto } = useProtocolosIatf();
  const [grupos, setGrupos] = useState<GrupoDTO[]>([]);
  const [aberto, setAberto] = useState(false);
  const [protocoloId, setProtocoloId] = useState("");
  const [dataInicio, setDataInicio] = useState(getHojeISO());
  const [grupoId, setGrupoId] = useState("");
  const [nome, setNome] = useState("");
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [carregandoAnimais, setCarregandoAnimais] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<ProgramacaoIatfLoteDetalheDTO | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState<number | null>(null);
  const [excecoes, setExcecoes] = useState<number[]>([]);
  const [produto, setProduto] = useState("");
  const [dose, setDose] = useState("");
  const [observacao, setObservacao] = useState("");
  const [busyEtapa, setBusyEtapa] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => { listarGrupos().then(setGrupos).catch(() => setGrupos([])); }, []);
  useEffect(() => {
    if (!grupoId) { setAnimais([]); return; }
    setCarregandoAnimais(true);
    listarAnimais({ status: "ATIVO", grupoId: Number(grupoId) })
      .then(setAnimais).catch(() => setAnimais([])).finally(() => setCarregandoAnimais(false));
  }, [grupoId]);

  const protos = useMemo(() => (protocolos ?? []).filter((p) => p.ativo), [protocolos]);
  if (loading || loadingProto) return null;
  const lista = programacoes ?? [];

  function abrir() {
    setAberto(true); setProtocoloId(""); setDataInicio(getHojeISO()); setGrupoId("");
    setNome(""); setAnimais([]); setErro(null);
  }
  function fechar() { setAberto(false); setErro(null); }

  async function programar(e: React.FormEvent) {
    e.preventDefault();
    if (!protocoloId || !dataInicio || animais.length === 0) {
      setErro("Escolha protocolo, data e um grupo com animais.");
      return;
    }
    setSalvando(true); setErro(null);
    try {
      await criarProgramacaoIatf({
        protocoloId: Number(protocoloId), dataInicio,
        grupoId: grupoId ? Number(grupoId) : null,
        nome: nome.trim() || undefined,
        animalIds: animais.map((a) => Number(a.id)),
      });
      fechar(); recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao programar o lote."); }
    finally { setSalvando(false); }
  }

  async function expandir(id: number) {
    if (detalhe?.id === id) { setDetalhe(null); return; }
    setCarregandoDetalhe(id); setErro(null); setResultado(null); setExcecoes([]);
    try { setDetalhe(await detalheProgramacaoIatf(id)); }
    catch (err) { setErro(err instanceof Error ? err.message : "Falha ao carregar a programação."); }
    finally { setCarregandoDetalhe(null); }
  }

  async function executar(dia: number, ordem: number, status: "CONCLUIDA" | "PULADA" | "PENDENTE") {
    if (!detalhe) return;
    const chave = `${dia}:${ordem}:${status}`;
    setBusyEtapa(chave); setErro(null); setResultado(null);
    try {
      const r = await executarEtapaLoteIatf(detalhe.id, {
        dia, ordem, status,
        dataExecucao: status === "PENDENTE" ? undefined : getHojeISO(),
        excecoesAnimalIds: excecoes,
        produto: produto.trim() || null,
        dose: dose.trim() || null,
        observacao: observacao.trim() || null,
      });
      setResultado(`${r.aplicados} ${r.aplicados === 1 ? "animal atualizado" : "animais atualizados"}${r.ignorados ? ` · ${r.ignorados} fora desta execução` : ""}.`);
      setDetalhe(await detalheProgramacaoIatf(detalhe.id));
      recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao executar a etapa no lote."); }
    finally { setBusyEtapa(null); }
  }

  async function excluir(id: number) {
    await excluirProgramacaoIatf(id);
    if (detalhe?.id === id) setDetalhe(null);
    recarregar();
  }

  return (
    <div className="mb-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-[11px] flex items-center justify-between">
        <h4 className="mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Programação IATF/TETF por lote</h4>
        {!aberto && <button onClick={abrir} disabled={protos.length === 0} className="rounded bg-[color:var(--cafe)] px-3 py-1 text-sm font-semibold text-white disabled:opacity-50">Programar lote</button>}
      </div>

      {protos.length === 0 && !aberto && <p className="text-sm text-ink-3">Cadastre um protocolo ativo para programar um lote.</p>}

      {aberto && (
        <form onSubmit={programar} className="mb-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-ink-3">Protocolo
              <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={protocoloId} onChange={(e) => setProtocoloId(e.target.value)}>
                <option value="">selecione…</option>
                {protos.map((p) => <option key={p.id} value={p.id}>{p.finalidade} · {p.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-xs text-ink-3">Início (D0)
              <input type="date" className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </label>
            <label className="flex flex-col text-xs text-ink-3">Lote (grupo)
              <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                <option value="">selecione…</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-1 flex-col text-xs text-ink-3">Rótulo (opcional)
              <input className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="IATF novilhas — jul/26" maxLength={120} />
            </label>
          </div>
          <p className="text-xs text-ink-3">{grupoId ? carregandoAnimais ? "carregando animais do lote…" : `${animais.length} ${animais.length === 1 ? "animal ativo" : "animais ativos"} receberão o protocolo` : "escolha um lote para carregar os animais"}</p>
          {erro && <p className="text-sm text-prejuizo">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={salvando || !protocoloId || animais.length === 0} className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Programar {animais.length > 0 ? `(${animais.length})` : ""}</button>
            <button type="button" onClick={fechar} className="rounded border border-[color:var(--rule-soft)] px-3 py-1.5 text-sm text-ink-2">Cancelar</button>
          </div>
        </form>
      )}

      {erro && !aberto && <p className="mb-2 text-sm text-prejuizo">{erro}</p>}
      {lista.length === 0 ? (
        !aberto && <p className="text-sm text-ink-3">Nenhuma programação de lote.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((p) => {
            const expandida = detalhe?.id === p.id;
            return (
              <div key={p.id} className="rounded border border-dashed border-[color:var(--rule-soft)] p-3">
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                  <button type="button" onClick={() => expandir(p.id)} className="font-semibold text-[color:var(--ink)] hover:text-[color:var(--cafe)]" aria-expanded={expandida}>
                    {p.nome ?? p.protocoloNome} <span className="text-xs text-ink-3">{expandida ? "▴" : "▾"}</span>
                  </button>
                  <span className="flex items-center gap-2 text-xs text-ink-3">
                    {p.grupoNome ? `${p.grupoNome} · ` : ""}{p.totalAnimais} {p.totalAnimais === 1 ? "animal" : "animais"} · início {fmtData(p.dataInicio)}
                    <button onClick={() => excluir(p.id)} className="text-ink-3 hover:text-prejuizo hover:underline" aria-label={`Excluir programação ${p.nome ?? p.protocoloNome}`}>excluir</button>
                  </span>
                </div>
                <div className="mb-1 text-xs text-ink-3">
                  {p.concluido ? "concluído" : p.proxima ? <>próxima <b className="text-[color:var(--cafe)]">{p.proxima.rotulo}</b> em {fmtData(p.proxima.data)}</> : "sem etapas"}
                  {" · "}{p.etapasConcluidas}/{p.totalEtapas} etapas resolvidas
                </div>
                <ol className="flex flex-wrap gap-x-3 gap-y-1">
                  {p.agenda.map((agenda) => {
                    const resumo = p.resumoExec.porEtapa.find((e) => e.dia === agenda.dia && e.ordem === agenda.ordem);
                    return <li key={`${agenda.dia}:${agenda.ordem}`} className="text-xs text-ink-2"><b className="text-[color:var(--cafe)]">{agenda.rotulo}</b> {resumo ? rotuloResumoEtapa(resumo) : "sem execuções"}</li>;
                  })}
                </ol>

                {carregandoDetalhe === p.id && <p className="mt-2 text-xs text-ink-3">carregando operação…</p>}
                {expandida && detalhe && (
                  <div className="mt-3 border-t border-[color:var(--rule-soft)] pt-3">
                    <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_2fr]">
                      <input className="rounded border border-[color:var(--rule-soft)] px-2 py-1 text-xs" value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="produto da execução" aria-label="Produto da execução coletiva" />
                      <input className="rounded border border-[color:var(--rule-soft)] px-2 py-1 text-xs" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="dose" aria-label="Dose da execução coletiva" />
                      <input className="rounded border border-[color:var(--rule-soft)] px-2 py-1 text-xs" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="observação" aria-label="Observação da execução coletiva" />
                    </div>
                    <fieldset className="mb-3 rounded border border-[color:var(--rule-soft)] p-2">
                      <legend className="px-1 text-[11px] uppercase tracking-[.05em] text-ink-3">Deixar fora desta execução</legend>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {detalhe.animais.map((animal) => (
                          <label key={animal.animalId} className="flex items-center gap-1.5 text-xs text-ink-2">
                            <input type="checkbox" checked={excecoes.includes(animal.animalId)} onChange={(e) => setExcecoes((atuais) => alternarExcecaoAnimal(atuais, animal.animalId, e.target.checked))} />
                            {animal.numero}{animal.nome ? ` · ${animal.nome}` : ""}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="flex flex-col gap-2">
                      {detalhe.agenda.map((agenda) => {
                        const resumo = detalhe.resumoExec.porEtapa.find((e) => e.dia === agenda.dia && e.ordem === agenda.ordem);
                        const busy = busyEtapa?.startsWith(`${agenda.dia}:${agenda.ordem}:`) ?? false;
                        return (
                          <div key={`${agenda.dia}:${agenda.ordem}`} className="flex flex-wrap items-center gap-2 rounded border border-[color:var(--rule-soft)] px-2.5 py-2">
                            <b className="w-9 text-sm text-[color:var(--cafe)]">{agenda.rotulo}</b>
                            <span className="w-24 text-xs tabular-nums text-ink-2">{fmtData(agenda.data)}</span>
                            <span className={`min-w-[220px] flex-1 text-xs ${resumo?.atrasadas ? "font-semibold text-prejuizo" : "text-ink-2"}`}>{resumo ? rotuloResumoEtapa(resumo) : "sem execuções"}</span>
                            <button type="button" disabled={busy} onClick={() => executar(agenda.dia, agenda.ordem, "CONCLUIDA")} className="rounded border border-[color:var(--rule-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--cafe)] disabled:opacity-50">feita</button>
                            <button type="button" disabled={busy} onClick={() => executar(agenda.dia, agenda.ordem, "PULADA")} className="rounded border border-[color:var(--rule-soft)] px-2 py-0.5 text-xs text-ink-2 disabled:opacity-50">pular</button>
                            <button type="button" disabled={busy} onClick={() => executar(agenda.dia, agenda.ordem, "PENDENTE")} className="px-1 text-xs text-ink-3 hover:underline disabled:opacity-50">reabrir</button>
                          </div>
                        );
                      })}
                    </div>
                    {resultado && <p className="mt-2 text-xs font-semibold text-[color:var(--cafe)]">{resultado}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
