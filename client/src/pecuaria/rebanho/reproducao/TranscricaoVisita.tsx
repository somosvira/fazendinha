import { CamposAvaliacao } from "./CamposAvaliacao";
import { RegularizarOrigem, consumoMantidoUltimaAnulacao } from "./RegularizarOrigem";
import { AlertasSanitarios } from "./AlertasSanitarios";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  CabecalhoTabela,
  ErrorBox,
  Panel,
  Pill,
} from "../../../financeiro/financeiro-ui";
import {
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { FormAplicacaoServico } from "../sanidade/FormAplicacaoServico";
import { FormFatoSanitario } from "../sanidade/FormFatoSanitario";
import { obterReproducao, reqV4, type PainelReprodutivo } from "./api";
import {
  confirmarVisita,
  salvarRascunhoVisita,
  obterSugestoesVisita,
  type SugestoesVisita,
  type Visita,
  type AtividadeVisita,
  type RascunhoVisita,
  type ParticipanteVisita,
} from "./visitas-api";
import {
  filtrarParticipantes,
  pendenciaRascunho,
  motivosParticipante,
} from "./visitas-regras";
import { RebanhoApiError } from "../api";
import { dadosConfirmacaoVisita } from "./visitas-transcricao";
import { FormReproducao } from "./FormReproducao";
export function Transcricao({
  visita,
  atividade,
  podeLancar,
  podeRegularizar = podeLancar,
  onMudou,
}: {
  visita: Visita;
  atividade: AtividadeVisita;
  podeLancar: boolean;
  podeRegularizar?: boolean;
  onMudou: () => Promise<void>;
}) {
  const [cienciaAlteracoes, setCienciaAlteracoes] = useState(false);
  const [alteracoes, setAlteracoes] = useState<
    Array<{ participanteId: string; animalId: string; alteracoes: string[] }>
  >([]);
  const [painel, setPainel] = useState<PainelReprodutivo | null>(null);
  const [sugestoes, setSugestoes] = useState<SugestoesVisita | null>(null);
  useEffect(() => {
    Promise.all([
      obterReproducao(),
      obterSugestoesVisita(visita.data.slice(0, 10)),
    ])
      .then(([p, s]) => {
        setPainel(p);
        setSugestoes(s);
      })
      .catch((e) => setErro(e.message));
  }, [visita.data]);
  const [rascunhos, setRascunhos] = useState<Record<string, RascunhoVisita>>(
    () =>
      Object.fromEntries(
        atividade.participantes.map((p) => [p.id, p.rascunho ?? {}]),
      ),
  );
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const prefixo = `atividade-${atividade.id}-`;
  const [q, setQ] = useState(
    () => new URLSearchParams(window.location.search).get(prefixo + "q") ?? "",
  );
  const [status, setStatus] = useState(
    () =>
      new URLSearchParams(window.location.search).get(prefixo + "status") ?? "",
  );
  const [motivos, setMotivos] = useState<string[]>(() =>
    new URLSearchParams(window.location.search).getAll(prefixo + "motivo"),
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const [k, v] of [
      ["q", q],
      ["status", status],
    ])
      v
        ? url.searchParams.set(prefixo + k, v)
        : url.searchParams.delete(prefixo + k);
    url.searchParams.delete(prefixo + "motivo");
    motivos.forEach((m) => url.searchParams.append(prefixo + "motivo", m));
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search + url.hash,
    );
  }, [prefixo, q, status, motivos]);
  useEffect(() => {
    const pop = () => {
      const p = new URLSearchParams(window.location.search);
      setQ(p.get(prefixo + "q") ?? "");
      setStatus(p.get(prefixo + "status") ?? "");
      setMotivos(p.getAll(prefixo + "motivo"));
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [prefixo]);
  const envioPendente = useRef<{
    payload: string;
    input: Parameters<typeof confirmarVisita>[2];
  } | null>(null);
  const [preparar, setPreparar] = useState<ParticipanteVisita | null>(null);
  const rascunhosAtuais = useRef(rascunhos);
  const versoes = useRef<Record<string, number>>(Object.fromEntries(atividade.participantes.map(p => [p.id, p.versaoRascunho ?? 0])));
  const conflitos = useRef(new Set<string>());
  const gravações = useRef<Record<string, Promise<unknown>>>({});
  useEffect(() => {
    for (const p of atividade.participantes) {
      if (p.status === "CONFIRMADO" || !gravações.current[p.id]) {
        rascunhosAtuais.current[p.id] = p.rascunho ?? {};
        versoes.current[p.id] = p.versaoRascunho ?? 0;
        conflitos.current.delete(p.id);
      }
    }
    setRascunhos({ ...rascunhosAtuais.current });
  }, [atividade.participantes]);
  const tarefaPreparada = preparar?.tarefaIatfId
    ? sugestoes?.tarefasIatf.find((t) => t.id === preparar.tarefaIatfId)
    : null;
  async function guardarProcedimento(dados: object) {
    if (!preparar) return;
    const p = preparar;
    rascunhosAtuais.current[p.id] = {
      ...rascunhosAtuais.current[p.id], dados: { ...dados }, status: "CONFIRMADO",
    };
    setRascunhos({ ...rascunhosAtuais.current });
    if (!(await persistir(p))) throw new Error("Não foi possível salvar o procedimento. Revise o rascunho.");
  }
  const itens = filtrarParticipantes(atividade.participantes, {
    q,
    status,
    motivos,
  });
  const motivosDisponiveis = Array.from(
    new Set(atividade.participantes.flatMap(motivosParticipante)),
  );
  const atualizar = (
    p: ParticipanteVisita,
    campo: keyof RascunhoVisita,
    valor: string | boolean,
  ) => {
    rascunhosAtuais.current[p.id] = { ...rascunhosAtuais.current[p.id], ...(["conduta", "participanteIatfId", "inicioEfetivo"].includes(campo) ? { cienciaSanitaria: false } : {}), [campo]: valor };
    setRascunhos({ ...rascunhosAtuais.current });
    setAvisos((r) => ({ ...r, [p.id]: "Alterações não salvas" }));
  };
  async function persistir(p: ParticipanteVisita) {
    const anterior = gravações.current[p.id] ?? Promise.resolve();
    const proxima = anterior
      .catch(() => {})
      .then(async () => {
        if (conflitos.current.has(p.id)) throw new Error("Rascunho alterado em outra sessão. Reabra a visita para revisar antes de salvar.");
        try {
          const salvo = await salvarRascunhoVisita(visita.id, p.id, visita.propriedadeId,
            { ...rascunhosAtuais.current[p.id] }, versoes.current[p.id] ?? 0);
          versoes.current[p.id] = salvo?.versaoRascunho ?? (versoes.current[p.id] ?? 0) + 1;
        } catch (e) {
          if (e instanceof RebanhoApiError && e.status === 409) conflitos.current.add(p.id);
          throw e;
        }
      });
    gravações.current[p.id] = proxima;
    try {
      await proxima;
      setAvisos((a) => ({ ...a, [p.id]: "Rascunho salvo" }));
      return true;
    } catch (e) {
      setAvisos((a) => ({
        ...a,
        [p.id]: e instanceof Error ? e.message : String(e),
      }));
      return false;
    }
  }
  async function confirmar(ids: string[]) {
    if (!ids.length || ids.length > 100) {
      setErro("Selecione entre 1 e 100 animais por confirmação.");
      return;
    }
    const pendencias = ids
      .map((id) => ({
        id,
        erro:
          atividade.tipo === "AVALIACAO_REPRODUTIVA"
            ? pendenciaRascunho(rascunhos[id])
            : null,
      }))
      .filter((p) => p.erro);
    if (pendencias.length) {
      setAvisos((a) => ({
        ...a,
        ...Object.fromEntries(pendencias.map((p) => [p.id, p.erro!])),
      }));
      setErro("Revise as pendências individuais antes de confirmar.");
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      const itens = ids.map((id) => {
        const r = rascunhos[id] ?? {};
        return {
          participanteId: id,
          status: r.status ?? "CONFIRMADO",
          motivo: r.motivo || undefined,
          dados: dadosConfirmacaoVisita(atividade.tipo, r),
        };
      });
      const payload = JSON.stringify(itens);
      let entrada =
        envioPendente.current?.payload === payload
          ? envioPendente.current.input
          : null;
      // Uma resposta perdida pode ter confirmado os fatos: reenvie exatamente o envelope anterior,
      // sem tentar sobrescrever os rascunhos de participantes já confirmados.
      if (!entrada) {
        const salvos = await Promise.all(
          ids.map((id) =>
            persistir(atividade.participantes.find((p) => p.id === id)!),
          ),
        );
        if (salvos.some((v) => !v))
          throw new Error(
            "Não foi possível salvar todos os rascunhos. Tente novamente.",
          );
        const previa = await reqV4<{
          fingerprint: string;
          participantes: Array<{
            participanteId: string;
            animalId: string;
            alteracoes: string[];
          }>;
        }>(
          `/visitas/${visita.id}/atividades/${atividade.id}/previa?propriedadeId=${visita.propriedadeId}`,
        );
        const mudancas = previa.participantes.filter(
          (p) => ids.includes(p.participanteId) && p.alteracoes.length,
        );
        if (
          mudancas.length &&
          (!cienciaAlteracoes ||
            JSON.stringify(mudancas) !== JSON.stringify(alteracoes))
        ) {
          setAlteracoes(mudancas);
          setCienciaAlteracoes(false);
          setErro(
            "Revise as mudanças desde a preparação e confirme ciência antes de registrar.",
          );
          return;
        }
        entrada = {
          propriedadeId: visita.propriedadeId,
          chave: crypto.randomUUID(),
          cienciaAlteracoes,
          fingerprintPrevia: cienciaAlteracoes ? previa.fingerprint : undefined,
          itens,
        };
        envioPendente.current = { payload, input: entrada };
      }
      await confirmarVisita(visita.id, atividade.id, entrada);
      envioPendente.current = null;
      setSelecionados([]);
      setCienciaAlteracoes(false);
      setAlteracoes([]);
      await onMudou();
    } catch (e) {
      if (e instanceof RebanhoApiError && e.status < 500) {
        envioPendente.current = null;
        if (e.code === "CONFLITO") setCienciaAlteracoes(false);
      }
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  const input = (
    p: ParticipanteVisita,
    campo: keyof RascunhoVisita,
    label: string,
    type = "text",
  ) => (
    <input
      aria-label={`${label} · ${p.snapshot.brinco ?? p.ordem}`}
      type={type}
      className={classeInput}
      disabled={!podeLancar || ocupado || p.status === "CONFIRMADO"}
      value={String(rascunhos[p.id]?.[campo] ?? "")}
      onChange={(e) => atualizar(p, campo, e.target.value)}
      onBlur={() => void persistir(p)}
    />
  );
  const select = (
    p: ParticipanteVisita,
    campo: keyof RascunhoVisita,
    label: string,
    opcoes: [string, string][],
  ) => (
    <label>{label}<select
      aria-label={`${label} · ${p.snapshot.brinco ?? p.ordem}`}
      className={classeInput}
      disabled={!podeLancar || ocupado || p.status === "CONFIRMADO"}
      value={String(rascunhos[p.id]?.[campo] ?? "")}
      onChange={(e) => atualizar(p, campo, e.target.value)}
      onBlur={() => void persistir(p)}
    >
      <option value="">Selecione</option>
      {opcoes.map(([v, r]) => (
        <option key={v} value={v}>
          {r}
        </option>
      ))}
    </select></label>
  );
  return (
    <Panel className="mt-5">
      <CabecalhoTabela
        titulo={atividade.nome}
        acao={
          podeLancar && (
            <Button
              disabled={ocupado || !selecionados.length}
              onClick={() => void confirmar(selecionados)}
            >
              Confirmar selecionados ({selecionados.length}/100)
            </Button>
          )
        }
      />
      <div className="p-4">
        <ErrorBox erro={erro} />
        {alteracoes.length > 0 && (
          <div className="rounded-lg border border-border p-4 mb-4">
            <ul className="text-sm space-y-2">
              {alteracoes.map((a) => (
                <li key={a.participanteId}>
                  {atividade.participantes.find(
                    (p) => p.id === a.participanteId,
                  )?.snapshot.brinco ?? a.animalId}
                  : {a.alteracoes.join("; ")}
                </li>
              ))}
            </ul>
            <ConfirmacaoCiencia
              id={`visita-ciencia-${atividade.id}`}
              checked={cienciaAlteracoes}
              onChange={setCienciaAlteracoes}
            >
              Revisei as mudanças desde a preparação da lista e confirmo estes
              participantes.
            </ConfirmacaoCiencia>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Buscar
            <input
              className={classeInput}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Atendimento
            <select
              className={classeInput}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos</option>
              {["PENDENTE", "CONFIRMADO", "ADIADO", "NAO_ATENDIDO"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {motivosDisponiveis.map((m) => (
            <label key={m} className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={motivos.includes(m)}
                onChange={(e) =>
                  setMotivos(
                    e.target.checked
                      ? [...motivos, m]
                      : motivos.filter((v) => v !== m),
                  )
                }
              />
              {m}
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-3 mt-3">
          Os filtros gerais se combinam; qualquer motivo selecionado inclui o
          animal. A ordem da lista permanece a mesma da impressão. Tab avança
          entre os campos; os rascunhos são salvos ao sair do campo.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-y border-border">
              <th className="p-3">Seleção / ordem</th>
              <th className="p-3">Animal</th>
              <th className="p-3">Atendimento / resultado</th>
              <th className="p-3">Conduta / anotação</th>
              <th className="p-3">Pendências</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((p) => (
              <tr className="border-b border-border align-top" key={p.id}>
                <td className="p-3">
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${p.snapshot.brinco ?? p.ordem}`}
                      disabled={
                        !podeLancar || ocupado || p.status === "CONFIRMADO"
                      }
                      checked={selecionados.includes(p.id)}
                      onChange={(e) =>
                        setSelecionados(
                          e.target.checked
                            ? [...selecionados, p.id]
                            : selecionados.filter((id) => id !== p.id),
                        )
                      }
                    />{" "}
                    {p.ordem}
                  </label>
                </td>
                <td className="p-3">
                  <strong>{p.snapshot.brinco ?? p.animalId}</strong>
                  <p>{p.snapshot.nome}</p>
                  <p className="text-xs">{motivosParticipante(p).join("; ")}</p>
                  <Pill>{p.historicoRegularizacao?.at(-1)?.acao === "ENCERRAR_SEM_SUBSTITUICAO" ? "Encerrado sem substituição" : p.status}</Pill>
                </td>
                <td className="p-3 min-w-56">
                  {select(p, "status", "Atendimento", [
                    ["CONFIRMADO", "Atendido"],
                    ["ADIADO", "Adiado"],
                    ["NAO_ATENDIDO", "Não atendido"],
                  ])}
                  {atividade.tipo === "TAREFA_IATF" &&
                    !["ADIADO", "NAO_ATENDIDO"].includes(rascunhos[p.id]?.status ?? "") &&
                    input(
                      p,
                      "realizadaEm",
                      "Data e hora realizada",
                      "datetime-local",
                    )}
                  {atividade.tipo === "AVALIACAO_REPRODUTIVA" ? (
                    <>
                      <fieldset disabled={!podeLancar || ocupado || p.status === "CONFIRMADO"} onBlur={() => void persistir(p)}>
                        <CamposAvaliacao dados={rascunhos[p.id] ?? {}} onChange={mudanca => {
                          rascunhosAtuais.current[p.id] = { ...rascunhosAtuais.current[p.id], ...Object.fromEntries(Object.entries(mudanca).map(([k,v]) => [k,v ?? ""])), cienciaSanitaria: false };
                          setRascunhos({ ...rascunhosAtuais.current });
                          setAvisos(r => ({ ...r, [p.id]: "Alterações não salvas" }));
                        }} />
                      </fieldset>
                    </>
                  ) : (
                    <>
                      {atividade.tipo === "INICIAR_IATF" ? (
                        input(
                          p,
                          "inicioEfetivo",
                          "Início efetivo",
                          "datetime-local",
                        )
                      ) : (
                        <>
                          <Button
                            secondary
                            disabled={
                              !podeLancar ||
                              ocupado ||
                              p.status === "CONFIRMADO"
                            }
                            onClick={() => setPreparar(p)}
                          >
                            Preencher procedimento
                          </Button>
                          {rascunhos[p.id]?.dados && (
                            <p className="text-xs mt-2">
                              Procedimento preparado no rascunho
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}
                </td>
                <td className="p-3 min-w-60">
                  {atividade.tipo === "AVALIACAO_REPRODUTIVA" && (
                    <>
                      {select(
                        p,
                        "tentativaId",
                        "Tentativa comprovada",
                        [...(painel?.tentativas ?? []), ...(painel?.animais.find(a => a.animalId === p.animalId)?.ultimaTentativa ? [{...painel.animais.find(a => a.animalId === p.animalId)!.ultimaTentativa!, animalId:p.animalId}] : [])]
                          .filter(
                            (t, indice, lista) =>
                              t.animalId === p.animalId &&
                              t.status !== "ANULADO" && lista.findIndex(item => item.id === t.id) === indice,
                          )
                          .map((t) => [
                            t.id,
                            `${t.data.slice(0, 10)} · ${t.tipo}`,
                          ]),
                      )}
                      {rascunhos[p.id]?.resultado === "POSITIVO" &&
                        !rascunhos[p.id]?.tentativaId &&
                        input(
                          p,
                          "motivoVinculoDesconhecido",
                          "Motivo da tentativa não comprovada",
                        )}
                    </>
                  )}
                  {atividade.tipo === "AVALIACAO_REPRODUTIVA" &&
                    select(
                      p,
                      "gestacaoId",
                      "Gestação conhecida",
                      [...(painel?.gestacoes ?? []), ...(painel?.animais.find(a => a.animalId === p.animalId)?.gestacao ? [{...painel.animais.find(a => a.animalId === p.animalId)!.gestacao!, animalId:p.animalId}] : [])]
                        .filter(
                          (g, indice, lista) =>
                            g.animalId === p.animalId && g.status === "VALIDO" && lista.findIndex(item => item.id === g.id) === indice,
                        )
                        .map((g) => [
                          g.id,
                          `${g.previsaoParto?.slice(0, 10) ?? "Previsão não informada"}`,
                        ]),
                    )}
                  {atividade.tipo === "INICIAR_IATF" &&
                    select(
                      p,
                      "participanteIatfId",
                      "Participação IATF",
                      (sugestoes?.participantesIatf ?? [])
                        .filter(
                          (t) => t.animalId === p.animalId && !t.inicioEfetivo,
                        )
                        .map((t) => [
                          t.id,
                          `Previsto ${t.inicioPrevisto.slice(0, 10)}`,
                        ]),
                    )}
                  {["AVALIACAO_REPRODUTIVA", "INICIAR_IATF"].includes(atividade.tipo) && (
                    <>
                    {((atividade.tipo === "AVALIACAO_REPRODUTIVA" && rascunhos[p.id]?.conduta === "IATF") || atividade.tipo === "INICIAR_IATF") && <AlertasSanitarios animalId={p.animalId} data={visita.data.slice(0,10)} acao="IATF" />}
                    <label className="flex gap-2 text-sm my-2">
                      <input type="checkbox" aria-label={`Ciência sanitária · ${p.snapshot.brinco ?? p.ordem}`}
                        checked={rascunhos[p.id]?.cienciaSanitaria === true}
                        disabled={!podeLancar || ocupado || p.status === "CONFIRMADO"}
                        onChange={(e) => atualizar(p, "cienciaSanitaria", e.target.checked)}
                        onBlur={() => void persistir(p)} />
                      Revisei os alertas sanitários informados para este procedimento.
                    </label>
                    </>
                  )}
                  {input(p, "anotacaoOriginal", "Anotação original")}
                  {input(
                    p,
                    "motivo",
                    "Motivo de perda, correção, descarte ou pendência",
                  )}
                  {atividade.tipo === "AVALIACAO_REPRODUTIVA" &&
                    input(p, "retornoEm", "Retorno", "date")}
                </td>
                <td className="p-3 min-w-44">
                  <p role="status">{avisos[p.id]}</p>
                  {podeRegularizar && p.regularizacaoPendente && <RegularizarOrigem path={`/visitas/${visita.id}/participantes/${p.id}/regularizacao`} propriedadeId={visita.propriedadeId} reabrirPermitido={visita.status !== "ENCERRADA"} consumoMantido={consumoMantidoUltimaAnulacao(p.historicoRegularizacao)} onMudou={onMudou} />}
                  {p.fatoId ? (
                    <p className="text-xs text-ink-3">Fato registrado</p>
                  ) : (
                    podeLancar && (
                      <Button
                        secondary
                        disabled={ocupado}
                        onClick={() => void confirmar([p.id])}
                      >
                        Confirmar animal
                      </Button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!itens.length && (
          <p className="p-5 text-sm">Nenhum participante com estes filtros.</p>
        )}
      </div>
      {preparar &&
        (atividade.tipo === "APLICACAO_SANITARIA" ||
          tarefaPreparada?.tipo === "APLICACAO") && (
          <FormAplicacaoServico
            dataInicial={visita.data.slice(0, 10)}
            animalId={preparar.animalId}
            propriedadeId={visita.propriedadeId}
            onFechar={() => setPreparar(null)}
            onSalvo={() => setPreparar(null)}
            onRegistrar={guardarProcedimento}
          />
        )}
      {preparar &&
        atividade.tipo === "TAREFA_IATF" &&
        painel &&
        tarefaPreparada &&
        ["TENTATIVA", "AVALIACAO"].includes(tarefaPreparada.tipo) && (
          <FormReproducao
            dataInicial={visita.data.slice(0, 10)}
            acao={
              tarefaPreparada.tipo === "TENTATIVA" ? "tentativa" : "avaliacao"
            }
            painel={painel}
            animalInicial={preparar.animalId}
            onFechar={() => setPreparar(null)}
            onSalvo={() => setPreparar(null)}
            onRegistrar={guardarProcedimento}
          />
        )}
      {preparar &&
        atividade.tipo === "TAREFA_IATF" &&
        tarefaPreparada &&
        ["MANEJO", "RETIRADA"].includes(tarefaPreparada.tipo) && (
          <PainelCadastro
            aberto
            titulo={tarefaPreparada.nome ?? "Registrar manejo"}
            onFechar={() => setPreparar(null)}
            rodape={
              <Button
                onClick={() =>
                  void guardarProcedimento({
                    observacao: rascunhos[preparar.id]?.anotacaoOriginal ?? "",
                  }).then(() => setPreparar(null))
                }
              >
                Preparar manejo
              </Button>
            }
          >
            <p className="text-sm">
              A descrição da execução e o motivo do desvio permanecem nas
              anotações da linha. A confirmação cria somente a execução desta
              tarefa.
            </p>
          </PainelCadastro>
        )}
      {preparar &&
        (["EXAME_SANITARIO", "INICIAR_SANITARIO"].includes(atividade.tipo) || (atividade.tipo === "TAREFA_IATF" && tarefaPreparada?.tipo === "EXAME")) && (
          <FormFatoSanitario
            dataInicial={visita.data.slice(0, 10)}
            tipo={atividade.tipo === "EXAME_SANITARIO" || tarefaPreparada?.tipo === "EXAME" ? "exame" : "protocolo"}
            animalInicial={preparar.animalId}
            fixo
            onFechar={() => setPreparar(null)}
            onSalvo={() => setPreparar(null)}
            onRegistrar={guardarProcedimento}
          />
        )}
    </Panel>
  );
}
