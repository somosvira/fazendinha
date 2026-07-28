import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Loader } from "../../components/Loading";
import { fmt } from "../../components/charts";
import { RebAnm, RebBox, RebEmpty, RebMain, RebPill } from "@/components/rb/RebPrimitives";
import {
  criarPlanoAcasalamento,
  escolherReprodutorPlano,
  listarCombinacoesMedida,
  listarGrupos,
  listarPlanosAcasalamento,
  obterPlanoAcasalamento,
  recalcularPlanoAcasalamento,
  type CandidatoSnapshotDTO,
  type CombinacaoMedidaDTO,
  type GrupoDTO,
  type LinhaPlanoAcasalamentoDTO,
  type PlanoAcasalamentoDTO,
  type ResumoPlanoAcasalamentoDTO,
  type StatusCandidatoAcasalamento,
} from "../api";
import { RebHeader } from "./RebHeader";

const BTN = "min-h-6 rounded-lg border border-[color:var(--cafe)] bg-transparent px-3 py-1.5 text-sm font-semibold text-[color:var(--cafe)] transition-colors hover:bg-[color:var(--leite-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--cafe)] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PRIMARY = `${BTN} bg-[color:var(--cafe)] text-[color:var(--bg-card)] hover:bg-[color:var(--cafe)]`;
const FIELD = "min-h-6 w-full rounded-lg border border-border bg-[color:var(--bg)] px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--cafe)]";

const STATUS: Record<StatusCandidatoAcasalamento, { label: string; tone: "ok" | "warn" | "bad" }> = {
  ok: { label: "apto", tone: "ok" },
  nao_verificavel: { label: "pedigree não verificável", tone: "warn" },
  consanguineo: { label: "consanguíneo", tone: "bad" },
  restrito: { label: "restrito", tone: "bad" },
};

function percentual(valor: number) {
  const escala = valor * 100;
  return `${fmt(escala, { decimals: Number.isInteger(escala) ? 0 : 1 })}%`;
}

function dataPtBr(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(valor));
}

function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : "Não foi possível concluir a operação.";
}

export function atualizarLinhaPlano(
  plano: PlanoAcasalamentoDTO,
  versao: number,
  linhaAtualizada: LinhaPlanoAcasalamentoDTO,
): PlanoAcasalamentoDTO {
  const versoes = plano.versoes.map((item) => item.versao === versao
    ? { ...item, linhas: item.linhas.map((linha) => linha.id === linhaAtualizada.id ? linhaAtualizada : linha) }
    : item);
  const ultimaVersao = versoes.reduce<typeof versoes[number] | null>(
    (ultima, item) => !ultima || item.versao > ultima.versao ? item : ultima,
    null,
  );
  return {
    ...plano,
    totalEscolhas: ultimaVersao?.linhas.filter((linha) => linha.reprodutorEscolhidoId != null).length ?? 0,
    versoes,
  };
}

function Candidato({ candidato }: { candidato: CandidatoSnapshotDTO }) {
  const status = STATUS[candidato.status];
  return (
    <div className="rounded-lg border border-[color:var(--rule-soft)] bg-[color:var(--bg-card-2)] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm text-foreground">{candidato.nome}</strong>
        <RebPill tone={status.tone}>{status.label}</RebPill>
        <span className="font-semibold tabular-nums text-[color:var(--cafe)]">{percentual(candidato.score)}</span>
        <span className="text-xs tabular-nums text-ink-3">{percentual(candidato.parentesco)} parentesco</span>
      </div>
      <p className="mb-0 mt-1 text-xs text-ink-3">{candidato.motivos[0] ?? "Sem motivo informado."}</p>
    </div>
  );
}

