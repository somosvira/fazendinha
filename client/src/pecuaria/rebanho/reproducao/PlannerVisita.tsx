import { Settings2 } from "lucide-react";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import type { ReactNode } from "react";
import { PainelFiltros } from "../../../financeiro/PainelFiltros";
import "./visitas-fluxo.css";
import { descreverCondicaoPreservada } from "./folha-regras";
import { revisaoGrupoPreparado } from "./revisao-preparada";
import { EtapasVisita } from "./EtapasVisita";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, CabecalhoTabela, ErrorBox, Panel } from "../../../financeiro/financeiro-ui";
import { getUsuario } from "../../../lib/auth";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarPara, urlEtapaVisita, type EtapaVisita } from "../../../router";
import { RebanhoApiError } from "../api";
import { SelecaoLivreVisita, InclusaoManualLivre, DefinirAtividadeLivre, type RascunhoAtividadeLivre } from "./SelecaoLivreVisita";
import { criteriosVazios, validarCriterios } from "./EditorSelecaoVisita";
import { CabecalhoContextoVisita, CelulasContextoVisita, contarColunasContextoVisita } from "./ContextoTabelaVisita";
import { carregarPreviaCompleta, chaveGrupo, consultarAgenda, incluirGrupo, previaGrupo, resumoRevisao, type CriteriosSelecao, type GrupoLivreInput, type GrupoPlanner, type GrupoRevisado, type JanelaPlanner, type PreviaPlanner } from "./planner-api";
import { obterVisita, type Visita } from "./visitas-api";

const janelas: [JanelaPlanner, string][] = [["DIA", "Previstos para o dia"], ["ANTERIOR", "Pendências anteriores"], ["SEM_PREVISAO", "Sem previsão"], ["FUTURA", "Datas futuras"]];
const mensagem = (e: unknown) => e instanceof Error ? e.message : String(e);
const identidade = () => String(getUsuario()?.id ?? "sessao");
const chaveEstado = (visita: Visita, modo?: string) => `fazendinha:visitas:${modo ?? "planejamento"}:${identidade()}:${visita.propriedadeId}:${visita.id}`;
type GrupoSelecionado = GrupoRevisado & { conferido?: boolean };
type FiltrosRevisao = { atencao: boolean; ordem: "BRINCO" | "NOME" | "DEL" | "DIAS_TENTATIVA"; desc: boolean };
type ReferenciaPrevia = { conferido?: boolean; grupo: GrupoPlanner["grupo"]; fingerprint: string; excluidos: string[]; chave: string };
type EstadoCompacto = { versao: 1 | 2; data: string; grupos: ReferenciaPrevia[]; revisao?: ReferenciaPrevia; revisoesPendentes?: ReferenciaPrevia[]; desatualizados?: ReferenciaPrevia[]; criterios?: CriteriosSelecao; atividade?: RascunhoAtividadeLivre };
const chaveFiltrosAntigos = (visita: Visita) => `fazendinha:visitas:filtros:${identidade()}:${visita.propriedadeId}:${visita.id}`;
function criteriosGuardados(visita: Visita): CriteriosSelecao {
  const atual = lerEstado(visita, "livre")?.criterios;
  if (atual && !validarCriterios(atual)) return atual;
  try { const antigo = JSON.parse(sessionStorage.getItem(chaveFiltrosAntigos(visita)) ?? "null") as CriteriosSelecao; if (antigo && !validarCriterios(antigo)) return antigo; } catch { /* formato antigo inválido */ }
  return criteriosVazios();
}
const normalizarChaves = (valor: unknown): unknown => Array.isArray(valor) ? valor.map(normalizarChaves) : valor && typeof valor === "object" ? Object.fromEntries(Object.entries(valor).sort(([a],[b]) => a.localeCompare(b)).map(([chave, item]) => [chave, normalizarChaves(item)])) : valor;
const mesmosCriterios = (a: CriteriosSelecao, b: CriteriosSelecao) => JSON.stringify(normalizarChaves(a)) === JSON.stringify(normalizarChaves(b));
const grupoCorresponde = (g: GrupoPlanner["grupo"], criterios: CriteriosSelecao) => g.origem !== "LIVRE" || mesmosCriterios(g.criterios, criterios);
function lerEstado(visita: Visita, modo: "agenda" | "livre"): EstadoCompacto | null {
  try {
    const bruto = sessionStorage.getItem(chaveEstado(visita,modo)) ?? sessionStorage.getItem(chaveEstado(visita));
    if (!bruto) return null;
    const valor = JSON.parse(bruto) as EstadoCompacto;
    if (![1,2].includes(valor?.versao) || !Array.isArray(valor.grupos)) return null;
    const pertence = (r: ReferenciaPrevia) => modo === "agenda" ? ["PROTOCOLO", "RETORNO", "APTIDAO"].includes(r.grupo.origem) : ["LIVRE", "SELECAO", "EXTRA"].includes(r.grupo.origem);
    return { ...valor, grupos: valor.grupos.filter(pertence), revisao: valor.revisao && pertence(valor.revisao) ? valor.revisao : undefined, revisoesPendentes: valor.revisoesPendentes?.filter(pertence), desatualizados: valor.desatualizados?.filter(pertence) };
  } catch { return null; }
}
function salvarEstado(visita: Visita, modo: "agenda" | "livre", grupos: GrupoSelecionado[], revisao: GrupoRevisado | null, revisoesPendentes: ReferenciaPrevia[], desatualizados: ReferenciaPrevia[], criterios?: CriteriosSelecao, atividade?: RascunhoAtividadeLivre | null) {
  const referencia = (r: GrupoSelecionado): ReferenciaPrevia => ({ conferido: r.conferido, grupo: r.previa.grupo.grupo, fingerprint: r.previa.fingerprint, excluidos: r.excluidos, chave: r.chave });
  const pendentes = revisao ? [...revisoesPendentes.filter(r => chaveGrupo(r.grupo) !== chaveGrupo(revisao.previa.grupo.grupo)), referencia(revisao)] : revisoesPendentes;
  const valor: EstadoCompacto = { versao: 2, data: visita.data.slice(0,10), grupos: grupos.map(referencia), ...(revisao ? { revisao: referencia(revisao) } : {}), ...(pendentes.length ? { revisoesPendentes: pendentes } : {}), ...(desatualizados.length ? { desatualizados } : {}), ...(criterios ? { criterios } : {}), ...(atividade ? { atividade } : {}) };
  try { sessionStorage.setItem(chaveEstado(visita,modo), JSON.stringify(valor)); } catch { /* armazenamento indisponível */ }
}

