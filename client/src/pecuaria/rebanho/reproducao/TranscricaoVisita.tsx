import { CampoDataIatf } from "./CampoDataIatf";
import { CamposResultadoExame } from "../sanidade/CamposExame";
import type { TipoExame } from "../sanidade/CadastrosSanitarios";
import { CamposAvaliacao } from "./CamposAvaliacao";
import { RegularizarOrigem, consumoMantidoUltimaAnulacao } from "./RegularizarOrigem";
import { AlertasSanitarios } from "./AlertasSanitarios";
import { Fragment, useEffect, useRef, useState } from "react";
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
import { reqV4, type PainelReprodutivo } from "./api";
import {
  confirmarVisita,
  salvarRascunhoVisita,
  obterSugestoesVisita,
  type SugestoesVisita,
  type SugestaoTarefa,
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
import {
  contextoTranscricao,
  dadosConfirmacaoVisita,
  rotulosCondutaAvaliacao,
  rotulosResultadoAvaliacao,
} from "./visitas-transcricao";
import { Iatf } from "./Iatf";
import { AcoesReprodutivas } from "./AcoesReprodutivas";
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
  const [tiposExame, setTiposExame] = useState<TipoExame[]>([]);
  useEffect(() => {
    let ativo = true;
    if (atividade.tipo === "AVALIACAO_REPRODUTIVA") reqV4<TipoExame[]>("/reproducao/tipos-exame?incluirInativos=true", undefined, "GET", visita.propriedadeId).then(t => { if (ativo) setTiposExame(t); }).catch(e => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, [atividade.tipo, visita.propriedadeId]);
  const [cienciaAlteracoes, setCienciaAlteracoes] = useState(false);
  const [alteracoes, setAlteracoes] = useState<
    Array<{ participanteId: string; animalId: string; alteracoes: string[] }>
  >([]);
  const [painel, setPainel] = useState<PainelReprodutivo | null>(null);
  const [sugestoes, setSugestoes] = useState<SugestoesVisita | null>(null);
  const sugestoesAtuais = useRef<SugestoesVisita | null>(null);
  useEffect(() => {
    Promise.all([
      reqV4<PainelReprodutivo>(`/reproducao?propriedadeId=${visita.propriedadeId}`, undefined, "GET", visita.propriedadeId),
      obterSugestoesVisita(visita.data.slice(0, 10), {}, visita.propriedadeId),
    ])
      .then(([p, s]) => {
        setPainel(p);
        setSugestoes(s);
        sugestoesAtuais.current = s;
      })
      .catch((e) => setErro(e.message));
  }, [visita.data, visita.propriedadeId]);
  const [rascunhos, setRascunhos] = useState<Record<string, RascunhoVisita>>(
    () =>
      Object.fromEntries(
        atividade.participantes.map((p) => [p.id, p.rascunho ?? {}]),
      ),
  );
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [revisao, setRevisao] = useState<string[]>([]);
  const revisaoRef = useRef<HTMLElement>(null);
  const [focoPendencia, setFocoPendencia] = useState<string | null>(null);
  useEffect(() => {
    if (!focoPendencia) return;
    const linha = document.getElementById(`linha-${focoPendencia}`);
    linha?.querySelector<HTMLSelectElement>("select")?.focus();
    setFocoPendencia(null);
  }, [focoPendencia]);
  useEffect(() => { if (revisao.length) revisaoRef.current?.focus(); }, [revisao]);
  const [confirmadosLocais, setConfirmadosLocais] = useState<string[]>([]);
  const [programarIatf, setProgramarIatf] = useState(false);
  const [avisoConfirmacao, setAvisoConfirmacao] = useState("");
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
  const [tarefaPreparada, setTarefaPreparada] = useState<SugestaoTarefa | null>(null);
  const [carregandoTarefa, setCarregandoTarefa] = useState(false);
  useEffect(() => {
    let atual = true;
    setTarefaPreparada(null);
    if (!preparar || (!preparar.tarefaIatfId && !preparar.tarefaSanitariaId)) { setCarregandoTarefa(false); return; }
    setCarregandoTarefa(true);
    setErro(null);
    const participante = preparar;
    reqV4<{ origem: "REPRODUTIVA" | "SANITARIA"; tarefa: SugestaoTarefa }>(
      `/visitas/${visita.id}/participantes/${participante.id}/tarefa`, undefined, "GET", visita.propriedadeId,
    ).then(resultado => {
      if (atual) setTarefaPreparada(resultado.tarefa);
    }).catch(e => {
      if (!atual) return;
      const preservada = e instanceof RebanhoApiError && e.status < 500 ? null
        : participante.snapshot.tarefaPlanejada?.tarefa
          ?? sugestoesAtuais.current?.tarefasIatf.find(t => t.id === participante.tarefaIatfId)
          ?? sugestoesAtuais.current?.tarefasSanitarias.find(t => t.id === participante.tarefaSanitariaId);
      if (preservada) setTarefaPreparada(preservada);
      else setPreparar(null);
      setErro(`${e instanceof Error ? e.message : String(e)}${preservada
        ? " Os parâmetros preservados na preparação estão disponíveis para revisão." : " Não foi possível carregar o procedimento desta tarefa. Tente abrir novamente."}`);
    }).finally(() => { if (atual) setCarregandoTarefa(false); });
    return () => { atual = false; };
  }, [preparar, atividade.tipo, visita.id, visita.propriedadeId]);
  async function guardarProcedimento(dados: object) {
    if (!preparar) return;
    const p = preparar;
    rascunhosAtuais.current[p.id] = {
      ...rascunhosAtuais.current[p.id], dados: { ...dados }, status: "CONFIRMADO",
    };
    setRascunhos({ ...rascunhosAtuais.current });
    if (!(await persistir(p))) throw new Error("Não foi possível salvar o procedimento. Revise o rascunho.");
  }
  const confirmado = (p: ParticipanteVisita) => p.status === "CONFIRMADO" || confirmadosLocais.includes(p.id);
  const selecionadosPendentes = selecionados.filter(id => {
    const p = atividade.participantes.find(item => item.id === id);
    return p && !confirmado(p);
  });
  const indicadosIatf = atividade.participantes.filter(p => confirmado(p) && !p.regularizacaoPendente &&
    (rascunhos[p.id]?.conduta ?? p.rascunho?.conduta) === "IATF");
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
            ? pendenciaAvaliacao(atividade.participantes.find(p => p.id === id)!, rascunhosAtuais.current[id])
            : null,
      }))
      .filter((p) => p.erro);
    if (pendencias.length) {
      setAvisos((a) => ({
        ...a,
        ...Object.fromEntries(pendencias.map((p) => [p.id, p.erro!])),
      }));
      setDetalhes(anteriores => [...new Set([...anteriores, ...pendencias.map(p => p.id)])]);
      setFocoPendencia(pendencias[0].id);
      setErro("Revise as pendências individuais antes de confirmar.");
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      const itens = ids.map((id) => {
        const r = rascunhosAtuais.current[id] ?? {};
        return {
          participanteId: id,
          status: r.status || "CONFIRMADO",
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
          undefined, "GET", visita.propriedadeId,
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
          fingerprintPrevia: previa.fingerprint,
          itens,
        };
        envioPendente.current = { payload, input: entrada };
      }
      await confirmarVisita(visita.id, atividade.id, entrada);
      envioPendente.current = null;
      setConfirmadosLocais(anteriores => [...new Set([...anteriores, ...ids.filter(id =>
        !["ADIADO", "NAO_ATENDIDO"].includes(rascunhosAtuais.current[id]?.status ?? ""),
      )])]);
      setSelecionados(anteriores => anteriores.filter(id => !ids.includes(id)));
      setRevisao([]);
      setAvisoConfirmacao(`${ids.length} atendimento(s) confirmado(s). Os demais rascunhos permanecem disponíveis.`);
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
      disabled={!podeLancar || ocupado || confirmado(p)}
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
      disabled={!podeLancar || ocupado || confirmado(p)}
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
  function gestacoesDoAnimal(p: ParticipanteVisita) {
    const animal = painel?.animais.find(a => a.animalId === p.animalId);
    return [...(painel?.gestacoes ?? []), ...(animal?.gestacao ? [{ ...animal.gestacao, animalId: p.animalId }] : [])]
      .filter((g, indice, lista) => g.animalId === p.animalId && g.status === "VALIDO"
        && (!g.confirmadaEm || g.confirmadaEm.slice(0, 10) <= visita.data.slice(0, 10))
        && (!g.encerradaEm || g.encerradaEm.slice(0, 10) > visita.data.slice(0, 10))
        && lista.findIndex(item => item.id === g.id) === indice);
  }
  function pendenciaAvaliacao(p: ParticipanteVisita, r: RascunhoVisita | undefined) {
    const pendencia = pendenciaRascunho(r);
    if (pendencia || !r || ["ADIADO", "NAO_ATENDIDO"].includes(r.status ?? "")) return pendencia;
    if ((["RECONFIRMACAO", "SEXAGEM"].includes(r.resultado ?? "") ||
      (r.sexoFetal && r.resultado !== "POSITIVO")) && !r.gestacaoId)
      return "Vincule a gestação conhecida para esta avaliação.";
    if (r.resultado === "NEGATIVO" && gestacoesDoAnimal(p).length)
      return "Há gestação conhecida: registre a perda ou corrija o diagnóstico antes de confirmar.";
    return null;
  }
  function mudarAvaliacao(p: ParticipanteVisita, mudanca: Record<string, unknown>) {
    rascunhosAtuais.current[p.id] = {
      ...rascunhosAtuais.current[p.id],
      ...Object.fromEntries(Object.entries(mudanca).map(([k, v]) => [k, v ?? ""])),
      cienciaSanitaria: false,
    };
    setRascunhos({ ...rascunhosAtuais.current });
    setAvisos(anteriores => ({ ...anteriores, [p.id]: "Alterações não salvas" }));
    // Os seletores salvam imediatamente; o restante mantém o salvamento ao sair do campo.
    void persistir(p);
  }
  function acaoAtendimento(p: ParticipanteVisita, status: string) {
    atualizar(p, "status", status);
    setDetalhes(anteriores => [...new Set([...anteriores, p.id])]);
    void persistir(p);
  }
  function tabelaAvaliacao() {
    const editaveis = itens.filter(p => !confirmado(p));
    return <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Avaliação coletiva na ordem da folha de campo</caption>
        <thead><tr className="text-left border-y border-border">
          <th className="p-3"><input type="checkbox" aria-label="Selecionar animais visíveis"
            disabled={!podeLancar || ocupado || !editaveis.length}
            checked={editaveis.length > 0 && editaveis.every(p => selecionados.includes(p.id))}
            onChange={e => setSelecionados(anteriores => e.target.checked
              ? [...new Set([...anteriores, ...editaveis.map(p => p.id)])]
              : anteriores.filter(id => !editaveis.some(p => p.id === id)))} /></th>
          {["Animal", "Lactação", "Partos / RP", "Última tentativa", "Situação anterior", "Resultado", "Conduta", "Ações"].map(t => <th key={t} className="p-3">{t}</th>)}
        </tr></thead>
        <tbody>{itens.map(p => {
          const r = rascunhos[p.id] ?? {};
          const contexto = contextoTranscricao(p.snapshot, visita.data);
          const bloqueado = !podeLancar || ocupado || confirmado(p);
          const ausente = ["ADIADO", "NAO_ATENDIDO"].includes(r.status ?? "");
          const exigeDetalhe = ausente || r.conduta === "DESCARTE" || r.conduta === "IATF"
            || (r.resultado === "POSITIVO" && !r.tentativaId && !r.gestacaoId)
            || ["SEXAGEM", "RECONFIRMACAO"].includes(r.resultado ?? "")
            || (r.resultado === "NEGATIVO" && gestacoesDoAnimal(p).length > 0);
          const expandido = detalhes.includes(p.id) || exigeDetalhe;
          return <Fragment key={p.id}>
            <tr id={`linha-${p.id}`} className="border-b border-border align-top">
              <td className="p-3"><input type="checkbox" aria-label={`Selecionar ${p.snapshot.brinco ?? p.ordem}`}
                disabled={bloqueado} checked={selecionados.includes(p.id)}
                onChange={e => setSelecionados(anteriores => e.target.checked ? [...new Set([...anteriores, p.id])] : anteriores.filter(id => id !== p.id))} /></td>
              <td className="p-3 min-w-28"><strong>{p.snapshot.brinco ?? p.animalId}</strong><p>{p.snapshot.nome}</p>
                <span className="text-xs text-ink-3">Linha {p.ordem}</span>
                {confirmado(p) && <p><Pill>Confirmado</Pill></p>}
              </td>
              <td className="p-3 min-w-32">{contexto.lactacao}
                {p.snapshot.diasPosParto != null && <p className="text-xs text-ink-3">{p.snapshot.diasPosParto} dias pós-parto</p>}
              </td>
              <td className="p-3 min-w-28"><p>Partos: {p.snapshot.partos ?? "Não informado"}</p><p className="text-xs">RP: {contexto.rp}</p></td>
              <td className="p-3 min-w-36">{contexto.tentativa}
                <p className="text-xs text-ink-3">{p.snapshot.tentativasCiclo == null ? "Ordem não informada" : `${p.snapshot.tentativasCiclo} tentativa(s) no ciclo`}</p>
              </td>
              <td className="p-3 min-w-36"><Pill>{contexto.situacao}</Pill>
                {p.snapshot.diasDesdeConfirmacao != null && <p className="text-xs mt-1">Confirmada há {p.snapshot.diasDesdeConfirmacao} dias</p>}
                {p.snapshot.idadeGestacionalDias != null && <p className="text-xs">Idade gestacional: {p.snapshot.idadeGestacionalDias} dias</p>}
              </td>
              <td className="p-3 min-w-52"><fieldset disabled={bloqueado || ausente}>
                {ausente ? <Pill>{r.status === "ADIADO" ? "Adiado" : "Ausente"}</Pill>
                  : <CamposAvaliacao secao="resultado" identificacao={p.snapshot.brinco ?? String(p.ordem)} dados={r}
                    onChange={mudanca => mudarAvaliacao(p, { ...mudanca, status: "CONFIRMADO" })} />}
              </fieldset>{r.sexoFetal && <p className="text-xs mt-1">Sexo fetal: {r.sexoFetal === "F" ? "Fêmea" : "Macho"}</p>}</td>
              <td className="p-3 min-w-48"><fieldset disabled={bloqueado || ausente}>
                <CamposAvaliacao secao="conduta" identificacao={p.snapshot.brinco ?? String(p.ordem)} dados={r}
                  onChange={mudanca => mudarAvaliacao(p, mudanca)} />
              </fieldset></td>
              <td className="p-3 min-w-36 space-y-2">
                <Button secondary aria-expanded={expandido} aria-controls={`detalhes-${p.id}`}
                  onClick={() => setDetalhes(anteriores => anteriores.includes(p.id) ? anteriores.filter(id => id !== p.id) : [...anteriores, p.id])}>Detalhes · {p.snapshot.brinco ?? p.ordem}</Button>
                {!confirmado(p) && podeLancar && <Button secondary disabled={ocupado} onClick={() => setRevisao([p.id])}>Revisar animal</Button>}
                <p role="status" className="text-xs">{avisos[p.id]}</p>
                {podeRegularizar && p.regularizacaoPendente && <RegularizarOrigem path={`/visitas/${visita.id}/participantes/${p.id}/regularizacao`} propriedadeId={visita.propriedadeId} reabrirPermitido={visita.status !== "ENCERRADA"} consumoMantido={consumoMantidoUltimaAnulacao(p.historicoRegularizacao)} onMudou={onMudou} />}
              </td>
            </tr>
            {expandido && <tr id={`detalhes-${p.id}`} className="border-b border-border bg-surface-2/40"><td colSpan={9} className="p-4">
              {detalhesAvaliacao(p, r, bloqueado, ausente)}
            </td></tr>}
          </Fragment>;
        })}</tbody>
      </table>
      {!itens.length && <p className="p-5 text-sm">Nenhum participante com estes filtros.</p>}
      <p className="p-4 text-xs text-ink-3">RP refere-se ao último parto válido até a visita. Informações não preenchidas continuam pendentes. Gestação e tentativa exibidas são contexto; o vínculo clínico exige confirmação.</p>
    </div>;
  }
  function detalhesAvaliacao(p: ParticipanteVisita, r: RascunhoVisita, bloqueado: boolean, ausente: boolean) {
    const animal = painel?.animais.find(a => a.animalId === p.animalId);
    const tentativas = [...(painel?.tentativas ?? []), ...(animal?.ultimaTentativa ? [{ ...animal.ultimaTentativa, animalId: p.animalId }] : [])]
      .filter((t, indice, lista) => t.animalId === p.animalId && t.status !== "ANULADO"
        && t.data.slice(0, 10) <= visita.data.slice(0, 10) && lista.findIndex(item => item.id === t.id) === indice);
    const gestacoes = gestacoesDoAnimal(p);
    const perdaPendente = r.resultado === "NEGATIVO" && gestacoes.length > 0;
    return <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button secondary disabled={bloqueado} onClick={() => acaoAtendimento(p, "NAO_ATENDIDO")}>Marcar ausente</Button>
        <Button secondary disabled={bloqueado} onClick={() => acaoAtendimento(p, "ADIADO")}>Adiar atendimento</Button>
        {ausente && <Button secondary disabled={bloqueado} onClick={() => acaoAtendimento(p, "")}>Voltar ao resultado</Button>}
      </div>
      <fieldset disabled={bloqueado} onBlur={() => void persistir(p)} className="grid gap-4 lg:grid-cols-2">
        {ausente ? <label>Motivo do atendimento pendente{input(p, "motivo", "Motivo do atendimento pendente")}</label> : <>
          <CamposAvaliacao secao="detalhes" identificacao={p.snapshot.brinco ?? String(p.ordem)} dados={r} onChange={mudanca => mudarAvaliacao(p, mudanca)} />
          <label>Tipo de exame<select aria-label={`Tipo de exame · ${p.snapshot.brinco ?? p.ordem}`} className={classeInput}
            value={r.tipoExameId ?? ""} onChange={e => {
              const tipo = tiposExame.find(t => t.id === e.target.value);
              mudarAvaliacao(p, { tipoExameId: tipo?.id, formatoExameHash: tipo?.formatoExameHash, resultados: [] });
            }}>
            <option value="">Avaliação reprodutiva padrão</option>
            {tiposExame.filter(t => t.ativo || t.id === r.tipoExameId).map(t => <option disabled={!t.ativo} key={t.id} value={t.id}>{t.nome} · v{t.versaoFormato ?? 1}{t.ativo ? "" : " (inativo)"}</option>)}
          </select></label>
          {r.resultado !== "NAO_AVALIADO" && <CamposResultadoExame
            campos={(tiposExame.find(t => t.id === r.tipoExameId)?.campos ?? []).filter(c => !["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(c.codigo))}
            valores={r.resultados ?? []} onChange={resultados => mudarAvaliacao(p, { resultados })} />}
          {r.resultado && r.resultado !== "NAO_AVALIADO" && <>
            {select(p, "tentativaId", "Tentativa comprovada", tentativas.map(t => [t.id, `${t.data.slice(0, 10)} · ${t.tipo}`]))}
            {gestacoes.length > 0 && select(p, "gestacaoId", "Gestação conhecida · confirmar vínculo", gestacoes.map(g => [g.id, `Confirmada ${g.confirmadaEm?.slice(0, 10) ?? "sem data informada"}`]))}
            {r.resultado === "POSITIVO" && !r.tentativaId && !r.gestacaoId && <label>Justificativa do vínculo desconhecido{input(p, "motivoVinculoDesconhecido", "Motivo da tentativa não comprovada")}</label>}
          </>}
          {r.conduta === "DESCARTE" && <label>Motivo do descarte{input(p, "motivo", "Motivo do descarte")}</label>}
          {(r.conduta === "AGUARDAR" || r.resultado === "INCONCLUSIVO" || r.retornoEm) && <label>Retorno{input(p, "retornoEm", "Retorno", "date")}</label>}
          {r.conduta === "IATF" && <div className="lg:col-span-2 space-y-2">
            <p className="text-sm">Indicação de IATF: o protocolo será programado depois da confirmação.</p>
            <AlertasSanitarios animalId={p.animalId} data={visita.data.slice(0, 10)} acao="IATF" propriedadeId={visita.propriedadeId} />
            <label className="flex gap-2 text-sm"><input type="checkbox" aria-label={`Ciência sanitária · ${p.snapshot.brinco ?? p.ordem}`}
              checked={r.cienciaSanitaria === true} onChange={e => atualizar(p, "cienciaSanitaria", e.target.checked)} />
              Revisei os alertas sanitários informados para esta indicação.</label>
          </div>}
        </>}
        <label>Anotação original{input(p, "anotacaoOriginal", "Anotação original")}</label>
      </fieldset>
      {perdaPendente && <div role="alert" className="rounded-lg border border-border p-3 space-y-3">
        <p>Há gestação conhecida na data da visita. O resultado vazio não registra perda automaticamente. Revise o diagnóstico ou registre a perda e sua data antes de confirmar.</p>
        {painel && <AcoesReprodutivas painel={painel} animalId={p.animalId} propriedadeId={visita.propriedadeId} podeLancar={!bloqueado} onMudou={async () => {
          setPainel(await reqV4<PainelReprodutivo>(`/reproducao?propriedadeId=${visita.propriedadeId}`, undefined, "GET", visita.propriedadeId));
          await onMudou();
        }} />}
      </div>}
      {p.snapshot.pendenciasContexto?.length ? <ul className="text-xs">{p.snapshot.pendenciasContexto.map(m => <li key={m}>{m}</li>)}</ul> : null}
    </div>;
  }
  const parametrosDaTarefaCarregados = (!preparar?.tarefaIatfId && !preparar?.tarefaSanitariaId) || !!tarefaPreparada;
  const planoAplicacao = tarefaPreparada?.planejadoSnapshot?.etapa.planoAplicacao;
  const parametrosAplicacao = tarefaPreparada?.tipo === "APLICACAO" ? {
    produtoId: planoAplicacao?.produtoId ?? tarefaPreparada.produtoId ?? "",
    dose: planoAplicacao?.dose ?? tarefaPreparada.dose ?? "",
    unidade: planoAplicacao?.unidadeDose ?? tarefaPreparada.unidade ?? "ML",
    via: planoAplicacao?.via ?? tarefaPreparada.via ?? undefined,
    tipoAplicacaoId: tarefaPreparada.tipoAplicacaoId,
  } : undefined;
  return (
    <Panel className="mt-5">
      <CabecalhoTabela
        titulo={atividade.nome}
        acao={
          podeLancar && (
            <Button
              disabled={ocupado || !selecionadosPendentes.length}
              onClick={() => setRevisao(selecionadosPendentes.slice(0, 100))}
            >
              Revisar selecionados ({selecionadosPendentes.length})
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
        {avisoConfirmacao && <p role="status" className="mb-3 text-sm">{avisoConfirmacao}</p>}
        {atividade.participantes.length > 100 && <p className="text-sm mb-3">
          A lista completa está preservada. Cada confirmação registra até 100 animais em conjunto;
          os demais permanecem selecionados para o próximo subconjunto.
        </p>}
        {revisao.length > 0 && <section ref={revisaoRef} tabIndex={-1} aria-label="Revisão do subconjunto" className="mb-4 rounded-lg border border-border p-4 space-y-3">
          <h3 className="font-semibold">Revisar {revisao.length} atendimento(s)</h3>
          <ul className="max-h-64 overflow-y-auto text-sm space-y-1">
            {revisao.map(id => {
              const p = atividade.participantes.find(item => item.id === id)!;
              const r = rascunhos[id] ?? {};
              return <li key={id}>{p.snapshot.brinco ?? p.animalId}: {r.status === "ADIADO" ? "Adiado"
                : r.status === "NAO_ATENDIDO" ? "Ausente"
                  : rotulosResultadoAvaliacao[r.resultado ?? ""] ?? (r.dados ? "Procedimento preparado" : "Pendente")}
                {r.conduta ? ` · ${rotulosCondutaAvaliacao[r.conduta] ?? r.conduta}` : ""}
                {r.sexoFetal ? ` · Sexo fetal: ${r.sexoFetal === "F" ? "fêmea" : "macho"}` : ""}
                {r.retornoEm ? ` · Retorno: ${r.retornoEm}` : ""}
                {r.motivo ? ` · Motivo: ${r.motivo}` : ""}
              </li>;
            })}
          </ul>
          {selecionadosPendentes.length > revisao.length && <p className="text-sm">{selecionadosPendentes.length - revisao.length} selecionado(s) ficam para o próximo subconjunto.</p>}
          <div className="flex gap-2">
            <Button disabled={ocupado} onClick={() => void confirmar(revisao)}>Confirmar {revisao.length} atendimento(s)</Button>
            <Button secondary disabled={ocupado} onClick={() => setRevisao([])}>Voltar ao preenchimento</Button>
          </div>
        </section>}
        {atividade.tipo === "AVALIACAO_REPRODUTIVA" && indicadosIatf.length > 0 && podeLancar && <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <p>{indicadosIatf.length} animal(is) com indicação de IATF confirmada. A indicação não inicia protocolo nem consome materiais.</p>
          <Button secondary disabled={!painel || ocupado} onClick={() => setProgramarIatf(true)}>Programar IATF para indicados ({indicadosIatf.length})</Button>
        </div>}
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
      {atividade.tipo === "AVALIACAO_REPRODUTIVA" ? tabelaAvaliacao() : <div className="overflow-x-auto">
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
                        !podeLancar || ocupado || confirmado(p)
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
                    <CampoDataIatf rotulo={`Data realizada · ${p.snapshot.brinco ?? p.ordem}`} valor={rascunhos[p.id]?.realizadaEm ?? ""} onChange={v => atualizar(p,"realizadaEm",v)} onBlur={() => void persistir(p)} disabled={!podeLancar || ocupado || confirmado(p)} />}
                  <>
                      {atividade.tipo === "INICIAR_IATF" ? (
                        <CampoDataIatf rotulo={`Início efetivo · ${p.snapshot.brinco ?? p.ordem}`} valor={rascunhos[p.id]?.inicioEfetivo ?? ""} onChange={v => atualizar(p,"inicioEfetivo",v)} onBlur={() => void persistir(p)} disabled={!podeLancar || ocupado || confirmado(p)} />
                      ) : (
                        <>
                          <Button
                            secondary
                            disabled={
                              !podeLancar ||
                              ocupado ||
                              confirmado(p)
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
                </td>
                <td className="p-3 min-w-60">
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
                  {atividade.tipo === "INICIAR_IATF" && (
                    <>
                    {atividade.tipo === "INICIAR_IATF" && <AlertasSanitarios animalId={p.animalId} data={visita.data.slice(0,10)} acao="IATF" propriedadeId={visita.propriedadeId} />}
                    <label className="flex gap-2 text-sm my-2">
                      <input type="checkbox" aria-label={`Ciência sanitária · ${p.snapshot.brinco ?? p.ordem}`}
                        checked={rascunhos[p.id]?.cienciaSanitaria === true}
                        disabled={!podeLancar || ocupado || confirmado(p)}
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
      </div>}
      {programarIatf && painel && <section aria-label="Programar animais indicados para IATF" className="p-4 space-y-3">
        <Button secondary onClick={() => setProgramarIatf(false)}>Fechar programação dos indicados</Button>
        <p className="text-sm mb-4">A indicação já foi registrada. Escolha o protocolo e o início previsto para programar o grupo.</p>
        <Iatf animais={indicadosIatf.map(p => ({
          animalId: p.animalId, brinco: p.snapshot.brinco ?? p.animalId, nome: p.snapshot.nome ?? null,
        }))}
          animaisIndicadosInicialmente={indicadosIatf.map(p => p.animalId)} propriedadeId={visita.propriedadeId}
          painel={painel} podeLancar={podeLancar} onMudou={onMudou} />
      </section>}
      {carregandoTarefa && <div role="status" className="p-4 space-y-2">
        <p>Carregando os parâmetros desta tarefa…</p>
        <Button secondary onClick={() => setPreparar(null)}>Cancelar carregamento</Button>
      </div>}
      {preparar && !carregandoTarefa && parametrosDaTarefaCarregados &&
        (atividade.tipo === "APLICACAO_SANITARIA" ||
          tarefaPreparada?.tipo === "APLICACAO") && (
          <FormAplicacaoServico
            animalId={preparar.animalId}
            parametrosIniciais={parametrosAplicacao}
            propriedadeId={visita.propriedadeId}
            momentoIatf={atividade.tipo === "TAREFA_IATF" ? rascunhos[preparar.id]?.realizadaEm || visita.data.slice(0,10) : undefined}
            dataInicial={atividade.tipo === "TAREFA_IATF" ? (rascunhos[preparar.id]?.realizadaEm || visita.data).slice(0,10) : visita.data.slice(0,10)}
            onFechar={() => setPreparar(null)}
            onSalvo={() => setPreparar(null)}
            onRegistrar={guardarProcedimento}
          />
        )}
      {preparar && !carregandoTarefa && parametrosDaTarefaCarregados &&
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
            propriedadeId={visita.propriedadeId}
            tentativaInicial={tarefaPreparada.planejadoSnapshot?.etapa.planoTentativa}
            tipoExameInicial={tarefaPreparada.planejadoSnapshot?.etapa.planoAvaliacao?.tipoExameId}
            finalidadeInicial={tarefaPreparada.planejadoSnapshot?.etapa.planoAvaliacao?.tipo}
            onFechar={() => setPreparar(null)}
            onSalvo={() => setPreparar(null)}
            onRegistrar={guardarProcedimento}
          />
        )}
      {preparar && !carregandoTarefa && parametrosDaTarefaCarregados &&
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
      {preparar && !carregandoTarefa && parametrosDaTarefaCarregados &&
        (["EXAME_SANITARIO", "INICIAR_SANITARIO"].includes(atividade.tipo) || (atividade.tipo === "TAREFA_IATF" && tarefaPreparada?.tipo === "EXAME")) && (
          <FormFatoSanitario
            dataInicial={visita.data.slice(0, 10)}
            tipo={atividade.tipo === "EXAME_SANITARIO" || tarefaPreparada?.tipo === "EXAME" ? "exame" : "protocolo"}
            animalInicial={preparar.animalId}
            propriedadeId={visita.propriedadeId}
            cadastroInicial={tarefaPreparada?.planejadoSnapshot?.etapa.planoExame?.tipoExameId ?? tarefaPreparada?.tipoExameId}
            fixo
            onFechar={() => setPreparar(null)}
            onSalvo={() => setPreparar(null)}
            onRegistrar={guardarProcedimento}
          />
        )}
    </Panel>
  );
}
