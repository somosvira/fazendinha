import { useEffect, useState } from "react";
import {
  Calendar, Eye, Check, Ban,
  ClipboardList,
  FlaskConical,
  Shield,
  Syringe,
} from "lucide-react";
import {
  Button,
  ErrorBox,
  hoje,
  PageHeader,
  PaginaFinanceira,
  Panel, TabelaFinanceira,
} from "../../../financeiro/financeiro-ui";
import {
  CampoFormulario,
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { getUsuario } from "../../../lib/auth";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { NavRebanho } from "../telas/NavRebanho";
import { Paginacao, SubAbas } from "../ui";
import { buscarFichaAnimal, listarAnimais, listarLotes } from "../api";
import type { AnimalResumo, Lote } from "../types";
import {
  reqSanidade,
  listarServicos,
  type ServicoSanitario,
  type AplicacaoSanitaria,
  type CarenciaAnimal,
} from "./api";
import { RateioServico } from "./RateioServico";
import { SanidadeAnimal } from "./SanidadeAnimal";
import type { Doenca, TipoExame } from "./CadastrosSanitarios";
import { ResultadoExame, type ExameResultado } from "./ResultadoExame";
import {
  FormAplicacaoServico,
  type TarefaAplicacao,
} from "./FormAplicacaoServico";

type Ocorrencia = {
  id: string;
  propriedadeId: number;
  animalId: string;
  inicio: string;
  fim: string | null;
  status: string;
  doenca: { nome: string };
  desfecho: string | null;
  _count: { aplicacoes: number; exames: number; execucoes: number };
};
type Exame = ExameResultado & {
  propriedadeId: number;
  animalId: string;
  data: string;
  status: string;
  tipoExame: { nome: string };
};
type Tarefa = {
  id: string;
  etapaId: string;
  propriedadeAtualId?: number | null;
  rodada?: { id: string; nome: string } | null;
  execucaoId: string;
  previstaPara: string;
  situacao: string;
  parametros: {
    tipo: string;
    tipoAplicacaoNomeSnapshot?: string;
    produtoId: string;
    tipoAplicacaoId: string;
    dose: string;
    unidade: string;
    tipoExameId: string;
  };
  execucao: {
    animalId: string;
    animal?: { id: string; brinco: string; nome: string | null };
    propriedadeId: number;
    protocolo: { nome: string; versao: number };
  };
};
type Protocolo = {
  id: string;
  nome: string;
  versao: number;
  ativo: boolean;
  publicadoEm: string | null;
};
type Aba = "agenda" | "ocorrencias" | "aplicacoes" | "exames" | "carencias";
type Painel =
  | { tipo: "ocorrencia" }
  | { tipo: "exame" }
  | { tipo: "protocolo" }
  | {
      tipo:
        | "encerrar"
        | "anular-ocorrencia"
        | "anular-aplicacao"
        | "dispensar"
        | "cancelar"
        | "adiar";
      id: string;
    };

const classeAcao = "inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border text-ink hover:bg-surface-2";
const ABAS: Aba[] = [
  "agenda",
  "ocorrencias",
  "aplicacoes",
  "exames",
  "carencias",
];
const estadoDaUrl = () => {
  const p = new URLSearchParams(window.location.search);
  const aba = p.get("aba") as Aba | null;
  return {
    aba: p.get("aplicacaoId")
      ? ("aplicacoes" as Aba)
      : aba && ABAS.includes(aba)
        ? aba
        : ("agenda" as Aba),
    aplicacaoId: p.get("aplicacaoId") ?? "",
    animalId: p.get("animalId") ?? "",
    buscaAnimal: p.get("buscaAnimal") ?? "",
    loteId: p.get("loteId") ?? "",
    de: p.get("de") ?? "",
    ate: p.get("ate") ?? "",
    situacao: p.get("situacao") ?? "",
    pagina: Math.max(1, Number(p.get("pagina")) || 1),
    detalheTipo: p.get("detalheTipo") ?? "",
    detalheId: p.get("detalheId") ?? "",
    detalhePropriedadeId: p.get("propriedadeId") ?? "",
  };
};

import { DetalheSanitario } from "./DetalheSanitario";
import { PainelDetalheSanitario } from "./PainelDetalheSanitario";
import { dataAplicacaoSanitaria, dataSanitaria, nomeAnimalSanitario, resultadoExameSanitario } from "./rotulos";
import { CarenciasSanitarias } from "./CarenciasSanitarias";
import { AgendaRodadas } from "./AgendaRodadas";
import { FormRodada } from "./FormRodada";
import { ExecutarEtapa } from "./ExecutarEtapa";
import type { TarefaRodada } from "./rodadas-api";
import type { PaginaSanitaria } from "./rodadas-api";
import { FormFatoSanitario, type TipoFatoSanitario } from "./FormFatoSanitario";

export function Sanidade({ podeLancar }: { podeLancar: boolean }) {
  const [rateando, setRateando] = useState(false);
  const [servicosGerenciamento, setServicosGerenciamento] = useState<ServicoSanitario[]>([]);
  const [erroServicos, setErroServicos] = useState<string | null>(null);
  const [carregandoServicos, setCarregandoServicos] = useState(false);
  const [repetirServicos, setRepetirServicos] = useState(0);
  const usuario = getUsuario();
  const podeGerenciarServicos = podeLancar && !!usuario && (usuario.dono || (usuario.areas.includes("financeiro") && usuario.areas.includes("pecuaria")));
  useEffect(() => {
    if (!rateando) return;
    let vivo = true; setCarregandoServicos(true); setErroServicos(null);
    listarServicos().then((lista) => { if (vivo) setServicosGerenciamento(lista); }).catch((e: unknown) => { if (vivo) setErroServicos(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregandoServicos(false); });
    return () => { vivo = false; };
  }, [rateando, repetirServicos]);
  const [aba, setAba] = useState<Aba>(() => estadoDaUrl().aba);
  const [visaoAgenda, setVisaoAgenda] = useState(() => new URLSearchParams(window.location.search).get("visaoAgenda") === "tarefas" ? "tarefas" : "rodadas");
  const [rodadaId, setRodadaId] = useState(() => new URLSearchParams(window.location.search).get("rodadaId") ?? "");
  const [executandoEtapa, setExecutandoEtapa] = useState<TarefaRodada[] | null>(null);
  const [aplicacaoId, setAplicacaoId] = useState(
    () => estadoDaUrl().aplicacaoId,
  );
  const [detalhe, setDetalhe] = useState<{ tipo: string; id: string } | null>(
    () => {
      const url = estadoDaUrl();
      return url.detalheTipo && url.detalheId
        ? { tipo: url.detalheTipo, id: url.detalheId }
        : url.aplicacaoId ? { tipo: "aplicacao", id: url.aplicacaoId } : null;
    },
  );
  const [detalheConteudo, setDetalheConteudo] = useState<unknown>(null);
  const [detalhePropriedadeId, setDetalhePropriedadeId] = useState(() => estadoDaUrl().detalhePropriedadeId);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [recarregarDetalhe, setRecarregarDetalhe] = useState(0);
  const [animais, setAnimais] = useState<AnimalResumo[]>([]);
  const [buscaAnimal, setBuscaAnimal] = useState(() => estadoDaUrl().buscaAnimal);
  const [carencias, setCarencias] = useState<
    (CarenciaAnimal & {
      animal: { id: string; brinco: string; nome: string | null };
    })[]
  >([]);
  const [animalId, setAnimalId] = useState(() => estadoDaUrl().animalId);
  const [loteId, setLoteId] = useState(() => estadoDaUrl().loteId);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [pagina, setPagina] = useState(() => estadoDaUrl().pagina);
  const [servicos, setServicos] = useState<ServicoSanitario[]>([]);
  const [servicoId, setServicoId] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [ocorrenciaId, setOcorrenciaId] = useState("");
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [aplicacoes, setAplicacoes] = useState<AplicacaoSanitaria[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [exames, setExames] = useState<Exame[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [totalTarefas, setTotalTarefas] = useState(0);
  const [doencas, setDoencas] = useState<Doenca[]>([]);
  const [tiposExame, setTiposExame] = useState<TipoExame[]>([]);
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [revisao, setRevisao] = useState(0);
  const [aplicacaoSalvaId, setAplicacaoSalvaId] = useState<string | null>(null);
  const [aplicacaoSalvaPropriedadeId, setAplicacaoSalvaPropriedadeId] = useState<number | undefined>();
  function atualizarAplicacao(id?: string, propriedadeIdFato?: number) {
    if (id) { setAplicacaoSalvaId(id); setAplicacaoSalvaPropriedadeId(propriedadeIdFato); }
    setRevisao((v) => v + 1);
  }
  const [painel, setPainel] = useState<Painel | null>(null);
  const [novoFato, setNovoFato] = useState<TipoFatoSanitario | null>(null);
  const [animalDaAcao, setAnimalDaAcao] = useState<{ animalId: string; propriedadeId: number } | null>(null);
  const [tarefaAplicacao, setTarefaAplicacao] =
    useState<TarefaAplicacao | null>(null);
  const [tarefaExameId, setTarefaExameId] = useState<string | null>(null);
  const [cadastroId, setCadastroId] = useState("");
  const [data, setData] = useState(hoje());
  const [texto, setTexto] = useState("");
  const [dataAdiamento, setDataAdiamento] = useState("");
  const [confirmarSobreposicao, setConfirmarSobreposicao] = useState(false);
  const [exigeSobreposicao, setExigeSobreposicao] = useState(false);
  const [resultado, setResultado] = useState("");
  const [de, setDe] = useState(() => estadoDaUrl().de);
  const [ate, setAte] = useState(() => estadoDaUrl().ate);
  const [situacao, setSituacao] = useState(() => estadoDaUrl().situacao);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoAba, setCarregandoAba] = useState(false);
  const [erroAba, setErroAba] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const animal = animais.find((a) => a.id === animalId);
  useEffect(() => {
    setConfirmarSobreposicao(false);
    setExigeSobreposicao(false);
  }, [cadastroId, data, animalId]);
  useEffect(() => {
    const restaurar = () => {
      const url = estadoDaUrl();
      setAba(url.aba); setAnimalId(url.animalId); setLoteId(url.loteId); setBuscaAnimal(url.buscaAnimal);
      setVisaoAgenda(new URLSearchParams(window.location.search).get("visaoAgenda") === "tarefas" ? "tarefas" : "rodadas");
      setRodadaId(new URLSearchParams(window.location.search).get("rodadaId") ?? "");
      setDe(url.de); setAte(url.ate); setSituacao(url.situacao); setPagina(url.pagina);
      setAplicacaoId(url.aplicacaoId); setDetalhePropriedadeId(url.detalhePropriedadeId);
      setDetalhe(url.detalheTipo && url.detalheId ? { tipo: url.detalheTipo, id: url.detalheId } : url.aplicacaoId ? { tipo: "aplicacao", id: url.aplicacaoId } : null);
    };
    window.addEventListener("popstate", restaurar);
    return () => window.removeEventListener("popstate", restaurar);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams();
    if (aba === "agenda" && rodadaId) { const atual = new URLSearchParams(window.location.search); for (const chave of ["etapaId", "paginaEtapas", "paginaParticipantes", "paginaTarefas"]) { const v = atual.get(chave); if (v) params.set(chave, v); } }
    params.set("aba", aba);
    if (aba === "agenda") { params.set("visaoAgenda", visaoAgenda); if (rodadaId) params.set("rodadaId", rodadaId); }
    for (const [k, v] of Object.entries({
      animalId,
      buscaAnimal,
      loteId,
      de,
      ate,
      situacao,
      aplicacaoId,
    }))
      if (v) params.set(k, v);
    if (pagina > 1) params.set("pagina", String(pagina));
    if (detalhe) {
      params.set("detalheTipo", detalhe.tipo);
      params.set("detalheId", detalhe.id);
      if (detalhePropriedadeId) params.set("propriedadeId", detalhePropriedadeId);
    }
    const url = `${window.location.pathname}?${params}`;
    if (url !== `${window.location.pathname}${window.location.search}`)
      window.history.replaceState(null, "", url);
  }, [aba, animalId, buscaAnimal, loteId, de, ate, situacao, pagina, aplicacaoId, detalhe, detalhePropriedadeId, visaoAgenda, rodadaId]);
  useEffect(() => {
    if (!detalhe) {
      setDetalheConteudo(null);
      setErroDetalhe(null);
      return;
    }
    let vivo = true;
    const recursos: Record<string, string> = {
      ocorrencia: "ocorrencias",
      aplicacao: "aplicacoes",
      exame: "exames",
      execucao: "execucoes",
    };
    const recurso = recursos[detalhe.tipo];
    if (!recurso) {
      setErroDetalhe("Tipo de detalhe desconhecido.");
      return;
    }
    setErroDetalhe(null);
    setDetalheConteudo(null);
    reqSanidade<unknown>(`/${recurso}/${encodeURIComponent(detalhe.id)}${detalhePropriedadeId ? `?propriedadeId=${encodeURIComponent(detalhePropriedadeId)}` : ""}`)
      .then((v) => {
        if (vivo) setDetalheConteudo(v);
      })
      .catch((e: unknown) => {
        if (vivo) setErroDetalhe(e instanceof Error ? e.message : String(e));
      });
    return () => {
      vivo = false;
    };
  }, [detalhe, detalhePropriedadeId, recarregarDetalhe]);
  useEffect(() => {
    let vivo = true;
    Promise.allSettled([
      listarAnimais({ pageSize: 100, busca: buscaAnimal }),
      listarLotes(),
      animalId ? buscarFichaAnimal(animalId) : Promise.resolve(null),
    ])
      .then(([a, l, ficha]) => {
        if (!vivo) return;
        if (a.status === "fulfilled") {
          const itens = a.value.itens;
          if (
            ficha.status === "fulfilled" &&
            ficha.value &&
            !itens.some((i) => i.id === ficha.value!.id)
          )
            itens.push(ficha.value);
          setAnimais(itens);
        }
        if (l.status === "fulfilled") setLotes(l.value);
        else
          setErro(
            l.reason instanceof Error ? l.reason.message : String(l.reason),
          );
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : String(e));
      });
    return () => {
      vivo = false;
    };
  }, [animalId, buscaAnimal]);
  useEffect(() => {
    let vivo = true;
    setCarregandoAba(true);
    setErroAba(null);
    const params = new URLSearchParams({
      pagina: String(pagina),
      porPagina: "50",
    });
    if (animalId) params.set("animalId", animalId);
    if (buscaAnimal.trim()) params.set("buscaAnimal", buscaAnimal.trim());
    if (loteId) params.set("loteId", loteId);
    if (de) params.set("de", de);
    if (ate) params.set("ate", ate);
    if (situacao) {
      const situacaoApi = ["CARÊNCIA_VIGENTE", "CARÊNCIA_DESCONHECIDA"].includes(situacao)
          ? ""
          : situacao;
      if (situacaoApi) params.set("situacao", situacaoApi);
    }
    const q = "?" + params.toString();
    const requisicoes: Record<Aba, () => Promise<unknown>> = {
      agenda: () => reqSanidade<PaginaSanitaria<Tarefa>>(`/tarefas${q}&paginado=true`),
      ocorrencias: () => reqSanidade<Ocorrencia[]>(`/ocorrencias${q}`),
      aplicacoes: () => reqSanidade<AplicacaoSanitaria[]>(`/aplicacoes${q}`),
      exames: () => reqSanidade<Exame[]>(`/exames${q}`),
      carencias: () => reqSanidade<
        (CarenciaAnimal & {
          animal: { id: string; brinco: string; nome: string | null };
        })[]
      >(`/carencias${q}`),
    };
    const extras = Promise.allSettled([
      reqSanidade<Doenca[]>("/doencas"),
      reqSanidade<TipoExame[]>("/tipos-exame"),
      reqSanidade<Protocolo[]>("/protocolos"),
    ]).then(([d, te, p]) => {
      if (!vivo) return;
      if (d.status === "fulfilled") setDoencas(d.value);
      if (te.status === "fulfilled") setTiposExame(te.value);
      if (p.status === "fulfilled") setProtocolos(p.value);
    });
    requisicoes[aba]().then(async (value) => {
      if (!vivo) return;
      if (aba === "agenda") { const p = value as PaginaSanitaria<Tarefa>; setTarefas(p.itens ?? []); setTotalTarefas(p.total ?? 0); }
      if (aba === "ocorrencias") setOcorrencias(value as Ocorrencia[]);
      if (aba === "aplicacoes") {
        const lista = value as AplicacaoSanitaria[];
        setAplicacoes(lista);
        const ids = [
          ...new Set(
            lista
              .filter((i) => !i.animal)
              .map((i) => i.animalId)
              .filter(
                (id): id is string => !!id && !animais.some((a) => a.id === id),
              ),
          ),
        ];
        const fichas = await Promise.allSettled(
          ids.map((id) => buscarFichaAnimal(id)),
        );
        if (vivo)
          setAnimais((atual) => [
            ...atual,
            ...fichas.flatMap((f) =>
              f.status === "fulfilled" ? [f.value] : [],
            ),
          ]);
      }
      if (aba === "exames") setExames(value as Exame[]);
      if (aba === "carencias")
        setCarencias(
          value as (CarenciaAnimal & {
            animal: { id: string; brinco: string; nome: string | null };
          })[],
        );
    })
      .catch((e: unknown) => {
        if (vivo) setErroAba(`${aplicacaoSalvaId ? "Aplicação salva. Não conseguimos atualizar a consulta. Tente novamente. " : ""}${e instanceof Error ? e.message : String(e)}`);
      })
      .finally(() => {
        if (vivo) setCarregandoAba(false);
      });
    void extras;
    return () => {
      vivo = false;
    };
  }, [aba, animalId, buscaAnimal, loteId, de, ate, situacao, pagina, revisao]);
  useEffect(() => {
    setServicos([]);
    setServicoId("");
    if (animal?.propriedade)
      listarServicos(animal.propriedade.id)
        .then(setServicos)
        .catch((e: unknown) =>
          setErro(e instanceof Error ? e.message : String(e)),
        );
  }, [animal?.propriedade?.id]);
  function abrir(p: Painel) {
    if (p.tipo === "ocorrencia" || p.tipo === "exame" || p.tipo === "protocolo") { setNovoFato(p.tipo); setCadastroId(""); setTarefaExameId(null); setAnimalDaAcao(null); return; }
    setPainel(p);
    setCadastroId("");
    setTexto("");
    setResultado("");
    setData(hoje());
    setDataAdiamento("");
    setConfirmarSobreposicao(false);
    setExigeSobreposicao(false);
    setTarefaExameId(null);
    setServicoId("");
    setResponsavel("");
    setOcorrenciaId("");
    setChave(crypto.randomUUID());
  }
  const nomeAnimal = (id: string) => {
    const a = animais.find((v) => v.id === id);
    return a
      ? `${a.brinco}${a.nome ? ` · ${a.nome}` : ""}`
      : "Animal não identificado";
  };
  const aplicacaoSelecionada = aplicacoes.find((a) => a.id === aplicacaoId);
  const linkFato = (id: string, fatoId?: string) =>
    `/pecuaria/rebanho/sanidade?aba=${aba}&animalId=${encodeURIComponent(id)}${fatoId ? `&aplicacaoId=${encodeURIComponent(fatoId)}` : ""}`;
  const abrirDetalhe = (tipo: string, id: string, propriedadeId?: number | null) => {
    const params = new URLSearchParams(window.location.search);
    params.set("detalheTipo", tipo); params.set("detalheId", id);
    if (propriedadeId != null) { params.set("propriedadeId", String(propriedadeId)); setDetalhePropriedadeId(String(propriedadeId)); }
    if (!detalhe) window.history.pushState(null, "", `${window.location.pathname}?${params}`);
    setDetalhe({ tipo, id });
  };
  function fecharDetalhe() { setDetalhe(null); setAplicacaoId(""); }
  const situacaoCorresponde = (
    s: string,
    fim?: string | null,
    resultado?: unknown,
  ) => {
    if (!situacao) return true;
    if (situacao === "ABERTA") return !fim;
    if (situacao === "ENCERRADA") return !!fim;
    if (situacao === "AGUARDANDO_RESULTADO")
      return resultado == null || resultado === "";
    if (situacao === "RESULTADO_INFORMADO") return resultado != null && resultado !== "";
    if (situacao === "ORIGEM_PENDENTE") return true;
    if (situacao === "ATRASADA") return s === "PENDENTE";
    if (situacao === "CARÊNCIA_VIGENTE" || situacao === "CARÊNCIA_DESCONHECIDA")
      return true;
    return s === situacao;
  };
  const noPeriodo = (
    d: string,
    s: string,
    fim?: string | null,
    resultado?: unknown,
  ) =>
    (!de || d.slice(0, 10) >= de) &&
    (!ate || d.slice(0, 10) <= ate) &&
    situacaoCorresponde(s, fim, resultado);
  async function salvar() {
    if (!painel || ocupado) return;
    const propriedadeId = animalDaAcao?.propriedadeId ?? animal?.propriedade?.id;
    if (!propriedadeId) {
      setErro("Selecione um animal neste sítio antes de registrar uma ação.");
      return;
    }
    setOcupado(true);
    setErro(null);
    let path: string;
    let body: object;
    if (painel.tipo === "ocorrencia") {
      path = "/ocorrencias";
      body = {
        animalId,
        propriedadeId,
        doencaId: cadastroId,
        inicio: data,
        observacao: texto || null,
      };
    } else if (painel.tipo === "exame") {
      const tipo = tiposExame.find((t) => t.id === cadastroId);
      path = "/exames";
      body = {
        animalId,
        propriedadeId,
        tipoExameId: cadastroId,
        data,
        tarefaId: tarefaExameId,
        operacaoServicoId: servicoId || null,
        responsavel: responsavel || null,
        ocorrenciaId: ocorrenciaId || null,
        ...(resultado === ""
          ? {}
          : tipo?.tipoResultado === "NUMERO"
            ? { resultadoNumero: Number(resultado) }
            : tipo?.tipoResultado === "OPCAO"
              ? { resultadoOpcao: resultado }
              : { resultadoTexto: resultado }),
      };
    } else if (painel.tipo === "protocolo") {
      path = "/execucoes";
      body = {
        animalId,
        propriedadeId,
        protocoloId: cadastroId,
        inicio: data,
        ocorrenciaId: ocorrenciaId || null,
        operacaoServicoId: servicoId || null,
        ...(confirmarSobreposicao
          ? { confirmarSobreposicao: true, justificativaSobreposicao: texto }
          : {}),
      };
    } else if (painel.tipo === "adiar") {
      path = `/tarefas/${painel.id}/adiamento`;
      body = { propriedadeId, previstaPara: dataAdiamento, motivo: texto };
    } else if (painel.tipo === "encerrar") {
      path = `/ocorrencias/${painel.id}/encerramento`;
      body = { propriedadeId, fim: data, desfecho: texto };
    } else {
      path =
        painel.tipo === "anular-ocorrencia"
          ? `/ocorrencias/${painel.id}/anulacao`
          : painel.tipo === "anular-aplicacao"
            ? `/aplicacoes/${painel.id}/anulacao`
            : painel.tipo === "cancelar"
              ? `/execucoes/${painel.id}/cancelamento`
              : `/tarefas/${painel.id}/dispensa`;
      body =
        painel.tipo === "dispensar"
          ? { propriedadeId, motivo: texto }
          : { propriedadeId, motivo: texto };
    }
    try {
      await reqSanidade(
        painel.tipo === "exame"
          ? "/exames/coletivos"
          : painel.tipo === "protocolo"
            ? "/execucoes/coletivas"
            : path,
        {
          method: "POST",
          body: JSON.stringify(
            painel.tipo === "exame" || painel.tipo === "protocolo"
              ? { chave, propriedadeId, itens: [body] }
              : body,
          ),
        },
      );
      setPainel(null);
      setRevisao((v) => v + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        painel.tipo === "protocolo" &&
        /protocolo pendente|sobreposição/i.test(msg)
      ) {
        setExigeSobreposicao(true);
        setErro(
          "Já existe uma execução deste protocolo com tarefas pendentes. Confirme a sobreposição e informe o motivo para prosseguir.",
        );
      } else setErro(msg);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <PaginaFinanceira>
      {executandoEtapa && <ExecutarEtapa tarefas={executandoEtapa} onFechar={() => setExecutandoEtapa(null)} onSalvo={() => { setExecutandoEtapa(null); setRevisao((v) => v + 1); }} />}
      {rateando && !carregandoServicos && !erroServicos && (
        <RateioServico
          propriedadeId={getPropriedadeAtiva()}
          servicos={servicosGerenciamento}
          onFechar={() => setRateando(false)}
          onSalvo={() => setRevisao((v) => v + 1)}
        />
      )}
      {rateando && (carregandoServicos || erroServicos) && <PainelCadastro aberto titulo="Gerenciar procedimentos" onFechar={() => setRateando(false)} rodape={<Button secondary onClick={() => setRateando(false)}>Fechar</Button>}>{carregandoServicos ? <p role="status">Carregando atendimentos…</p> : <><ErrorBox erro={erroServicos} /><Button secondary onClick={() => setRepetirServicos((v) => v + 1)}>Tentar novamente</Button></>}</PainelCadastro>}
      {tarefaAplicacao && animalDaAcao && (
        <FormAplicacaoServico
          animalId={animalDaAcao.animalId}
          propriedadeId={animalDaAcao.propriedadeId}
          tarefa={tarefaAplicacao}
          onFechar={() => setTarefaAplicacao(null)}
          onSalvo={(id, propriedadeIdFato) => {
            setTarefaAplicacao(null);
            atualizarAplicacao(id, propriedadeIdFato);
          }}
        />
      )}
      <PageHeader
        eyebrow="Pecuária"
        titulo="Sanidade"
        descricao="Agenda, ocorrências, aplicações, exames e carências dos animais."
        acao={podeGerenciarServicos ? <Button secondary onClick={() => setRateando(true)}>Gerenciar procedimentos</Button> : undefined}
      />
      <NavRebanho ativa="sanidade" />
      <ErrorBox erro={erro} />
      {aplicacaoSalvaId && <p role="status" className="mt-3">Aplicação salva. A lista segue os filtros atuais. <button type="button" className="underline" onClick={() => abrirDetalhe("aplicacao", aplicacaoSalvaId, aplicacaoSalvaPropriedadeId)}>Ver aplicação salva</button></p>}
      {erro && (
        <Button secondary onClick={() => setRevisao((v) => v + 1)}>
          Tentar novamente
        </Button>
      )}
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <label className="text-sm">
          Buscar animal
          <input
            className={classeInput}
            value={buscaAnimal}
            onChange={(e) => {
              setBuscaAnimal(e.target.value);
              setPagina(1);
            }}
            placeholder="Brinco ou nome"
          />
        </label>
        <label className="text-sm">
          Animal
          <select
            className={classeInput}
            value={animalId}
            onChange={(e) => {
              setAnimalId(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos os animais</option>
            {animais.map((a) => (
              <option key={a.id} value={a.id}>
                {a.brinco} · {a.nome ?? ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Lote
          <select
            className={classeInput}
            value={loteId}
            onChange={(e) => {
              setLoteId(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos os lotes</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          De
          <DatePicker
            value={de}
            onChange={(v) => {
              setDe(v);
              setPagina(1);
            }}
          />
        </label>
        <label className="text-sm">
          Até
          <DatePicker
            value={ate}
            onChange={(v) => {
              setAte(v);
              setPagina(1);
            }}
          />
        </label>
        <label className="text-sm">
          Situação
          <select
            className={classeInput}
            value={situacao}
            onChange={(e) => {
              setSituacao(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todas</option>
            {(aba === "agenda"
              ? [
                  ["PENDENTE", "Pendente"],
                  ["ATRASADA", "Atrasada"],
                  ["REALIZADA", "Realizada"],
                  ["DISPENSADA", "Dispensada"],
                  ["EXECUCAO_CANCELADA", "Execução cancelada"],
                ]
              : aba === "ocorrencias"
                ? [
                    ["ABERTA", "Aberta"],
                    ["ENCERRADA", "Encerrada"],
                    ["ANULADO", "Anulada"],
                  ]
                : aba === "exames"
                  ? [
                      ["AGUARDANDO_RESULTADO", "Aguardando resultado"],
                      ["RESULTADO_INFORMADO", "Resultado informado"],
                      ["ANULADO", "Anulado"],
                    ]
                  : aba === "carencias"
                    ? [
                        ["CARÊNCIA_VIGENTE", "Carência vigente"],
                        ["CARÊNCIA_DESCONHECIDA", "Prazo não informado"],
                      ]
                    : [
                        ["VALIDO", "Válida"],
                        ["ORIGEM_PENDENTE", "Origem pendente"],
                        ["ANULADO", "Anulada"],
                      ]
            ).map(([s, rotulo]) => (
              <option key={s} value={s}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>
      <SubAbas
        ativa={aba}
        onSelecionar={(v) => {
          setAba(v);
          setPagina(1);
          setSituacao("");
          if (v !== "aplicacoes") setAplicacaoId("");
        }}
        abas={[
          { valor: "agenda", rotulo: "Agenda", icon: Calendar },
          { valor: "ocorrencias", rotulo: "Ocorrências", icon: ClipboardList },
          { valor: "aplicacoes", rotulo: "Aplicações", icon: Syringe },
          { valor: "exames", rotulo: "Exames", icon: FlaskConical },
          { valor: "carencias", rotulo: "Carências", icon: Shield },
        ]}
      />
      {erroAba && (
        <div className="mt-4">
          <ErrorBox erro={erroAba} />
          <Button secondary onClick={() => setRevisao((v) => v + 1)}>
            Tentar carregar esta aba novamente
          </Button>
        </div>
      )}
      {carregandoAba ? (
        <p className="mt-5">
          Carregando{" "}
          {aba === "ocorrencias"
            ? "ocorrências"
            : aba === "aplicacoes"
              ? "aplicações"
              : aba === "carencias"
                ? "carências"
                : aba === "exames"
                  ? "exames"
                  : "agenda"}
          …
        </p>
      ) : (
        <Panel className="mt-5 space-y-3 p-5">
          {aba === "agenda" && (
            <>
              <SubAbas ativa={visaoAgenda} onSelecionar={(v) => { setVisaoAgenda(v); setPagina(1); }} abas={[{ valor: "rodadas", rotulo: "Ciclos", icon: Calendar }, { valor: "tarefas", rotulo: "Tarefas", icon: ClipboardList }]} />
              {visaoAgenda === "rodadas" ? <AgendaRodadas filtros={{ animalId, buscaAnimal, loteId, de, ate, situacao, pagina, porPagina: 20 }} podeLancar={podeLancar} recarregarToken={revisao} onAcao={(acao, t) => { if (acao === "consultar") { abrirDetalhe("execucao", t.execucaoId, t.execucao.propriedadeId); return; } setAnimalDaAcao({ animalId: t.execucao.animalId, propriedadeId: t.propriedadeAtualId ?? t.execucao.propriedadeId }); abrir({ tipo: acao, id: acao === "cancelar" ? t.execucaoId : t.id }); }} rodadaId={rodadaId} onAbrir={setRodadaId} onExecutar={setExecutandoEtapa} /> : <>
              {podeLancar && (
                <Button onClick={() => abrir({ tipo: "protocolo" })}>
                  Iniciar protocolo
                </Button>
              )}
              {tarefas
                .filter((t) => noPeriodo(t.previstaPara, t.situacao))
                .map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <strong>
                      {t.execucao.protocolo.nome} · v
                      {t.execucao.protocolo.versao}
                    </strong>
                    <p className="text-sm text-ink-3">{t.rodada?.nome ?? "Sem ciclo"}</p>
                    <p className="text-sm">
                      {t.execucao.animal ? nomeAnimalSanitario(t.execucao.animal) : nomeAnimal(t.execucao.animalId)} ·{" "}
                      {dataSanitaria(t.previstaPara)} ·{" "}
                      {t.parametros.tipoAplicacaoNomeSnapshot ??
                        (t.parametros.tipo === "APLICACAO" ? "Aplicação" : "Exame")}{" "}
                      ·{" "}
                      {t.situacao === "PENDENTE"
                        ? "Pendente"
                        : t.situacao === "REALIZADA"
                          ? "Realizada"
                          : t.situacao === "DISPENSADA"
                            ? "Dispensada"
                            : "Execução cancelada"}
                    </p>
                    {podeLancar &&
                      t.situacao === "PENDENTE" && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            secondary
                            onClick={() => {
                              setAnimalDaAcao({ animalId: t.execucao.animalId, propriedadeId: t.propriedadeAtualId ?? t.execucao.propriedadeId });
                              setExecutandoEtapa([{ ...t, parametros: { ...t.parametros, tipo: t.parametros.tipo === "APLICACAO" ? "APLICACAO" : "EXAME" } }]);
                            }}
                          >
                            Executar tarefa
                          </Button>
                          <Button
                            secondary
                            onClick={() => { setAnimalDaAcao({ animalId: t.execucao.animalId, propriedadeId: t.propriedadeAtualId ?? t.execucao.propriedadeId }); abrir({ tipo: "dispensar", id: t.id }); }}
                          >
                            Dispensar com motivo
                          </Button>
                          <Button
                            secondary
                            onClick={() => { setAnimalDaAcao({ animalId: t.execucao.animalId, propriedadeId: t.propriedadeAtualId ?? t.execucao.propriedadeId }); abrir({ tipo: "cancelar", id: t.execucaoId }); }}
                          >
                            Cancelar execução
                          </Button>
                          <Button
                            secondary
                            onClick={() => { setAnimalDaAcao({ animalId: t.execucao.animalId, propriedadeId: t.propriedadeAtualId ?? t.execucao.propriedadeId }); abrir({ tipo: "adiar", id: t.id }); }}
                          >
                            Adiar tarefa
                          </Button>
                        </div>
                      )}
                  </div>
                ))}
              {!tarefas.length && (
                <p>
                  Nenhuma tarefa planejada. Cadastre e publique um protocolo
                  antes de iniciar uma execução.
                </p>
              )}
              {totalTarefas > 0 && <Paginacao paginaAtual={pagina} totalPaginas={Math.max(1, Math.ceil(totalTarefas / 50))} totalItens={totalTarefas} itensPorPagina={50} onPaginaChange={setPagina} rotulo="tarefas" idSelect="agenda-pagina-tarefas" />}
              <p className="text-sm text-ink-3">
                Planejamento não consome estoque. Aplicações e exames são fatos
                independentes.
              </p>
              </>}
            </>
          )}
          {aba === "ocorrencias" && (
            <>
              {podeLancar && (
                <Button onClick={() => abrir({ tipo: "ocorrencia" })}>
                  Nova ocorrência
                </Button>
              )}
              <TabelaFinanceira rotulo="Ocorrências sanitárias" itens={ocorrencias.filter((o) => noPeriodo(o.inicio, o.status, o.fim))} chaveDe={(o) => o.id} barraRolagemSuperior onAbrir={(o) => abrirDetalhe("ocorrencia", o.id, o.propriedadeId)} colunas={[
                { chave: "animal", titulo: "Animal", principal: true, celula: (o) => <a className="underline" href={`/pecuaria/rebanho/animais/${encodeURIComponent(o.animalId)}`} onClick={(e) => e.stopPropagation()}>{nomeAnimal(o.animalId)}</a> },
                { chave: "doenca", titulo: "Doença", celula: (o) => o.doenca.nome },
                { chave: "inicio", titulo: "Início", celula: (o) => dataSanitaria(o.inicio) },
                { chave: "fim", titulo: "Fim", celula: (o) => o.fim ? dataSanitaria(o.fim) : "—" },
                { chave: "situacao", titulo: "Situação", celula: (o) => <>{o.fim ? "Encerrada" : "Aberta"}{o.status === "ANULADO" && <span className="ml-2 rounded bg-surface px-2 py-1">Anulada</span>}</> },
                { chave: "acoes", titulo: "Ações", acoes: true, celula: (o) => <div className="flex gap-2" onClick={(e) => e.stopPropagation()}><button type="button" className={classeAcao} aria-label="Ver detalhes da ocorrência" title="Ver detalhes" onClick={() => abrirDetalhe("ocorrencia", o.id, o.propriedadeId)}><Eye size={16} /></button>{podeLancar && o.status === "VALIDO" && <>{!o.fim && <button type="button" className={classeAcao} aria-label="Encerrar ocorrência" title="Encerrar" onClick={() => { setAnimalDaAcao({ animalId: o.animalId, propriedadeId: o.propriedadeId }); abrir({ tipo: "encerrar", id: o.id }); }}><Check size={16} /></button>}<button type="button" className={classeAcao} aria-label="Anular ocorrência" title="Anular" onClick={() => { setAnimalDaAcao({ animalId: o.animalId, propriedadeId: o.propriedadeId }); abrir({ tipo: "anular-ocorrencia", id: o.id }); }}><Ban size={16} /></button></>}</div> },
              ]} />
              {!ocorrencias.length && (
                <p>Nenhuma ocorrência encontrada para os filtros atuais.</p>
              )}
            </>
          )}
          {aba === "aplicacoes" && aplicacaoId && (
            <div
              className={`rounded-lg border p-4 ${aplicacaoSelecionada ? "border-pos bg-green-50 ring-2 ring-pos" : "border-border"}`}
            >
              <strong>
                {aplicacaoSelecionada
                  ? "Aplicação selecionada"
                  : "Aplicação vinculada"}
              </strong>
              {aplicacaoSelecionada ? (
                <p>
                  {aplicacaoSelecionada.tipoAplicacaoNomeSnapshot ??
                    aplicacaoSelecionada.finalidade ??
                    "Aplicação"}{" "}
                  · {aplicacaoSelecionada.nomeProdutoAplicado} ·{" "}
                  {aplicacaoSelecionada.dose} {aplicacaoSelecionada.unidadeDose}{" "}
                  · {dataAplicacaoSanitaria(aplicacaoSelecionada)}
                </p>
              ) : (
                <p>
                  Não encontramos esta aplicação no resultado carregado. Confira
                  o animal e os filtros de data.
                </p>
              )}
            </div>
          )}
          {aba === "carencias" && animal && <SanidadeAnimal animalId={animalId} propriedadeId={animal.propriedade?.id ?? null} podeLancar={podeLancar} recarregarToken={revisao} onMudou={atualizarAplicacao} />}
          {aba === "carencias" && !animal && (
            <>
              {carencias
                .filter(
                  (c) =>
                    !situacao ||
                    (situacao === "CARÊNCIA_VIGENTE"
                      ? [c.leite, c.carne].some((p) => p.estado === "CONHECIDO" && new Date(p.ate).getTime() > Date.now())
                      : [c.leite, c.carne].some(
                          (p) => p.estado === "NAO_INFORMADO",
                        )),
                )
                .map((c) => (
                  <div
                    key={c.animal.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <a
                      className="underline"
                      href={`/pecuaria/rebanho/sanidade?aba=carencias&animalId=${c.animal.id}`}
                    >
                      {nomeAnimalSanitario(c.animal)}
                    </a>
                    <CarenciasSanitarias carencia={c} />
                  </div>
                ))}
              {!carencias.length && (
                <p>Nenhuma carência encontrada para os filtros atuais.</p>
              )}
            </>
          )}
          {aba === "aplicacoes" && <SanidadeAnimal geral animalId={animalId} propriedadeId={animal?.propriedade?.id ?? null} podeLancar={podeLancar} recarregarToken={revisao} lista={aplicacoes.map((a) => ({ ...a, animal: a.animal ?? animais.find((v) => v.id === a.animalId) }))} abrirDetalhe={abrirDetalhe} onMudou={atualizarAplicacao} />}
          {aba === "exames" && (
            <>
              {podeLancar && (
                <Button onClick={() => abrir({ tipo: "exame" })}>
                  Registrar coleta / exame
                </Button>
              )}
              <TabelaFinanceira rotulo="Exames sanitários" itens={exames.filter((e) => noPeriodo(e.data, e.status, null, e.resultadoTexto ?? e.resultadoNumero ?? e.resultadoOpcao))} chaveDe={(e) => e.id} barraRolagemSuperior onAbrir={(e) => abrirDetalhe("exame", e.id, e.propriedadeId)} colunas={[
                { chave: "animal", titulo: "Animal", principal: true, celula: (e) => <a className="underline" href={`/pecuaria/rebanho/animais/${encodeURIComponent(e.animalId)}`} onClick={(v) => v.stopPropagation()}>{nomeAnimal(e.animalId)}</a> },
                { chave: "tipo", titulo: "Tipo de exame", celula: (e) => e.tipoExame.nome },
                { chave: "data", titulo: "Data", celula: (e) => dataSanitaria(e.data) },
                { chave: "resultado", titulo: "Resultado", celula: resultadoExameSanitario },
                { chave: "situacao", titulo: "Situação", celula: (e) => <>{resultadoExameSanitario(e) === "Aguardando resultado" ? "Aguardando resultado" : "Resultado informado"}{e.status === "ANULADO" && <span className="ml-2 rounded bg-surface px-2 py-1">Anulado</span>}</> },
                { chave: "acoes", titulo: "Ações", acoes: true, celula: (e) => <div className="flex gap-2" onClick={(v) => v.stopPropagation()}><button type="button" className={classeAcao} aria-label="Ver detalhes do exame" title="Ver detalhes" onClick={() => abrirDetalhe("exame", e.id, e.propriedadeId)}><Eye size={16} /></button>{podeLancar && e.status === "VALIDO" && <ResultadoExame exame={e} propriedadeId={e.propriedadeId} onSalvo={() => { setRevisao((v) => v + 1); setRecarregarDetalhe((v) => v + 1); }} />}</div> },
              ]} />
              {!exames.length && (
                <p>Nenhum exame encontrado para os filtros atuais.</p>
              )}
            </>
          )}
          {aba !== "agenda" &&
            <div className="flex items-center gap-3">
              <Button
                secondary
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </Button>
              <span>Página {pagina}</span>
              <Button
                secondary
                disabled={
                  (aba === "ocorrencias"


                      ? ocorrencias.length
                      : aba === "exames"
                        ? exames.length
                        : aba === "carencias"
                          ? carencias.length
                          : aplicacoes.length) < 50
                }
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          }
        </Panel>
      )}
      {detalhe && (
        <PainelDetalheSanitario onFechar={fecharDetalhe}>
          {erroDetalhe ? (
            <><ErrorBox erro={erroDetalhe} /><Button secondary onClick={() => setRecarregarDetalhe((v) => v + 1)}>Tentar novamente</Button></>
          ) : detalheConteudo == null ? (
            <p>Carregando detalhe…</p>
          ) : (
            <DetalheSanitario tipo={detalhe.tipo} valor={detalheConteudo} abrir={abrirDetalhe} />
          )}
        </PainelDetalheSanitario>
      )}
      {painel && (
        <PainelCadastro
          aberto
          titulo={
            painel.tipo === "ocorrencia"
              ? "Nova ocorrência"
              : painel.tipo === "exame"
                ? "Registrar coleta / exame"
                : painel.tipo === "protocolo"
                  ? "Iniciar protocolo publicado"
                  : "Confirmar ação sanitária"
          }
          onFechar={() => {
            if (!ocupado) setPainel(null);
          }}
          rodape={
            <>
              <Button
                secondary
                disabled={ocupado}
                onClick={() => setPainel(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" form="acao-sanitaria" disabled={ocupado}>
                Confirmar
              </Button>
            </>
          }
        >
          <form
            id="acao-sanitaria"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void salvar();
            }}
          >
            <ErrorBox erro={erro} />
            <p>{animalDaAcao ? nomeAnimal(animalDaAcao.animalId) : animal ? nomeAnimal(animal.id) : "Selecione um animal"}</p>
            {(painel.tipo === "ocorrencia" ||
              painel.tipo === "exame" ||
              painel.tipo === "protocolo") && (
              <CampoFormulario
                id="san-cadastro"
                rotulo={
                  painel.tipo === "ocorrencia"
                    ? "Doença"
                    : painel.tipo === "exame"
                      ? "Tipo de exame"
                      : "Versão publicada"
                }
                obrigatorio
              >
                {(p) => (
                  <select
                    {...p}
                    required
                    value={cadastroId}
                    onChange={(e) => setCadastroId(e.target.value)}
                    className={classeInput}
                  >
                    <option value="">Selecione</option>
                    {(painel.tipo === "ocorrencia"
                      ? doencas
                      : painel.tipo === "exame"
                        ? tiposExame
                        : protocolos.filter((v) => v.publicadoEm && v.ativo)
                    ).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nome}
                      </option>
                    ))}
                  </select>
                )}
              </CampoFormulario>
            )}
            {["ocorrencia", "exame", "protocolo", "encerrar"].includes(
              painel.tipo,
            ) && (
              <CampoFormulario id="san-fato-data" rotulo="Data" obrigatorio>
                {(p) => (
                  <DatePicker {...p} required value={data} onChange={setData} />
                )}
              </CampoFormulario>
            )}
            {(painel.tipo === "exame" || painel.tipo === "protocolo") && (
              <CampoFormulario
                id="san-servico-vinculo"
                rotulo="Serviço associado (opcional)"
              >
                {(p) => (
                  <select
                    {...p}
                    className={classeInput}
                    value={servicoId}
                    onChange={(e) => setServicoId(e.target.value)}
                  >
                    <option value="">Sem Serviço</option>
                    {servicos.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.numero} · {s.descricao ?? "Serviço"}
                      </option>
                    ))}
                  </select>
                )}
              </CampoFormulario>
            )}
            {(painel.tipo === "exame" || painel.tipo === "protocolo") && (
              <CampoFormulario
                id="san-ocorrencia"
                rotulo="Ocorrência associada (opcional)"
              >
                {(p) => (
                  <select
                    {...p}
                    value={ocorrenciaId}
                    onChange={(e) => setOcorrenciaId(e.target.value)}
                    className={classeInput}
                  >
                    <option value="">Sem ocorrência</option>
                    {ocorrencias
                      .filter(
                        (o) => o.animalId === animalId && o.status === "VALIDO",
                      )
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.doenca.nome} · {dataSanitaria(o.inicio)}
                        </option>
                      ))}
                  </select>
                )}
              </CampoFormulario>
            )}
            {painel.tipo === "exame" && (
              <CampoFormulario
                id="san-responsavel-exame"
                rotulo="Responsável (opcional)"
              >
                {(p) => (
                  <input
                    {...p}
                    maxLength={160}
                    className={classeInput}
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                  />
                )}
              </CampoFormulario>
            )}
            {painel.tipo === "exame" ? (
              <CampoFormulario
                id="san-resultado"
                rotulo="Resultado (opcional; coleta pode aguardar resultado)"
              >
                {(p) =>
                  tiposExame.find((t) => t.id === cadastroId)?.tipoResultado ===
                  "OPCAO" ? (
                    <select
                      {...p}
                      value={resultado}
                      onChange={(e) => setResultado(e.target.value)}
                      className={classeInput}
                    >
                      <option value="">Ainda não disponível</option>
                      {tiposExame
                        .find((t) => t.id === cadastroId)
                        ?.opcoes?.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                    </select>
                  ) : (
                    <input
                      {...p}
                      type={
                        tiposExame.find((t) => t.id === cadastroId)
                          ?.tipoResultado === "NUMERO"
                          ? "number"
                          : "text"
                      }
                      value={resultado}
                      onChange={(e) => setResultado(e.target.value)}
                      className={classeInput}
                    />
                  )
                }
              </CampoFormulario>
            ) : (
              (painel.tipo !== "protocolo" || exigeSobreposicao) && (
                <CampoFormulario
                  id="san-motivo"
                  rotulo={
                    painel.tipo === "protocolo"
                      ? "Justificativa da sobreposição"
                      : painel.tipo === "ocorrencia"
                        ? "Observação"
                        : painel.tipo === "encerrar"
                          ? "Desfecho"
                          : "Motivo"
                  }
                  obrigatorio={painel.tipo !== "ocorrencia"}
                >
                  {(p) => (
                    <textarea
                      {...p}
                      required={painel.tipo !== "ocorrencia"}
                      minLength={painel.tipo === "ocorrencia" ? 0 : 5}
                      maxLength={500}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      className={classeInput}
                    />
                  )}
                </CampoFormulario>
              )
            )}
            {painel.tipo === "protocolo" && exigeSobreposicao && <ConfirmacaoCiencia id="san-sobreposicao" checked={confirmarSobreposicao} onChange={setConfirmarSobreposicao} obrigatorio disabled={ocupado}>Confirmo iniciar outro protocolo com tarefas pendentes.</ConfirmacaoCiencia>}
            {painel.tipo === "adiar" && (
              <CampoFormulario
                id="san-adiamento-data"
                rotulo="Nova data prevista"
                obrigatorio
              >
                {(p) => (
                  <DatePicker
                    {...p}
                    required
                    value={dataAdiamento}
                    onChange={setDataAdiamento}
                  />
                )}
              </CampoFormulario>
            )}
          </form>
        </PainelCadastro>
      )}
      {novoFato === "protocolo" ? <FormRodada animalInicial={animalId || undefined} onFechar={() => setNovoFato(null)} onSalvo={(id) => { setNovoFato(null); setVisaoAgenda("rodadas"); setRodadaId(id); setRevisao((v) => v + 1); }} /> : novoFato && <FormFatoSanitario tipo={novoFato} animalInicial={animalDaAcao?.animalId ?? animalId} fixo={!!tarefaExameId} cadastroInicial={cadastroId} tarefaId={tarefaExameId} onFechar={() => setNovoFato(null)} onSalvo={() => { setNovoFato(null); setRevisao((v) => v + 1); }} />}
    </PaginaFinanceira>
  );
}
