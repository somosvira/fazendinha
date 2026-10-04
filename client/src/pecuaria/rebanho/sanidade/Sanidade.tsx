import { useEffect, useState } from "react";
import {
  Calendar,
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
  Panel,
} from "../../../financeiro/financeiro-ui";
import {
  CampoFormulario,
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { NavRebanho } from "../telas/NavRebanho";
import { podeAcessarArea } from "../../../estoque/navegacao";
import { SubAbas } from "../ui";
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
import { SanidadeAnimal, resumoCarencia } from "./SanidadeAnimal";
import type { Doenca, TipoExame } from "./CadastrosSanitarios";
import { ResultadoExame, type ExameResultado } from "./ResultadoExame";
import {
  FormAplicacaoServico,
  type TarefaAplicacao,
} from "./FormAplicacaoServico";

type Ocorrencia = {
  id: string;
  animalId: string;
  inicio: string;
  fim: string | null;
  status: string;
  doenca: { nome: string };
  desfecho: string | null;
  _count: { aplicacoes: number; exames: number; execucoes: number };
};
type Exame = ExameResultado & {
  animalId: string;
  data: string;
  status: string;
  tipoExame: { nome: string };
};
type Tarefa = {
  id: string;
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

type RegistroDetalhe = Record<string, unknown>;
const registro = (valor: unknown): RegistroDetalhe => valor && typeof valor === "object" ? valor as RegistroDetalhe : {};
const textoDetalhe = (valor: unknown) => valor == null || valor === "" ? "Não informado" : String(valor);
const dadosDetalhe: Record<string, Array<[string, string]>> = {
  ocorrencia: [["Início", "inicio"], ["Fim", "fim"], ["Situação", "status"], ["Desfecho", "desfecho"]],
  aplicacao: [["Data", "data"], ["Situação", "status"], ["Medicamento", "nomeProdutoAplicado"], ["Quantidade", "dose"], ["Unidade", "unidadeDose"], ["Origem", "origemInsumo"], ["Responsável", "responsavel"], ["Via", "via"], ["Referência técnica", "referenciaCarencia"], ["Lote", "partidaCodigoSnapshot"], ["Validade do lote", "partidaValidadeSnapshot"], ["Carência leite", "estadoCarenciaLeite"], ["Prazo leite (h)", "carenciaLeiteHoras"], ["Carência carne", "estadoCarenciaCarne"], ["Prazo carne (h)", "carenciaCarneHoras"]],
  exame: [["Data", "data"], ["Situação", "status"], ["Resultado", "resultadoTexto"], ["Resultado numérico", "resultadoNumero"], ["Opção", "resultadoOpcao"]],
  execucao: [["Início", "inicio"], ["Situação", "status"], ["Cancelada em", "canceladaEm"]],
};
function DetalheSanitario({ tipo, valor, abrir }: { tipo: string; valor: unknown; abrir: (tipo: string, id: string) => void }) {
  const fato = registro(valor);
  const animal = registro(fato.animal);
  const protocolo = registro(fato.protocolo);
  const doenca = registro(fato.doenca);
  const tipoExame = registro(fato.tipoExame);
  const ocorrencia = registro(fato.ocorrencia);
  const tarefa = registro(fato.tarefa);
  const movimento = registro(fato.movimentoEstoque);
  const links: Array<[string, string, string]> = [];
  if (ocorrencia.id) links.push(["Ocorrência relacionada", "ocorrencia", String(ocorrencia.id)]);
  if (tarefa.execucaoId) links.push(["Execução do protocolo", "execucao", String(tarefa.execucaoId)]);
  for (const [chave, nome, destino] of [["aplicacoes", "Aplicação", "aplicacao"], ["exames", "Exame", "exame"], ["execucoes", "Execução", "execucao"]] as const) {
    for (const item of Array.isArray(fato[chave]) ? fato[chave] : []) {
      const vinculo = registro(item);
      if (vinculo.id) links.push([`${nome} · ${textoDetalhe(vinculo.data ?? vinculo.inicio)}`, destino, String(vinculo.id)]);
    }
  }
  return <div className="space-y-4 text-sm">
    <p><strong>Animal:</strong> {animal.id ? <a className="underline" href={`/pecuaria/rebanho/animais/${encodeURIComponent(String(animal.id))}`}>{textoDetalhe(animal.brinco)} · {textoDetalhe(animal.nome)}</a> : "Não informado"}</p>
    {!!doenca.nome && <p><strong>Doença:</strong> {String(doenca.nome)}</p>}
    {!!tipoExame.nome && <p><strong>Tipo de exame:</strong> {String(tipoExame.nome)}</p>}
    {!!protocolo.nome && <p><strong>Protocolo:</strong> {String(protocolo.nome)} · versão {textoDetalhe(protocolo.versao)}</p>}
    <dl className="grid gap-2 sm:grid-cols-2">{(dadosDetalhe[tipo] ?? []).map(([rotulo, chave]) => <div key={chave} className="rounded-lg bg-surface p-2"><dt className="text-ink-3">{rotulo}</dt><dd>{textoDetalhe(chave === "partidaCodigoSnapshot" ? fato.loteNome || fato[chave] : fato[chave])}</dd></div>)}</dl>
    {!!fato.loteNome && typeof fato.partidaCodigoSnapshot === "string" && fato.partidaCodigoSnapshot !== fato.loteNome && !/^LOTE-[0-9a-f-]{36}$/i.test(fato.partidaCodigoSnapshot) && <p className="text-ink-3">Referência histórica do lote: {fato.partidaCodigoSnapshot}</p>}
    {!!movimento.id && <p><strong>Saída do estoque:</strong> <a className="underline" href={`/estoque?movimentoId=${encodeURIComponent(String(movimento.id))}${fato.propriedadeId ? `&propriedadeId=${encodeURIComponent(String(fato.propriedadeId))}` : ""}`}>Ver movimento</a></p>}
    {!!fato.operacaoServicoId && podeAcessarArea("financeiro") && <p><strong>Serviço:</strong> <a className="underline" href={`/financeiro/operacoes/${encodeURIComponent(String(fato.operacaoServicoId))}`}>Ver origem financeira</a></p>}
    {fato.valorProdutoAtribuido != null && <p><strong>Custo atribuído do medicamento:</strong> R$ {String(fato.valorProdutoAtribuido)}</p>}
    {fato.valorServicoAtribuido != null && <p><strong>Rateio atribuído do Serviço:</strong> R$ {String(fato.valorServicoAtribuido)}</p>}
    {links.length > 0 && <section><h3 className="font-semibold">Fatos relacionados</h3><div className="mt-2 flex flex-wrap gap-2">{links.map(([rotulo, destino, id]) => <button key={`${destino}-${id}`} type="button" className="rounded-lg border border-border px-3 py-2 underline" onClick={() => abrir(destino, id)}>{rotulo}</button>)}</div></section>}
    {Array.isArray(fato.tarefas) && <section><h3 className="font-semibold">Tarefas</h3><div className="mt-2 space-y-2">{fato.tarefas.map((item) => { const t = registro(item); return <p key={String(t.id)} className="rounded-lg border border-border p-2">{textoDetalhe(t.previstaPara)} · {t.dispensadaEm ? "Dispensada" : (Array.isArray(t.aplicacoes) && t.aplicacoes.length) || (Array.isArray(t.exames) && t.exames.length) ? "Realizada" : "Pendente"}</p>; })}</div></section>}
  </div>;
}

export function Sanidade({ podeLancar }: { podeLancar: boolean }) {
  const [rateando, setRateando] = useState(false);
  const [aba, setAba] = useState<Aba>(() => estadoDaUrl().aba);
  const [aplicacaoId, setAplicacaoId] = useState(
    () => estadoDaUrl().aplicacaoId,
  );
  const [detalhe, setDetalhe] = useState<{ tipo: string; id: string } | null>(
    () => {
      const url = estadoDaUrl();
      return url.detalheTipo && url.detalheId
        ? { tipo: url.detalheTipo, id: url.detalheId }
        : null;
    },
  );
  const [detalheConteudo, setDetalheConteudo] = useState<unknown>(null);
  const [detalhePropriedadeId, setDetalhePropriedadeId] = useState(() => estadoDaUrl().detalhePropriedadeId);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [recarregarDetalhe, setRecarregarDetalhe] = useState(0);
  const [animais, setAnimais] = useState<AnimalResumo[]>([]);
  const [buscaAnimal, setBuscaAnimal] = useState("");
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
  const [doencas, setDoencas] = useState<Doenca[]>([]);
  const [tiposExame, setTiposExame] = useState<TipoExame[]>([]);
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [revisao, setRevisao] = useState(0);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [tarefaAplicacao, setTarefaAplicacao] =
    useState<TarefaAplicacao | null>(null);
  const [tarefaExameId, setTarefaExameId] = useState<string | null>(null);
  const [cadastroId, setCadastroId] = useState("");
  const [data, setData] = useState(hoje());
  const [texto, setTexto] = useState("");
  const [dataAdiamento, setDataAdiamento] = useState("");
  const [confirmarSobreposicao, setConfirmarSobreposicao] = useState(false);
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
    const params = new URLSearchParams();
    params.set("aba", aba);
    for (const [k, v] of Object.entries({
      animalId,
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
  }, [aba, animalId, loteId, de, ate, situacao, pagina, aplicacaoId, detalhe, detalhePropriedadeId]);
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
    const requisicoes: Partial<Record<Aba, Promise<unknown>>> = {
      agenda: reqSanidade<Tarefa[]>(`/tarefas${q}`),
      ocorrencias: reqSanidade<Ocorrencia[]>(`/ocorrencias${q}`),
      aplicacoes: reqSanidade<AplicacaoSanitaria[]>(`/aplicacoes${q}`),
      exames: reqSanidade<Exame[]>(`/exames${q}`),
      carencias: reqSanidade<
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
    requisicoes[aba]!.then(async (value) => {
      if (!vivo) return;
      if (aba === "agenda") setTarefas(value as Tarefa[]);
      if (aba === "ocorrencias") setOcorrencias(value as Ocorrencia[]);
      if (aba === "aplicacoes") {
        const lista = value as AplicacaoSanitaria[];
        setAplicacoes(lista);
        const ids = [
          ...new Set(
            lista
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
        if (vivo) setErroAba(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (vivo) setCarregandoAba(false);
      });
    void extras;
    return () => {
      vivo = false;
    };
  }, [aba, animalId, loteId, de, ate, situacao, pagina, revisao]);
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
    setPainel(p);
    setCadastroId("");
    setTexto("");
    setResultado("");
    setData(hoje());
    setDataAdiamento("");
    setConfirmarSobreposicao(false);
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
  const abrirDetalhe = (tipo: string, id: string) => setDetalhe({ tipo, id });
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
    const propriedadeId = animal?.propriedade?.id;
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
      body = { previstaPara: dataAdiamento, motivo: texto };
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
          ? { motivo: texto }
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
        setConfirmarSobreposicao(true);
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
      {rateando && animal?.propriedade && (
        <RateioServico
          propriedadeId={animal.propriedade.id}
          servicos={servicos.filter((s) => s.valorTotal !== undefined)}
          onFechar={() => setRateando(false)}
        />
      )}
      {podeLancar && servicos.some((s) => s.valorTotal !== undefined) && (
        <Button secondary onClick={() => setRateando(true)}>
          Ratear Serviço (opcional)
        </Button>
      )}
      {tarefaAplicacao && animal?.propriedade && (
        <FormAplicacaoServico
          animalId={animalId}
          propriedadeId={animal.propriedade.id}
          tarefa={tarefaAplicacao}
          onFechar={() => setTarefaAplicacao(null)}
          onSalvo={() => {
            setTarefaAplicacao(null);
            setRevisao((v) => v + 1);
          }}
        />
      )}
      <PageHeader
        eyebrow="Pecuária"
        titulo="Sanidade"
        descricao="Agenda e fatos sanitários. Selecione um animal para lançar e consultar suas carências."
      />
      <NavRebanho ativa="sanidade" />
      <ErrorBox erro={erro} />
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
              {podeLancar && animal && (
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
                    <p className="text-sm">
                      {nomeAnimal(t.execucao.animalId)} ·{" "}
                      {t.previstaPara.slice(0, 10)} ·{" "}
                      {t.parametros.tipoAplicacaoNomeSnapshot ??
                        t.parametros.tipo}{" "}
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
                      animalId === t.execucao.animalId &&
                      t.situacao === "PENDENTE" && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            secondary
                            onClick={() => {
                              if (t.parametros.tipo === "APLICACAO")
                                setTarefaAplicacao({
                                  id: t.id,
                                  ...t.parametros,
                                });
                              else {
                                abrir({ tipo: "exame" });
                                setCadastroId(t.parametros.tipoExameId);
                                setTarefaExameId(t.id);
                              }
                            }}
                          >
                            Executar tarefa
                          </Button>
                          <Button
                            secondary
                            onClick={() =>
                              abrir({ tipo: "dispensar", id: t.id })
                            }
                          >
                            Dispensar com motivo
                          </Button>
                          <Button
                            secondary
                            onClick={() =>
                              abrir({ tipo: "cancelar", id: t.execucaoId })
                            }
                          >
                            Cancelar execução
                          </Button>
                          <Button
                            secondary
                            onClick={() => abrir({ tipo: "adiar", id: t.id })}
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
              <p className="text-sm text-ink-3">
                Planejamento não consome estoque. Aplicações e exames são fatos
                independentes.
              </p>
            </>
          )}
          {aba === "ocorrencias" && (
            <>
              {podeLancar && animal && (
                <Button onClick={() => abrir({ tipo: "ocorrencia" })}>
                  Nova ocorrência
                </Button>
              )}
              {ocorrencias
                .filter((o) => noPeriodo(o.inicio, o.status, o.fim))
                .map((o) => (
                  <div
                    key={o.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <strong>
                      {o.doenca.nome} ·{" "}
                      <a className="underline" href={linkFato(o.animalId)}>
                        {nomeAnimal(o.animalId)}
                      </a>
                    </strong>
                    <p>
                      {o._count.aplicacoes} aplicações · {o._count.exames}{" "}
                      exames · {o._count.execucoes} protocolos
                    </p>
                    <p>
                      {o.inicio.slice(0, 10)} ·{" "}
                      {o.fim ? `Encerrada: ${o.desfecho}` : "Aberta"} ·{" "}
                      {o.status === "ANULADO" ? "Anulada" : "Válida"}
                    </p>
                    <Button
                      secondary
                      onClick={() => abrirDetalhe("ocorrencia", o.id)}
                    >
                      Ver detalhes
                    </Button>
                    {podeLancar &&
                      animalId === o.animalId &&
                      o.status === "VALIDO" && (
                        <div className="mt-2 flex gap-2">
                          {!o.fim && (
                            <Button
                              secondary
                              onClick={() =>
                                abrir({ tipo: "encerrar", id: o.id })
                              }
                            >
                              Encerrar
                            </Button>
                          )}
                          <Button
                            secondary
                            onClick={() =>
                              abrir({ tipo: "anular-ocorrencia", id: o.id })
                            }
                          >
                            Anular
                          </Button>
                        </div>
                      )}
                  </div>
                ))}
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
                  · {aplicacaoSelecionada.data.slice(0, 10)}
                </p>
              ) : (
                <p>
                  Não encontramos esta aplicação no resultado carregado. Confira
                  o animal e os filtros de data.
                </p>
              )}
            </div>
          )}
          {(aba === "aplicacoes" || (aba === "carencias" && animal)) &&
            (animal ? (
              <SanidadeAnimal
                animalId={animalId}
                propriedadeId={animal.propriedade?.id ?? null}
                podeLancar={podeLancar}
                recarregarToken={revisao}
                lista={aplicacoes}
                onMudou={() => setRevisao((v) => v + 1)}
              />
            ) : (
              <p>
                Selecione um animal para consultar carências e registrar uma
                aplicação.
              </p>
            ))}
          {aba === "carencias" && !animal && (
            <>
              {carencias
                .filter(
                  (c) =>
                    !situacao ||
                    (situacao === "CARÊNCIA_VIGENTE"
                      ? [c.leite, c.carne].some((p) => p.estado === "CONHECIDO")
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
                      {c.animal.brinco} · {c.animal.nome ?? ""}
                    </a>
                    <p>Leite: {resumoCarencia(c.leite)}</p>
                    <p>Abate/carne: {resumoCarencia(c.carne)}</p>
                  </div>
                ))}
              {!carencias.length && (
                <p>Nenhuma carência encontrada para os filtros atuais.</p>
              )}
            </>
          )}
          {aba === "aplicacoes" &&
            !animal &&
            aplicacoes
              .filter((a) => noPeriodo(a.data, a.status))
              .map((a) => (
                <div
                  key={a.id}
                  id={`aplicacao-${a.id}`}
                  className={`rounded-lg border p-3 ${a.id === aplicacaoId ? "border-green-700 bg-green-50 ring-2 ring-green-700" : "border-border"}`}
                >
                  <strong>
                    <a className="underline" href={linkFato(a.animalId, a.id)}>
                      {nomeAnimal(a.animalId)}
                    </a>
                    {a.id === aplicacaoId && (
                      <span className="ml-2 font-normal">
                        · aplicação selecionada
                      </span>
                    )}
                  </strong>
                  <p>
                    {a.tipoAplicacaoNomeSnapshot ?? a.finalidade ?? "Aplicação"}{" "}
                    · {a.nomeProdutoAplicado} · {a.dose} {a.unidadeDose} ·{" "}
                    {a.data.slice(0, 10)} ·{" "}
                    {a.status === "VALIDO" ? "Válida" : "Anulada"}
                  </p>
                  <Button
                    secondary
                    onClick={() => abrirDetalhe("aplicacao", a.id)}
                  >
                    Ver detalhes
                  </Button>
                </div>
              ))}
          {aba === "exames" && (
            <>
              {podeLancar && animal && (
                <Button onClick={() => abrir({ tipo: "exame" })}>
                  Registrar coleta / exame
                </Button>
              )}
              {exames
                .filter((e) =>
                  noPeriodo(
                    e.data,
                    e.status,
                    null,
                    e.resultadoTexto ?? e.resultadoNumero ?? e.resultadoOpcao,
                  ),
                )
                .map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <strong>
                      {e.tipoExame.nome} ·{" "}
                      <a className="underline" href={linkFato(e.animalId)}>
                        {nomeAnimal(e.animalId)}
                      </a>
                    </strong>
                    <p>
                      {e.data.slice(0, 10)} ·{" "}
                      {e.status === "VALIDO" ? "Válido" : "Anulado"} ·{" "}
                      {e.resultadoTexto ??
                        e.resultadoNumero ??
                        e.resultadoOpcao ??
                        "Aguardando resultado"}
                    </p>
                    <Button
                      secondary
                      onClick={() => abrirDetalhe("exame", e.id)}
                    >
                      Ver detalhes
                    </Button>
                    {podeLancar &&
                      animalId === e.animalId &&
                      animal?.propriedade &&
                      e.status === "VALIDO" && (
                        <ResultadoExame
                          exame={e}
                          propriedadeId={animal.propriedade.id}
                          onSalvo={() => setRevisao((v) => v + 1)}
                        />
                      )}
                  </div>
                ))}
              {!exames.length && (
                <p>Nenhum exame encontrado para os filtros atuais.</p>
              )}
            </>
          )}
          {
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
                  (aba === "agenda"
                    ? tarefas.length
                    : aba === "ocorrencias"
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
        <Panel className="mt-5 space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Detalhe do fato sanitário</h2>
            <Button secondary onClick={() => setDetalhe(null)}>
              Voltar à lista
            </Button>
          </div>
          {erroDetalhe ? (
            <><ErrorBox erro={erroDetalhe} /><Button secondary onClick={() => setRecarregarDetalhe((v) => v + 1)}>Tentar novamente</Button></>
          ) : detalheConteudo == null ? (
            <p>Carregando detalhe…</p>
          ) : (
            <DetalheSanitario tipo={detalhe.tipo} valor={detalheConteudo} abrir={abrirDetalhe} />
          )}
        </Panel>
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
            <p>{animal ? nomeAnimal(animal.id) : "Selecione um animal"}</p>
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
                          {o.doenca.nome} · {o.inicio.slice(0, 10)}
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
              (painel.tipo !== "protocolo" || confirmarSobreposicao) && (
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
    </PaginaFinanceira>
  );
}