export function AcasalamentoPlanosTab({ onAbrirFicha }: { onAbrirFicha?: (animalId: string) => void }) {
  const [planos, setPlanos] = useState<ResumoPlanoAcasalamentoDTO[]>([]);
  const [grupos, setGrupos] = useState<GrupoDTO[]>([]);
  const [combinacoes, setCombinacoes] = useState<CombinacaoMedidaDTO[]>([]);
  const [plano, setPlano] = useState<PlanoAcasalamentoDTO | null>(null);
  const [versaoSelecionada, setVersaoSelecionada] = useState<number | null>(null);
  const [selecoes, setSelecoes] = useState<Record<number, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [combinacaoId, setCombinacaoId] = useState("");
  const [confirmacao, setConfirmacao] = useState<{ linha: LinhaPlanoAcasalamentoDTO; candidato: CandidatoSnapshotDTO } | null>(null);
  const gatilhoConfirmacaoRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let ativo = true;
    Promise.all([listarPlanosAcasalamento(), listarGrupos(), listarCombinacoesMedida()])
      .then(([novosPlanos, novosGrupos, novasCombinacoes]) => {
        if (!ativo) return;
        setPlanos(novosPlanos);
        setGrupos(novosGrupos);
        setCombinacoes(novasCombinacoes);
        setGrupoId(novosGrupos[0] ? String(novosGrupos[0].id) : "");
        setCombinacaoId(novasCombinacoes[0] ? String(novasCombinacoes[0].id) : "");
      })
      .catch((e) => ativo && setErro(mensagemErro(e)))
      .finally(() => ativo && setLoading(false));
    return () => { ativo = false; };
  }, []);

  const versaoAtual = useMemo(
    () => plano?.versoes.find((item) => item.versao === versaoSelecionada) ?? null,
    [plano, versaoSelecionada],
  );

  function selecionarPlanoDetalhado(novoPlano: PlanoAcasalamentoDTO) {
    const ultima = novoPlano.versoes.reduce<number | null>((maior, item) => maior == null || item.versao > maior ? item.versao : maior, null);
    setPlano(novoPlano);
    setVersaoSelecionada(ultima);
    setSelecoes(Object.fromEntries((novoPlano.versoes.find((item) => item.versao === ultima)?.linhas ?? []).map((linha) => [linha.id, linha.reprodutorEscolhidoId])));
  }

  async function abrirPlano(id: number) {
    setOcupado(true);
    setErro(null);
    setFeedback(null);
    try {
      selecionarPlanoDetalhado(await obterPlanoAcasalamento(id));
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function criar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!nome.trim() || !grupoId || !combinacaoId) {
      setErro("Informe nome, grupo e combinação para criar o plano.");
      return;
    }
    setOcupado(true);
    setErro(null);
    setFeedback(null);
    try {
      const criado = await criarPlanoAcasalamento({ nome: nome.trim(), grupoId: Number(grupoId), combinacaoId: Number(combinacaoId) });
      selecionarPlanoDetalhado(criado);
      const { versoes: _versoes, ...resumo } = criado;
      setPlanos((atuais) => [resumo, ...atuais.filter((item) => item.id !== resumo.id)]);
      setNome("");
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function recalcular() {
    if (!plano) return;
    setOcupado(true);
    setErro(null);
    setFeedback(null);
    try {
      const atualizado = await recalcularPlanoAcasalamento(plano.id);
      selecionarPlanoDetalhado(atualizado);
      setPlanos((atuais) => atuais.map((item) => item.id === atualizado.id
        ? { ...item, ultimaVersao: atualizado.ultimaVersao, totalFemeas: atualizado.totalFemeas, totalEscolhas: atualizado.totalEscolhas, updatedAt: atualizado.updatedAt }
        : item));
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function salvarEscolha(linha: LinhaPlanoAcasalamentoDTO, candidato: CandidatoSnapshotDTO, confirmadoNaoVerificavel: boolean) {
    if (!plano || versaoSelecionada == null) return;
    setOcupado(true);
    setErro(null);
    setFeedback(null);
    try {
      const resposta = await escolherReprodutorPlano(linha.id, { reprodutorId: candidato.reprodutorId, confirmadoNaoVerificavel });
      setPlano((atual) => atual ? atualizarLinhaPlano(atual, versaoSelecionada, resposta.linha) : atual);
      setSelecoes((atuais) => ({ ...atuais, [linha.id]: candidato.reprodutorId }));
      setFeedback(resposta.aviso ?? `Escolha de ${candidato.nome} salva para ${linha.femeaNumero}.`);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  function pedirEscolha(linha: LinhaPlanoAcasalamentoDTO, gatilho: HTMLButtonElement) {
    const candidato = linha.ranking.find((item) => item.reprodutorId === selecoes[linha.id]);
    if (!candidato || candidato.status === "consanguineo" || candidato.status === "restrito") return;
    if (candidato.status === "nao_verificavel") {
      gatilhoConfirmacaoRef.current = gatilho;
      setConfirmacao({ linha, candidato });
      return;
    }
    void salvarEscolha(linha, candidato, false);
  }

  function fecharConfirmacao() {
    setConfirmacao(null);
    requestAnimationFrame(() => gatilhoConfirmacaoRef.current?.focus());
  }

  function selecionarVersao(numero: number) {
    const proximaVersao = plano?.versoes.find((item) => item.versao === numero);
    setVersaoSelecionada(numero);
    setSelecoes(Object.fromEntries((proximaVersao?.linhas ?? []).map((linha) => [linha.id, linha.reprodutorEscolhidoId])));
  }

  return (
    <RebMain>
      <RebHeader eyebrow="Rebanho · Reprodução" title="Planos de acasalamento" />

      {loading && <Loader label="Carregando planos de acasalamento…" />}
      {erro && <p role="alert" className="rounded-lg border border-[color:var(--rule-soft)] px-3 py-2 text-sm text-prejuizo">Erro: {erro}</p>}
      {feedback && <p role="status" className="rounded-lg border border-[color:var(--rule-soft)] bg-[color:var(--leite-soft)] px-3 py-2 text-sm text-foreground">{feedback}</p>}

      {!loading && (
        <>
          <RebBox>
            <h4>Novo plano</h4>
            <form aria-label="Cadastro de plano de acasalamento" className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end" onSubmit={criar}>
              <label className="grid gap-1 text-sm font-semibold text-foreground">
                Nome do plano
                <input className={FIELD} value={nome} onChange={(e) => setNome(e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-foreground">
                Grupo do plano
                <select className={FIELD} value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                  <option value="">Selecione</option>
                  {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-foreground">
                Combinação de medidas
                <select className={FIELD} value={combinacaoId} onChange={(e) => setCombinacaoId(e.target.value)}>
                  <option value="">Selecione</option>
                  {combinacoes.map((combinacao) => <option key={combinacao.id} value={combinacao.id}>{combinacao.nome}</option>)}
                </select>
              </label>
              <button className={BTN_PRIMARY} disabled={ocupado} type="submit">Criar plano de acasalamento</button>
            </form>
          </RebBox>

          <section aria-labelledby="planos-acasalamento-titulo">
            <h2 id="planos-acasalamento-titulo" className="font-serif text-xl font-semibold text-foreground">Planos por lote</h2>
            {planos.length === 0 ? (
              <RebEmpty>
                <strong className="block text-foreground">Nenhum plano de acasalamento criado</strong>
                <span>Crie o primeiro plano para calcular candidatos por lote.</span>
              </RebEmpty>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {planos.map((item) => (
                  <RebBox key={item.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="m-0 font-serif text-lg font-semibold text-foreground">{item.nome}</h3>
                        <p className="my-1 text-sm text-ink-3">{item.grupoNome} · {item.combinacaoNome}</p>
                        <p className="m-0 text-xs text-ink-3">
                          {item.ultimaVersao == null ? "Sem versão" : `Versão ${item.ultimaVersao}`} · {item.totalFemeas} fêmeas · {item.totalEscolhas} escolhas · criado em {dataPtBr(item.createdAt)} · atualizado em {dataPtBr(item.updatedAt)}
                        </p>
                      </div>
                      <button className={BTN} disabled={ocupado} onClick={() => void abrirPlano(item.id)} type="button" aria-label={`Abrir plano ${item.nome}`}>Abrir</button>
                    </div>
                  </RebBox>
                ))}
              </div>
            )}
          </section>

          {ocupado && <Loader size="sm" label="Atualizando plano…" />}

          {plano && (
            <section aria-labelledby="plano-detalhe-titulo" className="mt-6">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-[color:var(--rule-soft)] pb-3">
                <div>
                  <p className="m-0 text-xs uppercase tracking-[.08em] text-ink-3">{plano.grupoNome} · {plano.combinacaoNome}</p>
                  <h2 id="plano-detalhe-titulo" className="m-0 font-serif text-2xl font-semibold text-foreground">{plano.nome}</h2>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="grid gap-1 text-xs font-semibold text-foreground">
                    Versão do plano
                    <select className={FIELD} value={versaoSelecionada ?? ""} onChange={(e) => selecionarVersao(Number(e.target.value))}>
                      {[...plano.versoes].sort((a, b) => b.versao - a.versao).map((item) => (
                        <option key={item.id} value={item.versao}>Versão {item.versao} · {dataPtBr(item.createdAt)}</option>
                      ))}
                    </select>
                  </label>
                  <button className={BTN_PRIMARY} disabled={ocupado} onClick={() => void recalcular()} type="button" aria-label={`Recalcular plano ${plano.nome}`}>Recalcular</button>
                </div>
              </div>

              {!versaoAtual || versaoAtual.linhas.length === 0 ? (
                <RebEmpty>Esta versão não possui fêmeas no lote.</RebEmpty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                    <thead><tr className="border-b border-border text-xs uppercase tracking-[.06em] text-ink-3"><th className="p-2">Fêmea</th><th className="p-2">Candidatos e parentesco</th><th className="p-2">Escolha</th></tr></thead>
                    <tbody>
                      {versaoAtual.linhas.map((linha) => {
                        const candidatoSelecionado = linha.ranking.find((item) => item.reprodutorId === selecoes[linha.id]);
                        return (
                          <tr key={linha.id} className="border-b border-[color:var(--rule-soft)] align-top">
                            <td className="p-2">
                              <button className="min-h-6 min-w-6 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--cafe)]" type="button" onClick={() => onAbrirFicha?.(String(linha.femeaId))} aria-label={`Abrir ficha da fêmea ${linha.femeaNumero}${linha.femeaNome ? ` ${linha.femeaNome}` : ""}`}>
                                <RebAnm>#{linha.femeaNumero}{linha.femeaNome && <small className="block">{linha.femeaNome}</small>}</RebAnm>
                              </button>
                            </td>
                            <td className="grid gap-2 p-2">{linha.ranking.map((candidato) => <Candidato key={candidato.reprodutorId} candidato={candidato} />)}</td>
                            <td className="p-2">
                              <label className="grid gap-1 font-semibold text-foreground">
                                Reprodutor para {linha.femeaNumero}{linha.femeaNome ? ` ${linha.femeaNome}` : ""}
                                <select className={FIELD} value={selecoes[linha.id] ?? ""} onChange={(e) => setSelecoes((atuais) => ({ ...atuais, [linha.id]: e.target.value ? Number(e.target.value) : null }))}>
                                  <option value="">Selecione</option>
                                  {linha.ranking.map((candidato) => (
                                    <option key={candidato.reprodutorId} value={candidato.reprodutorId} disabled={candidato.status === "consanguineo" || candidato.status === "restrito"}>
                                      {candidato.nome} · {STATUS[candidato.status].label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                className={`${BTN_PRIMARY} mt-2 w-full`}
                                disabled={ocupado || !candidatoSelecionado || candidatoSelecionado.status === "consanguineo" || candidatoSelecionado.status === "restrito"}
                                type="button"
                                onClick={(e) => pedirEscolha(linha, e.currentTarget)}
                                aria-label={candidatoSelecionado ? `Escolher ${candidatoSelecionado.nome} para ${linha.femeaNumero}${linha.femeaNome ? ` ${linha.femeaNome}` : ""}` : `Escolher reprodutor para ${linha.femeaNumero}${linha.femeaNome ? ` ${linha.femeaNome}` : ""}`}
                              >Escolher</button>
                              {linha.reprodutorEscolhidoNome && <p className="mb-0 mt-2 text-xs font-semibold text-[color:var(--cafe)]">Escolhido: {linha.reprodutorEscolhidoNome}</p>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmacao != null}
        title="Confirmar pedigree não verificável"
        message={confirmacao ? `O pedigree não foi suficiente para verificar a consanguinidade entre ${confirmacao.linha.femeaNumero}${confirmacao.linha.femeaNome ? ` ${confirmacao.linha.femeaNome}` : ""} e ${confirmacao.candidato.nome}. Confirme apenas se deseja assumir esse risco.` : ""}
        confirmLabel={confirmacao ? `Confirmar ${confirmacao.candidato.nome} para ${confirmacao.linha.femeaNumero}${confirmacao.linha.femeaNome ? ` ${confirmacao.linha.femeaNome}` : ""}` : "Confirmar escolha"}
        cancelLabel="Cancelar escolha"
        onCancel={fecharConfirmacao}
        onConfirm={() => {
          if (!confirmacao) return;
          const escolha = confirmacao;
          fecharConfirmacao();
          void salvarEscolha(escolha.linha, escolha.candidato, true);
        }}
      />
    </RebMain>
  );
}
