import "./visitas-fluxo.css";
import { nomeAtividadeVisita, lotesAtividadeVisita } from "./apresentacao-visita";
import { motivosComunsFolha } from "./folha-regras";
import { CampoDataIatf } from "./CampoDataIatf";
import { CamposResultadoExame } from "../sanidade/CamposExame";
import type { TipoExame } from "../sanidade/CadastrosSanitarios";
import { CamposAvaliacao } from "./CamposAvaliacao";
import { RegularizarOrigem, consumoMantidoUltimaAnulacao } from "./RegularizarOrigem";
import { AlertasSanitarios } from "./AlertasSanitarios";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  ErrorBox,
  Pill,
} from "../../../financeiro/financeiro-ui";
import {
  classeInput,
} from "../../../financeiro/PainelCadastro";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { FormAplicacaoServico } from "../sanidade/FormAplicacaoServico";
import { FormFatoSanitario } from "../sanidade/FormFatoSanitario";
import { reqV4, type PainelReprodutivo } from "./api";
import {
  confirmarVisita,
  obterVisita,
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
  dadosConfirmacaoVisita,
  ehAvaliacaoTarefa,
  pendenciaAvaliacaoTarefa,
  rotulosCondutaAvaliacao,
  resultadoPrincipalVisita,
} from "./visitas-transcricao";
import { Iatf } from "./Iatf";
import { AcoesReprodutivas } from "./AcoesReprodutivas";
import { FormReproducao } from "./FormReproducao";
import { CabecalhoContextoVisita, CelulasContextoVisita, ContextoInlineVisita, contarColunasContextoVisita } from "./ContextoTabelaVisita";
import { blocosConfirmacao } from "./visitas-regras";
export function Transcricao({
  visita,
  atividade,
  podeLancar,
  podeRegularizar = podeLancar,
  onMudou,
  registrarGuardaSaida,
  onPlanejar,
}: {
  visita: Visita;
  atividade: AtividadeVisita;
  podeLancar: boolean;
  podeRegularizar?: boolean;
  onMudou: () => Promise<void>;
  registrarGuardaSaida?: (guarda: (() => Promise<boolean>) | null) => void;
  onPlanejar?: () => void;
}) {
  const [tiposExame, setTiposExame] = useState<TipoExame[]>([]);
  useEffect(() => {
    let ativo = true;
    if (atividade.tipo === "AVALIACAO_REPRODUTIVA" || atividade.tipo === "TAREFA_IATF") reqV4<TipoExame[]>("/reproducao/tipos-exame?incluirInativos=true", undefined, "GET", visita.propriedadeId).then(t => { if (ativo) setTiposExame(t); }).catch(e => { if (ativo) setErro(e.message); });
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
  const [detalhesFechados, setDetalhesFechados] = useState<string[]>([]);
  function alternarDetalhes(id: string, expandido: boolean) {
    setDetalhes(d=>expandido?d.filter(item=>item!==id):[...new Set([...d,id])]);
    setDetalhesFechados(d=>expandido?[...new Set([...d,id])]:d.filter(item=>item!==id));
    if (!expandido) {
      const tabela = document.getElementById(`linha-${id}`)?.closest<HTMLElement>(".visita-tabela");
      if (tabela) tabela.scrollLeft = 0;
    }
  }
  const [revisao, setRevisao] = useState<string[]>([]);
  const revisaoRef = useRef<HTMLElement>(null);
  const [focoPendencia, setFocoPendencia] = useState<string | null>(null);
  useEffect(() => { if (revisao.length) revisaoRef.current?.focus(); }, [revisao]);
  const [confirmadosLocais, setConfirmadosLocais] = useState<string[]>([]);
  const [programarIatf, setProgramarIatf] = useState(false);
  const [avisoConfirmacao, setAvisoConfirmacao] = useState("");
  const [progressoConfirmacao, setProgressoConfirmacao] = useState("");
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
  const [pagina, setPagina] = useState(1);
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
  const conciliadoRemoto = (esperado: { participanteId: string; status?: string; motivo?: string }, remoto: ParticipanteVisita | undefined) => {
    if (!remoto) return false;
    const status = esperado.status ?? "CONFIRMADO";
    if (status === "ADIADO" || status === "NAO_ATENDIDO")
      return remoto.status === status && remoto.motivo === esperado.motivo;
    return remoto.status === "CONFIRMADO" || !!remoto.fatoId;
  };
  const [preparar, setPreparar] = useState<ParticipanteVisita | null>(null);
  const rascunhosAtuais = useRef(rascunhos);
  const versoes = useRef<Record<string, number>>(Object.fromEntries(atividade.participantes.map(p => [p.id, p.versaoRascunho ?? 0])));
  const conflitos = useRef(new Set<string>());
  const gravações = useRef<Record<string, Promise<unknown>>>({});
  const rascunhosSujos = useRef(new Set<string>());
  const guardaAtual = useRef<() => Promise<boolean>>(async () => true);
  const guardaEstavel = useCallback(() => guardaAtual.current(), []);
  useEffect(() => {
    registrarGuardaSaida?.(guardaEstavel);
    return () => registrarGuardaSaida?.(null);
  }, [registrarGuardaSaida, guardaEstavel]);
  useEffect(() => {
    const protegerRascunho = (evento: BeforeUnloadEvent) => {
      if (!rascunhosSujos.current.size && !Object.keys(gravações.current).length && !envioPendente.current && !ocupado) return;
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", protegerRascunho);
    return () => window.removeEventListener("beforeunload", protegerRascunho);
  }, [ocupado]);
  useEffect(() => {
    for (const p of atividade.participantes) {
      if (conflitos.current.has(p.id)) continue;
      const remoto = p.rascunho ?? {};
      if (rascunhosSujos.current.has(p.id)) {
        if (JSON.stringify(rascunhosAtuais.current[p.id] ?? {}) !== JSON.stringify(remoto)) continue;
        rascunhosSujos.current.delete(p.id);
      }
      if (!gravações.current[p.id]) {
        rascunhosAtuais.current[p.id] = remoto;
        versoes.current[p.id] = p.versaoRascunho ?? 0;
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
      ...rascunhosAtuais.current[p.id], dados: { ...(p.tarefaSanitariaId ? { desvio: rascunhosAtuais.current[p.id]?.dados?.desvio } : {}), ...dados }, status: "CONFIRMADO",
    };
    rascunhosSujos.current.add(p.id);
    setRascunhos({ ...rascunhosAtuais.current });
    if (!(await persistir(p))) throw new Error("Não foi possível salvar o procedimento. Revise o rascunho.");
  }
  const confirmado = (p: ParticipanteVisita) => p.status === "CONFIRMADO" || confirmadosLocais.includes(p.id);
  const selecionadosPendentes = selecionados.filter(id => {
    const p = atividade.participantes.find(item => item.id === id);
    return p && !confirmado(p);
  });
  const indicadosIatf = atividade.participantes.filter(p => confirmado(p) && !p.regularizacaoPendente &&
    (ehAvaliacaoTarefa(p) ? (rascunhos[p.id]?.dados?.conduta ?? p.rascunho?.dados?.conduta) : (rascunhos[p.id]?.conduta ?? p.rascunho?.conduta)) === "IATF");
  const itens = filtrarParticipantes(atividade.participantes, {
    q,
    status,
    motivos,
  });
  const itensPagina = itens.slice((pagina - 1) * 15, pagina * 15);
  useEffect(() => { setPagina(1); }, [q, status, motivos]);
  useEffect(() => {
    if (!focoPendencia) return;
    const indice = itens.findIndex(p => p.id === focoPendencia);
    const paginaAlvo = indice >= 0 ? Math.floor(indice / 15) + 1 : pagina;
    if (paginaAlvo !== pagina) { setPagina(paginaAlvo); return; }
    const linha = document.getElementById(`linha-${focoPendencia}`);
    linha?.querySelector<HTMLSelectElement>("select")?.focus();
    setFocoPendencia(null);
  }, [focoPendencia, pagina, itens]);
  function paginacaoAtendimento() {
    const paginas = Math.max(1, Math.ceil(itens.length / 15));
    return <nav aria-label="Paginação dos participantes" className="visita-paginacao">
      <span>{itens.length ? (pagina - 1) * 15 + 1 : 0}–{Math.min(pagina * 15, itens.length)} de {itens.length} participantes filtrados · 15 por página</span>
      <div className="flex items-center gap-2"><Button secondary disabled={pagina <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>Anterior</Button><span>Página {pagina} de {paginas}</span><Button secondary disabled={pagina >= paginas} onClick={() => setPagina(p => Math.min(paginas, p + 1))}>Próxima</Button></div>
    </nav>;
  }
  const motivosDisponiveis = Array.from(
    new Set(atividade.participantes.flatMap(motivosParticipante)),
  );
  const atualizar = <K extends keyof RascunhoVisita,>(
    p: ParticipanteVisita,
    campo: K,
    valor: RascunhoVisita[K],
  ) => {
    rascunhosAtuais.current[p.id] = { ...rascunhosAtuais.current[p.id], ...(["conduta", "participanteIatfId", "inicioEfetivo"].includes(campo) ? { cienciaSanitaria: false } : {}), [campo]: valor };
    rascunhosSujos.current.add(p.id);
    setRascunhos({ ...rascunhosAtuais.current });
    setAvisos((r) => ({ ...r, [p.id]: "Alterações não salvas" }));
  };
  function atualizarDados(p: ParticipanteVisita, mudanca: Record<string, unknown>) {
    if ("resultado" in mudanca) setDetalhesFechados(d=>d.filter(id=>id!==p.id));
    rascunhosAtuais.current[p.id] = { ...rascunhosAtuais.current[p.id], dados: { ...(rascunhosAtuais.current[p.id]?.dados ?? {}), ...("conduta" in mudanca ? { cienciaSanitaria: false } : {}), ...mudanca }, status: "CONFIRMADO" };
    rascunhosSujos.current.add(p.id);
    setRascunhos({ ...rascunhosAtuais.current });
    setAvisos(a => ({ ...a, [p.id]: "Alterações não salvas" }));
  }
  async function persistir(p: ParticipanteVisita) {
    if (!rascunhosSujos.current.has(p.id) && !gravações.current[p.id]) return true;
    const anterior = gravações.current[p.id] ?? Promise.resolve();
    const proxima = anterior
      .catch(() => {})
      .then(async () => {
        if (!rascunhosSujos.current.has(p.id)) return;
        if (conflitos.current.has(p.id)) throw new Error("Rascunho alterado em outra sessão. Reabra a visita para revisar antes de salvar.");
        const snapshot = { ...rascunhosAtuais.current[p.id] };
        try {
          const salvo = await salvarRascunhoVisita(visita.id, p.id, visita.propriedadeId,
            snapshot, versoes.current[p.id] ?? 0);
          versoes.current[p.id] = salvo?.versaoRascunho ?? (versoes.current[p.id] ?? 0) + 1;
          if (JSON.stringify(rascunhosAtuais.current[p.id] ?? {}) === JSON.stringify(snapshot)) rascunhosSujos.current.delete(p.id);
        } catch (e) {
          if (e instanceof RebanhoApiError && e.status === 409) conflitos.current.add(p.id);
          else {
            // A escrita pode ter sido aceita mesmo que a resposta não tenha chegado.
            const atualizada = await obterVisita(visita.id);
            const remoto = atualizada.atividades.flatMap(a => a.participantes).find(item => item.id === p.id);
            if (remoto && JSON.stringify(remoto.rascunho ?? {}) === JSON.stringify(snapshot)) {
              versoes.current[p.id] = remoto.versaoRascunho ?? versoes.current[p.id] ?? 0;
              if (JSON.stringify(rascunhosAtuais.current[p.id] ?? {}) === JSON.stringify(snapshot)) rascunhosSujos.current.delete(p.id);
              return;
            }
          }
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
    } finally {
      if (gravações.current[p.id] === proxima) delete gravações.current[p.id];
    }
  }
  guardaAtual.current = async () => {
    if (ocupado) return false;
    let idsJaConciliados = new Set<string>();
    if (envioPendente.current) {
      try {
        const atualizada = await obterVisita(visita.id);
        const itensPendentes = envioPendente.current.input.itens;
        const remotos = atualizada.atividades.flatMap(a => a.participantes);
        if (itensPendentes.some(item => !conciliadoRemoto(item, remotos.find(p => p.id === item.participanteId)))) {
          setErro("Há uma confirmação sem resposta. A visita foi consultada e a confirmação precisa ser retomada nesta atividade antes de sair.");
          return false;
        }
        idsJaConciliados = new Set(itensPendentes.map(item => item.participanteId));
        for (const item of itensPendentes) {
          const p = atividade.participantes.find(participante => participante.id === item.participanteId);
          if (p) {
            rascunhosAtuais.current[p.id] = { ...rascunhosAtuais.current[p.id], status: item.status ?? "CONFIRMADO" };
            rascunhosSujos.current.delete(p.id);
          }
        }
        setRascunhos({ ...rascunhosAtuais.current });
        setConfirmadosLocais(prev => [...new Set([...prev, ...itensPendentes.filter(item => (item.status ?? "CONFIRMADO") === "CONFIRMADO").map(item => item.participanteId)])]);
        envioPendente.current = null;
        await onMudou();
      } catch {
        setErro("Não foi possível consultar a confirmação pendente. Permaneça nesta atividade e tente novamente.");
        return false;
      }
    }
    const ids = new Set([...rascunhosSujos.current, ...Object.keys(gravações.current)]);
    const participantes = [...ids].filter(id => !idsJaConciliados.has(id)).map(id => atividade.participantes.find(p => p.id === id)).filter((p): p is ParticipanteVisita => !!p && !confirmado(p));
    const resultados = await Promise.all(participantes.map(p => persistir(p)));
    return resultados.every(Boolean) && participantes.every(p => !conflitos.current.has(p.id) && !rascunhosSujos.current.has(p.id));
  };
  async function confirmar(ids: string[]) {
    if (!ids.length) return;
    const blocos = blocosConfirmacao(ids);
    setOcupado(true);
    setProgressoConfirmacao(blocos.length > 1 ? `Preparando ${blocos.length} blocos de até 100 participantes.` : "");
    try {
      for (const [indice, bloco] of blocos.entries()) {
        setProgressoConfirmacao(blocos.length > 1 ? `Confirmando bloco ${indice + 1} de ${blocos.length} (${bloco.length} participantes).` : "");
        if (!(await confirmarBloco(bloco))) {
          if (indice > 0) setProgressoConfirmacao(`Parado no bloco ${indice + 1} de ${blocos.length}. Os blocos anteriores foram confirmados; revise e retome os participantes restantes.`);
          return;
        }
      }
      setProgressoConfirmacao("");
    } finally {
      setOcupado(false);
    }
  }
  async function confirmarBloco(ids: string[]): Promise<boolean> {
    const pendencias = ids
      .map((id) => ({
        id,
        erro:
          atividade.tipo === "AVALIACAO_REPRODUTIVA"
            ? pendenciaAvaliacao(atividade.participantes.find(p => p.id === id)!, rascunhosAtuais.current[id])
            : atividade.tipo === "TAREFA_IATF" && ehAvaliacaoTarefa(atividade.participantes.find(p => p.id === id)!)
              ? ["ADIADO", "NAO_ATENDIDO"].includes(rascunhosAtuais.current[id]?.status ?? "")
                ? pendenciaRascunho(rascunhosAtuais.current[id])
                : pendenciaAvaliacaoTarefa(rascunhosAtuais.current[id]?.dados, gestacoesDoAnimal(atividade.participantes.find(p => p.id === id)!).length > 0)
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
      return false;
    }
    setErro(null);
    let payloadAtual: string | null = null;
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
      payloadAtual = payload;
      if (envioPendente.current && envioPendente.current.payload !== payload) {
        setErro("Existe uma confirmação anterior sem resposta. Consulte a visita antes de alterar e reenviar os dados deste bloco.");
        return false;
      }
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
      return false;
        }
        entrada = {
          propriedadeId: visita.propriedadeId,
          chave: crypto.randomUUID(),
          cienciaAlteracoes,
          fingerprintPrevia: previa.fingerprint,
          itens: itens.map(item => ({ ...item, ...(atividade.participantes.find(p => p.id === item.participanteId)?.versaoRascunho != null ? { versaoRascunho: versoes.current[item.participanteId] } : {}) })),
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
      return true;
    } catch (e) {
      if (e instanceof RebanhoApiError && e.status < 500) {
        envioPendente.current = null;
        if (e.code === "CONFLITO") setCienciaAlteracoes(false);
      } else if (payloadAtual != null && envioPendente.current?.payload === payloadAtual) {
        try {
          const atualizada = await obterVisita(visita.id);
          const remotos = atualizada.atividades.flatMap(a => a.participantes);
          if (envioPendente.current.input.itens.every(item => conciliadoRemoto(item, remotos.find(p => p.id === item.participanteId)))) {
            const itensConciliados = envioPendente.current.input.itens;
            envioPendente.current = null;
            for (const item of itensConciliados) {
              const p = atividade.participantes.find(participante => participante.id === item.participanteId);
              if (p) {
                rascunhosAtuais.current[p.id] = { ...rascunhosAtuais.current[p.id], status: item.status ?? "CONFIRMADO" };
                rascunhosSujos.current.delete(p.id);
              }
            }
            setRascunhos({ ...rascunhosAtuais.current });
            setConfirmadosLocais(prev => [...new Set([...prev, ...itensConciliados.filter(item => (item.status ?? "CONFIRMADO") === "CONFIRMADO").map(item => item.participanteId)])]);
            setSelecionados(prev => prev.filter(id => !itensConciliados.some(item => item.participanteId === id)));
            setRevisao([]);
            setAvisoConfirmacao(`${ids.length} atendimento(s) confirmado(s), conciliados após consultar a visita.`);
            await onMudou();
            return true;
          }
        } catch { /* A guarda preservará o envelope para nova consulta. */ }
      }
      setErro(e instanceof Error ? e.message : String(e));
      return false;
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
  const selectDados = (p: ParticipanteVisita, campo: string, label: string, opcoes: [string, string][]) => (
    <label>{label}<select aria-label={`${label} · ${p.snapshot.brinco ?? p.ordem}`} className={classeInput} disabled={!podeLancar || ocupado || confirmado(p)} value={String(rascunhos[p.id]?.dados?.[campo] ?? "")} onChange={e => atualizarDados(p, { [campo]: e.target.value })} onBlur={() => void persistir(p)}>
      <option value="">Selecione</option>{opcoes.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
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
    if ("resultado" in mudanca) setDetalhesFechados(d=>d.filter(id=>id!==p.id));
    rascunhosAtuais.current[p.id] = {
      ...rascunhosAtuais.current[p.id],
      ...Object.fromEntries(Object.entries(mudanca).map(([k, v]) => [k, v ?? ""])),
      cienciaSanitaria: false,
    };
    rascunhosSujos.current.add(p.id);
    setRascunhos({ ...rascunhosAtuais.current });
    setAvisos(anteriores => ({ ...anteriores, [p.id]: "Alterações não salvas" }));
    // Os seletores salvam imediatamente; o restante mantém o salvamento ao sair do campo.
    void persistir(p);
  }
  function acaoAtendimento(p: ParticipanteVisita, status: string) {
    atualizar(p, "status", status);
    setDetalhesFechados(d=>d.filter(id=>id!==p.id));
    setDetalhes(anteriores => [...new Set([...anteriores, p.id])]);
    void persistir(p);
  }
  function tabelaAvaliacao() {
    const editaveis = itens.filter(p => !confirmado(p));
    return <div className="visita-tabela visita-tabela-atendimento" role="region" aria-label="Resultados dos animais" tabIndex={0}>
      <table className="w-full text-sm">
        <caption className="sr-only">Avaliação coletiva na ordem da folha de campo</caption>
        <thead className="sticky top-0 z-10 bg-surface"><tr className="text-left border-y border-border">
          <th className="p-3"><input type="checkbox" aria-label="Selecionar todos os participantes filtrados"
            disabled={!podeLancar || ocupado || !editaveis.length}
            checked={editaveis.length > 0 && editaveis.every(p => selecionados.includes(p.id))}
            onChange={e => setSelecionados(anteriores => e.target.checked
              ? [...new Set([...anteriores, ...editaveis.map(p => p.id)])]
              : anteriores.filter(id => !editaveis.some(p => p.id === id)))} /></th>
          <CabecalhoContextoVisita />
          <th className="p-3">Resultado do atendimento</th><th className="p-3">Detalhes</th>
        </tr></thead>
        <tbody>{itensPagina.map(p => {
          const r = rascunhos[p.id] ?? {};
          const bloqueado = !podeLancar || ocupado || confirmado(p);
          const ausente = ["ADIADO", "NAO_ATENDIDO"].includes(r.status ?? "");
          const exigeDetalhe = ausente || r.conduta === "DESCARTE" || r.conduta === "IATF"
            || (r.resultado === "POSITIVO" && !r.tentativaId && !r.gestacaoId)
            || ["SEXAGEM", "RECONFIRMACAO"].includes(r.resultado ?? "")
            || (r.resultado === "NEGATIVO" && gestacoesDoAnimal(p).length > 0);
          const expandido = detalhes.includes(p.id) || (exigeDetalhe && !detalhesFechados.includes(p.id));
          return <Fragment key={p.id}>
            <tr id={`linha-${p.id}`} className="border-b border-border align-top">
              <td className="p-3"><input type="checkbox" aria-label={`Selecionar ${p.snapshot.brinco ?? p.ordem}`}
                disabled={bloqueado} checked={selecionados.includes(p.id)}
                onChange={e => setSelecionados(anteriores => e.target.checked ? [...new Set([...anteriores, p.id])] : anteriores.filter(id => id !== p.id))} /></td>
              <CelulasContextoVisita contexto={p.snapshot} dataReferencia={visita.data} compacto/>
              <td className="visita-resultado"><fieldset disabled={bloqueado} onBlur={()=>void persistir(p)}>
                <CamposAvaliacao secao="resultado" identificacao={p.snapshot.brinco ?? String(p.ordem)} dados={r}
                  administrativo={{status:r.status,onChange:valor=>acaoAtendimento(p,valor)}}
                  onChange={mudanca=>mudarAvaliacao(p,{...mudanca,status:"CONFIRMADO"})}/>
              </fieldset>{r.sexoFetal && <small>Sexo fetal: {r.sexoFetal === "F" ? "Fêmea" : "Macho"}</small>}{confirmado(p) && <small className="visita-confirmado">Confirmado</small>}</td>
              <td className="p-3 min-w-36 space-y-2">
                <button type="button" className="visita-link h-auto" aria-label={`Detalhes · ${p.snapshot.brinco ?? p.ordem}`} aria-expanded={expandido} aria-controls={`detalhes-${p.id}`} onClick={()=>alternarDetalhes(p.id,expandido)}>{expandido ? "Fechar" : "Detalhes"}</button>
                <p role="status" className="text-xs">{avisos[p.id]}</p>
                {podeRegularizar && p.regularizacaoPendente && <RegularizarOrigem path={`/visitas/${visita.id}/participantes/${p.id}/regularizacao`} propriedadeId={visita.propriedadeId} reabrirPermitido={visita.status !== "ENCERRADA"} consumoMantido={consumoMantidoUltimaAnulacao(p.historicoRegularizacao)} onMudou={onMudou} />}
              </td>
            </tr>
            {expandido && <tr id={`detalhes-${p.id}`} className="visita-detalhes"><td colSpan={contarColunasContextoVisita() + 3} className="p-4">
              <ContextoInlineVisita contexto={p.snapshot} dataReferencia={visita.data} />
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
          <label>Conduta<CamposAvaliacao secao="conduta" identificacao={p.snapshot.brinco ?? String(p.ordem)} dados={r} onChange={mudanca => mudarAvaliacao(p, mudanca)} /></label>
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
      {!confirmado(p) && podeLancar && <Button secondary disabled={ocupado} onClick={()=>setRevisao([p.id])}>Revisar animal</Button>}
      {p.snapshot.pendenciasContexto?.length ? <ul className="text-xs">{p.snapshot.pendenciasContexto.map(m => <li key={m}>{m}</li>)}</ul> : null}
    </div>;
  }
  function campoDesvioSanitario(p: ParticipanteVisita) {
    const desvio = rascunhos[p.id]?.dados?.desvio as { motivo?: string } | undefined;
    return <label>Motivo do desvio da tarefa (se houver)
      <input aria-label={`Motivo do desvio · ${p.snapshot.brinco ?? p.ordem}`} className={classeInput} maxLength={500}
        disabled={!podeLancar || ocupado || confirmado(p)} value={desvio?.motivo ?? ""}
        onChange={e => atualizar(p, "dados", { ...rascunhosAtuais.current[p.id]?.dados, desvio: e.target.value ? { motivo: e.target.value } : undefined })}
        onBlur={() => void persistir(p)} />
      <small>Informe o motivo ao alterar a data, o produto, a dose ou o exame planejado.</small>
    </label>;
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
  const confirmados = atividade.participantes.filter(confirmado).length;
  const idsComResultado = atividade.participantes.filter(p => {
    if (confirmado(p) || p.regularizacaoPendente) return false;
    const r = rascunhos[p.id] ?? {};
    if (["ADIADO", "NAO_ATENDIDO"].includes(r.status ?? "")) return true;
    if (atividade.tipo === "AVALIACAO_REPRODUTIVA" || ehAvaliacaoTarefa(p)) {
      return !!resultadoPrincipalVisita(atividade.tipo, p, r);
    }
    return !!r.resultado || Object.keys(r.dados ?? {}).length > 0
      || r.status === "CONFIRMADO";
  }).map(p => p.id);
  const idsConferencia = selecionadosPendentes.length ? selecionadosPendentes : idsComResultado;
  const comuns = motivosComunsFolha(atividade.participantes);
  const primeiraTarefa = atividade.participantes[0]?.snapshot.tarefaPlanejada?.tarefa;
  const tituloAtividade = nomeAtividadeVisita(atividade);
  const protocoloVisivel = primeiraTarefa?.protocoloNome ?? atividade.nome;
  const referenciaVisivel = comuns.join("; ") || primeiraTarefa?.nome || "Contexto preservado na preparação";
  return (
    <section className="visita-painel visita-transcricao">
      <div className="visita-painel-cabecalho"><div><h2>{tituloAtividade}</h2><p>{lotesAtividadeVisita(atividade)} · {atividade.participantes.length} animais na lista preparada</p></div><span className="visita-badge">{confirmados} / {atividade.participantes.length} confirmados</span></div>
      <div className="visita-contexto">{protocoloVisivel !== tituloAtividade && <div><span>Protocolo / seleção</span>{protocoloVisivel}</div>}<div><span>Data do atendimento</span>{visita.data.slice(0,10).split("-").reverse().join("/")}</div>{referenciaVisivel !== tituloAtividade && referenciaVisivel !== protocoloVisivel && <div className="visita-criterio"><span>Referência compartilhada</span>{referenciaVisivel}</div>}</div>
      <div className="visita-aviso suave">{atividade.tipo === "AVALIACAO_REPRODUTIVA" || atividade.participantes.some(ehAvaliacaoTarefa) ? "Conclusão, sexo fetal e conduta são informações distintas. Os complementos aparecem em “Detalhes”." : "O resultado principal fica na linha. Os dados complementares do procedimento ficam em “Detalhes”."}</div>
      <div className="visita-mensagens">
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
        {progressoConfirmacao && <p role="status" className="mb-3 text-sm">{progressoConfirmacao}</p>}
        {atividade.participantes.length > 100 && <p className="text-sm mb-3">
          A lista completa está preservada. Cada confirmação registra até 100 animais em conjunto;
          os demais permanecem selecionados para o próximo subconjunto.
        </p>}
        {revisao.length > 0 && <section ref={revisaoRef} tabIndex={-1} aria-label="Revisão do subconjunto" className="visita-confirmacao space-y-3">
          <h3 className="font-semibold">Revisar {revisao.length} atendimento(s)</h3>
          <ul className="max-h-64 overflow-y-auto text-sm space-y-1">
            {revisao.slice(0, 100).map(id => {
              const p = atividade.participantes.find(item => item.id === id)!;
              const r = rascunhos[id] ?? {};
              return <li key={id}>{p.snapshot.brinco ?? p.animalId}: {r.status === "ADIADO" ? "Adiado"
                : r.status === "NAO_ATENDIDO" ? "Ausente"
                  : resultadoPrincipalVisita(atividade.tipo, p, r) ?? (r.dados ? "Procedimento preparado" : "Pendente")}
                {r.conduta ? ` · ${rotulosCondutaAvaliacao[r.conduta] ?? r.conduta}` : ""}
                {r.sexoFetal ? ` · Sexo fetal: ${r.sexoFetal === "F" ? "fêmea" : "macho"}` : ""}
                {r.retornoEm ? ` · Retorno: ${r.retornoEm}` : ""}
                {r.motivo ? ` · Motivo: ${r.motivo}` : ""}
              </li>;
            })}
          </ul>
          {revisao.length > 100 && <p className="text-sm">A confirmação seguirá em blocos de até 100. Após cada bloco concluído, a próxima parte começa; se houver falha, somente os participantes restantes ficam para retomada.</p>}
          <div className="flex gap-2">
            <Button disabled={ocupado} onClick={() => void confirmar(revisao)}>Confirmar {revisao.length} atendimento(s)</Button>
            <Button secondary disabled={ocupado} onClick={() => setRevisao([])}>Voltar ao preenchimento</Button>
          </div>
        </section>}
        {indicadosIatf.length > 0 && podeLancar && <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <p>{indicadosIatf.length} animal(is) com indicação de IATF confirmada. A indicação não inicia protocolo nem consome materiais.</p>
          <Button secondary disabled={!painel || ocupado} onClick={() => setProgramarIatf(true)}>Programar IATF para indicados ({indicadosIatf.length})</Button>
        </div>}
      </div>
      <div className="visita-toolbar"><label className="visita-campo">Buscar<input className="visita-busca h-auto" type="search" aria-label="Buscar participantes" value={q} onChange={e=>setQ(e.target.value)} placeholder="Brinco, nome ou lote"/></label><div className="visita-toolbar-direita"><span>Rascunhos salvos ao sair do campo</span><details className="visita-filtros-extras"><summary>Filtrar atendimentos</summary><div><label>Atendimento<select className="h-auto" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos</option><option value="PENDENTE">Pendentes</option><option value="CONFIRMADO">Confirmados</option><option value="ADIADO">Adiados</option><option value="NAO_ATENDIDO">Não atendidos</option></select></label>{motivosDisponiveis.map(m=><label key={m}><input type="checkbox" checked={motivos.includes(m)} onChange={e=>setMotivos(e.target.checked?[...motivos,m]:motivos.filter(v=>v!==m))}/>{m}</label>)}</div></details>{!!selecionadosPendentes.length && <span>{selecionadosPendentes.length} selecionados</span>}</div></div>
      {atividade.tipo === "AVALIACAO_REPRODUTIVA" ? tabelaAvaliacao() : <div className="visita-tabela visita-tabela-atendimento" role="region" aria-label="Procedimentos dos animais" tabIndex={0}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface"><tr className="text-left border-y border-border">
            <th className="p-3"><input type="checkbox" aria-label="Selecionar todos os participantes filtrados" disabled={!podeLancar || ocupado || !itens.some(p => !confirmado(p))} checked={itens.filter(p => !confirmado(p)).length > 0 && itens.filter(p => !confirmado(p)).every(p => selecionados.includes(p.id))} onChange={e => setSelecionados(prev => e.target.checked ? [...new Set([...prev, ...itens.filter(p => !confirmado(p)).map(p => p.id)])] : prev.filter(id => !itens.some(p => p.id === id)))} /></th><CabecalhoContextoVisita />
            <th className="p-3">Resultado do atendimento</th><th className="p-3">Detalhes</th>
          </tr></thead>
          <tbody>{itensPagina.map(p => {
            const r = rascunhos[p.id] ?? {};
            const resultadoTarefa = String(r.dados?.resultado ?? "");
            const exigeDetalhes = ["ADIADO","NAO_ATENDIDO"].includes(r.status ?? "") || (ehAvaliacaoTarefa(p) && !!resultadoTarefa && (resultadoTarefa === "SEXAGEM" || resultadoTarefa === "RECONFIRMACAO" || (resultadoTarefa === "POSITIVO" && !r.dados?.tentativaId && !r.dados?.gestacaoId) || !r.realizadaEm));
            const expandido = detalhes.includes(p.id) || preparar?.id === p.id || (exigeDetalhes && !detalhesFechados.includes(p.id));
            const bloqueado = !podeLancar || ocupado || confirmado(p);
            return <Fragment key={p.id}>
              <tr className="border-b border-border align-top" id={`linha-${p.id}`}>
                <td className="p-3"><input type="checkbox" aria-label={`Selecionar ${p.snapshot.brinco ?? p.ordem}`} disabled={bloqueado} checked={selecionados.includes(p.id)} onChange={e => setSelecionados(e.target.checked ? [...new Set([...selecionados, p.id])] : selecionados.filter(id => id !== p.id))} /></td>
                <CelulasContextoVisita contexto={p.snapshot} dataReferencia={visita.data} compacto/>
                <td className="visita-resultado">{atividade.tipo === "TAREFA_IATF" && ehAvaliacaoTarefa(p) ? <fieldset disabled={bloqueado} onBlur={()=>void persistir(p)}><CamposAvaliacao secao="resultado" identificacao={p.snapshot.brinco ?? String(p.ordem)} dados={(r.dados ?? {}) as RascunhoVisita} administrativo={{status:r.status,onChange:valor=>acaoAtendimento(p,valor)}} onChange={mudanca=>atualizarDados(p,mudanca)}/></fieldset> : <select aria-label={`Atendimento · ${p.snapshot.brinco ?? p.ordem}`} title={r.status === "CONFIRMADO" ? atividade.tipo === "INICIAR_IATF" ? "Início realizado" : "Procedimento realizado" : r.status === "ADIADO" ? "Adiado" : r.status === "NAO_ATENDIDO" ? "Não atendido" : "Selecionar resultado"} value={r.status ?? ""} disabled={bloqueado} onChange={e=>{atualizar(p,"status",e.target.value);setDetalhes(d=>[...new Set([...d,p.id])]);}} onBlur={()=>void persistir(p)}><option value="">Selecionar resultado</option><option value="CONFIRMADO">{atividade.tipo === "INICIAR_IATF" ? "Início realizado" : "Procedimento realizado"}</option><option value="ADIADO">Adiado</option><option value="NAO_ATENDIDO">Não atendido</option></select>}{confirmado(p) && <small className="visita-confirmado">Confirmado</small>}</td>
                <td className="p-3 min-w-36 space-y-2">
                  <button type="button" className="visita-link h-auto" aria-label={`Detalhes · ${p.snapshot.brinco ?? p.ordem}`} aria-expanded={expandido} aria-controls={`detalhes-${p.id}`} onClick={()=>alternarDetalhes(p.id,expandido)}>{expandido ? "Fechar" : "Detalhes"}</button>
                  <p role="status" className="text-xs">{avisos[p.id]}</p>
                  {podeRegularizar && p.regularizacaoPendente && <RegularizarOrigem path={`/visitas/${visita.id}/participantes/${p.id}/regularizacao`} propriedadeId={visita.propriedadeId} reabrirPermitido={visita.status !== "ENCERRADA"} consumoMantido={consumoMantidoUltimaAnulacao(p.historicoRegularizacao)} onMudou={onMudou} />}
                  {p.fatoId && <p className="text-xs text-ink-3">Fato registrado</p>}
                </td>
              </tr>
              {expandido && <tr id={`detalhes-${p.id}`} className="visita-detalhes"><td colSpan={contarColunasContextoVisita() + 3} className="p-4">
                <ContextoInlineVisita contexto={p.snapshot} dataReferencia={visita.data} />
                <div className="grid gap-4 lg:grid-cols-2">
                  {atividade.tipo === "TAREFA_IATF" && ehAvaliacaoTarefa(p) && <>
                    <fieldset disabled={bloqueado} className="grid gap-3 rounded-lg border border-border p-3"><legend className="px-1 font-semibold">Vínculos do resultado</legend>
                      {selectDados(p, "tentativaId", "Tentativa comprovada", ((painel?.tentativas ?? []).filter(t => t.animalId === p.animalId && t.status !== "ANULADO" && t.data.slice(0,10) <= visita.data.slice(0,10)).map(t => [t.id, `${t.data.slice(0,10)} · ${t.tipo}`]) as [string,string][]))}
                      {selectDados(p, "gestacaoId", "Gestação conhecida", ((painel?.gestacoes ?? []).filter(g => g.animalId === p.animalId && g.status === "VALIDO" && (!g.confirmadaEm || g.confirmadaEm.slice(0,10) <= visita.data.slice(0,10)) && (!g.encerradaEm || g.encerradaEm.slice(0,10) > visita.data.slice(0,10))).map(g => [g.id, `Confirmada ${g.confirmadaEm?.slice(0,10) ?? "sem data"}`]) as [string,string][]))}
                      <fieldset disabled={bloqueado} onBlur={() => void persistir(p)} className="grid gap-3">
                        <CamposAvaliacao secao="detalhes" identificacao={p.snapshot.brinco ?? String(p.ordem)} dados={r.dados ?? {}} onChange={mudanca => atualizarDados(p, mudanca)} />
                        <label>Conduta<CamposAvaliacao secao="conduta" identificacao={p.snapshot.brinco ?? String(p.ordem)} dados={r.dados ?? {}} onChange={mudanca => atualizarDados(p, mudanca)} /></label>
                        {r.dados?.conduta === "DESCARTE" && <label>Motivo do descarte<input aria-label={`Motivo do descarte · ${p.snapshot.brinco ?? p.ordem}`} className={classeInput} value={String(r.dados?.motivo ?? "")} onChange={e => atualizarDados(p, { motivo: e.target.value })} /></label>}
                        {(r.dados?.conduta === "AGUARDAR" || !!r.dados?.retornoEm) && <label>Retorno<input aria-label={`Retorno · ${p.snapshot.brinco ?? p.ordem}`} className={classeInput} type="date" value={String(r.dados?.retornoEm ?? "")} onChange={e => atualizarDados(p, { retornoEm: e.target.value || undefined })} /></label>}
                        {r.dados?.conduta === "IATF" && <div><p>A indicação não inicia o protocolo. A programação fica disponível após confirmar.</p><AlertasSanitarios animalId={p.animalId} data={(r.realizadaEm || visita.data).slice(0,10)} acao="IATF" propriedadeId={visita.propriedadeId} /><label><input type="checkbox" aria-label={`Ciência sanitária · ${p.snapshot.brinco ?? p.ordem}`} checked={r.dados?.cienciaSanitaria === true} onChange={e => atualizarDados(p, { cienciaSanitaria: e.target.checked })} />Revisei os alertas sanitários para esta indicação.</label></div>}
                      </fieldset>
                      {r.dados?.resultado === "POSITIVO" && !r.dados?.tentativaId && !r.dados?.gestacaoId && <label>Justificativa do vínculo desconhecido<input className={classeInput} value={String(r.dados?.motivoVinculoDesconhecido ?? "")} onChange={e => atualizarDados(p, { motivoVinculoDesconhecido: e.target.value })} onBlur={() => void persistir(p)} /></label>}
                      {r.dados?.resultado === "NEGATIVO" && gestacoesDoAnimal(p).length > 0 && <div role="alert" className="rounded-lg border border-border p-3 space-y-3"><p>Há gestação conhecida na data. O resultado vazio não registra perda automaticamente; registre a perda ou corrija o diagnóstico antes de confirmar.</p>{painel && <AcoesReprodutivas painel={painel} animalId={p.animalId} propriedadeId={visita.propriedadeId} podeLancar={!bloqueado} onMudou={onMudou} />}</div>}
                      <label>Anotação original<input className={classeInput} value={String(r.dados?.anotacaoOriginal ?? "")} onChange={e => atualizarDados(p, { anotacaoOriginal: e.target.value })} onBlur={() => void persistir(p)} /></label>
                      {["ADIADO", "NAO_ATENDIDO"].includes(r.status ?? "") && input(p, "motivo", "Motivo do atendimento pendente")}
                    </fieldset>
                    <div className="grid gap-3"><label>Tipo de exame<select className={classeInput} aria-label={`Tipo de exame · ${p.snapshot.brinco ?? p.ordem}`} disabled={bloqueado} value={String(r.dados?.tipoExameId ?? p.snapshot.tarefaPlanejada?.tarefa.planejadoSnapshot?.etapa.planoAvaliacao?.tipoExameId ?? (preparar?.id === p.id ? tarefaPreparada?.planejadoSnapshot?.etapa.planoAvaliacao?.tipoExameId : ""))} onChange={e => { const tipo = tiposExame.find(t => t.id === e.target.value); atualizarDados(p, { tipoExameId: tipo?.id, formatoExameHash: tipo?.formatoExameHash, resultados: [] }); }}><option value="">Avaliação padrão da tarefa</option>{tiposExame.filter(t => t.ativo || t.id === r.dados?.tipoExameId).map(t => <option key={t.id} value={t.id}>{t.nome} · v{t.versaoFormato ?? 1}{t.ativo ? "" : " (inativo)"}</option>)}</select></label>
                      {!!r.dados?.tipoExameId && <CamposResultadoExame campos={(tiposExame.find(t => t.id === r.dados?.tipoExameId)?.campos ?? []).filter(c => !["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(c.codigo))} valores={(r.dados?.resultados as import("../sanidade/CamposExame").ObservacaoExame[]) ?? []} onChange={resultados => atualizarDados(p, { resultados })} />}
                    </div>
                  </>}
                  {atividade.tipo === "TAREFA_IATF" && r.status !== "ADIADO" && r.status !== "NAO_ATENDIDO" && <CampoDataIatf rotulo={`Data realizada · ${p.snapshot.brinco ?? p.ordem}`} valor={r.realizadaEm ?? ""} onChange={v => atualizar(p, "realizadaEm", v)} onBlur={() => void persistir(p)} disabled={bloqueado} />}
                  {atividade.tipo === "INICIAR_IATF" && <>
                    <CampoDataIatf rotulo={`Início efetivo · ${p.snapshot.brinco ?? p.ordem}`} valor={r.inicioEfetivo ?? ""} onChange={v => atualizar(p, "inicioEfetivo", v)} onBlur={() => void persistir(p)} disabled={bloqueado} />
                    <p className="text-sm">{atividade.contexto?.inicioIatf
                      ? `${atividade.contexto.inicioIatf.nomeProtocolo} · versão ${atividade.contexto.inicioIatf.versaoProtocolo}`
                      : sugestoes?.protocolosIatf.find(t => t.id === atividade.contexto?.protocoloId)?.nome ?? "Atividade antiga: selecione a participação para definir o protocolo."}</p>
                    {(() => {
                      const protocoloId = atividade.contexto?.inicioIatf?.protocoloId ?? atividade.contexto?.protocoloId;
                      const temProtocolo = typeof protocoloId === "string" && protocoloId.length > 0;
                      const compativeis = (sugestoes?.participantesIatf ?? []).filter(t => t.animalId === p.animalId && !t.inicioEfetivo
                        && (!temProtocolo || t.protocoloId === protocoloId) && (t.propriedadeId == null || t.propriedadeId === visita.propriedadeId));
                      const referenciaIndisponivel = !!r.participanteIatfId && !compativeis.some(t => t.id === r.participanteIatfId);
                      return <>
                        {referenciaIndisponivel ? <>
                          <p role="alert" className="text-xs">A participação salva no rascunho deixou de estar disponível. Resolva o vínculo antes de confirmar, escolhendo uma opção compatível.</p>
                          {!temProtocolo && compativeis.length === 0 && <p className="text-xs">Nenhuma participação pendente compatível está disponível. Este início antigo exige uma participação existente.</p>}
                          <label>Participação IATF<select aria-label={`Participação IATF · ${p.snapshot.brinco ?? p.ordem}`} className={classeInput} disabled={bloqueado} value={r.participanteIatfId ?? ""} onChange={e => { atualizar(p, "participanteIatfId", e.target.value); void persistir(p); }} onBlur={() => void persistir(p)}>
                            <option value={r.participanteIatfId} disabled>Participação anterior indisponível · selecione uma opção</option>
                            {temProtocolo && compativeis.length === 0 && <option value="">Criar nova participação</option>}
                            {temProtocolo && compativeis.length === 1 && <option value={compativeis[0].id}>Usar participação pendente compatível · {compativeis[0].programacaoNome ?? compativeis[0].protocoloNome ?? "programação existente"}</option>}
                            {(!temProtocolo || compativeis.length > 1) && <option value="">{temProtocolo ? "Limpar escolha anterior" : "Selecione uma participação"}</option>}
                            {(!temProtocolo || compativeis.length > 1) && compativeis.map(t => <option key={t.id} value={t.id}>{t.protocoloNome ?? "Protocolo"} · v{t.protocoloVersao ?? "?"} · {t.programacaoNome ?? "Programação"} · previsto {t.inicioPrevisto.slice(0, 10)}</option>)}
                          </select></label>
                        </> : <>
                          {temProtocolo && compativeis.length === 0 && <p className="text-xs">A participação e as tarefas serão criadas ao confirmar este início.</p>}
                          {compativeis.length === 1 && <p className="text-xs">Participação pendente: {compativeis[0].programacaoNome ?? compativeis[0].protocoloNome ?? "programação existente"} · previsto {compativeis[0].inicioPrevisto.slice(0, 10)}. Será reutilizada na confirmação.</p>}
                          {(compativeis.length > 1 || !temProtocolo) && select(p, "participanteIatfId", "Participação IATF", compativeis.map(t => [t.id, `${t.protocoloNome ?? "Protocolo"} · v${t.protocoloVersao ?? "?"} · ${t.programacaoNome ?? "Programação"} · previsto ${t.inicioPrevisto.slice(0, 10)}`]))}
                        </>}
                      </>;
                    })()}
                    <div><AlertasSanitarios animalId={p.animalId} data={visita.data.slice(0,10)} acao="IATF" propriedadeId={visita.propriedadeId} /><label className="flex gap-2 text-sm my-2"><input type="checkbox" aria-label={`Ciência sanitária · ${p.snapshot.brinco ?? p.ordem}`} checked={r.cienciaSanitaria === true} disabled={bloqueado} onChange={e => atualizar(p, "cienciaSanitaria", e.target.checked)} onBlur={() => void persistir(p)} />Revisei os alertas sanitários informados para este procedimento.</label></div>
                  </>}
                  {p.tarefaSanitariaId && preparar?.id !== p.id && campoDesvioSanitario(p)}
                  {atividade.tipo !== "INICIAR_IATF" && <div><Button secondary disabled={bloqueado} onClick={() => { setPreparar(p); setDetalhes(prev => [...new Set([...prev, p.id])]); }}>Preencher procedimento</Button>{r.dados && <p className="text-xs mt-2">Procedimento preparado no rascunho</p>}</div>}
                  <label>Anotação original{input(p, "anotacaoOriginal", "Anotação original")}</label>
                  <label>Motivo de perda, correção, descarte ou pendência{input(p, "motivo", "Motivo de perda, correção, descarte ou pendência")}</label>
                  {podeLancar && !p.fatoId && <Button secondary disabled={ocupado} onClick={() => setRevisao([p.id])}>Conferir animal</Button>}
                </div>
              </td></tr>}
            </Fragment>;
          })}</tbody>
        </table>
        {!itens.length && <p className="p-5 text-sm">Nenhum participante com estes filtros.</p>}
      </div>}
      {paginacaoAtendimento()}
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
            conteudoExtra={preparar.tarefaSanitariaId ? campoDesvioSanitario(preparar) : undefined}
            propriedadeId={visita.propriedadeId}
            momentoIatf={atividade.tipo === "TAREFA_IATF" ? rascunhos[preparar.id]?.realizadaEm || visita.data.slice(0,10) : undefined}
            dataInicial={atividade.tipo === "TAREFA_IATF" ? (rascunhos[preparar.id]?.realizadaEm || visita.data).slice(0,10) : visita.data.slice(0,10)}
            onFechar={() => setPreparar(null)}
            onSalvo={() => setPreparar(null)}
            onRegistrar={guardarProcedimento}
            inline
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
            inline
          />
        )}
      {preparar && !carregandoTarefa && parametrosDaTarefaCarregados &&
        atividade.tipo === "TAREFA_IATF" &&
        tarefaPreparada &&
        ["MANEJO", "RETIRADA"].includes(tarefaPreparada.tipo) && (
          <section className="grid gap-3 rounded-lg border border-border p-4">
            <h3 className="font-semibold">{tarefaPreparada.nome ?? "Registrar manejo"}</h3>
            <p className="text-sm">A descrição da execução e o motivo do desvio permanecem nas anotações da linha. A confirmação cria somente a execução desta tarefa.</p>
            <div><Button secondary onClick={() => setPreparar(null)}>Fechar</Button> <Button onClick={() => void guardarProcedimento({ observacao: rascunhos[preparar.id]?.anotacaoOriginal ?? "" }).then(() => setPreparar(null))}>Preparar manejo</Button></div>
          </section>
        )}
      {preparar && !carregandoTarefa && parametrosDaTarefaCarregados &&
        (["EXAME_SANITARIO", "INICIAR_SANITARIO"].includes(atividade.tipo) || (atividade.tipo === "TAREFA_IATF" && tarefaPreparada?.tipo === "EXAME")) && (
          <FormFatoSanitario
            conteudoExtra={preparar.tarefaSanitariaId ? campoDesvioSanitario(preparar) : undefined}
            dataInicial={visita.data.slice(0, 10)}
            tipo={atividade.tipo === "EXAME_SANITARIO" || tarefaPreparada?.tipo === "EXAME" ? "exame" : "protocolo"}
            animalInicial={preparar.animalId}
            propriedadeId={visita.propriedadeId}
            cadastroInicial={tarefaPreparada?.planejadoSnapshot?.etapa.planoExame?.tipoExameId ?? tarefaPreparada?.tipoExameId ?? String(atividade.contexto?.[atividade.tipo === "INICIAR_SANITARIO" ? "protocoloId" : "tipoExameId"] ?? "")}
            fixo
            onFechar={() => setPreparar(null)}
            onSalvo={() => setPreparar(null)}
            onRegistrar={guardarProcedimento}
            inline
          />
        )}
      <div className="visita-rodape"><div><strong>{confirmados} procedimentos confirmados</strong><small>{idsComResultado.length} resultado(s) em rascunho neste grupo · {selecionadosPendentes.length ? `${selecionadosPendentes.length} selecionados para conferência` : "nenhum procedimento é executado ao preencher"}</small></div><div className="visita-acoes">{onPlanejar && visita.status !== "ENCERRADA" && <button className="visita-botao" disabled={ocupado} onClick={onPlanejar}>Adicionar grupo</button>}<button className="visita-botao primario" aria-label={selecionadosPendentes.length ? `Revisar selecionados (${selecionadosPendentes.length})` : `Conferir resultados (${idsConferencia.length})`} disabled={!podeLancar || ocupado || !idsConferencia.length} onClick={()=>setRevisao(idsConferencia)}>Conferir {idsConferencia.length || ""} resultados</button></div></div>
    </section>
  );
}
