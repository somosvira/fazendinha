import { AjudaCampo } from "../../../components/Dica";
import { ParticipacoesProgramacao } from "./ParticipacoesProgramacao";
import { BarraConsulta } from "../../../financeiro/BarraConsulta";
import { BuscaLista } from "../../../components/BuscaLista";
import { CampoFiltro } from "../../../financeiro/PainelFiltros";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { useRascunhoConsulta } from "../../../financeiro/useRascunhoConsulta";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "../../../components/VisualizacaoConsulta";
import { CartaoProtocoloReprodutivo, LinkReproducao } from "./ConsultaReproducaoUI";
import { useConsultaCadastroProtocolos } from "../protocolos/useConsultaCadastroProtocolos";
import { urlCadastroProtocolo } from "../protocolos/rotas-cadastro";
import "../protocolos/protocolos.css";
import { SeletorCatalogoProtocolo } from "../protocolos/SeletorCatalogoProtocolo";
import { type ReferenciasCustoCadastro } from "../protocolos/CamposReferenciasCusto";
import { listarCadastrosProtocolos, type CadastroProtocoloMeta } from "../protocolos/cadastros-api";
import { CatalogoModelosProtocolos } from "../protocolos/CatalogoModelosProtocolos";
import { momentoParaCadastro, type MomentoCadastro, type SubtipoAplicacaoCadastro } from "../protocolos/CamposMomentoAcao";
import { GestaoParticipantes } from "../protocolos/GestaoParticipantes";
import { obterCabecalhoProtocolo, reqProtocolo, consultaProtocolo, type CabecalhoProtocolo, type TarefaOperacional } from "../protocolos/api";
import { SeletorVersaoProtocolo } from "../protocolos/SeletorVersaoProtocolo";
import { ListaRascunho } from "../protocolos/ListaRascunho";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
import { OperacaoProtocolo } from "../protocolos/OperacaoProtocolo";
import {BibliotecaReprodutiva} from "./BibliotecaReprodutiva";
import { CampoDataIatf, dataHoraISO, horarioIatf, inputHorarioIatf } from "./CampoDataIatf";
export { dataHoraISO, horarioIatf, inputHorarioIatf } from "./CampoDataIatf";
import { navegarPara } from "../../../router";
import { RegularizarOrigem, consumoMantidoUltimaAnulacao } from "./RegularizarOrigem";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
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
import { type UnidadeMedida } from "../../../lib/unidades";
export type EtapaIatf = {
  chaveEdicao?: string;
  tentativaTipo?: "IA" | "TE";
  referenciasCusto?: ReferenciasCustoCadastro;
  ordem?: number;
  momento?: MomentoCadastro;
  subtipo?: SubtipoAplicacaoCadastro;
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
    tipoAplicacaoId?: string | null;
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
export function etapaParaCadastro(e: EtapaIatf, contratoNovo = false): EtapaIatf {
  return {
    referenciasCusto:e.referenciasCusto, nome: e.nome, tipo: e.tipo, intervalo: e.intervalo, unidade: e.unidade,
    ...(e.momento ? { momento: momentoParaCadastro(e.momento) } : {}),
    ...(e.tipo === "APLICACAO" && e.subtipo ? { subtipo: e.subtipo } : {}),
    ...(e.orientacaoTemporal ? {orientacaoTemporal:e.orientacaoTemporal} : {}),
    ...(e.tipo === "APLICACAO" && e.planoAplicacao ? { planoAplicacao: { produtoId: e.planoAplicacao.produtoId, dose: e.planoAplicacao.dose, unidadeDose: e.planoAplicacao.unidadeDose, via: e.planoAplicacao.via, ...(e.planoAplicacao.tipoAplicacaoId ? { tipoAplicacaoId: e.planoAplicacao.tipoAplicacaoId } : {}) } } : {}),
    ...(e.tipo === "TENTATIVA" && e.tentativaTipo && !e.planoTentativa ? { tentativaTipo: e.tentativaTipo } : {}),
    ...(e.tipo === "TENTATIVA" && contratoNovo ? { tentativaTipo: e.tentativaTipo ?? e.planoTentativa?.tipo } : {}),
    ...(e.tipo === "TENTATIVA" && !contratoNovo && e.planoTentativa ? { planoTentativa: { tipo: e.planoTentativa.tipo, materialId: e.planoTentativa.materialId, quantidade: e.planoTentativa.quantidade } } : {}),
    ...(e.tipo === "EXAME" && e.planoExame ? { planoExame: { tipoExameId: e.planoExame.tipoExameId } } : {}),
    ...(e.tipo === "AVALIACAO" && e.planoAvaliacao ? { planoAvaliacao: { tipoExameId: e.planoAvaliacao.tipoExameId, tipo: e.planoAvaliacao.tipo } } : {}),
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
  situacaoOperacional?: TarefaOperacional["situacao"];
  motivoOperacional?: string | null;
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
    protocolos: CadastroProtocoloMeta[];
    protocolosTotal: number; protocolosPagina: number;
    programacoes: CabecalhoProtocolo[];
    total: number; pagina: number;
  } | null>(null);
  const [leitura, setLeitura] = useState<{
    contexto: string;
    carregando: boolean;
    erro: string | null;
  }>({ contexto, carregando: true, erro: null });
  const consultaVisivel = consulta?.contexto === contexto ? consulta : null;
  const protocolos = consultaVisivel?.protocolos ?? [];
  const { pagina: paginaProtocolos, setPagina: setPaginaProtocolos, busca: buscaProtocolos, setBusca: setBuscaProtocolos, situacao: situacaoProtocolos, setSituacao: setSituacaoProtocolos } = useConsultaCadastroProtocolos(modo === "cadastros");
  const programacoes = consultaVisivel?.programacoes ?? [];
  const [buscaProgramacao,setBuscaProgramacao]=useState(()=>new URLSearchParams(window.location.search).get("iatfBusca")??"");
  const [paginaProgramacoes,setPaginaProgramacoes]=useState(()=>Math.max(1,Math.floor(Number(new URLSearchParams(window.location.search).get("iatfPagina"))||1)));
  useEffect(()=>{if(programacaoId||modo!=="operacao")return;const u=new URL(window.location.href);buscaProgramacao?u.searchParams.set("iatfBusca",buscaProgramacao):u.searchParams.delete("iatfBusca");paginaProgramacoes>1?u.searchParams.set("iatfPagina",String(paginaProgramacoes)):u.searchParams.delete("iatfPagina");window.history.replaceState(window.history.state,"",u.pathname+u.search+u.hash);},[buscaProgramacao,paginaProgramacoes,programacaoId,modo]);
  useEffect(()=>{const restaurar=()=>{const p=new URLSearchParams(window.location.search);setBuscaProgramacao(p.get("iatfBusca")??"");setPaginaProgramacoes(Math.max(1,Math.floor(Number(p.get("iatfPagina"))||1)));};window.addEventListener("popstate",restaurar);return()=>window.removeEventListener("popstate",restaurar);},[]);
  const filtradas = programacoes;
  const visual = useVisualizacaoConsulta("visualProtocolosReproducao", "reproducao");
  const [criterios, setCriterios] = useState(() => ({ status: new URLSearchParams(window.location.search).get("iatfStatus") ?? "", ordem: new URLSearchParams(window.location.search).get("iatfOrdem") ?? "RECENTES" }));
  const edicaoProgramacoes = useRascunhoConsulta({ busca: buscaProgramacao, ...criterios }, { busca: "", status: "", ordem: "RECENTES" }, v => {
    setBuscaProgramacao(v.busca); setPaginaProgramacoes(1); setCriterios({ status: v.status, ordem: v.ordem });
    const url = new URL(window.location.href); for (const [k, valor] of [["iatfStatus", v.status], ["iatfOrdem", v.ordem]]) valor ? url.searchParams.set(k, valor) : url.searchParams.delete(k); window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  });
  useEffect(() => { const restaurar = () => { const p = new URLSearchParams(window.location.search); setCriterios(c=>{ const v={ status: p.get("iatfStatus") ?? "", ordem: p.get("iatfOrdem") ?? "RECENTES" }; return JSON.stringify(c)===JSON.stringify(v)?c:v; }); }; window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar); }, []);
  const paginasProgramacoes=Math.max(1,Math.ceil((consultaVisivel?.total ?? 0)/10));
  const paginaLista = consultaVisivel?.pagina ?? paginaProgramacoes;
  const carregando = leitura.contexto !== contexto || leitura.carregando;
  const erroConsulta = leitura.contexto === contexto ? leitura.erro : null;
  const sequenciaConsulta = useRef(0);
  const [detalheCarregado, setDetalheCarregado] = useState<{
    contexto: string;
    valor: CabecalhoProtocolo;
  } | null>(null);
  const detalhe =
    detalheCarregado?.contexto === contexto ? detalheCarregado.valor : null;
  const setDetalhe = (valor: CabecalhoProtocolo | null) =>
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
    "programacao" | "participantes" | null
  >(null);
  const [ocupado, setOcupado] = useState(false);
  const [nome, setNome] = useState("");
  const [cienciaSanitaria, setCienciaSanitaria] = useState(false);
  const [chaveProgramacao, setChaveProgramacao] = useState(() =>
    crypto.randomUUID(),
  );
  const [protocoloId, setProtocoloId] = useState("");
  const [inicio, setInicio] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [operacaoRevisao, setOperacaoRevisao] = useState(0);
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
        modo === "cadastros" ? listarCadastrosProtocolos("REPRODUTIVO", paginaProtocolos, buscaProtocolos, situacaoProtocolos) : Promise.resolve({ itens: [] as CadastroProtocoloMeta[], total: 0, pagina: 1, porPagina: 10 }),
        modo === "cadastros" || programacaoId ? Promise.resolve({ itens: [] as CabecalhoProtocolo[], total: 0, pagina: 1, porPagina: 10 }) : reqProtocolo<{ itens: CabecalhoProtocolo[]; total: number; pagina: number; porPagina: number }>(`/programacoes${consultaProtocolo({ tipo: "REPRODUTIVO", busca: buscaProgramacao, status: criterios.status || undefined, ordem: criterios.ordem === "RECENTES" ? undefined : criterios.ordem, pagina: paginaProgramacoes })}`, sitioEfetivo ?? undefined),
      ]);
      if (atual()) {
        setConsulta({ contexto, protocolos: protocolos.itens, protocolosTotal: protocolos.total, protocolosPagina: protocolos.pagina, programacoes: programacoes.itens, total: programacoes.total, pagina: programacoes.pagina });
        if (modo === "operacao" && !programacaoId && programacoes.pagina !== paginaProgramacoes) setPaginaProgramacoes(programacoes.pagina);
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
  }, [contexto, modo, reqIatf, programacaoId, buscaProgramacao, criterios, paginaProgramacoes, sitioEfetivo, paginaProtocolos, buscaProtocolos, situacaoProtocolos]);
  useEffect(() => {
    setDetalheCarregado(null);
    setLeituraDetalhe(null);
    setNovo(null);
    setAcao(null);
    setErro(null);
    setOcupado(false);
    setProtocoloId("");
    setSelecionados([]);
    setInicio("");
    setNome("");
    setCienciaSanitaria(false);
    setDataHora("");
    setMotivo("");
    void carregar();
    return () => {
      sequenciaConsulta.current++;
      aberturaAtual.current++;
    };
  }, [carregar]);
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
        const resultado = await obterCabecalhoProtocolo({ programacaoId: id }, sitioEfetivo ?? undefined);
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
    [contexto, sitioEfetivo],
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
      if (contextoAtual.current === contexto) { setOperacaoRevisao(v => v + 1); await onMudou?.(); }
    } catch (e) {
      if (contextoAtual.current === contexto) setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (contextoAtual.current === contexto) setOcupado(false);
    }
  };
  const abrirCadastro = (p: CadastroProtocoloMeta, derivar: boolean) => {
    if (!ocupado) navegarPara(urlCadastroProtocolo("REPRODUTIVO", p.id, !derivar));
  };
  return (
    <div className="protocolos-pagina protocolos-superficie space-y-5">
      <ErrorBox erro={erro} />
      {modo !== "operacao" && <BibliotecaReprodutiva propriedadeId={sitioEfetivo} podeLancar={podeLancar} onCopiou={()=>void carregar()}/>}
      {modo === "operacao" && !programacaoId && <Panel>
        <BarraConsulta edicaoFiltros={edicaoProgramacoes} campos={[
          { chave: "busca", conteudo: <CampoFiltro rotulo="Protocolo ou grupo"><input className={classeInput} aria-label="Buscar programação no filtro" value={edicaoProgramacoes.rascunho.busca} onChange={e=>edicaoProgramacoes.editar("busca",e.target.value)}/></CampoFiltro> },
          { chave: "situacao", conteudo: <CampoFiltro rotulo="Situação"><SelectCampo value={edicaoProgramacoes.rascunho.status} onValueChange={v=>edicaoProgramacoes.editar("status",v)}><option value="">Todas</option><option value="ABERTA">Aberta</option><option value="ENCERRADA">Encerrada</option></SelectCampo></CampoFiltro> },
          { chave: "ordem", conteudo: <CampoFiltro rotulo="Ordenar por"><SelectCampo value={edicaoProgramacoes.rascunho.ordem} onValueChange={v=>edicaoProgramacoes.editar("ordem",v)}><option value="RECENTES">Mais recentes</option><option value="NOME">Nome do grupo</option></SelectCampo></CampoFiltro> },
        ].map(c=>({...c,ativo:false,limpar:edicaoProgramacoes.limpar}))} criterios={criterios.status?[{id:"status",rotulo:criterios.status==="ABERTA"?"Aberta":"Encerrada",limpar:()=>{setCriterios(c=>({...c,status:""}));setPaginaProgramacoes(1);const u=new URL(window.location.href);u.searchParams.delete("iatfStatus");window.history.replaceState(window.history.state,"",u.pathname+u.search+u.hash);}}]:[]} acao={<>
          {podeLancar && <Button disabled={!sitioEfetivo || carregando || !!erroConsulta} onClick={() => { setNome(""); setNovo("programacao"); setChaveProgramacao(crypto.randomUUID()); setCienciaSanitaria(false); }}>Programar protocolo</Button>}
          <AlternarVisualizacaoConsulta {...visual} rotulo="Visualização dos protocolos em acompanhamento"/>
        </>}><BuscaLista rotulo="Buscar programação" placeholder="Protocolo ou grupo" valor={buscaProgramacao} onChange={v=>{setBuscaProgramacao(v);setPaginaProgramacoes(1);}}/></BarraConsulta>
        <div className="space-y-3">
          <div className="repro-consulta-titulo"><div><h2>Grupos programados</h2><p>Modelo versionado e participação individual preservados.</p></div></div>
          {carregando && (
            <p role="status" className="rounded-lg bg-muted p-3 text-sm">
              {consultaVisivel
                ? "Atualizando programações… Os dados confirmados continuam visíveis."
                : "Carregando programações…"}
            </p>
          )}
          <ErrorBox erro={erroConsulta} />
          {erroConsulta && <Button secondary onClick={() => void carregar()}>Tentar novamente</Button>}
          <>{visual.modo === "visual" ? <div className="reproducao-cartoes">{filtradas.map(p => <CartaoProtocoloReprodutivo key={p.id} grupo={p} sitio={sitioEfetivo ?? undefined} aoAbrir={() => onAbrirProgramacao ? onAbrirProgramacao(p.id) : void abrir(p.id)}/>)}</div> : <TabelaFinanceira visualizacao="tabela" rotulo="Programações IATF" itens={filtradas} chaveDe={p=>p.id} onAbrir={p => onAbrirProgramacao ? onAbrirProgramacao(p.id) : void abrir(p.id)} colunas={[
            {chave:"nome",titulo:"Programação",principal:true,larguraMinima:200,larguraFlexivel:true,celula:p=><a href={`/pecuaria/reproducao/programacoes/${encodeURIComponent(p.id)}?retorno=${encodeURIComponent(window.location.pathname + window.location.search)}${sitioEfetivo ? `&sitio=${sitioEfetivo}` : ""}`} onClick={e => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); onAbrirProgramacao ? onAbrirProgramacao(p.id) : void abrir(p.id); } }}>{p.nome}</a>},
            {chave:"inicio",titulo:"Início programado",larguraMinima:180,celula:p=>horarioIatf(p.inicioReferencia,p.precisaoTemporal)},
            {chave:"participantes",titulo:"Participantes",larguraMinima:110,celula:p=>p.participantesTotal ?? "—"},
            {chave:"situacao",titulo:"Situação",larguraMinima:120,celula:p=><Pill>{p.status==="ABERTA"?"Aberta":p.status==="ENCERRADA"?"Encerrada":"A conferir"}</Pill>},
            {chave:"acao",titulo:"Ação",acoes:true,larguraMinima:140,celula:p=><LinkReproducao botao sitio={sitioEfetivo ?? undefined} href={`/pecuaria/reproducao/programacoes/${p.id}?retorno=${encodeURIComponent(window.location.pathname+window.location.search)}`} aoAbrir={() => onAbrirProgramacao ? onAbrirProgramacao(p.id) : void abrir(p.id)}>Abrir acompanhamento</LinkReproducao>},
          ]}/>}</>
          {(consultaVisivel?.total ?? 0)>10&&<Paginacao paginaAtual={paginaLista} totalPaginas={paginasProgramacoes} totalItens={consultaVisivel?.total ?? 0} itensPorPagina={10} onPaginaChange={setPaginaProgramacoes} rotulo="programações" idSelect="pagina-programacoes-iatf"/>}
          {!carregando && !erroConsulta && consultaVisivel && !!buscaProgramacao.trim() && !programacoes.length && <Empty>Nenhuma programação encontrada com esta busca. Ajuste os critérios para consultar outras programações.</Empty>}
          {!carregando &&
            !erroConsulta &&
            consultaVisivel &&
            !programacoes.length && !buscaProgramacao.trim() && (
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
        <div className="repro-programacao-detalhe">
          <header className="repro-programacao-identidade"><div><h2>{detalhe.nome}</h2><p>{detalhe.protocolo.nome} · versão {detalhe.protocolo.versao}</p><p>Início de referência: {horarioIatf(detalhe.inicioReferencia, detalhe.precisaoTemporal)}</p></div><Pill>{detalhe.status === "ABERTA" ? "Aberta" : detalhe.status === "ENCERRADA" ? "Encerrada" : "A conferir"}</Pill></header>
          <dl className="repro-programacao-resumo"><div><dt>Participantes</dt><dd>{detalhe.participantesTotal ?? "Não informado"}</dd></div><div><dt>Procedimentos atendidos</dt><dd>{detalhe.contagens.atendidos}</dd></div><div><dt>Procedimentos pendentes</dt><dd>{detalhe.contagens.pendentes}</dd></div></dl>
          <ParticipacoesProgramacao key={`${detalhe.id}:${sitioEfetivo}`} id={detalhe.id} propriedadeId={sitioEfetivo ?? undefined} revisao={operacaoRevisao}/>
          {!onFecharDetalhe && <div className="mb-3 flex justify-end"><Button secondary onClick={() => { aberturaAtual.current++; setLeituraDetalhe(null); setDetalhe(null); }}>Fechar detalhes</Button></div>}
          <OperacaoProtocolo programacaoId={detalhe.id} propriedadeId={sitioEfetivo ?? undefined} podeLancar={podeLancar} revisao={operacaoRevisao}
            acoes={podeLancar && sitioEfetivo != null && detalhe.propriedadeId === sitioEfetivo && detalhe.status === "ABERTA" ? <Button secondary onClick={() => { setNovo("participantes"); setChaveProgramacao(crypto.randomUUID()); setInicio(""); setSelecionados([]); setCienciaSanitaria(false); }}>Adicionar ou reintegrar participantes</Button> : undefined}
            gestao={<GestaoParticipantes key={`${detalhe.id}:${sitioEfetivo}`} id={detalhe.id} propriedadeId={sitioEfetivo ?? undefined} podeLancar={podeLancar && sitioEfetivo != null && detalhe.propriedadeId === sitioEfetivo} revisao={operacaoRevisao} aoRetirar={id => { setAcao({ tipo: "retirada", id }); setMotivo(""); }} />}
            aoSalvar={() => { setOperacaoRevisao(v => v + 1); void Promise.all([detalhe ? abrir(detalhe.id) : Promise.resolve(), onMudou?.()]); }}
            regularizacao={(t, aoSalvar) => t.propriedadeId ? <RegularizarOrigem path={`/reproducao/tarefas-iatf/${t.id}/regularizacao`} propriedadeId={t.tarefaOrigem.propriedadeRegularizacaoId ?? t.propriedadeId} consumoMantido={consumoMantidoUltimaAnulacao(t.tarefaOrigem.historicoRegularizacao)} onMudou={async () => { aoSalvar(); await onMudou?.(); }} /> : null}
          />
        </div>
      )}
      {modo === "cadastros" && <CatalogoModelosProtocolos tipo="REPRODUTIVO" protocolos={protocolos}
        total={consultaVisivel?.protocolosTotal ?? 0} pagina={consultaVisivel?.protocolosPagina ?? paginaProtocolos}
        carregando={carregando} erro={erroConsulta} ocupado={ocupado} podeLancar={podeLancar}
        busca={buscaProtocolos} situacao={situacaoProtocolos}
        onBusca={valor=>{setBuscaProtocolos(valor);setPaginaProtocolos(1);}}
        onSituacao={valor=>{setSituacaoProtocolos(valor);setPaginaProtocolos(1);}} onPagina={setPaginaProtocolos}
        onRecarregar={()=>void carregar()} onNovo={()=>navegarPara(urlCadastroProtocolo("REPRODUTIVO"))}
        onNovaVersao={p=>abrirCadastro(p,true)} onConcluir={p=>abrirCadastro(p,false)}
        onInativar={p=>void executar(async()=>{await reqIatf(`/reproducao/protocolos/${p.id}/inativar`,{});await carregar();})}/>}
      {novo && (
        <PainelCadastro
          aberto
          largura="sm:max-w-3xl"
          titulo="Nova programação IATF"
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
                if (novo === "participantes" && detalhe)
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
            {(
              <>
                {novo !== "participantes" && (
                  <SeletorVersaoProtocolo tipo="REPRODUTIVO" rotulo="Versão publicada" valor={protocoloId} propriedadeId={sitioEfetivo ?? undefined} onChange={setProtocoloId} />
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
                <ListaRascunho itens={animais} rotulo="animais disponíveis" texto={a => `${a.brinco} ${a.nome ?? ""}`} renderizar={a => (
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
                  )} />
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

    </div>
  );
}

export function PlanoEtapa({
  etapa,
  propriedadeId,
  contratoNovo,
  tipoDefinido,
  onChange,
}: {
  contratoNovo?: boolean;
  tipoDefinido?: boolean;
  etapa: EtapaIatf;
  propriedadeId?: number;
  onChange: (e: EtapaIatf) => void;
}) {
  if (etapa.tipo === "EXAME") return <SeletorCatalogoProtocolo propriedadeId={propriedadeId} origem="SANITARIO" opcao="TIPO_EXAME" rotulo="Exame sanitário planejado" valor={etapa.planoExame?.tipoExameId ?? ""} onChange={tipoExameId => onChange({ ...etapa, planoExame: tipoExameId ? { tipoExameId } : undefined })}/>;
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
          tipoAplicacaoId: p?.tipoAplicacaoId,
          ...campos,
        },
      });
    return (
      <div className="col-span-full grid gap-3 sm:grid-cols-2">
        <p className="col-span-full text-sm">
          Informe os parâmetros definidos pelo responsável. Planejar não aplica
          nem consome estoque.
        </p>
        <SeletorCatalogoProtocolo propriedadeId={propriedadeId} origem="SANITARIO" opcao="PRODUTO" rotulo="Produto planejado" valor={p?.produtoId ?? ""} onChange={(produtoId, produto) => produtoId ? alterar({ produtoId, dose: produtoId === p?.produtoId ? p.dose : "", unidadeDose: produtoId === p?.produtoId ? p.unidadeDose : (produto?.unidade ?? "ML") as UnidadeMedida, via: produtoId === p?.produtoId ? p.via : produto?.perfilSanitario?.viaPadrao ?? null, tipoAplicacaoId: produtoId === p?.produtoId ? p.tipoAplicacaoId : produto?.perfilSanitario?.tipoAplicacaoId ?? null }) : onChange({ ...etapa, planoAplicacao: undefined })}/>
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
          Unidade da dose (do produto)
          <input className={classeInput} readOnly value={p?.produtoId ? p.unidadeDose : ""} />
        </label>
      </div>
    );
  }
  if (etapa.tipo === "TENTATIVA") {
    if (contratoNovo) return <div className="col-span-full grid gap-3">{!tipoDefinido && <label>Procedimento de reprodução<select required className={classeInput} value={etapa.tentativaTipo ?? etapa.planoTentativa?.tipo ?? ""} onChange={e => onChange({ ...etapa, tentativaTipo: e.target.value as "IA" | "TE", planoTentativa: undefined })}><option value="" disabled>Selecione o procedimento</option><option value="IA">Inseminação artificial</option><option value="TE">Transferência de embrião</option></select></label>}<p className="text-sm">Material genético e quantidade são obrigatórios no atendimento. Nenhum material é fixado neste modelo.</p></div>;
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
        <SeletorCatalogoProtocolo propriedadeId={propriedadeId} origem="REPRODUTIVO" opcao="MATERIAL" tipoTentativa={p?.tipo ?? "IA"} rotulo="Material planejado" valor={p?.materialId ?? ""} onChange={materialId => materialId ? alterar({ materialId }) : onChange({ ...etapa, planoTentativa: undefined })}/>
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
      <SeletorCatalogoProtocolo propriedadeId={propriedadeId} origem="REPRODUTIVO" opcao="TIPO_EXAME" rotulo="Tipo de exame reprodutivo" valor={etapa.planoAvaliacao?.tipoExameId ?? ""} onChange={tipoExameId => onChange({ ...etapa, planoAvaliacao: { tipo: etapa.planoAvaliacao?.tipo ?? "DIAGNOSTICO", tipoExameId: tipoExameId || undefined } })}/>
      <p className="text-sm">Sem tipo definido, mantém a avaliação reprodutiva padrão de compatibilidade.</p>
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
export function OrientacaoTemporalEtapa({etapa,onChange}:{etapa:EtapaIatf;onChange:(e:EtapaIatf)=>void}){
 const r=etapa.orientacaoTemporal;const mudar=(v:Partial<NonNullable<EtapaIatf["orientacaoTemporal"]>>)=>r&&onChange({...etapa,orientacaoTemporal:{...r,...v}});
 return <fieldset className="space-y-2 rounded border p-3"><legend>Orientação temporal desta etapa <AjudaCampo rotulo="Ajuda sobre orientação temporal" texto="Alerta apenas. Sem a hora da referência ou da execução, o intervalo fica não aferível. A orientação não altera as próximas etapas."/></legend><label className="flex gap-2"><input type="checkbox" checked={!!r} onChange={e=>onChange({...etapa,orientacaoTemporal:e.target.checked?{versao:1,efeito:"ALERTA",referencia:"INICIO_EFETIVO",intervaloHoras:etapa.unidade==="HORAS"?etapa.intervalo:etapa.intervalo*24,toleranciaAntesMinutos:0,toleranciaDepoisMinutos:0}:undefined})}/>Configurar alerta de intervalo</label>{r&&<><label>Referência<select className={classeInput} value={r.referencia} onChange={e=>mudar({referencia:e.target.value as typeof r.referencia})}><option value="INICIO_EFETIVO">Início efetivo</option><option value="ETAPA_ANTERIOR">Execução válida da etapa anterior</option></select></label>{([["intervaloHoras","Intervalo (horas)"],["toleranciaAntesMinutos","Tolerância antes (minutos)"],["toleranciaDepoisMinutos","Tolerância depois (minutos)"]] as const).map(([campo,label])=><label key={campo}>{label}<input className={classeInput} type="number" required min={0} step={campo==="intervaloHoras"?"any":1} value={r[campo]} onChange={e=>mudar({[campo]:Number(e.target.value)})}/></label>)}</>}</fieldset>;
}