export function PlannerVisita({ visita, podeLancar, propriedadeNome, etapa = "planejamento", grupo = null, onEtapa, onMudou, modo = "agenda" }: {
  visita: Visita;
  podeLancar: boolean;
  propriedadeNome?: string;
  etapa?: EtapaVisita;
  grupo?: string | null;
  onEtapa?: (etapa: EtapaVisita, opcoes?: { grupo?: string; atividade?: string; modo?: "agenda" | "livre" }) => void;
  onMudou?: () => Promise<void>;
  modo?: "agenda" | "livre";
}) {
  const livre = modo === "livre";
  const etapaInicial = livre ? "selecao" : "planejamento";
  const grupoPreparado = livre && (etapa === "revisao" || etapa === "atividade") && grupo ? visita.atividades.map(a => a.contexto?.grupoPlanner as GrupoPlanner["grupo"] | undefined).find(g => g && chaveGrupo(g) === grupo) : undefined;
  const revisaoPreparada = useMemo(() => grupoPreparado ? revisaoGrupoPreparado(visita, grupoPreparado) : null, [visita, grupoPreparado]);
  const criteriosPreparados = grupoPreparado?.origem === "LIVRE" ? grupoPreparado.criterios : undefined;
  const data = visita.data.slice(0, 10), propriedadeId = visita.propriedadeId;
  const sitio = propriedadeNome ? (/^sítio\b/i.test(propriedadeNome) ? propriedadeNome : `Sítio ${propriedadeNome}`) : "Sítio da visita";
  const ir = (para: EtapaVisita, opcoes: { grupo?: string; atividade?: string } = {}) => {
    if (para !== "revisao" && para !== "atividade") geracaoPrevia.current++;
    const destino = livre && para === "planejamento" ? "selecao" : para;
    const parametros = {...opcoes,modo};
    if (onEtapa) onEtapa(destino, parametros); else navegarPara(urlEtapaVisita(visita.id, destino, parametros));
  };
  const [grupos, setGrupos] = useState<GrupoPlanner[]>([]);
  const [janela, setJanela] = useState<JanelaPlanner>("DIA");
  const [erroReferencia,setErroReferencia] = useState<string|null>(null);
  const [erro, setErro] = useState<string | null>(null), [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true), [ocupado, setOcupado] = useState(false);
  const [revisados, setRevisados] = useState<GrupoSelecionado[]>([]);
  const [revisao, setRevisao] = useState<GrupoRevisado | null>(null);
  const [revisoesPendentes, setRevisoesPendentes] = useState<ReferenciaPrevia[]>([]);
  const [desatualizados, setDesatualizados] = useState<ReferenciaPrevia[]>([]);
  const [pagina, setPagina] = useState(1), [busca, setBusca] = useState(""), [ordem, setOrdem] = useState<"BRINCO" | "DEL" | "DIAS_TENTATIVA">("BRINCO"), [desc, setDesc] = useState(false);
  const [filtrosRevisao, setFiltrosRevisao] = useState<FiltrosRevisao | null>(null);
  const [filtroAtencao, setFiltroAtencao] = useState(false), [invalidos, setInvalidos] = useState<string[]>([]);
  const [restaurado, setRestaurado] = useState(false);
  const [criteriosLivres, setCriteriosLivres] = useState(() => criteriosPreparados ?? criteriosGuardados(visita));
  const [atividadeLivre, setAtividadeLivre] = useState<RascunhoAtividadeLivre | null>(() => lerEstado(visita, "livre")?.atividade ?? null);
  const preparacaoLivre = useRef<{conteudo:string;chave:string}|null>(null);
  const geracaoPrevia = useRef(0);
  const geracaoGrupos = useRef(0);
  const ultimaRevisaoLivre = useRef<GrupoRevisado | null>(null);
  const criteriosAtuais = useRef(criteriosLivres);
  criteriosAtuais.current = criteriosLivres;
  const rotaPrevia = useRef({ etapa, grupo });
  useEffect(() => () => { geracaoPrevia.current++; }, []);
  useEffect(() => {
    const anterior = rotaPrevia.current;
    if (anterior.etapa === "revisao" && (etapa !== "revisao" || grupo !== anterior.grupo)) {
      geracaoPrevia.current++;
      setOcupado(false);
    }
    rotaPrevia.current = { etapa, grupo };
  }, [etapa, grupo]);

  const carregarPreviaVisita: typeof carregarPreviaCompleta = async (...args) => {
    const p = await carregarPreviaCompleta(...args);
    return {...p,animais:p.animais.map(a=>({...a,visitasAbertas:a.visitasAbertas.filter(v=>v.id!==visita.id)}))};
  };
  const carregar = useCallback(async () => {
    const atual = ++geracaoGrupos.current;
    setCarregando(true); setErro(null);
    try {
      if (revisaoPreparada) {
        setGrupos([revisaoPreparada.previa.grupo]); setRevisao(revisaoPreparada);
        setRevisados([]); setRestaurado(true); setAviso(null);
        return;
      }
      if (livre) {
        const salvo = lerEstado(visita, modo);
        const referencias = [...(salvo?.grupos ?? []), ...(salvo?.revisoesPendentes ?? []), ...(salvo?.desatualizados ?? []), ...(salvo?.revisao ? [salvo.revisao] : [])].map(r => r.grupo);
        if (grupo) for (const atividade of visita.atividades) {
          const preservado = atividade.contexto?.grupoPlanner as GrupoPlanner["grupo"] | undefined;
          if (preservado && ["LIVRE", "EXTRA", "SELECAO"].includes(preservado.origem) && chaveGrupo(preservado) === grupo) referencias.push(preservado);
        }
        if (grupo && !referencias.some(g => chaveGrupo(g) === grupo)) {
          try { const legado = JSON.parse(grupo) as GrupoPlanner["grupo"]; if (["EXTRA", "LIVRE"].includes(legado.origem)) referencias.push(legado); } catch { if (/^[a-f0-9-]{36}$/.test(grupo)) referencias.push({origem:"SELECAO",selecaoVersaoId:grupo}); }
        }
        const unicos = [...new Map(referencias.map(g => [chaveGrupo(g),g])).values()];
        const resultados = await Promise.allSettled(unicos.map(g => previaGrupo(propriedadeId,data,g)));
        if (atual !== geracaoGrupos.current) return;
        setGrupos(resultados.flatMap(r => r.status === "fulfilled" ? [r.value.grupo] : []));
        if (resultados.some(r=>r.status==="rejected")) setAviso("Alguns grupos salvos não estão mais disponíveis. Ajuste os filtros ou tente recarregar.");
        return;
      }
      const primeira = await consultarAgenda(propriedadeId, data); const todos = [...primeira.grupos];
      if (atual !== geracaoGrupos.current) return;
      for (let p = 2; todos.length < primeira.totalGrupos; p++) {
        const proxima = await consultarAgenda(propriedadeId, data, p);
        if (atual !== geracaoGrupos.current) return;
        if (!proxima.grupos.length) throw new Error("Não foi possível carregar todos os grupos. Atualize o planner.");
        todos.push(...proxima.grupos);
      }
      setGrupos(todos);
    } catch (e) { if (atual === geracaoGrupos.current) setErro(mensagem(e)); }
    finally { if (atual === geracaoGrupos.current) setCarregando(false); }
  }, [propriedadeId, data, livre, modo, visita.id, revisaoPreparada]);
  useEffect(() => { void carregar(); }, [carregar]);

  // O armazenamento guarda somente referências, assinatura e exclusões. Recarrega
  // cada prévia e mantém escolhas apenas se o contexto ainda tiver a mesma assinatura.
  useEffect(() => {
    if (restaurado || carregando || revisaoPreparada) return;
    let vigente = true;
    const geracao = geracaoGrupos.current;
    const criteriosNoInicio = criteriosAtuais.current;
    const podeRestaurar = () => vigente && geracao === geracaoGrupos.current && (!livre || mesmosCriterios(criteriosAtuais.current, criteriosNoInicio));
    const restaurar = async () => {
      const estado = lerEstado(visita,modo); if (!estado) { setRestaurado(true); return; }
      if (estado.data !== data) {
        setDesatualizados([...(estado.desatualizados ?? []), ...estado.grupos, ...(estado.revisoesPendentes ?? []), ...(estado.revisao ? [estado.revisao] : [])]);
        setAviso("A data oficial da visita mudou desde a última revisão. As seleções antigas precisam ser conferidas novamente.");
        setRestaurado(true); return;
      }
      const validos: GrupoSelecionado[] = [];
      const pendentes: ReferenciaPrevia[] = [...(estado.desatualizados ?? [])];
      let alterado = false;
      for (const salvo of estado.grupos) {
        if (!podeRestaurar()) return;
        const disponivel = grupos.find(g => chaveGrupo(g.grupo) === chaveGrupo(salvo.grupo));
        if (!disponivel) { alterado = true; continue; }
        try {
          const previa = await carregarPreviaVisita(propriedadeId, data, disponivel.grupo);
          if (!podeRestaurar()) return;
          if (previa.fingerprint !== salvo.fingerprint) { alterado = true; pendentes.push(salvo); continue; }
          validos.push({ conferido: salvo.conferido ?? true, previa, excluidos: salvo.excluidos.filter(id => previa.animais.some(a => a.animalId === id)), chave: salvo.chave });
        } catch { alterado = true; }
      }
      if (!podeRestaurar()) return;
      setRevisados(validos); setDesatualizados(pendentes); setRestaurado(true);
      setRevisoesPendentes(estado.revisoesPendentes ?? (estado.revisao ? [estado.revisao] : []));
      if (alterado) setAviso("Alguns grupos mudaram desde a revisão. Confira novamente antes de preparar.");
    };
    void restaurar();
    return () => { vigente = false; };
  }, [carregando, grupos, propriedadeId, data, visita, restaurado]);
  useEffect(() => {
    if (revisao && !revisaoPreparada) {
      const atual: ReferenciaPrevia = { grupo: revisao.previa.grupo.grupo, fingerprint: revisao.previa.fingerprint, excluidos: revisao.excluidos, chave: revisao.chave };
      setRevisoesPendentes(pendentes => [...pendentes.filter(r => chaveGrupo(r.grupo) !== chaveGrupo(atual.grupo)), atual]);
    }
  }, [revisao, revisaoPreparada]);
  useEffect(() => {
    if (!restaurado || grupoPreparado || (livre && (etapa === "revisao" || etapa === "atividade") && !revisao)) return;
    salvarEstado(visita, modo, revisados, revisao, revisoesPendentes, desatualizados, livre ? criteriosLivres : undefined, livre ? atividadeLivre : undefined);
  }, [visita, modo, revisados, revisao, revisoesPendentes, desatualizados, restaurado, livre, criteriosLivres, atividadeLivre, grupoPreparado, etapa]);

  function mudarCriteriosLivres(novos: CriteriosSelecao) {
    const anterior = revisao ?? revisados[0] ?? ultimaRevisaoLivre.current;
    if (anterior) ultimaRevisaoLivre.current = anterior;
    const salvo = lerEstado(visita, "livre");
    const referenciaAnterior: ReferenciaPrevia[] = anterior ? [{ grupo: anterior.previa.grupo.grupo, fingerprint: anterior.previa.fingerprint, excluidos: anterior.excluidos, chave: anterior.chave }] : salvo?.revisao ? [salvo.revisao] : salvo?.revisoesPendentes?.length ? salvo.revisoesPendentes : desatualizados;
    criteriosAtuais.current = novos;
    geracaoPrevia.current++;
    geracaoGrupos.current++;
    setCriteriosLivres(novos);
    setRevisao(null);
    setRevisados([]);
    setRevisoesPendentes([]);
    setDesatualizados(referenciaAnterior);
    setOcupado(false); setCarregando(false); setRestaurado(true);
    setErroReferencia(null);
    setAviso("Os filtros mudaram. Revise o grupo atualizado antes de definir a atividade.");
    salvarEstado(visita, "livre", [], null, [], referenciaAnterior, novos, atividadeLivre);
  }
  function novoGrupoLivre() {
    const vazios = criteriosVazios();
    criteriosAtuais.current = vazios;
    geracaoPrevia.current++;
    geracaoGrupos.current++;
    ultimaRevisaoLivre.current = null;
    setCriteriosLivres(vazios); setAtividadeLivre(null); setGrupos([]); setRevisao(null); setRevisados([]); setOcupado(false); setCarregando(false); setRestaurado(true);
    setRevisoesPendentes([]); setDesatualizados([]); setAviso(null); setErroReferencia(null);
    salvarEstado(visita, "livre", [], null, [], [], vazios, null);
  }

  useEffect(() => {
    if ((etapa !== "revisao" && etapa !== "atividade") || !grupo || carregando || ocupado || erro || erroReferencia) return;
    if (revisao && chaveGrupo(revisao.previa.grupo.grupo) === grupo && grupoCorresponde(revisao.previa.grupo.grupo, criteriosLivres)) {setErroReferencia(null);return;}
    const encontrado = grupos.find(g => chaveGrupo(g.grupo) === grupo);
    if (!encontrado) {
      const iniciado = ultimaRevisaoLivre.current?.previa.grupo;
      if (livre && iniciado && chaveGrupo(iniciado.grupo) === grupo && grupoCorresponde(iniciado.grupo, criteriosLivres)) {
        setGrupos([iniciado]);
        return;
      }
      if (restaurado) {
        if (livre) { setAviso("O grupo da URL não corresponde à revisão atual. Confira os filtros e revise novamente."); ir("selecao"); }
        else setErroReferencia("Este grupo não está disponível no contexto atual. Volte aos filtros ou recarregue a agenda.");
      }
      return;
    }
    if (livre && !grupoCorresponde(encontrado.grupo, criteriosLivres)) {
      setRevisao(null);
      setErroReferencia("Os filtros mudaram. Revise o grupo atualizado antes de continuar.");
      ir("selecao");
      return;
    }
    setErroReferencia(null);
    setRevisao(null);
    void abrirRevisao(encontrado, true, etapa === "atividade" ? "atividade" : "revisao");
    // A URL inicia a leitura uma vez. A revisão passa a ser a fonte visual após validar o fingerprint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, grupo, carregando, ocupado, grupos, revisao, restaurado, criteriosLivres, livre, erro, erroReferencia]);

  async function abrirRevisao(g: GrupoPlanner, mostrar = true, destino: EtapaVisita = "revisao") {
    if (livre && !grupoCorresponde(g.grupo, criteriosAtuais.current)) { setErroReferencia("Os filtros mudaram. Revise o grupo atualizado antes de continuar."); ir("selecao"); return; }
    const atual = ++geracaoPrevia.current;
    setOcupado(true); setErro(null);
    try {
      const previa = await carregarPreviaVisita(propriedadeId, data, g.grupo);
      if (atual !== geracaoPrevia.current) return;
      const existente = revisados.find(r => chaveGrupo(r.previa.grupo.grupo) === chaveGrupo(g.grupo));
      const estadoSalvo = lerEstado(visita,modo);
      const salvo = estadoSalvo?.revisoesPendentes?.find(r => chaveGrupo(r.grupo) === chaveGrupo(g.grupo)) ?? estadoSalvo?.revisao;
      const salvarRetido = salvo && chaveGrupo(salvo.grupo) === chaveGrupo(g.grupo) && salvo.fingerprint === previa.fingerprint ? salvo : null;
      const candidato = existente?.previa.fingerprint === previa.fingerprint ? existente : null;
      const obsoleto = estadoSalvo?.desatualizados?.find(r => chaveGrupo(r.grupo) === chaveGrupo(g.grupo)) ?? (salvo && chaveGrupo(salvo.grupo) === chaveGrupo(g.grupo) && salvo.fingerprint !== previa.fingerprint ? salvo : null);
      const retido = salvarRetido ?? (candidato ? { excluidos: candidato.excluidos, chave: candidato.chave } : obsoleto ? { excluidos: obsoleto.excluidos, chave: obsoleto.chave } : null);
      const nova = { previa, excluidos: retido?.excluidos.filter(id => previa.animais.some(a => a.animalId === id)) ?? [], chave: retido?.chave ?? crypto.randomUUID() };
      if (obsoleto) setAviso("O grupo mudou desde a revisão. Exclusões ainda válidas foram mantidas; confira a lista atualizada e salve a revisão para confirmar.");
      if (mostrar) {
        setRevisao(nova); setPagina(1); setBusca(""); setFiltroAtencao(false);
        const exigeRevisao = livre && destino === "atividade" && (!salvarRetido && !candidato || !!obsoleto);
        if (exigeRevisao) { setAviso("A revisão precisa ser conferida com a prévia atual antes de definir a atividade."); ir("revisao", {grupo: chaveGrupo(g.grupo)}); }
        else if (etapa !== "revisao" || grupo !== chaveGrupo(g.grupo)) ir(destino, { grupo: chaveGrupo(g.grupo) });
      } else {
        setRevisados(anteriores => [...anteriores.filter(r => chaveGrupo(r.previa.grupo.grupo) !== chaveGrupo(g.grupo)), { ...nova, conferido: false }]);
      }
    } catch (e) { if (atual === geracaoPrevia.current) setErro(mensagem(e)); }
    finally { if (atual === geracaoPrevia.current) setOcupado(false); }
  }
  function comRevisaoAtual(): GrupoSelecionado[] {
    if (!revisao) return revisados;
    const anterior = revisados.find(r => chaveGrupo(r.previa.grupo.grupo) === chaveGrupo(revisao.previa.grupo.grupo));
    const mesmaExclusao = anterior && [...anterior.excluidos].sort().join(",") === [...revisao.excluidos].sort().join(",");
    return [...revisados.filter(r => chaveGrupo(r.previa.grupo.grupo) !== chaveGrupo(revisao.previa.grupo.grupo)), { ...revisao, conferido: true, chave: anterior && !mesmaExclusao ? crypto.randomUUID() : revisao.chave }];
  }
  function guardarRevisao() {
    if (!revisao || resumoRevisao([revisao]).animais === 0) return;
    setRevisados(comRevisaoAtual());
    setInvalidos(v => v.filter(id => id !== chaveGrupo(revisao.previa.grupo.grupo)));
    setRevisoesPendentes(v => v.filter(r => chaveGrupo(r.grupo) !== chaveGrupo(revisao.previa.grupo.grupo)));
    setDesatualizados(v => v.filter(r => chaveGrupo(r.grupo) !== chaveGrupo(revisao.previa.grupo.grupo)));
    setRevisao(null); ir("planejamento");
  }
  async function prepararRevisao() {
    if (!revisao || !resumoRevisao([revisao]).animais) return;
    const selecionados = livre ? [{...revisao,conferido:true}] : comRevisaoAtual();
    setRevisados(selecionados);
    await preparar(selecionados);
  }
  async function preparar(selecionados = revisados) {
    setOcupado(true); setErro(null); setAviso(null); let preparados = 0;
    try {
      for (const r of selecionados) {
        await incluirGrupo(visita.id, { propriedadeId, chave: r.chave, grupo: r.previa.grupo.grupo, fingerprint: r.previa.fingerprint, excluidos: r.excluidos });
        preparados++; setRevisados(v => v.filter(g => g.chave !== r.chave));
      }
      setAviso(`${preparados} grupo(s) preparado(s).`);
      const atualizada = await obterVisita(visita.id);
      if (livre) {
        const vazios = criteriosVazios();
        setAtividadeLivre(null); setCriteriosLivres(vazios); setRevisao(null); setRevisoesPendentes([]); setDesatualizados([]); ultimaRevisaoLivre.current = null;
        salvarEstado(visita, "livre", [], null, [], [], vazios, null);
      }
      ir("atendimento", { atividade: atualizada.atividades.at(-1)?.id });
    } catch (e) {
      setErro(`${preparados ? `${preparados} grupo(s) já preparado(s). Os demais continuam selecionados. ` : ""}${mensagem(e)}${e instanceof RebanhoApiError && e.status === 409 ? " Recarregue o planner e revise novamente os grupos pendentes." : ""}`);
      if (e instanceof RebanhoApiError && e.status === 409) setInvalidos(selecionados.map(r => chaveGrupo(r.previa.grupo.grupo)));
      if (preparados > 0) { setRevisao(null); ir("planejamento"); }
    } finally { if (preparados && onMudou) await onMudou(); setOcupado(false); }
  }

  const totais = resumoRevisao(revisados);
  const preparadosUnicos = visita.totalAnimais ?? new Set(visita.atividades.flatMap(a => a.participantes.map(p => p.animalId))).size;
  const procedimentos = visita.totalParticipantes ?? visita.atividades.reduce((s, a) => s + a.participantes.length, 0);
  const linhas = (lista: GrupoPlanner[]) => <div>{lista.map(g => {
    const selecionado = revisados.find(r => chaveGrupo(r.previa.grupo.grupo) === chaveGrupo(g.grupo));
    const quantidade = selecionado ? resumoRevisao([selecionado]).animais : g.totalAnimais;
    return <div key={chaveGrupo(g.grupo)} className={`visita-grupo ${selecionado ? "escolhido" : ""}`}>
      <input aria-label={`Selecionar ${g.nome}`} type="checkbox" checked={!!selecionado} disabled={!podeLancar || ocupado || carregando} onChange={() => { if (selecionado) { setRevisados(v => v.filter(r => chaveGrupo(r.previa.grupo.grupo) !== chaveGrupo(g.grupo))); if (revisao && chaveGrupo(revisao.previa.grupo.grupo) === chaveGrupo(g.grupo)) setRevisao(null); } else void abrirRevisao(g, false); }}/>
      <div><div className="visita-grupo-titulo">{g.etapa?.nome ?? g.nome}</div><div className="visita-grupo-sub">{g.protocolo?.nome ?? (g.janela === "HABITUAL" ? "Seleção habitual" : g.nome)}</div>
        {(selecionado?.conferido !== false && selecionado || g.emVisitaAberta > 0 || (selecionado?.excluidos.length ?? 0) > 0) && <div className="visita-grupo-badges">{selecionado && selecionado.conferido !== false && <span className="visita-badge verde">Revisado</span>}{g.emVisitaAberta > 0 && <span className="visita-badge amarelo">{g.emVisitaAberta} em outra visita aberta</span>}{!!selecionado?.excluidos.length && <span className="visita-badge">{selecionado.excluidos.length} excluídos</span>}</div>}
      </div>
      <div><div className="visita-grupo-titulo">{g.turma?.nome ?? (g.janela === "HABITUAL" ? "Seleção dinâmica" : "Participação individual")}</div><div className="visita-grupo-sub">{g.previstaPara ? g.previstaPara.slice(0, 10).split("-").reverse().join("/") : "Previsão não definida"}{g.precisaoTemporal === "HORA" && g.previstaPara ? ` · ${g.previstaPara.slice(11, 16)}` : ""} · {g.protocolo ? `Versão ${g.protocolo.versao}` : "Seleção salva"}</div></div>
      <div className="visita-grupo-total">{quantidade}<small>{quantidade === 1 ? "animal" : "animais"}{selecionado?.excluidos.length ? " incluídos" : ""}</small>{g.totalProcedimentos !== g.totalAnimais && <small>{g.totalProcedimentos} procedimentos</small>}</div>
      <button type="button" className="visita-botao pequeno h-auto" disabled={ocupado || carregando} onClick={() => void abrirRevisao(g)}>Revisar animais</button>
    </div>;
  })}{!lista.length && <p className="visita-vazio">Nenhum grupo nesta janela.</p>}</div>;
  const cabecalhoPainel = (titulo: string, descricao: string, acao?: ReactNode) => <div className="visita-painel-cabecalho"><div><h2>{titulo}</h2><p>{descricao}</p></div>{acao}</div>;
  const revisarSelecao = () => { const primeiro = revisados[0]; if (primeiro) void abrirRevisao(primeiro.previa.grupo); };

  const motivosComuns = useMemo(() => {
    const animais = revisao?.previa.animais ?? [];
    if (!animais.length) return [];
    const comuns = new Set(animais[0].motivos);
    for (const animal of animais.slice(1)) {
      const presentes = new Set(animal.motivos);
      for (const motivo of comuns) if (!presentes.has(motivo)) comuns.delete(motivo);
    }
    return animais[0].motivos.filter((motivo, indice, lista) => comuns.has(motivo) && lista.indexOf(motivo) === indice);
  }, [revisao]);
  const ordemConfigurada = livre && revisao?.previa.grupo.criterios?.ordenacao[0];
  const ordemVisual = ordemConfigurada && ["BRINCO", "NOME", "DEL", "DIAS_TENTATIVA"].includes(ordemConfigurada.campo) ? ordemConfigurada.campo as "BRINCO" | "NOME" | "DEL" | "DIAS_TENTATIVA" : ordem;
  const descVisual = ordemConfigurada ? ordemConfigurada.direcao === "DESC" : desc;
  const filtrados = useMemo(() => {
    if (!revisao) return [];
    const comuns = new Set(motivosComuns);
    const resultado = revisao.previa.animais.filter(a => (!busca || `${a.brinco ?? ""} ${a.nome ?? ""} ${a.lote?.nome ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))) && (!filtroAtencao || a.visitasAbertas.length > 0 || a.motivos.some(motivo => !comuns.has(motivo))));
    if (livre) return resultado;
    return resultado.sort((a, b) => {
        const x = ordem === "DEL" ? a.del : ordem === "DIAS_TENTATIVA" ? a.diasTentativa : a.brinco ?? "";
        const y = ordem === "DEL" ? b.del : ordem === "DIAS_TENTATIVA" ? b.diasTentativa : b.brinco ?? "";
        const comp = typeof x === "number" && typeof y === "number" ? x - y : x == null ? 1 : y == null ? -1 : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
        return comp * (desc ? -1 : 1);
      });
  }, [revisao, busca, filtroAtencao, ordem, desc, motivosComuns, livre]);
  const tamanhoPagina = 15, totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas), paginaAnimais = filtrados.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);
  function alterarOrdenacaoLivre(campo: "BRINCO" | "NOME" | "DEL" | "DIAS_TENTATIVA", direcao: "ASC" | "DESC") {
    if (!revisao || revisao.previa.grupo.grupo.origem !== "LIVRE") return;
    const grupoAtual = revisao.previa.grupo.grupo;
    const restantes = grupoAtual.criterios.ordenacao.filter(o => o.campo !== campo);
    const criterios = {...grupoAtual.criterios, ordenacao: [{campo, direcao}, ...restantes].slice(0,5)};
    setPagina(1);
    void atualizarLivre({...grupoAtual, criterios});
  }
  const alternarOrdem = (campo: "BRINCO" | "DEL" | "DIAS_TENTATIVA") => {
    if (livre) alterarOrdenacaoLivre(campo, ordemVisual === campo && !descVisual ? "DESC" : "ASC");
    else if (ordem === campo) setDesc(v => !v);
    else { setOrdem(campo); setDesc(false); }
  };
  const jaPreparado = revisao && visita.atividades.find(a=>a.contexto?.grupoPlanner && chaveGrupo(a.contexto.grupoPlanner as GrupoPlanner["grupo"]) === chaveGrupo(revisao.previa.grupo.grupo));
  const totalColunas = contarColunasContextoVisita() + 2;

  async function atualizarLivre(input: import("./planner-api").GrupoLivreInput, prepararAgora = false) {
    if (ocupado || revisaoPreparada) return;
    const anterior = revisao;
    if (!anterior || !grupoCorresponde(anterior.previa.grupo.grupo, criteriosAtuais.current)) return;
    const geracao = ++geracaoPrevia.current;
    const criteriosDoInicio = criteriosAtuais.current;
    const vigente = () => geracao === geracaoPrevia.current && mesmosCriterios(criteriosAtuais.current, criteriosDoInicio);
    setOcupado(true); setErro(null);
    try {
      if (prepararAgora && anterior) {
        const atual = await carregarPreviaVisita(propriedadeId,data,anterior.previa.grupo.grupo);
        if (!vigente()) return;
        if (atual.fingerprint !== anterior.previa.fingerprint) {
          const nova = {...anterior,previa:atual,chave:crypto.randomUUID(),excluidos:anterior.excluidos.filter(id=>atual.animais.some(a=>a.animalId===id))};
          setRevisao(nova);setGrupos([atual.grupo]);ir("revisao",{grupo:chaveGrupo(atual.grupo.grupo)});
          throw new Error("O contexto dos animais mudou. Confira novamente a prévia antes de preparar.");
        }
      }
      const previa = await carregarPreviaVisita(propriedadeId,data,input);
      if (!vigente()) return;
      const nova: GrupoRevisado = {previa,excluidos:(anterior?.excluidos ?? []).filter(id=>previa.animais.some(a=>a.animalId===id)),chave:crypto.randomUUID()};
      const conteudo=JSON.stringify({grupo:input,fingerprint:previa.fingerprint,excluidos:[...nova.excluidos].sort()});
      if (prepararAgora) { if(preparacaoLivre.current?.conteudo!==conteudo)preparacaoLivre.current={conteudo,chave:crypto.randomUUID()};nova.chave=preparacaoLivre.current!.chave; }
      geracaoGrupos.current++; setCarregando(false);
      setGrupos([previa.grupo]); setRevisados([]); setRevisao(nova);
      if (input.origem === "LIVRE") { criteriosAtuais.current = input.criterios; setCriteriosLivres(input.criterios); }
      if (prepararAgora) {
        if (anterior && (anterior.previa.grupo.grupo.origem !== "LIVRE" || (anterior.previa.assinaturaContexto && anterior.previa.assinaturaContexto !== previa.assinaturaContexto) || anterior.previa.total !== previa.total || anterior.previa.animais.some(a=>!previa.animais.some(b=>b.animalId===a.animalId)))) {
          ir("revisao",{grupo:chaveGrupo(input)}); throw new Error("A composição ou o contexto do grupo mudou. Confira a lista atualizada antes de preparar.");
        }
        await preparar([nova]);
      } else ir("revisao",{grupo:chaveGrupo(input)});
    } catch(e) { if (vigente()) setErro(mensagem(e)); } finally { if (vigente()) setOcupado(false); }
  }
  const iniciarRevisaoLivre = (previa: PreviaPlanner) => {
    setErro(null);setErroReferencia(null);
    if (!grupoCorresponde(previa.grupo.grupo, criteriosAtuais.current)) return;
    const anterior = revisao ?? ultimaRevisaoLivre.current;
    const salvo = lerEstado(visita, "livre");
    const antigos = anterior?.excluidos ?? salvo?.revisao?.excluidos ?? salvo?.revisoesPendentes?.at(-1)?.excluidos ?? salvo?.desatualizados?.at(-1)?.excluidos ?? [];
    const exclusoes = antigos.filter(id=>previa.animais.some(a=>a.animalId===id));
    setAviso(antigos.length !== exclusoes.length ? `${antigos.length - exclusoes.length} exclusão(ões) antiga(s) deixaram de se aplicar ao grupo atualizado.` : null);
    const nova = {previa,excluidos:exclusoes,chave:crypto.randomUUID()};
    const referenciaNova: ReferenciaPrevia = {grupo:previa.grupo.grupo,fingerprint:previa.fingerprint,excluidos:exclusoes,chave:nova.chave};
    ultimaRevisaoLivre.current = nova;
    geracaoGrupos.current++;setCarregando(false);
    setGrupos([previa.grupo]);setRevisados([]);setRevisao(nova);setRevisoesPendentes([referenciaNova]);setDesatualizados([]);setPagina(1);setBusca("");setFiltroAtencao(false);
    salvarEstado(visita,modo,[],nova,[referenciaNova],[],criteriosLivres,atividadeLivre);
    ir("revisao",{grupo:chaveGrupo(previa.grupo.grupo)});
  };
  return <section className="visita-fluxo" aria-label={etapa === "revisao" ? "Revisão do grupo" : "Planejamento da visita"}>
    <div className="visita-breadcrumb"><a href="/pecuaria/visitas" onClick={e => {e.preventDefault(); navegarPara("/pecuaria/visitas");}}>Visitas veterinárias</a><span>/</span><span>Visita de {data.split("-").reverse().join("/")}</span></div>
    <header className="visita-cabecalho"><div><div className="visita-eyebrow">Visita veterinária · {sitio}</div><h1>{etapa === "revisao" ? "Revisar animais" : etapa === "atividade" ? "Incluir grupo na visita" : livre ? "Selecionar animais por filtros" : "Agenda do dia"}</h1><p>{etapa === "revisao" && livre ? "Confira os dados e retire quem ficará fora deste atendimento." : etapa === "revisao" ? "Confira os dados por coluna e desmarque quem ficará fora deste grupo. Nenhum exame é registrado nesta etapa." : etapa === "atividade" ? "Dê um nome ao grupo e escolha o que será feito. O atendimento vem depois." : livre ? "Monte o grupo pelos seus critérios e confira os animais antes de definir a atividade." : "Escolha as demandas previstas para a data da visita, organizadas por Reprodução e Sanidade."}</p></div><div className="visita-acoes">{etapa === "revisao" || etapa === "atividade" ? <button className="visita-botao" onClick={() => ir(etapa === "atividade" ? "revisao" : "planejamento",{grupo:etapa === "atividade" && revisao ? chaveGrupo(revisao.previa.grupo.grupo) : undefined})}>{etapa === "atividade" ? "Rever animais" : livre ? "Ajustar filtros" : "Voltar à agenda"}</button> : <><button className="visita-botao" onClick={()=>ir("entrada")}>Escolher outro caminho</button>{visita.atividades.length > 0 && <button className="visita-botao" onClick={() => ir("atendimento", { atividade: visita.atividades.at(-1)?.id })}>Retomar atendimento</button>}</>}</div></header>
    <EtapasVisita modo={modo} etapa={etapa} podeRevisar={!revisaoPreparada && (!!revisao && grupoCorresponde(revisao.previa.grupo.grupo, criteriosLivres) || (!livre && revisados.length > 0))} podeAtender={visita.atividades.length > 0} ocupado={ocupado} onNavegar={para => { if (para === "atividade" && revisao && grupoCorresponde(revisao.previa.grupo.grupo, criteriosLivres)) ir("atividade",{grupo:chaveGrupo(revisao.previa.grupo.grupo)}); else if (para === "revisao") { if (revisao && grupoCorresponde(revisao.previa.grupo.grupo, criteriosLivres)) ir("revisao", {grupo: chaveGrupo(revisao.previa.grupo.grupo)}); else if (!livre) revisarSelecao(); else ir("selecao"); } else ir(para, {atividade: visita.atividades[0]?.id}); }}/>
    {etapa === "planejamento" && <div className="visita-configuracao"><label>Data da visita <input className="visita-data h-auto" type="date" aria-label="Data da visita" value={data} readOnly title="Data definida no cadastro da visita"/></label><span className="visita-badge">{sitio}</span><span className="visita-dica">As previsões e o DEL são apresentados em relação à data da visita.</span></div>}
    <ErrorBox erro={erro ?? erroReferencia}/>{(erro || erroReferencia) && <button className="visita-link" disabled={ocupado || carregando} onClick={()=>{setRestaurado(false);void carregar();}}>Recarregar planner</button>}{aviso && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm">{aviso}</p>}{carregando && <p role="status">Carregando grupos do sítio…</p>}{ocupado && <p role="status">Processando a lista. Aguarde…</p>}
    {etapa === "selecao" && livre ? <SelecaoLivreVisita visita={visita} sitio={sitio} podeLancar={podeLancar} criterios={criteriosLivres} onCriterios={mudarCriteriosLivres} onNovoGrupo={novoGrupoLivre} inicial={revisao?.previa.grupo.grupo.origem === "LIVRE" ? revisao.previa.grupo.grupo : ultimaRevisaoLivre.current?.previa.grupo.grupo.origem === "LIVRE" ? ultimaRevisaoLivre.current.previa.grupo.grupo : grupos.at(-1)?.grupo.origem === "LIVRE" ? grupos.at(-1)!.grupo as GrupoLivreInput : undefined} onRevisar={iniciarRevisaoLivre}/> : etapa === "atividade" && livre ? (revisao && grupoCorresponde(revisao.previa.grupo.grupo, criteriosLivres) ? <DefinirAtividadeLivre visita={visita} revisao={revisao} rascunho={atividadeLivre ?? {nome:revisao.previa.grupo.grupo.origem === "LIVRE" ? revisao.previa.grupo.grupo.nome : "Grupo montado por filtros",tipo:revisao.previa.grupo.grupo.origem === "LIVRE" ? revisao.previa.grupo.grupo.tipo : "AVALIACAO_REPRODUTIVA",referencia:""}} onRascunho={setAtividadeLivre} bloqueado={ocupado || !podeLancar || !!jaPreparado} onVoltar={()=>ir("revisao",{grupo:chaveGrupo(revisao.previa.grupo.grupo)})} onConfirmar={g=>atualizarLivre(g,true)}/> : <p role="status">Carregando grupo revisado…</p>) : etapa === "planejamento" ? <>
      <nav className="visita-janelas" aria-label="Janela dos grupos">{janelas.map(([j, label]) => <button key={j} type="button" aria-pressed={janela === j} onClick={() => setJanela(j)} className={janela === j ? "selecionada h-auto" : "h-auto"}>{label}<span>{grupos.filter(g => g.janela === j).length}</span></button>)}</nav>
      <section className="visita-painel" aria-label="Grupos de atendimento">{cabecalhoPainel("Grupos disponíveis", "Marque um grupo inteiro ou revise a lista para retirar animais.", <span className="visita-badge">{revisados.length} grupos selecionados</span>)}
        <h3 className="visita-secao">Reprodução</h3>{linhas(grupos.filter(g => g.secao === "REPRODUCAO" && g.janela === janela))}
        <h3 className="visita-secao">Sanidade</h3>{linhas(grupos.filter(g => g.secao === "SANIDADE" && g.janela === janela))}
        <div className="visita-resumo"><div><b>{totais.animais}</b><span>animais únicos</span></div><div><b>{totais.procedimentos}</b><span>procedimentos selecionados</span></div><p>Um animal pode precisar de diagnóstico e aplicação na mesma visita. Ele conta uma vez no total de animais.</p></div>
      </section>
      {desatualizados.length > 0 && <Panel><CabecalhoTabela titulo="Grupos que precisam de nova conferência" descricao="A prévia mudou desde a revisão salva. Suas exclusões compatíveis foram mantidas, mas precisam ser confirmadas na lista atualizada."/><div className="divide-y divide-border">{desatualizados.map((r,i)=>{const atual=grupos.find(g=>chaveGrupo(g.grupo)===chaveGrupo(r.grupo));return <div key={`${chaveGrupo(r.grupo)}-${i}`} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><strong>{atual?.nome ?? "Grupo não disponível"}</strong><p className="text-sm text-ink-3">{atual ? "Revise a composição atual para usar este grupo." : "Este grupo não está mais disponível no planner; escolha outro grupo."}</p></div>{atual && <Button secondary onClick={()=>void abrirRevisao(atual)}>Rever grupo atualizado</Button>}</div>;})}</div></Panel>}
      {!!revisados.length && <details className="visita-selecionados"><summary>Grupos revisados ({revisados.filter(r => r.conferido !== false).length}) · {revisados.length} selecionados</summary><div>{revisados.map(r => <div key={r.chave} className="visita-selecionado"><span>{r.previa.grupo.nome} · {resumoRevisao([r]).animais} incluídos{invalidos.includes(chaveGrupo(r.previa.grupo.grupo)) && " · Revise novamente antes de preparar."}</span><button className="visita-link" disabled={ocupado} onClick={() => void abrirRevisao(r.previa.grupo)}>Rever</button><button className="visita-link" disabled={ocupado} onClick={() => setRevisados(v => v.filter(x => x.chave !== r.chave))}>Retirar</button></div>)}</div></details>}
      {procedimentos > 0 && <p className="visita-dica">Já preparados: {preparadosUnicos} animais únicos · {procedimentos} procedimentos. <button className="visita-link" onClick={() => ir("atendimento", {atividade: visita.atividades[0]?.id})}>Retomar atendimento</button></p>}
      <div className="visita-rodape"><div><strong>{totais.animais} animais únicos · {totais.procedimentos} procedimentos</strong><small>{revisados.length ? `${revisados.length} grupos selecionados · sua seleção fica preservada ao navegar.` : "Selecione os grupos que deseja levar para a visita."}</small></div><button className="visita-botao primario" disabled={ocupado || carregando || !revisados.length} onClick={revisarSelecao}>Revisar seleção</button></div>

    </> : etapa === "revisao" ? <>
      {jaPreparado && <p role="status" className="visita-aviso">Este grupo já foi preparado nesta visita. {revisaoPreparada && "Consulta da lista gravada: incluídos na ordem de preparação e excluídos ao final. Para excluídos, mostramos somente a identificação preservada. "}<button className="visita-link" onClick={()=>ir("atendimento",{atividade:jaPreparado.id})}>Retomar atendimento do grupo</button></p>}
      {!revisao ? <Panel><p className="p-5" role="status">Carregando prévia integral e conferindo a assinatura do grupo…</p></Panel> : <>
        <section className="visita-painel visita-revisao-painel">
          {cabecalhoPainel(revisao.previa.grupo.etapa?.nome ?? revisao.previa.grupo.nome, `${revisao.previa.grupo.turma?.nome ?? "Seleção de animais"} · ${revisao.previa.total} animais na lista · ${revisao.previa.total - revisao.excluidos.length} incluídos`, <span className="visita-badge verde">Dados em {data.split("-").reverse().join("/")}</span>)}
          {revisados.length > 1 && <div className="visita-revisao-escopo"><label>Revisar outro grupo<select className="h-auto" value={chaveGrupo(revisao.previa.grupo.grupo)} onChange={e=>{const alvo=revisados.find(r=>chaveGrupo(r.previa.grupo.grupo)===e.target.value);if(alvo)void abrirRevisao(alvo.previa.grupo);}}>{[revisao,...revisados.filter(r=>chaveGrupo(r.previa.grupo.grupo)!==chaveGrupo(revisao.previa.grupo.grupo))].map(r=><option key={r.chave} value={chaveGrupo(r.previa.grupo.grupo)}>{r.previa.grupo.nome}</option>)}</select></label></div>}
          {livre ? <div className="visita-contexto livre-criterios"><span>Filtros usados nesta seleção</span><div><span className="visita-filtro-chip">Referência: {data.split("-").reverse().join("/")}</span>{!revisao.previa.grupo.criterios?.todas.length && <span className="visita-filtro-chip">Todos os animais no sítio e na data</span>}{revisao.previa.grupo.criterios?.todas.map((c,i)=><span className="visita-filtro-chip" key={i}>{descreverCondicaoPreservada(c,{referenciasSelecao:revisao.previa.grupo.contexto?.referenciasSelecao})}</span>)}{revisao.previa.grupo.criterios?.qualquer.length ? revisao.previa.grupo.criterios.qualquer.map(b=><span className="visita-filtro-chip" key={b.id}>Alternativa: {b.todas.map(c=>descreverCondicaoPreservada(c,{referenciasSelecao:revisao.previa.grupo.contexto?.referenciasSelecao})).join(" e ")}</span>) : <span className="visita-filtro-chip">Sem condição de manejo adicional</span>}<span className="visita-filtro-chip">Dados desconhecidos: {revisao.previa.grupo.criterios?.politicaDesconhecidos === "INCLUIR" ? "incluir e sinalizar" : "excluir"}</span></div></div> : <>
          <div className="visita-contexto"><div><span>Protocolo / seleção</span>{revisao.previa.grupo.protocolo?.nome ?? revisao.previa.grupo.nome}</div><div><span>Etapa</span>{livre ? "A definir após a revisão" : revisao.previa.grupo.etapa?.nome ?? "Avaliação reprodutiva"}</div><div><span>Previsto para</span>{livre ? data.split("-").reverse().join("/") : revisao.previa.grupo.previstaPara?.slice(0,10).split("-").reverse().join("/") ?? "Previsão não definida"}</div><div className="visita-criterio"><span>Critério de inclusão</span>{motivosComuns.length ? <>{motivosComuns.join("; ")}<span className="sr-only">Motivos comuns do grupo</span></> : "Critérios da seleção na data da visita."}</div></div>
          </>}
          {revisao.previa.animais.some(a=>a.visitasAbertas.length > 0) && <div className="visita-aviso"><span><strong>{revisao.previa.animais.filter(a=>a.visitasAbertas.length > 0).length} animais já estão em outra visita aberta.</strong> Confira as linhas sinalizadas para evitar preparar o mesmo procedimento duas vezes.</span><button type="button" className="visita-link h-auto" onClick={()=>{setFiltroAtencao(v=>!v);setPagina(1);}}>{filtroAtencao ? "Mostrar todos" : "Ver esses animais"}</button></div>}
          <div className="visita-toolbar"><label className="visita-campo">Buscar<input type="search" className="visita-busca h-auto" aria-label="Buscar animal, brinco ou lote" value={busca} onChange={e=>{setBusca(e.target.value);setPagina(1);}} placeholder="Brinco, nome ou lote"/></label><button className="visita-link h-auto" disabled={!podeLancar || ocupado || !!jaPreparado} onClick={()=>setRevisao({...revisao,excluidos:revisao.excluidos.filter(id=>!filtrados.some(a=>a.animalId===id))})}>Incluir todos os filtrados</button><button className="visita-link h-auto" disabled={!podeLancar || ocupado || !!jaPreparado} onClick={()=>setRevisao({...revisao,excluidos:[...new Set([...revisao.excluidos,...filtrados.map(a=>a.animalId)])]})}>Excluir todos os filtrados</button><div className="visita-toolbar-direita"><span>{revisao.excluidos.length} excluídos deste grupo</span><Button secondary className="consulta-mais-filtros" aria-haspopup="dialog" aria-expanded={!!filtrosRevisao} onClick={() => setFiltrosRevisao({ atencao: filtroAtencao, ordem: ordemVisual, desc: descVisual })}><Settings2 size={16} aria-hidden/>Filtros</Button>
          {filtrosRevisao && <PainelFiltros aberto onAbertoChange={aberto => { if (!aberto) setFiltrosRevisao(null); }} temFiltros
            onLimpar={() => setFiltrosRevisao({ atencao: false, ordem: revisaoPreparada ? ordemVisual : "BRINCO", desc: revisaoPreparada ? descVisual : false })}
            onAplicar={() => {
              setFiltroAtencao(filtrosRevisao.atencao);
              if (!revisaoPreparada && !ocupado && (filtrosRevisao.ordem !== ordemVisual || filtrosRevisao.desc !== descVisual)) {
                if (livre) alterarOrdenacaoLivre(filtrosRevisao.ordem, filtrosRevisao.desc ? "DESC" : "ASC");
                else { setOrdem(filtrosRevisao.ordem as typeof ordem); setDesc(filtrosRevisao.desc); }
              }
              setPagina(1); setFiltrosRevisao(null);
            }}>
            <label className="flex items-center gap-2"><input type="checkbox" checked={filtrosRevisao.atencao} onChange={e => setFiltrosRevisao({ ...filtrosRevisao, atencao: e.target.checked })} />Somente com atenção</label>
            <label>Ordenar por<SelectCampo value={filtrosRevisao.ordem} disabled={!!revisaoPreparada || ocupado} onValueChange={valor => setFiltrosRevisao({ ...filtrosRevisao, ordem: valor as FiltrosRevisao["ordem"] })}><option value="BRINCO">Animal</option>{livre && <option value="NOME">Nome</option>}<option value="DEL">DEL</option><option value="DIAS_TENTATIVA">Dias desde tentativa</option></SelectCampo></label>
            <label>Direção<SelectCampo value={filtrosRevisao.desc ? "DESC" : "ASC"} disabled={!!revisaoPreparada || ocupado} onValueChange={valor => setFiltrosRevisao({ ...filtrosRevisao, desc: valor === "DESC" })}><option value="ASC">Crescente</option><option value="DESC">Decrescente</option></SelectCampo></label>
          </PainelFiltros>}</div></div>
          <div className="visita-tabela" role="region" aria-label="Animais do grupo, com contexto na data da visita" tabIndex={0}><table className="w-full consulta-tabela"><caption className="sr-only">Prévia completa do grupo {revisao.previa.grupo.nome}</caption><thead><tr><th scope="col" className="visita-coluna-selecao"><span className="sr-only">Incluir</span></th><CabecalhoContextoVisita onOrdenar={revisaoPreparada ? undefined : alternarOrdem} ordem={ordemVisual} desc={descVisual}/><th scope="col">Atenção</th></tr></thead><tbody>{paginaAnimais.map(a=><tr key={`${a.animalId}-${a.tarefaId ?? "animal"}`} className={revisao.excluidos.includes(a.animalId) ? "visita-excluido" : ""}><td className="visita-coluna-selecao"><input type="checkbox" aria-label={`Incluir ${a.brinco ?? a.animalId}`} checked={!revisao.excluidos.includes(a.animalId)} disabled={!podeLancar || ocupado || !!jaPreparado} onChange={e=>setRevisao({...revisao,excluidos:e.target.checked?revisao.excluidos.filter(id=>id!==a.animalId):[...new Set([...revisao.excluidos,a.animalId])]})}/></td><CelulasContextoVisita contexto={a} dataReferencia={data} compacto/><td className="visita-atencao">{a.visitasAbertas.length > 0 && <details><summary>Outra visita</summary>{a.visitasAbertas.map(v=><p key={v.id}>{v.nome}</p>)}</details>}{a.motivos.filter(m=>!motivosComuns.includes(m)).map(m=><p key={m}>{m}</p>)}{!a.visitasAbertas.length && !a.motivos.some(m=>!motivosComuns.includes(m)) && "—"}</td></tr>)}{!paginaAnimais.length && <tr><td colSpan={totalColunas} className="visita-vazio">Nenhum animal corresponde aos filtros.</td></tr>}</tbody></table></div>
          <div className="visita-paginacao"><span>{filtrados.length ? `${(paginaAtual-1)*tamanhoPagina+1}–${Math.min(paginaAtual*tamanhoPagina,filtrados.length)} de ${filtrados.length}` : "0 resultados"} · {revisao.previa.total} animais no grupo · {revisao.previa.total - revisao.excluidos.length} incluídos</span><div><button className="visita-botao pequeno h-auto" disabled={paginaAtual===1} onClick={()=>setPagina(p=>p-1)}>Anterior</button><span>Página {paginaAtual} de {totalPaginas}</span><button className="visita-botao pequeno h-auto" disabled={paginaAtual>=totalPaginas} onClick={()=>setPagina(p=>p+1)}>Próxima</button></div></div>
          {livre && podeLancar && !jaPreparado && <InclusaoManualLivre visita={visita} revisao={revisao} bloqueado={ocupado} onRetirar={id=>{const g=revisao.previa.grupo.grupo;if(g.origem === "LIVRE") void atualizarLivre({...g,incluidosManualmente:g.incluidosManualmente.filter(a=>a!==id)});}} onIncluir={id=>{const g=revisao.previa.grupo.grupo; if(g.origem === "LIVRE") void atualizarLivre({...g,incluidosManualmente:[...new Set([...g.incluidosManualmente,id])]});}}/>}
          <div className="visita-aviso suave">RP = retenção de placenta no parto de referência. “—” = não informado ou sem parto conhecido. “Seca” não equivale a DEL zero.</div>
        </section>
        <div className="visita-rodape"><div><strong>{revisao.previa.total - revisao.excluidos.length} de {revisao.previa.total} animais incluídos neste grupo</strong><small>{resumoRevisao(comRevisaoAtual()).animais} animais únicos · {resumoRevisao(comRevisaoAtual()).procedimentos} procedimentos na seleção da visita.</small></div><div className="visita-acoes"><button className="visita-botao" disabled={ocupado} onClick={livre ? ()=>ir(etapaInicial) : guardarRevisao}>{livre ? "Voltar aos filtros" : "Salvar grupo revisado"}</button><button className="visita-botao primario" disabled={!!jaPreparado || !podeLancar || ocupado || carregando || revisao.previa.total === revisao.excluidos.length || revisados.some(r => invalidos.includes(chaveGrupo(r.previa.grupo.grupo)) && chaveGrupo(r.previa.grupo.grupo) !== chaveGrupo(revisao.previa.grupo.grupo))} onClick={() => livre ? (salvarEstado(visita,modo,[],revisao,[],[],criteriosLivres,atividadeLivre), ir("atividade",{grupo:chaveGrupo(revisao.previa.grupo.grupo)})) : void prepararRevisao()}>{livre ? "Definir atividade e visita" : "Preparar visita e ir ao atendimento"}</button></div></div>
      </>}
    </> : <Panel><CabecalhoTabela titulo="Atendimento da visita" descricao="Escolha uma atividade para continuar o registro."/><div className="divide-y divide-border">{visita.atividades.map(a => <button key={a.id} type="button" className="w-full p-4 text-left hover:bg-surface-2" onClick={() => ir("atendimento", {atividade:a.id})}>{a.nome}<span className="ml-2 text-sm text-ink-3">{a.totais?.totalParticipantes ?? a.participantes.length} animais</span></button>)}{!visita.atividades.length && <p className="p-4">Nenhuma atividade preparada.</p>}</div></Panel>}
  </section>;
}
