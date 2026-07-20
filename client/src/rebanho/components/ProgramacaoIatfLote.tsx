import { useEffect, useMemo, useState } from "react";
import {
  useProgramacoesIatf, useProtocolosIatf, criarProgramacaoIatf, excluirProgramacaoIatf,
  listarAnimais, listarGrupos, type GrupoDTO,
} from "../api";
import type { Animal } from "../types";
import { getHojeISO } from "../../lib/hoje";

const fmtData = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR");

// Programa um protocolo IATF do catálogo para um LOTE inteiro num mesmo D0. Escolhe o protocolo,
// a data D0 e o grupo (carrega os animais ativos do grupo) e cria uma aplicação por animal, todas
// amarradas à programação. Mostra o calendário derivado (D0/D7/D9/D11…) e a próxima etapa.
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

  useEffect(() => { listarGrupos().then(setGrupos).catch(() => setGrupos([])); }, []);

  // Ao escolher um grupo, carrega os animais ativos dele para virarem o lote.
  useEffect(() => {
    if (!grupoId) { setAnimais([]); return; }
    setCarregandoAnimais(true);
    listarAnimais({ status: "ATIVO", grupoId: Number(grupoId) })
      .then(setAnimais).catch(() => setAnimais([])).finally(() => setCarregandoAnimais(false));
  }, [grupoId]);

  const protos = useMemo(() => (protocolos ?? []).filter((p) => p.ativo), [protocolos]);
  if (loading || loadingProto) return null;
  const lista = programacoes ?? [];

  function abrir() { setAberto(true); setProtocoloId(""); setDataInicio(getHojeISO()); setGrupoId(""); setNome(""); setAnimais([]); setErro(null); }
  function fechar() { setAberto(false); setErro(null); }

  async function programar(e: React.FormEvent) {
    e.preventDefault();
    if (!protocoloId || !dataInicio || animais.length === 0) { setErro("Escolha protocolo, data e um grupo com animais."); return; }
    setSalvando(true); setErro(null);
    try {
      await criarProgramacaoIatf({
        protocoloId: Number(protocoloId),
        dataInicio,
        grupoId: grupoId ? Number(grupoId) : null,
        nome: nome.trim() || undefined,
        animalIds: animais.map((a) => Number(a.id)),
      });
      fechar(); recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao programar o lote."); }
    finally { setSalvando(false); }
  }

  async function excluir(id: number) { await excluirProgramacaoIatf(id); recarregar(); }

  return (
    <div className="mb-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-[11px] flex items-center justify-between">
        <h4 className="mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Programação IATF por lote</h4>
        {!aberto && (
          <button onClick={abrir} disabled={protos.length === 0} className="rounded bg-[color:var(--cafe)] px-3 py-1 text-sm font-semibold text-white disabled:opacity-50">Programar lote</button>
        )}
      </div>

      {protos.length === 0 && !aberto && (
        <p className="text-sm text-ink-3">Cadastre um protocolo ativo em <b>Protocolos IATF</b> para programar um lote.</p>
      )}

      {aberto && (
        <form onSubmit={programar} className="mb-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-ink-3">
              Protocolo
              <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={protocoloId} onChange={(e) => setProtocoloId(e.target.value)}>
                <option value="">selecione…</option>
                {protos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-xs text-ink-3">
              Início (D0)
              <input type="date" className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </label>
            <label className="flex flex-col text-xs text-ink-3">
              Lote (grupo)
              <select className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                <option value="">selecione…</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-1 flex-col text-xs text-ink-3">
              Rótulo (opcional)
              <input className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="IATF novilhas — jul/26" maxLength={120} />
            </label>
          </div>
          <p className="text-xs text-ink-3">
            {grupoId
              ? carregandoAnimais ? "carregando animais do lote…" : `${animais.length} ${animais.length === 1 ? "animal ativo" : "animais ativos"} no lote receberão o protocolo`
              : "escolha um lote para carregar os animais"}
          </p>
          {erro && <p className="text-sm text-prejuizo">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={salvando || !protocoloId || animais.length === 0} className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Programar {animais.length > 0 ? `(${animais.length})` : ""}</button>
            <button type="button" onClick={fechar} className="rounded border border-[color:var(--rule-soft)] px-3 py-1.5 text-sm text-ink-2">Cancelar</button>
          </div>
        </form>
      )}

      {lista.length === 0 ? (
        !aberto && <p className="text-sm text-ink-3">Nenhuma programação de lote. Programe um protocolo para um grupo inteiro de uma vez.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((p) => (
            <div key={p.id} className="rounded border border-dashed border-[color:var(--rule-soft)] p-3">
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold text-[color:var(--ink)]">{p.nome ?? p.protocoloNome}</span>
                <span className="flex items-center gap-2 text-xs text-ink-3">
                  {p.grupoNome ? `${p.grupoNome} · ` : ""}{p.totalAnimais} {p.totalAnimais === 1 ? "animal" : "animais"} · início {fmtData(p.dataInicio)}
                  <button onClick={() => excluir(p.id)} className="text-ink-3 hover:text-prejuizo hover:underline" aria-label={`Excluir programação ${p.nome ?? p.protocoloNome}`}>excluir</button>
                </span>
              </div>
              <div className="mb-1 text-xs text-ink-3">
                {p.concluido
                  ? "protocolo concluído"
                  : p.proxima
                    ? <>próxima etapa <b className="text-[color:var(--cafe)]">{p.proxima.rotulo}</b> em {fmtData(p.proxima.data)} — {p.proxima.acao}</>
                    : "sem etapas"}
                {" · "}{p.etapasConcluidas}/{p.totalEtapas} etapas
              </div>
              <ol className="flex flex-wrap gap-x-3 gap-y-0.5">
                {p.agenda.map((et) => {
                  const passada = !p.concluido && p.proxima != null && et.data < p.proxima.data;
                  const atual = p.proxima != null && et.rotulo === p.proxima.rotulo;
                  return (
                    <li key={et.rotulo} className={`flex items-baseline gap-1 text-sm ${passada ? "text-ink-3 line-through" : atual ? "font-semibold text-[color:var(--cafe)]" : "text-[color:var(--ink)]"}`}>
                      <b className="font-semibold">{et.rotulo}</b>
                      <span className="tabular-nums text-ink-2">{fmtData(et.data)}</span>
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
