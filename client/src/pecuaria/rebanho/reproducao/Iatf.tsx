import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { Button as BotaoUI } from "../../../components/ui/button";
import { ProtocoloTimeline } from "./ProtocoloTimeline";
import {BibliotecaReprodutiva} from "./BibliotecaReprodutiva";
import { CustosDiretos } from "../custos/CustosDiretos";
import { CampoDataIatf, dataHoraISO, horarioIatf, inputHorarioIatf } from "./CampoDataIatf";
export { dataHoraISO, horarioIatf, inputHorarioIatf } from "./CampoDataIatf";
import { FormFatoSanitario } from "../sanidade/FormFatoSanitario";
import type { TipoExame } from "../sanidade/CadastrosSanitarios";
import { reqSanidade } from "../sanidade/api";
import { navegarPara } from "../../../router";
import { RegularizarOrigem, consumoMantidoUltimaAnulacao } from "./RegularizarOrigem";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  CabecalhoTabela,
  ErrorBox,
  Empty,
  Panel,
  Pill,
  TabelaFinanceira,
} from "../../../financeiro/financeiro-ui";
import {
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { reqV4, type PainelReprodutivo, type AnimalReprodutivo } from "./api";
import { FormReproducao } from "./FormReproducao";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { listarMaterialGenetico } from "../api";
import type { MaterialGeneticoDTO } from "../types";
import { UNIDADES, type UnidadeMedida } from "../../../lib/unidades";
import { FormAplicacaoServico } from "../sanidade/FormAplicacaoServico";
export type EtapaIatf = {
  nome: string;
  tipo: "APLICACAO" | "MANEJO" | "RETIRADA" | "TENTATIVA" | "AVALIACAO" | "EXAME";
  intervalo: number;
  unidade: "DIAS" | "HORAS";
  orientacaoTemporal?: {versao:1;referencia:"INICIO_EFETIVO"|"ETAPA_ANTERIOR";intervaloHoras:number;toleranciaAntesMinutos:number;toleranciaDepoisMinutos:number;efeito:"ALERTA"};
  planoAplicacao?: {
    produtoId: string;
    dose: string;
    unidadeDose: UnidadeMedida;
    via?: string | null;
  };
  planoTentativa?: {
    tipo: "IA" | "TE";
    materialId: string;
    quantidade: number;
  };
  planoExame?: { tipoExameId: string };
  planoAvaliacao?: { tipoExameId?: string; tipo: "DIAGNOSTICO" | "RECONFIRMACAO" | "SEXAGEM" };
};
/** Projeções de leitura incluem referências congeladas, que não pertencem à entrada de cadastro. */
export function etapaParaCadastro(e: EtapaIatf): EtapaIatf {
  return {
    nome: e.nome, tipo: e.tipo, intervalo: e.intervalo, unidade: e.unidade,
    ...(e.orientacaoTemporal ? {orientacaoTemporal:e.orientacaoTemporal} : {}),
    ...(e.planoAplicacao ? { planoAplicacao: { produtoId: e.planoAplicacao.produtoId, dose: e.planoAplicacao.dose, unidadeDose: e.planoAplicacao.unidadeDose, via: e.planoAplicacao.via } } : {}),
    ...(e.planoTentativa ? { planoTentativa: { tipo: e.planoTentativa.tipo, materialId: e.planoTentativa.materialId, quantidade: e.planoTentativa.quantidade } } : {}),
    ...(e.planoExame ? { planoExame: { tipoExameId: e.planoExame.tipoExameId } } : {}),
    ...(e.planoAvaliacao ? { planoAvaliacao: { tipoExameId: e.planoAvaliacao.tipoExameId, tipo: e.planoAvaliacao.tipo } } : {}),
  };
}
export type ProtocoloIatf = {
  id: string;
  nome: string;
  versao: number;
  publicado: boolean;
  referenciaTecnica?: {fonte?:{titulo:string;url:string};versaoReferencia?:string;protocoloOrigemId?:string}|null;
  ativo?: boolean;
  utilizada?: boolean;
  descricao?: string | null;
  etapas: EtapaIatf[];
};
export type TarefaIatf = {
  precisaoTemporal?: "DIA" | "HORA";
  precisaoRealizacao?: "DIA" | "HORA" | null;
  previsaoPendente?: boolean;
  id: string;
  nome?: string;
  tipo: string;
  previstaEm: string;
  realizadaEm?: string | null;
  status: string;
  etapa?: number;
  planejadoSnapshot?: {
    previsaoPendente?: boolean;
    etapa: EtapaIatf;
    referencias?: Record<string, unknown>;
    previstaEm: string;
    previsaoOriginal: string;
    inicioReferencia: string;
  } | null;
  realizadoSnapshot?: {
    tipo: string;
    precisaoRealizacao?: "DIA" | "HORA";
    realizadaEm: string;
    dados: Record<string, unknown>;
  } | null;
  desviosSnapshot?: {
    aferido: boolean;
    horarioAferido?: boolean;
    orientacaoTemporal?:{estado:"NAO_CONFIGURADA"|"NAO_AFERIVEL"|"DENTRO"|"FORA";previstaPara?:string;diferencaMinutos?:number;motivo?:string;regra?:{referencia:string}};
    diferencas: { campo: string; planejado: unknown; realizado: unknown }[];
    motivo?: string | null;
  } | null;
  dispensadaEm?: string | null;
  aplicacaoId?: string | null;
  tentativaId?: string | null;
  avaliacaoId?: string | null;
  fatoId?: string | null;
  regularizacaoPendente?: boolean;
  historicoRegularizacao?: Array<{acao?: string; destinoConsumo?: string | null}>;
};
export type ParticipanteIatf = {
  precisaoTemporal?: "DIA" | "HORA";
  precisaoInicioEfetivo?: "DIA" | "HORA" | null;
  id: string;
  animalId: string;
  inicioPrevisto: string;
  inicioEfetivo: string | null;
  status?: string;
  encerradoEm?: string | null;
  motivoEncerramento?: string | null;
  tarefas: TarefaIatf[];
  animal?: { brinco: string; nome?: string | null };
};
export type ProgramacaoIatf = {
  precisaoTemporal?: "DIA" | "HORA";
  id: string;
  nome: string;
  protocoloId: string;
  inicioPrevisto: string;
  status: string;
  protocolo?: ProtocoloIatf;
  participantes: ParticipanteIatf[];
};
export const statusTarefaIatf = (t: TarefaIatf) =>
  t.historicoRegularizacao?.at(-1)?.acao === "ENCERRAR_SEM_SUBSTITUICAO" ? "Encerrada sem substituição" : t.realizadaEm ? "Realizada" : t.dispensadaEm ? "Dispensada" : "Pendente";
export const statusParticipanteIatf = (p: ParticipanteIatf) =>
  p.encerradoEm ? "Encerrada" : p.inicioEfetivo ? "Iniciada" : "Prevista";
export function Iatf({
  programacaoId, onAbrirProgramacao, onFecharDetalhe,
  animais = [],
  painel,
  modo = "operacao",
  podeLancar,
  onMudou,
  animaisIndicadosInicialmente,
  propriedadeId,
}: {
  programacaoId?: string;
  onAbrirProgramacao?: (id: string) => void;
  onFecharDetalhe?: () => void;
  animais?: Array<Pick<AnimalReprodutivo, "animalId" | "brinco" | "nome">>;
  animaisIndicadosInicialmente?: string[];
  propriedadeId?: number;
  painel?: PainelReprodutivo;
  modo?: "operacao" | "cadastros";
  podeLancar: boolean;
  onMudou?: () => Promise<void>;
}) {
  const sitioEfetivo = propriedadeId ?? getPropriedadeAtiva();
  const contexto = `${sitioEfetivo ?? "consolidado"}:${modo}`;
  const contextoAtual = useRef(contexto);
  contextoAtual.current = contexto;
  const reqIatf = useCallback(
    <T,>(path: string, body?: object, method = "POST") => {
      const consulta =
        sitioEfetivo && !body
          ? `${path}${path.includes("?") ? "&" : "?"}propriedadeId=${sitioEfetivo}`
          : path;
      return reqV4<T>(consulta, body, method, sitioEfetivo ?? undefined);
    },
    [sitioEfetivo],
  );
  const [consulta, setConsulta] = useState<{
    contexto: string;
    protocolos: ProtocoloIatf[];
    programacoes: ProgramacaoIatf[];
  } | null>(null);
  const [leitura, setLeitura] = useState<{
    contexto: string;
    carregando: boolean;
    erro: string | null;
  }>({ contexto, carregando: true, erro: null });
  const consultaVisivel = consulta?.contexto === contexto ? consulta : null;
  const protocolos = consultaVisivel?.protocolos ?? [];
  const programacoes = consultaVisivel?.programacoes ?? [];
  const [buscaProgramacao,setBuscaProgramacao]=useState(()=>new URLSearchParams(window.location.search).get("iatfBusca")??"");
  const [paginaProgramacoes,setPaginaProgramacoes]=useState(()=>Math.max(1,Math.floor(Number(new URLSearchParams(window.location.search).get("iatfPagina"))||1)));
  useEffect(()=>{if(programacaoId||modo!=="operacao")return;const u=new URL(window.location.href);buscaProgramacao?u.searchParams.set("iatfBusca",buscaProgramacao):u.searchParams.delete("iatfBusca");paginaProgramacoes>1?u.searchParams.set("iatfPagina",String(paginaProgramacoes)):u.searchParams.delete("iatfPagina");window.history.replaceState(window.history.state,"",u.pathname+u.search+u.hash);},[buscaProgramacao,paginaProgramacoes,programacaoId,modo]);
  useEffect(()=>{const restaurar=()=>{const p=new URLSearchParams(window.location.search);setBuscaProgramacao(p.get("iatfBusca")??"");setPaginaProgramacoes(Math.max(1,Math.floor(Number(p.get("iatfPagina"))||1)));};window.addEventListener("popstate",restaurar);return()=>window.removeEventListener("popstate",restaurar);},[]);
  const filtradas=programacoes.filter(p=>p.nome.toLocaleLowerCase("pt-BR").includes(buscaProgramacao.toLocaleLowerCase("pt-BR")));
  const paginasProgramacoes=Math.max(1,Math.ceil(filtradas.length/20));
  const paginaLista=Math.min(paginaProgramacoes,paginasProgramacoes);
  const carregando = leitura.contexto !== contexto || leitura.carregando;
  const erroConsulta = leitura.contexto === contexto ? leitura.erro : null;
  const sequenciaConsulta = useRef(0);
  const [detalheCarregado, setDetalheCarregado] = useState<{
    contexto: string;
    valor: ProgramacaoIatf;
  } | null>(null);
  const detalhe =
    detalheCarregado?.contexto === contexto ? detalheCarregado.valor : null;
  const setDetalhe = (valor: ProgramacaoIatf | null) =>
    setDetalheCarregado(valor ? { contexto, valor } : null);
  const [leituraDetalhe, setLeituraDetalhe] = useState<{
    contexto: string;
    id: string;
    carregando: boolean;
    erro: string | null;
  } | null>(null);
  const detalheAtual =
    leituraDetalhe?.contexto === contexto ? leituraDetalhe : null;
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState<
    "protocolo" | "programacao" | "participantes" | null
  >(null);
  const [ocupado, setOcupado] = useState(false);
  const [nome, setNome] = useState("");
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [materiais, setMateriais] = useState<MaterialGeneticoDTO[]>([]);
  const [cienciaSanitaria, setCienciaSanitaria] = useState(false);
  const [chaveProgramacao, setChaveProgramacao] = useState(() =>
    crypto.randomUUID(),
  );
  const [editando, setEditando] = useState<string | null>(null);
  const [versao, setVersao] = useState(1);
  const [origemVersaoId,setOrigemVersaoId]=useState<string|null>(null);
  const [publicado, setPublicado] = useState(false);
  const [protocoloId, setProtocoloId] = useState("");
  const [inicio, setInicio] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [etapas, setEtapas] = useState<EtapaIatf[]>([
    { nome: "", tipo: "MANEJO", intervalo: 0, unidade: "DIAS" },
  ]);
  const [execucao, setExecucao] = useState<{
    tarefa: TarefaIatf;
    animalId: string;
  } | null>(null);
  const [acao, setAcao] = useState<{
    tipo: "inicio" | "revisao" | "retirada";
    id: string;
  } | null>(null);
  const [dataHora, setDataHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const aberturaAtual = useRef(0);
  const carregar = useCallback(async () => {
    if (contextoAtual.current !== contexto) return;
    const pedido = ++sequenciaConsulta.current;
    const atual = () =>
      sequenciaConsulta.current === pedido && contextoAtual.current === contexto;
    setLeitura({ contexto, carregando: true, erro: null });
    try {
      const [protocolos, programacoes] = await Promise.all([
        reqIatf<ProtocoloIatf[]>("/reproducao/protocolos"),
        modo === "cadastros"
          ? Promise.resolve([] as ProgramacaoIatf[])
          : reqIatf<ProgramacaoIatf[]>("/reproducao/programacoes"),
      ]);
      if (atual()) {
        setConsulta({ contexto, protocolos, programacoes });
        setLeitura({ contexto, carregando: false, erro: null });
      }
    } catch (e) {
      if (atual())
        setLeitura({
          contexto,
          carregando: false,
          erro: e instanceof Error ? e.message : String(e),
        });
    }
  }, [contexto, modo, reqIatf]);
  useEffect(() => {
    setDetalheCarregado(null);
    setLeituraDetalhe(null);
    setNovo(null);
    setExecucao(null);
    setAcao(null);
    setErro(null);
    setOcupado(false);
    setProtocoloId("");
    setSelecionados([]);
    setInicio("");
    setNome("");
    setCienciaSanitaria(false);
    setEditando(null);
    setOrigemVersaoId(null);
    setDataHora("");
    setMotivo("");
    void carregar();
    return () => {
      sequenciaConsulta.current++;
      aberturaAtual.current++;
    };
  }, [carregar]);
  useEffect(() => {
    let ativo = true;
    setProdutos([]);
    setMateriais([]);
    void Promise.all([
      listarProdutos(
        { uso: "sanitario", ativo: true },
        sitioEfetivo ?? undefined,
      ),
      listarMaterialGenetico({}, sitioEfetivo ?? undefined),
    ])
      .then(([p, m]) => {
        if (ativo) {
          setProdutos(p);
          setMateriais(m);
        }
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      });
    return () => {
      ativo = false;
    };
  }, [sitioEfetivo]);
  const abrir = useCallback(
    async (id: string) => {
      if (contextoAtual.current !== contexto) return;
      const pedido = ++aberturaAtual.current;
      const atual = () =>
        pedido === aberturaAtual.current && contextoAtual.current === contexto;
      setDetalheCarregado((anterior) =>
        anterior?.contexto === contexto && anterior.valor.id === id
          ? anterior
          : null,
      );
      setLeituraDetalhe({ contexto, id, carregando: true, erro: null });
      try {
        const resultado = await reqIatf<ProgramacaoIatf>(
          `/reproducao/programacoes/${id}`,
        );
        if (atual()) {
          setDetalheCarregado({ contexto, valor: resultado });
          setLeituraDetalhe({ contexto, id, carregando: false, erro: null });
        }
      } catch (e) {
        if (atual())
          setLeituraDetalhe({
            contexto,
            id,
            carregando: false,
            erro: e instanceof Error ? e.message : String(e),
          });
      }
    },
    [contexto, reqIatf],
  );
  useEffect(() => {
    const atualizar = () => {
      const id = programacaoId ?? new URLSearchParams(window.location.search).get("programacaoId");
      if (id) void abrir(id);
      else {
        aberturaAtual.current++;
        setDetalheCarregado(null);
        setLeituraDetalhe(null);
      }
    };
    atualizar();
    window.addEventListener("popstate", atualizar);
    return () => {
      aberturaAtual.current++;
      window.removeEventListener("popstate", atualizar);
    };
  }, [abrir, programacaoId]);
  const indicacaoAberta = useRef(false);
  useEffect(() => {
    if (!animaisIndicadosInicialmente?.length || indicacaoAberta.current || !podeLancar) return;
    indicacaoAberta.current = true;
    setSelecionados([...new Set(animaisIndicadosInicialmente)].slice(0, 100));
    setNome("");
    setInicio("");
    setProtocoloId("");
    setCienciaSanitaria(false);
    setChaveProgramacao(crypto.randomUUID());
    setNovo("programacao");
  }, [animaisIndicadosInicialmente, podeLancar]);
  const prop = () => {
    const p = propriedadeId ?? getPropriedadeAtiva();
    if (!p) throw new Error("Selecione um sítio.");
    return p;
  };
  const executar = async (fn: () => Promise<void>) => {
    if (contextoAtual.current !== contexto) return;
    setOcupado(true);
    setErro(null);
    try {
      await fn();
      if (contextoAtual.current === contexto) await onMudou?.();
    } catch (e) {
      if (contextoAtual.current === contexto) setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (contextoAtual.current === contexto) setOcupado(false);
    }
  };
  return (
    <div className="space-y-5">
      <ErrorBox erro={erro} />
      {modo !== "operacao" && <BibliotecaReprodutiva propriedadeId={sitioEfetivo} podeLancar={podeLancar} onCopiou={()=>void carregar()}/>}
      {modo === "operacao" && !programacaoId && <Panel>
        <BarraConsulta acao={<div className="flex flex-wrap gap-2">
                <Button secondary disabled={carregando} onClick={() => void carregar()}>Atualizar programações</Button>
                {podeLancar && <>
                <a className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm" href="/configuracoes/pecuaria/reproducao/protocolos" onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarPara("/configuracoes/pecuaria/reproducao/protocolos"); } }}>Gerenciar protocolos reprodutivos</a>
                <Button
                  disabled={!sitioEfetivo || carregando || !!erroConsulta}
                  onClick={() => {
                    setNome("");
                    setNovo("programacao");
                    setChaveProgramacao(crypto.randomUUID());
                    setCienciaSanitaria(false);
                  }}
                >
                  Nova programação
                </Button>
                </>}
              </div>} />
        <div className="p-4 space-y-3">
          <p className="text-sm text-ink-3">
            Indicação, programação, início efetivo e execução são fatos
            separados. O calendário começa no início efetivo individual,
            conforme a versão escolhida.
          </p>
          {carregando && (
            <p role="status" className="rounded-lg bg-muted p-3 text-sm">
              {consultaVisivel
                ? "Atualizando programações… Os dados confirmados continuam visíveis."
                : "Carregando programações…"}
            </p>
          )}
          <ErrorBox erro={erroConsulta} />
          {erroConsulta && <Button secondary onClick={() => void carregar()}>Tentar novamente</Button>}
          <label className="block text-sm">Buscar programação<input className={classeInput} aria-label="Buscar programação" value={buscaProgramacao} onChange={e=>{setBuscaProgramacao(e.target.value);setPaginaProgramacoes(1);}}/></label>
          <TabelaFinanceira rotulo="Programações IATF" itens={filtradas.slice((paginaLista-1)*20,paginaLista*20)} chaveDe={p=>p.id} colunas={[
            {chave:"nome",titulo:"Programação",principal:true,larguraMinima:200,larguraFlexivel:true,celula:p=>p.nome},
            {chave:"inicio",titulo:"Início programado",larguraMinima:180,celula:p=>horarioIatf(p.inicioPrevisto,p.precisaoTemporal)},
            {chave:"participantes",titulo:"Participantes",larguraMinima:110,celula:p=>p.participantes.length},
            {chave:"situacao",titulo:"Situação",larguraMinima:120,celula:p=><Pill>{p.status==="ABERTA"?"Aberta":p.status==="ENCERRADA"?"Encerrada":"A conferir"}</Pill>},
            {chave:"acao",titulo:"Ação",acoes:true,larguraMinima:140,celula:p=><BotaoUI variant="outline" aria-label={`Ver IATF ${p.nome}`} onClick={()=>onAbrirProgramacao?onAbrirProgramacao(p.id):void abrir(p.id)}>Ver IATF</BotaoUI>},
          ]}/>
          {filtradas.length>20&&<Paginacao paginaAtual={paginaLista} totalPaginas={paginasProgramacoes} totalItens={filtradas.length} itensPorPagina={20} onPaginaChange={setPaginaProgramacoes} rotulo="programações" idSelect="pagina-programacoes-iatf"/>}
          {!!programacoes.length&&!filtradas.length&&<Empty>Nenhuma programação encontrada com esta busca.</Empty>}
          {!carregando &&
            !erroConsulta &&
            consultaVisivel &&
            !programacoes.length && (
              <Empty>
                <div className="space-y-3">
                  <p className="font-semibold text-ink">
                    {sitioEfetivo
                      ? "Nenhuma programação neste sítio."
                      : "Nenhuma programação no contexto consultado."}
                  </p>
                  <p>
                    As programações reúnem uma versão publicada do protocolo e os
                    animais participantes; o início efetivo é registrado depois.
                  </p>
                  {!sitioEfetivo ? (
                    <p>Selecione um sítio para criar uma programação.</p>
                  ) : podeLancar ? (
                    <p>
                      Use Nova programação para organizar os participantes. Se
                      necessário, cadastre e publique o protocolo em Gerenciar
                      protocolos reprodutivos.
                    </p>
                  ) : (
                    <p>
                      Quando houver programações, elas aparecerão aqui para consulta.
                      A criação exige uma pessoa com permissão de lançamento.
                    </p>
                  )}
                </div>
              </Empty>
            )}
        </div>
      </Panel>}
      {modo === "operacao" && detalheAtual?.carregando && (
        <p role="status" className="rounded-lg border bg-card p-4 text-sm">
          {detalhe ? "Atualizando programação…" : "Carregando programação…"}
        </p>
      )}
      {modo === "operacao" && detalheAtual?.erro && (
        <div className="rounded-lg border bg-card p-4">
          <ErrorBox erro={detalheAtual.erro} />
          <Button secondary onClick={() => void abrir(detalheAtual.id)}>
            Tentar abrir novamente
          </Button>
        </div>
      )}
      {modo === "operacao" && detalhe && (
        <Panel>
          <CabecalhoTabela
            titulo={`${detalhe.nome} · ${detalhe.protocolo?.nome ?? "Protocolo"} v${detalhe.protocolo?.versao ?? ""}`}
            acao={
              <Button secondary onClick={() => { if(onFecharDetalhe){onFecharDetalhe();return;} aberturaAtual.current++; setLeituraDetalhe(null); setDetalhe(null); }}>
                {onFecharDetalhe ? "Voltar às programações" : "Fechar detalhes"}
              </Button>
            }
          />
          <div className="p-4 space-y-4">
            {sitioEfetivo!=null && <CustosDiretos key={detalhe.id} programacaoId={detalhe.id} propriedadeId={sitioEfetivo} podeLancar={podeLancar} />}
            {podeLancar && detalhe.status === "ABERTA" && (
              <Button
                secondary
                onClick={() => {
                  setNovo("participantes");
                  setChaveProgramacao(crypto.randomUUID());
                  setInicio("");
                  setSelecionados([]);
                  setCienciaSanitaria(false);
                }}
              >
                Adicionar ou reintegrar participantes
              </Button>
            )}
            {detalhe.participantes.map((p) => (
              <section
                key={p.id}
                className="rounded-lg border border-border p-4"
              >
                {sitioEfetivo!=null && <details><summary>Custos desta participação</summary><CustosDiretos key={p.id} participacaoId={p.id} propriedadeId={sitioEfetivo} podeLancar={podeLancar} /></details>}
                <div className="flex justify-between gap-3">
                  <h3>
                    {p.animal?.brinco ??
                      animais.find((a) => a.animalId === p.animalId)?.brinco ??
                      p.animalId}
                  </h3>
                  <Pill>{statusParticipanteIatf(p)}</Pill>
                </div>
                <p className="text-sm mt-2">
                  Previsto: {horarioIatf(p.inicioPrevisto, p.precisaoTemporal)} · Início efetivo:{" "}
                  {p.inicioEfetivo
                    ? horarioIatf(p.inicioEfetivo, p.precisaoInicioEfetivo ?? "HORA")
                    : "não confirmado"}
                </p>
                {podeLancar && !p.inicioEfetivo && !p.encerradoEm && (
                  <Button
                    secondary
                    onClick={() => {
                      setAcao({ tipo: "inicio", id: p.id });
                      setDataHora("");
                    }}
                  >
                    Confirmar início efetivo
                  </Button>
                )}
                {podeLancar && !p.encerradoEm && (
                  <Button
                    secondary
                    onClick={() => {
                      setAcao({ tipo: "retirada", id: p.id });
                      setMotivo("");
                    }}
                  >
                    Retirar participação
                  </Button>
                )}
                {p.motivoEncerramento && (
                  <p className="text-sm">{p.motivoEncerramento}</p>
                )}
                <ProtocoloTimeline participante={p}/>
                <div className="mt-3 space-y-2">
                  {p.tarefas?.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap justify-between items-center gap-2 border-t border-border pt-2 text-sm"
                    >
                      <span>
                        {t.nome ?? t.planejadoSnapshot?.etapa.nome ?? t.tipo} ·{" "}
                        {t.previsaoPendente ? "Previsão a definir: início sem horário" : horarioIatf(t.previstaEm, t.precisaoTemporal)} · {statusTarefaIatf(t)}
                      </span>
                      {podeLancar &&
                        !t.realizadaEm &&
                        !t.dispensadaEm &&
                        !p.encerradoEm && (
                          <Button
                            secondary
                            onClick={() => {
                              setAcao({ tipo: "revisao", id: t.id });
                              setDataHora(t.previsaoPendente ? "" : inputHorarioIatf(t.previstaEm, t.precisaoTemporal));
                              setMotivo("");
                            }}
                          >
                            Revisar data explicitamente
                          </Button>
                        )}
                      {podeLancar &&
                        p.inicioEfetivo &&
                        !p.encerradoEm &&
                        !t.realizadaEm &&
                        !t.dispensadaEm && (
                          <Button
                            secondary
                            onClick={() =>
                              setExecucao({ tarefa: t, animalId: p.animalId })
                            }
                          >
                            Registrar execução
                          </Button>
                        )}
                      {podeLancar && t.regularizacaoPendente && sitioEfetivo && <RegularizarOrigem path={`/reproducao/tarefas-iatf/${t.id}/regularizacao`} propriedadeId={sitioEfetivo} consumoMantido={consumoMantidoUltimaAnulacao(t.historicoRegularizacao)} onMudou={async()=>{if(detalhe) await abrir(detalhe.id); await onMudou?.();}} />}
                      {(t.planejadoSnapshot || t.realizadoSnapshot) && (
                        <DetalheEtapa tarefa={t} />
                      )}
                      {(t.fatoId ||
                        t.aplicacaoId ||
                        t.tentativaId ||
                        t.avaliacaoId) && (
                        <span className="text-ink-3">Fato vinculado</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Panel>
      )}
      {modo === "cadastros" && <Panel>
        <CabecalhoTabela
          titulo="Protocolos reprodutivos"
          acao={
            <div className="flex flex-wrap gap-2">
              <Button
                secondary
                disabled={carregando}
                onClick={() => void carregar()}
              >
                Atualizar protocolos
              </Button>
              {podeLancar && (
                <Button
                  onClick={() => {
                    setEditando(null);
                    setOrigemVersaoId(null);
                    setNome("");
                    setVersao(1);
                    setPublicado(false);
                    setEtapas([
                      { nome: "", tipo: "MANEJO", intervalo: 0, unidade: "DIAS" },
                    ]);
                    setNovo("protocolo");
                  }}
                >
                  Novo protocolo reprodutivo
                </Button>
              )}
            </div>
          }
        />
        <div className="p-4 grid gap-3">
          {carregando && (
            <p role="status" className="rounded-lg bg-muted p-3 text-sm">
              {consultaVisivel
                ? "Atualizando protocolos… Os dados confirmados continuam visíveis."
                : "Carregando protocolos…"}
            </p>
          )}
          <ErrorBox erro={erroConsulta} />
          {erroConsulta && <Button secondary onClick={() => void carregar()}>Tentar novamente</Button>}
          {protocolos.map((p) => (
            <section
              key={p.id}
              className="text-sm border border-border rounded-lg p-3"
            >
              <h3 className="font-semibold">
                {p.nome} · versão {p.versao} ·{" "}
                {p.ativo === false ? "Inativa" : p.publicado ? "Publicada" : "Rascunho"}
              </h3>
              <p>
                {p.etapas
                  .map(
                    (e) =>
                      `${e.nome}: +${e.intervalo} ${e.unidade === "DIAS" ? "dias" : "horas"}`,
                  )
                  .join(" · ")}
              </p>
              {podeLancar && <div className="mt-3 flex flex-wrap gap-2">
                {p.referenciaTecnica?.fonte&&<p className="text-sm"><a className="underline" href={p.referenciaTecnica.fonte.url} target="_blank" rel="noreferrer">{p.referenciaTecnica.fonte.titulo}</a> · referência {p.referenciaTecnica.versaoReferencia}</p>}
                {!p.publicado && !p.utilizada && p.ativo !== false && <><Button secondary disabled={ocupado} onClick={() => { setEditando(p.id); setNome(p.nome); setVersao(p.versao); setEtapas(p.etapas.map(etapaParaCadastro)); setPublicado(false); setNovo("protocolo"); }}>Editar rascunho</Button><Button secondary disabled={ocupado} onClick={() => void executar(async () => { await reqIatf(`/reproducao/protocolos/${p.id}/publicar`, {}); await carregar(); })}>Publicar versão</Button></>}
                <Button secondary disabled={ocupado} onClick={() => { setEditando(null); setOrigemVersaoId(p.id); setNome(p.nome); setVersao(Math.max(...protocolos.filter(v => v.nome === p.nome).map(v => v.versao)) + 1); setEtapas(p.etapas.map(etapaParaCadastro)); setPublicado(false); setNovo("protocolo"); }}>Nova versão</Button>
                {p.ativo !== false && <Button secondary disabled={ocupado} onClick={() => void executar(async () => { await reqIatf(`/reproducao/protocolos/${p.id}/inativar`, {}); await carregar(); })}>Inativar versão</Button>}
              </div>}
            </section>
          ))}
          {!carregando && !erroConsulta && consultaVisivel && !protocolos.length && (
            <Empty>
              <div className="space-y-3">
                <p className="font-semibold text-ink">
                  Nenhum protocolo reprodutivo cadastrado.
                </p>
                <p>
                  {podeLancar
                    ? "Crie um protocolo ou copie uma referência da biblioteca como rascunho. Configure as etapas e publique uma versão antes de usá-la nas programações."
                    : "As versões cadastradas aparecerão aqui para consulta. O cadastro e a publicação exigem permissão de lançamento."}
                </p>
              </div>
            </Empty>
          )}
        </div>
      </Panel>}
      {novo && (
        <PainelCadastro
          aberto
          titulo={
            novo === "protocolo"
              ? editando ? "Editar protocolo reprodutivo" : "Nova versão de protocolo reprodutivo"
              : "Nova programação IATF"
          }
          onFechar={() => setNovo(null)}
          bloqueado={ocupado}
          rodape={
            <>
              <Button secondary onClick={() => setNovo(null)}>
                Cancelar
              </Button>
              <Button type="submit" form="novo-iatf" disabled={ocupado}>
                Salvar
              </Button>
            </>
          }
        >
          <form
            id="novo-iatf"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void executar(async () => {
                if (novo === "protocolo")
                  await reqIatf(`/reproducao/protocolos${editando ? `/${editando}` : ""}`, {
                    nome,
                    ...(!editando&&origemVersaoId?{origemVersaoId}:{}),
                    versao,
                    publicado,
                    etapas: etapas.map(etapaParaCadastro),
                  }, editando ? "PATCH" : "POST");
                else if (novo === "participantes" && detalhe)
                  await reqIatf(
                    `/reproducao/programacoes/${detalhe.id}/participantes`,
                    {
                      chave: chaveProgramacao,
                      propriedadeId: prop(),
                      cienciaSanitaria,
                      animais: selecionados.map((animalId) => ({
                        animalId,
                        inicioPrevisto: dataHoraISO(inicio),
                      })),
                    },
                  );
                else
                  await reqIatf("/reproducao/programacoes", {
                    chave: chaveProgramacao,
                    propriedadeId: prop(),
                    nome,
                    cienciaSanitaria,
                    protocoloId,
                    inicioPrevisto: dataHoraISO(inicio),
                    animais: selecionados.map((animalId) => ({ animalId })),
                  });
                if (contextoAtual.current !== contexto) return;
                setNovo(null);
                await carregar();
                if (detalhe) await abrir(detalhe.id);
              });
            }}
          >
            <ErrorBox erro={erro} />
            {novo !== "participantes" && (
              <label className="text-sm">
                Nome
                <input
                  className={classeInput}
                  required
                  minLength={2}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </label>
            )}
            {novo === "protocolo" ? (
              <>
                <label className="text-sm">
                  Versão
                  <input
                    type="number"
                    required
                    min={1}
                    className={classeInput}
                    value={versao}
                    readOnly={!!editando}
                    onChange={(e) => setVersao(Number(e.target.value))}
                  />
                </label>
                <label className="text-sm">
                  <input
                    type="checkbox"
                    checked={publicado}
                    onChange={(e) => setPublicado(e.target.checked)}
                  />{" "}
                  Publicar versão fixa
                </label>
                <p className="text-sm text-ink-3">
                  Defina os intervalos desde o início efetivo. Não há doses ou
                  recomendações clínicas predefinidas.
                </p>
                {etapas.map((t, i) => (
                  <fieldset
                    className="grid gap-3 rounded-lg border border-border p-3"
                    key={i}
                  >
                    <legend>Etapa {i + 1}</legend>
                    <label>
                      Nome
                      <input
                        className={classeInput}
                        required
                        value={t.nome}
                        onChange={(e) =>
                          setEtapas(
                            etapas.map((x, j) =>
                              j === i ? { ...x, nome: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Ação
                      <select
                        className={classeInput}
                        value={t.tipo}
                        onChange={(e) =>
                          setEtapas(
                            etapas.map((x, j) =>
                              j === i
                                ? {
                                    nome: x.nome,
                                    intervalo: x.intervalo,
                                    unidade: x.unidade,
                                    tipo: e.target.value as EtapaIatf["tipo"],
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        {[
                          ["APLICACAO", "Aplicação"],
                          ["MANEJO", "Manejo"],
                          ["RETIRADA", "Retirada de dispositivo"],
                          ["TENTATIVA", "Tentativa"],
                          ["AVALIACAO", "Exame reprodutivo"],
                          ["EXAME", "Exame sanitário"],
                        ].map(([v, r]) => (
                          <option key={v} value={v}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Intervalo desde o início
                      <input
                        type="number"
                        min={0}
                        required
                        className={classeInput}
                        value={t.intervalo}
                        onChange={(e) =>
                          setEtapas(
                            etapas.map((x, j) =>
                              j === i
                                ? { ...x, intervalo: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Unidade
                      <select
                        className={classeInput}
                        value={t.unidade}
                        onChange={(e) =>
                          setEtapas(
                            etapas.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    unidade: e.target.value as "DIAS" | "HORAS",
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="DIAS">Dias</option>
                        <option value="HORAS">Horas</option>
                      </select>
                    </label>
                    <OrientacaoTemporalEtapa etapa={t} onChange={novo=>setEtapas(etapas.map((x,j)=>j===i?novo:x))}/>
                    <PlanoEtapa
                      etapa={t}
                      produtos={produtos}
                      materiais={materiais}
                      onChange={(novo) =>
                        setEtapas(etapas.map((x, j) => (j === i ? novo : x)))
                      }
                    />
                    {etapas.length > 1 && (
                      <Button
                        secondary
                        type="button"
                        onClick={() =>
                          setEtapas(etapas.filter((_, j) => j !== i))
                        }
                      >
                        Remover etapa
                      </Button>
                    )}
                  </fieldset>
                ))}
                <Button
                  secondary
                  type="button"
                  onClick={() =>
                    setEtapas([
                      ...etapas,
                      {
                        nome: "",
                        tipo: "MANEJO",
                        intervalo: 0,
                        unidade: "DIAS",
                      },
                    ])
                  }
                >
                  + Adicionar etapa
                </Button>
              </>
            ) : (
              <>
                {novo !== "participantes" && (
                  <label className="text-sm">
                    Versão publicada
                    <select
                      className={classeInput}
                      required
                      value={protocoloId}
                      onChange={(e) => setProtocoloId(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {protocolos
                        .filter((p) => p.publicado && p.ativo !== false)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome} · v{p.versao}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <CampoDataIatf rotulo="Início previsto" valor={inicio} onChange={setInicio} />
                <label className="text-sm">
                  <input
                    type="checkbox"
                    checked={cienciaSanitaria}
                    onChange={(e) => setCienciaSanitaria(e.target.checked)}
                  />{" "}
                  Confirmo ciência dos alertas sanitários configurados para
                  estes animais, quando aplicáveis.
                </label>
                {(animaisIndicadosInicialmente?.length ?? 0) > 100 && <p className="text-sm">
                  A programação aceita até 100 animais. Revise este subconjunto; os demais indicados continuam disponíveis para outra programação.
                </p>}
                <p className="text-sm">
                  Participantes: {selecionados.length}/100
                </p>
                {animais
                  .filter(
                    (a) =>
                      novo !== "participantes" ||
                      !detalhe?.participantes.some(
                        (p) => p.animalId === a.animalId && !p.encerradoEm,
                      ),
                  )
                  .map((a) => (
                    <label key={a.animalId} className="text-sm">
                      <input
                        type="checkbox"
                        checked={selecionados.includes(a.animalId)}
                        disabled={
                          !selecionados.includes(a.animalId) &&
                          selecionados.length >= 100
                        }
                        onChange={(e) =>
                          setSelecionados(
                            e.target.checked
                              ? [...selecionados, a.animalId]
                              : selecionados.filter((id) => id !== a.animalId),
                          )
                        }
                      />{" "}
                      {a.brinco} {a.nome}
                    </label>
                  ))}
              </>
            )}
          </form>
        </PainelCadastro>
      )}
      {acao && (
        <PainelCadastro
          aberto
          titulo={
            acao.tipo === "inicio"
              ? "Confirmar início efetivo"
              : acao.tipo === "retirada"
                ? "Retirar participação"
                : "Revisar data da etapa"
          }
          onFechar={() => setAcao(null)}
          bloqueado={ocupado}
          rodape={
            <>
              <Button secondary onClick={() => setAcao(null)}>
                Cancelar
              </Button>
              <Button type="submit" form="acao-iatf" disabled={ocupado}>
                Confirmar
              </Button>
            </>
          }
        >
          <form
            id="acao-iatf"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void executar(async () => {
                await reqIatf(
                  `/reproducao/${acao.tipo === "revisao" ? "tarefas-iatf" : "participantes-iatf"}/${acao.id}/${acao.tipo === "inicio" ? "inicio" : acao.tipo === "retirada" ? "retirada" : "reprogramacao"}`,
                  acao.tipo === "inicio"
                    ? {
                        propriedadeId: prop(),
                        inicioEfetivo: dataHoraISO(dataHora),
                        cienciaSanitaria,
                      }
                    : acao.tipo === "retirada"
                      ? { propriedadeId: prop(), motivo }
                      : {
                          propriedadeId: prop(),
                          previstaEm: dataHoraISO(dataHora),
                          motivo,
                        },
                );
                setAcao(null);
                if (detalhe) await abrir(detalhe.id);
              });
            }}
          >
            <ErrorBox erro={erro} />
            {acao.tipo !== "retirada" && (
              <CampoDataIatf rotulo="Data" valor={dataHora} onChange={setDataHora} />
            )}
            {acao.tipo === "inicio" && (
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={cienciaSanitaria}
                  onChange={(e) => setCienciaSanitaria(e.target.checked)}
                />{" "}
                Ciência dos alertas sanitários configurados, quando aplicáveis.
              </label>
            )}
            {acao.tipo !== "inicio" && (
              <>
                <p className="text-sm">
                  Esta revisão altera somente a etapa selecionada. As demais
                  datas exigem revisão individual.
                </p>
                <label className="text-sm">
                  Motivo
                  <input
                    className={classeInput}
                    minLength={5}
                    required
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </label>
              </>
            )}
          </form>
        </PainelCadastro>
      )}
      {execucao && painel && (
        <ExecucaoIatf
          propriedadeId={sitioEfetivo}
          tarefa={execucao.tarefa}
          animalId={execucao.animalId}
          painel={painel}
          onFechar={() => setExecucao(null)}
          onSalvo={() => {
            setExecucao(null);
            void Promise.all([detalhe ? abrir(detalhe.id) : Promise.resolve(), onMudou?.()]);
          }}
        />
      )}
    </div>
  );
}

function ExecucaoIatf({
  propriedadeId,
  tarefa,
  animalId,
  painel,
  onFechar,
  onSalvo,
}: {
  propriedadeId: number | null;
  tarefa: TarefaIatf;
  animalId: string;
  painel: PainelReprodutivo;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [realizada, setRealizada] = useState("");
  const [motivo, setMotivo] = useState("");
  const [preparado, setPreparado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [chave] = useState(() => crypto.randomUUID());
  const registrar = async (dados: object) => {
    if (!propriedadeId) throw new Error("Selecione um sítio.");
    await reqV4(`/reproducao/tarefas-iatf/${tarefa.id}/execucao`, {
      propriedadeId,
      chave,
      realizadaEm: dataHoraISO(realizada),
      dados,
      motivo: motivo || undefined,
    }, "POST", propriedadeId);
  };
  if (preparado && tarefa.tipo === "APLICACAO" && propriedadeId)
    return (
      <FormAplicacaoServico
        animalId={animalId}
        propriedadeId={propriedadeId}
        onFechar={onFechar}
        onSalvo={onSalvo}
        onRegistrar={registrar}
        dataInicial={realizada.slice(0, 10)}
        momentoIatf={realizada}
        conteudoExtra={
          <>
            <DetalheEtapa tarefa={tarefa} />
            <label className="text-sm">
              Motivo de desvio, quando alterar data ou parâmetros
              <input
                className={classeInput}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                minLength={5}
              />
            </label>
          </>
        }
      />
    );
  if (preparado && tarefa.tipo === "EXAME") return <FormFatoSanitario tipo="exame" animalInicial={animalId} fixo onFechar={onFechar} onSalvo={onSalvo} onRegistrar={registrar} dataInicial={realizada.slice(0,10)} conteudoExtra={<><DetalheEtapa tarefa={tarefa} /><label>Motivo do desvio<input className={classeInput} value={motivo} onChange={e => setMotivo(e.target.value)} /></label></>} />;
  if (preparado && (tarefa.tipo === "TENTATIVA" || tarefa.tipo === "AVALIACAO"))
    return (
      <FormReproducao
        acao={tarefa.tipo === "TENTATIVA" ? "tentativa" : "avaliacao"}
        painel={painel}
        animalInicial={animalId}
        tipoExameInicial={tarefa.planejadoSnapshot?.etapa.planoAvaliacao?.tipoExameId}
        finalidadeInicial={tarefa.planejadoSnapshot?.etapa.planoAvaliacao?.tipo}
        onFechar={onFechar}
        onSalvo={onSalvo}
        onRegistrar={registrar}
        dataInicial={realizada.slice(0, 10)}
        conteudoExtra={
          <>
            <DetalheEtapa tarefa={tarefa} />
            <label className="text-sm">
              Motivo de desvio, quando alterar data ou parâmetros
              <input
                className={classeInput}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                minLength={5}
              />
            </label>
          </>
        }
      />
    );
  return (
    <PainelCadastro
      aberto
      titulo={`Executar ${tarefa.nome ?? tarefa.tipo}`}
      onFechar={onFechar}
      bloqueado={ocupado}
      rodape={
        <>
          <Button secondary onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="execucao-iatf" disabled={ocupado}>
            Continuar
          </Button>
        </>
      }
    >
      <form
        id="execucao-iatf"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (["APLICACAO", "TENTATIVA", "AVALIACAO", "EXAME"].includes(tarefa.tipo)) {
            setPreparado(true);
            return;
          }
          setOcupado(true);
          registrar({ observacao: motivo || undefined })
            .then(onSalvo)
            .catch((e) => setErro(e.message))
            .finally(() => setOcupado(false));
        }}
      >
        <ErrorBox erro={erro} />
        <p className="text-sm">
          Planejado: {tarefa.previsaoPendente ? "Previsão a definir: início sem horário" : horarioIatf(tarefa.previstaEm, tarefa.precisaoTemporal)}. A execução não desloca as
          próximas etapas.
        </p>
        <DetalheEtapa tarefa={tarefa} />
        <CampoDataIatf rotulo="Data realizada" valor={realizada} onChange={setRealizada} />
        <label className="text-sm">
          Motivo do desvio, se houver
          <input
            className={classeInput}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
      </form>
    </PainelCadastro>
  );
}

function PlanoEtapa({
  etapa,
  produtos,
  materiais,
  onChange,
}: {
  etapa: EtapaIatf;
  produtos: ProdutoDTO[];
  materiais: MaterialGeneticoDTO[];
  onChange: (e: EtapaIatf) => void;
}) {
  const [exames, setExames] = useState<TipoExame[]>([]);
  const [erroExames, setErroExames] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    if (["EXAME", "AVALIACAO"].includes(etapa.tipo)) {
      setExames([]); setErroExames(null);
      (etapa.tipo === "EXAME" ? reqSanidade<TipoExame[]>("/tipos-exame") : reqV4<TipoExame[]>("/reproducao/tipos-exame"))
        .then(itens => { if (ativo) setExames(itens); }).catch(e => { if (ativo) setErroExames(e.message); });
    }
    return () => { ativo = false; };
  }, [etapa.tipo]);
  if (etapa.tipo === "EXAME") return <><ErrorBox erro={erroExames} /><label>Exame sanitário planejado<select className={classeInput} value={etapa.planoExame?.tipoExameId ?? ""} onChange={e => onChange({ ...etapa, planoExame: e.target.value ? { tipoExameId: e.target.value } : undefined })}><option value="">Selecione o exame</option>{exames.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label></>;
  if (etapa.tipo === "APLICACAO") {
    const p = etapa.planoAplicacao;
    const alterar = (
      campos: Partial<NonNullable<EtapaIatf["planoAplicacao"]>>,
    ) =>
      onChange({
        ...etapa,
        planoAplicacao: {
          produtoId: p?.produtoId ?? "",
          dose: p?.dose ?? "",
          unidadeDose: p?.unidadeDose ?? "ML",
          via: p?.via ?? null,
          ...campos,
        },
      });
    return (
      <div className="col-span-full grid gap-3 sm:grid-cols-2">
        <p className="col-span-full text-sm">
          Informe os parâmetros definidos pelo responsável. Planejar não aplica
          nem consome estoque.
        </p>
        <label>
          Produto planejado
          <select
            className={classeInput}
            value={p?.produtoId ?? ""}
            onChange={(e) => {
              const produto = produtos.find((p) => p.id === e.target.value);
              if (!produto) {
                onChange({ ...etapa, planoAplicacao: undefined });
                return;
              }
              alterar({ produtoId: produto.id, unidadeDose: produto.unidade });
            }}
          >
            <option value="">Não definido</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dose planejada
          <input
            className={classeInput}
            type="number"
            min="0.001"
            step="0.001"
            value={p?.dose ?? ""}
            required={!!p}
            onChange={(e) => alterar({ dose: e.target.value })}
          />
        </label>
        <label>
          Unidade da dose
          <select
            className={classeInput}
            value={p?.unidadeDose ?? "ML"}
            onChange={(e) =>
              alterar({ unidadeDose: e.target.value as UnidadeMedida })
            }
          >
            {Object.entries(UNIDADES).map(([u, r]) => (
              <option key={u} value={u}>
                {r.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Via planejada
          <input
            className={classeInput}
            value={p?.via ?? ""}
            onChange={(e) => alterar({ via: e.target.value || null })}
          />
        </label>
      </div>
    );
  }
  if (etapa.tipo === "TENTATIVA") {
    const p = etapa.planoTentativa;
    const alterar = (
      campos: Partial<NonNullable<EtapaIatf["planoTentativa"]>>,
    ) =>
      onChange({
        ...etapa,
        planoTentativa: {
          tipo: p?.tipo ?? "IA",
          materialId: p?.materialId ?? "",
          quantidade: p?.quantidade ?? 0,
          ...campos,
        },
      });
    return (
      <div className="col-span-full grid gap-3 sm:grid-cols-2">
        <label>
          Tentativa planejada
          <select
            className={classeInput}
            value={p?.tipo ?? "IA"}
            onChange={(e) =>
              alterar({ tipo: e.target.value as "IA" | "TE", materialId: "" })
            }
          >
            <option value="IA">Inseminação artificial</option>
            <option value="TE">Transferência de embrião</option>
          </select>
        </label>
        <label>
          Material planejado
          <select
            className={classeInput}
            value={p?.materialId ?? ""}
            onChange={(e) => {
              if (!e.target.value) {
                onChange({ ...etapa, planoTentativa: undefined });
                return;
              }
              alterar({ materialId: e.target.value });
            }}
          >
            <option value="">Não definido</option>
            {materiais
              .filter(
                (m) =>
                  m.produto.ativo &&
                  m.tipo === ((p?.tipo ?? "IA") === "IA" ? "SEMEN" : "EMBRIAO"),
              )
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.produto.nome}
                </option>
              ))}
          </select>
        </label>
        <label>
          Quantidade planejada
          <input
            className={classeInput}
            type="number"
            min="0.001"
            step="0.001"
            required={!!p}
            value={p?.quantidade || ""}
            onChange={(e) => alterar({ quantidade: Number(e.target.value) })}
          />
        </label>
      </div>
    );
  }
  if (etapa.tipo === "AVALIACAO")
    return (
      <div className="col-span-full grid gap-3">
      <ErrorBox erro={erroExames} />
      <label>Tipo de exame reprodutivo<select className={classeInput} value={etapa.planoAvaliacao?.tipoExameId ?? ""} onChange={e => onChange({ ...etapa, planoAvaliacao: { tipo: etapa.planoAvaliacao?.tipo ?? "DIAGNOSTICO", tipoExameId: e.target.value || undefined } })}>
        <option value="">Avaliação reprodutiva padrão (compatibilidade)</option>
        {exames.filter(t => t.tipoResultado === "MULTIPLO").map(t => <option key={t.id} value={t.id}>{t.nome} · v{t.versaoFormato ?? 1}</option>)}
      </select></label>
      <label>
        Avaliação planejada
        <select
          className={classeInput}
          value={etapa.planoAvaliacao?.tipo ?? ""}
          onChange={(e) =>
            onChange({
              ...etapa,
              planoAvaliacao: e.target.value
                ? {
                    tipoExameId: etapa.planoAvaliacao?.tipoExameId,
                    tipo: e.target.value as
                      | "DIAGNOSTICO"
                      | "RECONFIRMACAO"
                      | "SEXAGEM",
                  }
                : undefined,
            })
          }
        >
          <option value="">Não definida</option>
          <option value="DIAGNOSTICO">
            Diagnóstico, resultado a registrar
          </option>
          <option value="RECONFIRMACAO">
            Reconfirmação de gestação conhecida
          </option>
          <option value="SEXAGEM">Sexagem de gestação conhecida</option>
        </select>
      </label></div>
    );
  return (
    <p className="col-span-full text-sm">
      A confirmação registra esta ação com horário e autoria. Não implica
      aplicação de medicamento.
    </p>
  );
}
const nomesCampos: Record<string, string> = {
  dataHora: "Data e hora",
  data: "Data",
  produtoId: "Produto",
  dose: "Dose",
  unidadeDose: "Unidade",
  via: "Via",
  tipoTentativa: "Tentativa",
  materialId: "Material genético",
  quantidade: "Quantidade",
  tipoAvaliacao: "Finalidade do exame",
  tipoExameId: "Tipo de exame",
};
function DetalheEtapa({ tarefa }: { tarefa: TarefaIatf }) {
  const plano = tarefa.planejadoSnapshot?.etapa;
  const referencias = tarefa.planejadoSnapshot?.referencias;
  const produto = referencias?.produto as { nome?: string } | undefined,
    material = referencias?.material as { produtoNome?: string } | undefined;
  const exame = referencias?.exame as { id?: string; nome?: string; versao?: number } | undefined;
  const apresentacao = (campo: string, v: unknown) => {
    if (v === null || v === undefined) return "Não informado";
    if (campo === "tipoExameId" && v === exame?.id) return `${exame.nome ?? "Exame planejado"} · v${exame.versao ?? 1}`;
    if (campo === "dataHora" && typeof v === "string") return horarioIatf(v);
    return String(v);
  };
  return (
    <details className="w-full min-w-0 text-sm">
      <summary className="cursor-pointer">Planejamento e execução</summary>
      <div className="space-y-2 py-2">
        {plano?.planoAplicacao && (
          <p>
            Planejado: {produto?.nome ?? "Produto referenciado"} ·{" "}
            {plano.planoAplicacao.dose}{" "}
            {UNIDADES[plano.planoAplicacao.unidadeDose]?.rotulo} · via{" "}
            {plano.planoAplicacao.via ?? "não informada"}
          </p>
        )}
        {plano?.planoTentativa && (
          <p>
            Planejado: {plano.planoTentativa.tipo} ·{" "}
            {material?.produtoNome ?? "Material referenciado"} · quantidade{" "}
            {plano.planoTentativa.quantidade}
          </p>
        )}
        {plano?.planoAvaliacao && (
          <p>
            Exame previsto: {exame?.nome ?? "Avaliação reprodutiva padrão"}{exame?.versao ? ` · v${exame.versao}` : ""}. Finalidade: {plano.planoAvaliacao.tipo}. O resultado é registrado após atendimento.
          </p>
        )}
        {!plano && (
          <p>
            Planejamento histórico não aferível. Execução exige documentação do
            motivo.
          </p>
        )}
        {tarefa.realizadaEm && (
          <p>Realizada: {horarioIatf(tarefa.realizadaEm, tarefa.precisaoRealizacao ?? tarefa.realizadoSnapshot?.precisaoRealizacao ?? "HORA")}</p>
        )}
        {tarefa.desviosSnapshot?.orientacaoTemporal?.estado==="FORA"&&<p role="status" className="rounded border border-amber-500 p-3">Alerta de intervalo: execução fora da tolerância configurada nesta etapa. Alvo: {tarefa.desviosSnapshot.orientacaoTemporal.previstaPara?horarioIatf(tarefa.desviosSnapshot.orientacaoTemporal.previstaPara,"HORA"):"não informado"}. Esse alerta não altera o calendário.</p>}
        {tarefa.desviosSnapshot?.orientacaoTemporal?.estado==="NAO_AFERIVEL"&&<p>Intervalo não aferível: a hora da referência válida ou da execução não foi informada.</p>}
        {tarefa.desviosSnapshot?.horarioAferido === false && !tarefa.desviosSnapshot.orientacaoTemporal && <p>{tarefa.planejadoSnapshot?.previsaoPendente ? "Data prevista e horário não aferidos: início sem horário conhecido." : "Horário não aferido: planejamento ou realização sem horário conhecido."}</p>}
        {tarefa.desviosSnapshot && (
          <p>
            {!tarefa.desviosSnapshot.aferido
              ? "Desvio não aferido por falta de planejamento completo"
              : tarefa.desviosSnapshot.diferencas.length
                ? "Execução com desvio documentado"
                : tarefa.desviosSnapshot.horarioAferido === false ? "Parâmetros comparáveis sem desvio; horário não aferido" : "Parâmetros realizados conforme planejamento"}
          </p>
        )}
        {!!tarefa.desviosSnapshot?.diferencas.length && (
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">Campo</th>
                  <th className="text-left">Planejado</th>
                  <th className="text-left">Realizado</th>
                </tr>
              </thead>
              <tbody>
                {tarefa.desviosSnapshot.diferencas.map((d) => (
                  <tr key={d.campo}>
                    <td>{nomesCampos[d.campo] ?? d.campo}</td>
                    <td className="break-all">
                      {apresentacao(d.campo, d.planejado)}
                    </td>
                    <td className="break-all">
                      {apresentacao(d.campo, d.realizado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tarefa.desviosSnapshot?.motivo && (
          <p>Motivo: {tarefa.desviosSnapshot.motivo}</p>
        )}
      </div>
    </details>
  );
}

function OrientacaoTemporalEtapa({etapa,onChange}:{etapa:EtapaIatf;onChange:(e:EtapaIatf)=>void}){
 const r=etapa.orientacaoTemporal;const mudar=(v:Partial<NonNullable<EtapaIatf["orientacaoTemporal"]>>)=>r&&onChange({...etapa,orientacaoTemporal:{...r,...v}});
 return <fieldset className="space-y-2 rounded border p-3"><legend>Orientação temporal desta etapa</legend><label className="flex gap-2"><input type="checkbox" checked={!!r} onChange={e=>onChange({...etapa,orientacaoTemporal:e.target.checked?{versao:1,efeito:"ALERTA",referencia:"INICIO_EFETIVO",intervaloHoras:etapa.unidade==="HORAS"?etapa.intervalo:etapa.intervalo*24,toleranciaAntesMinutos:0,toleranciaDepoisMinutos:0}:undefined})}/>Configurar alerta de intervalo</label>{r&&<><label>Referência<select className={classeInput} value={r.referencia} onChange={e=>mudar({referencia:e.target.value as typeof r.referencia})}><option value="INICIO_EFETIVO">Início efetivo</option><option value="ETAPA_ANTERIOR">Execução válida da etapa anterior</option></select></label>{([["intervaloHoras","Intervalo (horas)"],["toleranciaAntesMinutos","Tolerância antes (minutos)"],["toleranciaDepoisMinutos","Tolerância depois (minutos)"]] as const).map(([campo,label])=><label key={campo}>{label}<input className={classeInput} type="number" required min={0} step={campo==="intervaloHoras"?"any":1} value={r[campo]} onChange={e=>mudar({[campo]:Number(e.target.value)})}/></label>)}<p className="text-sm">Alerta apenas. Sem a hora da referência ou da execução, o intervalo fica não aferível. A orientação não altera as próximas etapas.</p></>}</fieldset>;
}
