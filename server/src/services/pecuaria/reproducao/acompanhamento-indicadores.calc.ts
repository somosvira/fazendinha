import { calcularElegibilidadeNaData, type EntradaElegibilidade } from "./elegibilidade.calc.js";
import { diasCalendarioContexto } from "./contexto-animal.calc.js";

export const VERSAO_ACOMPANHAMENTO_INDICADORES = "ACOMPANHAMENTO_GERENCIAL_V1" as const;
export type LocalIndicadorAcompanhamento = { propriedadeId: number | null; loteId?: string | null; papel?: string | null };
export type FiltrosAcompanhamentoIndicadores = {
  propriedadeId: number; inicio: string; fim: string; corte: string; loteId?: string; papeis?: string[];
  tiposTentativa?: Array<"IA" | "TE" | "COBERTURA">; janelaPerdaDias?: number; iepModo?: "VIVOS_NATIMORTOS" | "TODOS_PARTOS";
};
export type CandidatoLiberacaoIndicador = {
  data: string;
  /** Contexto reconstruído nessa data, antes do serviço de referência; não é o cadastro atual. */
  contexto: Omit<EntradaElegibilidade, "referencia">;
};
export type CicloAcompanhamentoIndicador = {
  id: string; chaveCiclo: string; animalId: string; inicio: string; fim?: string | null;
  localInicio: LocalIndicadorAcompanhamento; localCorte: LocalIndicadorAcompanhamento | null;
  partoId?: string | null; partoEm?: string | null; fimPev?: string | null; saidaEm?: string | null;
  servicos: Array<{ id: string; data: string; tipo: "IA" | "TE" | "COBERTURA"; valido: boolean; propriedadeId: number | null; ordem?: number; local?: LocalIndicadorAcompanhamento }>;
  candidatosLiberacao: CandidatoLiberacaoIndicador[];
  restricoes: Array<{ id: string; inicio: string; fim: string | null; efeito: "ALERTA" | "BLOQUEIO" }>;
};
export type GestacaoAcompanhamentoIndicador = {
  id: string; animalId: string; valida: boolean; confirmadaEm: string; localConfirmacao: LocalIndicadorAcompanhamento;
  primeiroDgPositivo: { id: string; data: string; local: LocalIndicadorAcompanhamento } | null;
  encerramento: { tipo: "PERDA" | "PARTO" | "NAO_IDENTIFICADO"; data: string; fatoId: string; explicacao?: string;subtipo?:"PERDA_REGISTRADA"|"ABORTO" } | null;
  /** Intervalos inclusivos comprovados pelo registro operacional. Localização, sozinha, não prova seguimento. */
  coberturaSeguimento: Array<{ desde: string; ate: string; evidenciaIds: string[] }>;
  evidencias: Array<{ id: string; gestacaoId: string; data: string; tipo: "DG_POSITIVO" | "PARTO_QUALIFICANTE"; valida: boolean }>;
};
export type PartoAcompanhamentoIndicador = {
  id: string; animalId: string; data: string; valido: boolean; local: LocalIndicadorAcompanhamento;
  desfecho: "VIVO" | "NATIMORTO" | "ABORTO" | "DESCONHECIDO";
};
export type ConcepcaoAcompanhamentoIndicador = {
  /** Identidade da gestação, nunca da reconfirmação. A prova é produzida pelo classificador factual. */
  id: string; animalId: string; tentativaId: string | null; confirmadaEm: string; valida: boolean;
  evidenciaIds: string[]; localConfirmacao: LocalIndicadorAcompanhamento;
};
export type DadosAcompanhamentoIndicadores = {
  ciclos: CicloAcompanhamentoIndicador[]; gestacoes: GestacaoAcompanhamentoIndicador[]; partos: PartoAcompanhamentoIndicador[];
  concepcoes?: ConcepcaoAcompanhamentoIndicador[];
  pendenciasOrigemCiclo?:Array<{animalId:string;motivo:string;local:LocalIndicadorAcompanhamento}>;
};

function dia(valor: string): Date {
  const d = new Date(`${valor}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== valor) throw new Error("Data de indicador inválida");
  return d;
}
const dias = (de: string, ate: string) => diasCalendarioContexto(dia(de), dia(ate));
const somar = (de: string, n: number) => new Date(dia(de).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const entre = (d: string, de: string, ate: string) => d >= de && d <= ate;
const unicos = (valores: string[]) => [...new Set(valores)].sort();
function fatosUnicos<T extends { id: string }>(fatos: T[]): T[] {
  const porId = new Map<string, T>();
  for (const fato of fatos) {
    const anterior = porId.get(fato.id);
    if (anterior && JSON.stringify(anterior) !== JSON.stringify(fato)) throw new Error("Fatos com a mesma identidade possuem dados divergentes");
    if (!anterior) porId.set(fato.id, fato);
  }
  return [...porId.values()];
}
const media = (valores: number[]) => valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : null;
function validarFiltros(f: FiltrosAcompanhamentoIndicadores) {
  dia(f.inicio); dia(f.fim); dia(f.corte);
  if (f.inicio > f.fim || f.fim > f.corte) throw new Error("Período ou corte de indicador inválido");
  if (!Number.isInteger(f.propriedadeId) || f.propriedadeId <= 0) throw new Error("Sítio de indicador inválido");
  if (f.janelaPerdaDias !== undefined && (!Number.isInteger(f.janelaPerdaDias) || f.janelaPerdaDias < 1)) throw new Error("Escolha uma duração positiva para o seguimento das perdas");
}
type Escopo = "INCLUIR" | "EXCLUIR" | "PENDENTE";
function escopo(local: LocalIndicadorAcompanhamento | null, f: FiltrosAcompanhamentoIndicadores): Escopo {
  if (local?.propriedadeId == null) return "PENDENTE";
  if (local.propriedadeId !== f.propriedadeId) return "EXCLUIR";
  if (f.loteId && local.loteId == null || f.papeis?.length && local.papel == null) return "PENDENTE";
  if (f.loteId && local.loteId !== f.loteId || f.papeis?.length && !f.papeis.includes(local.papel!)) return "EXCLUIR";
  return "INCLUIR";
}

/** Reavalia as evidências de cada candidato. aptaDesde isolado nunca comprova liberação. */
export function primeiraLiberacaoValidaIndicador(ciclo: CicloAcompanhamentoIndicador, ate: string) {
  const avaliados = ciclo.candidatosLiberacao.filter(c => c.data >= ciclo.inicio && c.data <= ate && (!ciclo.fim || c.data < ciclo.fim))
    .sort((a, b) => a.data.localeCompare(b.data)).map(c => {
      const coerente = c.contexto.animalId === ciclo.animalId && c.contexto.ciclo?.chaveCiclo === ciclo.chaveCiclo;
      const resultado = coerente ? calcularElegibilidadeNaData({ ...c.contexto, referencia: dia(c.data) }) : null;
      return { data: c.data, elegivel: resultado?.elegivel ?? null, politicaId: resultado?.politicaId ?? null,
        politicaVersao: resultado?.politicaVersao ?? null, decisaoId: resultado?.decisaoId ?? null,
        motivos: resultado?.motivos ?? ["CONTEXTO_DO_CICLO_DIVERGENTE"], restricaoIds: resultado?.restricaoIds ?? [] };
    });
  return { primeira: avaliados.find(a => a.elegivel === true) ?? null, avaliados };
}

function linhaEspera(c: CicloAcompanhamentoIndicador, f: FiltrosAcompanhamentoIndicadores) {
  const servicos = fatosUnicos(c.servicos).filter(s => s.valido && s.data >= c.inicio && s.data <= f.corte && (!c.fim || s.data < c.fim)
    && (!f.tiposTentativa || f.tiposTentativa.includes(s.tipo))).sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  const primeiro = servicos[0] ?? null;
  const esperaObservadaAte = [f.corte, c.fim ?? f.corte, c.saidaEm ?? f.corte, primeiro?.data ?? f.corte].sort()[0];
  const limite = primeiro?.data ?? esperaObservadaAte;
  const liberacao = primeiraLiberacaoValidaIndicador(c, limite);
  const pendencias: string[] = [];
  if (!liberacao.primeira) pendencias.push("PRIMEIRA_LIBERACAO_NAO_COMPROVADA");
  if (!c.fimPev) pendencias.push("FIM_PEV_NAO_COMPROVADO");
  if (!primeiro) pendencias.push("PRIMEIRO_SERVICO_AUSENTE");
  const antecipacoes = ([['PARTO', c.partoEm], ['FIM_PEV', c.fimPev]] as const).flatMap(([referencia, desde]) =>
    primeiro && desde && primeiro.data < desde ? [{ referencia, desde, servicoEm: primeiro.data, dias: dias(primeiro.data, desde) }] : []);
  if (antecipacoes.length) pendencias.push("SERVICO_ANTERIOR_A_MARCO");
  const intervalo = (de?: string | null) => primeiro && de && de <= primeiro.data ? dias(de, primeiro.data) : null;
  return { cicloId: c.id, chaveCiclo: c.chaveCiclo, animalId: c.animalId, inicio: c.inicio, localCoorte: c.localInicio,
    partoId: c.partoId ?? null, partoEm: c.partoEm ?? null, fimPev: c.fimPev ?? null,
    primeiraLiberacao: liberacao.primeira, primeiroServico: primeiro, diasPartoServico: intervalo(c.partoEm),
    diasFimPevServico: intervalo(c.fimPev), diasLiberacaoServico: intervalo(liberacao.primeira?.data),
    antecipacoes, esperaObservadaAte, diasEsperaObservada: liberacao.primeira ? dias(liberacao.primeira.data, limite) : null,
    diasAguardandoServico: !primeiro && esperaObservadaAte === f.corte && (!c.fim || c.fim > f.corte) && (!c.saidaEm || c.saidaEm > f.corte)
      && liberacao.primeira ? dias(liberacao.primeira.data, f.corte) : null,
    tentativas: servicos.length, repeticoes: Math.max(servicos.length - 1, 0),
    restricoesIntermediarias: c.restricoes.filter(r => r.inicio <= limite && (!r.fim || r.fim > (liberacao.primeira?.data ?? c.inicio))),
    saidaEm: c.saidaEm && c.saidaEm <= f.corte ? c.saidaEm : null, pendencias, avaliacoesLiberacao: liberacao.avaliados };
}
export function calcularEsperaAcompanhamento(ciclos: CicloAcompanhamentoIndicador[], f: FiltrosAcompanhamentoIndicadores) {
  validarFiltros(f);
  ciclos = fatosUnicos(ciclos);
  const pendenciasEscopo: Array<{ cicloId: string; populacao: "COORTE" | "FILA" }> = [];
  const coorte = ciclos.filter(c => {
    if (!entre(c.inicio, f.inicio, f.fim)) return false;
    const e = escopo(c.localInicio, f); if (e === "PENDENTE") pendenciasEscopo.push({ cicloId: c.id, populacao: "COORTE" });
    return e === "INCLUIR";
  }).map(c => linhaEspera(c, f));
  const pendenciasFila: Array<{ motivo: string; linha: ReturnType<typeof linhaEspera> }> = [];
  const fila = ciclos.filter(c => c.inicio <= f.corte && (!c.fim || c.fim > f.corte) && (!c.saidaEm || c.saidaEm > f.corte)).flatMap(c => {
    const linha = linhaEspera(c, f); if (linha.primeiroServico) return [];
    const e = escopo(c.localCorte, f); if (e === "PENDENTE") pendenciasEscopo.push({ cicloId: c.id, populacao: "FILA" });
    if (e !== "INCLUIR") return [];
    if (!linha.primeiraLiberacao) { pendenciasFila.push({ motivo: "LIBERACAO_NAO_COMPROVADA", linha }); return []; }
    const noCorte = linha.avaliacoesLiberacao.find(a => a.data === f.corte);
    if (!noCorte || noCorte.elegivel === null) { pendenciasFila.push({ motivo: "DISPONIBILIDADE_NO_CORTE_NAO_COMPROVADA", linha }); return []; }
    if (!noCorte.elegivel) { pendenciasFila.push({ motivo: "RESTRICAO_NO_CORTE", linha }); return []; }
    return [linha];
  });
  return { coorte, filaAtual: fila, pendenciasFila, pendenciasEscopo, resumoCoorte: {
    ciclos: coorte.length, comServico: coorte.filter(c => c.primeiroServico).length, semServico: coorte.filter(c => !c.primeiroServico).length,
    saidas: coorte.filter(c => c.saidaEm).length, repeticoes: coorte.reduce((s,c) => s+c.repeticoes, 0),
    mediaDiasLiberacaoServico: media(coorte.flatMap(c => c.diasLiberacaoServico == null ? [] : [c.diasLiberacaoServico])),
  } };
}

function coberturaComprovada(g: GestacaoAcompanhamentoIndicador, de: string, ate: string) {
  let cursor = de;
  for (const intervalo of g.coberturaSeguimento.filter(i => i.evidenciaIds.length && i.desde <= i.ate).sort((a,b) => a.desde.localeCompare(b.desde))) {
    if (intervalo.ate < cursor) continue;
    if (intervalo.desde > cursor) return false;
    if (intervalo.ate >= ate) return true;
    cursor = somar(intervalo.ate, 1);
  }
  return false;
}
function linhaPerda(g: GestacaoAcompanhamentoIndicador, f: FiltrosAcompanhamentoIndicadores) {
  const dg = g.primeiroDgPositivo;
  const fimJanela = dg && f.janelaPerdaDias !== undefined ? somar(dg.data, f.janelaPerdaDias) : null;
  const encerramento = g.encerramento && g.encerramento.data <= f.corte ? g.encerramento : null;
  const motivos: string[] = [];
  if (!dg) motivos.push("PRIMEIRO_DG_POSITIVO_NAO_COMPROVADO");
  if (f.janelaPerdaDias === undefined) motivos.push("DURACAO_NAO_ESCOLHIDA");
  if (dg && dg.data > f.corte || dg && dg.data < g.confirmadaEm) motivos.push("CONFIRMACOES_COM_CRONOLOGIA_DIVERGENTE");
  if (encerramento?.tipo === "NAO_IDENTIFICADO") motivos.push("DESFECHO_NAO_IDENTIFICADO");
  if (encerramento && dg && encerramento.data < dg.data) motivos.push("ENCERRAMENTO_ANTERIOR_A_CONFIRMACAO");
  let estado: "SEM_JANELA" | "PERDA_NA_JANELA" | "SEM_PERDA_COM_SEGUIMENTO" | "INCOMPLETO" = f.janelaPerdaDias === undefined ? "SEM_JANELA" : "INCOMPLETO";
  const evidencias: string[] = [];
  if (dg && fimJanela && !motivos.length) {
    if (encerramento?.tipo === "PERDA" && encerramento.data <= fimJanela) { estado = "PERDA_NA_JANELA"; evidencias.push(encerramento.fatoId); }
    else if (fimJanela > f.corte) motivos.push("JANELA_AINDA_NAO_COMPLETADA");
    else if (encerramento && encerramento.data < fimJanela) motivos.push("DESFECHO_TERMINAL_ANTES_DO_FIM_DA_JANELA");
    else {
      const comprovantes = g.evidencias.filter(e => e.valida && e.gestacaoId === g.id && e.data >= fimJanela && e.data <= f.corte
        && (!encerramento || e.data <= encerramento.data));
      if (!comprovantes.length) motivos.push("EVIDENCIA_DE_SEGUIMENTO_AUSENTE");
      else if (!coberturaComprovada(g, dg.data, fimJanela)) motivos.push("CONTINUIDADE_DE_SEGUIMENTO_NAO_COMPROVADA");
      else { estado = "SEM_PERDA_COM_SEGUIMENTO"; evidencias.push(...comprovantes.map(e => e.id)); }
    }
  }
  return { lacunas:encerramento?.tipo==="PERDA"&&(encerramento.explicacao?.trim().length??0)<5?[encerramento.subtipo==="ABORTO"?"EXPLICACAO_HISTORICA_ABORTO_AUSENTE":"EXPLICACAO_HISTORICA_PERDA_AUSENTE"]:[], gestacaoId: g.id, animalId: g.animalId, primeiroDgPositivo: dg, fimJanela, encerramento, estado, motivos: unicos(motivos), evidenciaIds: evidencias };
}
export function calcularPerdasAcompanhamento(gestacoes: GestacaoAcompanhamentoIndicador[], f: FiltrosAcompanhamentoIndicadores) {
  validarFiltros(f);
  const pendenciasEscopo: string[] = [];
  const coorte = fatosUnicos(gestacoes).filter(g => {
    if (!g.valida || g.confirmadaEm > f.corte || !entre(g.primeiroDgPositivo?.data ?? g.confirmadaEm, f.inicio, f.fim)) return false;
    const e = escopo(g.primeiroDgPositivo?.local ?? g.localConfirmacao, f); if (e === "PENDENTE") pendenciasEscopo.push(g.id);
    return e === "INCLUIR";
  }).map(g => linhaPerda(g, f));
  const numerador = coorte.filter(l => l.estado === "PERDA_NA_JANELA").length;
  const denominador = coorte.filter(l => l.estado === "PERDA_NA_JANELA" || l.estado === "SEM_PERDA_COM_SEGUIMENTO").length;
  return { coorte, pendenciasEscopo, janelaDias: f.janelaPerdaDias ?? null, contagens: {
    gestacoes: coorte.length, perdasRegistradas:coorte.filter(l=>l.encerramento?.tipo==="PERDA"&&l.encerramento.subtipo!=="ABORTO").length, abortos:coorte.filter(l=>l.encerramento?.tipo==="PERDA"&&l.encerramento.subtipo==="ABORTO").length,
    perdasAteCorte: coorte.filter(l => l.encerramento?.tipo === "PERDA").length,
    encerramentosNaoIdentificados: coorte.filter(l => l.encerramento?.tipo === "NAO_IDENTIFICADO").length,
    incompletos: coorte.filter(l => l.estado === "INCOMPLETO").length, semPrimeiroDg: coorte.filter(l => !l.primeiroDgPositivo).length,
  }, composicaoNumerador:{perdasRegistradas:coorte.filter(l=>l.estado==="PERDA_NA_JANELA"&&l.encerramento?.subtipo!=="ABORTO").length,abortos:coorte.filter(l=>l.estado==="PERDA_NA_JANELA"&&l.encerramento?.subtipo==="ABORTO").length}, numerador: f.janelaPerdaDias === undefined ? null : numerador, denominador: f.janelaPerdaDias === undefined ? null : denominador,
    percentual: f.janelaPerdaDias !== undefined && denominador > 0 ? 100*numerador/denominador : null };
}

export function calcularIepAcompanhamento(partos: PartoAcompanhamentoIndicador[], f: FiltrosAcompanhamentoIndicadores) {
  validarFiltros(f);
  const modo = f.iepModo ?? "VIVOS_NATIMORTOS";
  const validos = fatosUnicos(partos).filter(p => p.valido && p.data <= f.corte);
  const qualifica = (p: PartoAcompanhamentoIndicador) => modo === "TODOS_PARTOS" || p.desfecho === "VIVO" || p.desfecho === "NATIMORTO";
  const abortos = validos.filter(p => p.desfecho === "ABORTO" && entre(p.data, f.inicio, f.fim) && escopo(p.local, f) === "INCLUIR");
  const pendencias: Array<{ partoId: string; motivo: string }> = [];
  const pares: Array<{ animalId: string; anteriorId: string; atualId: string; anteriorEm: string; atualEm: string; dias: number;abortosIntermediarios:Array<{id:string;data:string}> }> = [];
  const semAnterior: string[] = [];
  for (const atual of validos.filter(p => entre(p.data, f.inicio, f.fim))) {
    const e = escopo(atual.local, f); if (e === "PENDENTE") pendencias.push({ partoId: atual.id, motivo: "ESCOPO_HISTORICO_NAO_COMPROVADO" });
    if (e !== "INCLUIR") continue;
    if (!qualifica(atual)) { if (atual.desfecho === "DESCONHECIDO") pendencias.push({ partoId: atual.id, motivo: "DESFECHO_PARTO_DESCONHECIDO" }); continue; }
    if (validos.some(p => p.id !== atual.id && p.animalId === atual.animalId && p.data === atual.data)) {
      pendencias.push({ partoId: atual.id, motivo: "PARTOS_DISTINTOS_NA_MESMA_DATA" }); continue;
    }
    const anteriores = validos.filter(p => p.animalId === atual.animalId && p.data < atual.data).sort((a,b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id));
    const anterior = anteriores.find(qualifica);
    if (!anterior) { semAnterior.push(atual.id); continue; }
    if (anteriores.some(p => p.id !== anterior.id && p.data === anterior.data && qualifica(p))) {
      pendencias.push({ partoId: atual.id, motivo: "ANTERIORES_DISTINTOS_NA_MESMA_DATA" }); continue;
    }
    if (modo === "VIVOS_NATIMORTOS" && anteriores.some(p => p.data > anterior.data && p.desfecho === "DESCONHECIDO")) {
      pendencias.push({ partoId: atual.id, motivo: "PARTO_INTERMEDIARIO_DESCONHECIDO" }); continue;
    }
    pares.push({ animalId: atual.animalId, anteriorId: anterior.id, atualId: atual.id, anteriorEm: anterior.data, atualEm: atual.data, dias: dias(anterior.data, atual.data), abortosIntermediarios: validos.filter(p=>p.animalId===atual.animalId&&p.desfecho==="ABORTO"&&p.data>anterior.data&&p.data<atual.data).map(p=>({id:p.id,data:p.data})) });
  }
  return { modo, pares, abortos, semAnterior, pendencias, mediaDias: media(pares.map(p => p.dias)) };
}

export function calcularTentativasPorConcepcao(ciclos: CicloAcompanhamentoIndicador[], concepcoes: ConcepcaoAcompanhamentoIndicador[], f: FiltrosAcompanhamentoIndicadores) {
  validarFiltros(f);
  ciclos = fatosUnicos(ciclos);
  const linhas: Array<{ concepcaoId: string; animalId: string; cicloId: string; tentativaId: string; servicoEm: string; confirmadaEm: string;
    numeroTentativas: number | null; tentativaIds: string[]; tipos: string[]; evidenciaIds: string[]; pendencias: string[] }> = [];
  const pendencias: Array<{ concepcaoId: string; referencia: "CONFIRMACAO" | "SERVICO"; data: string; motivo: string }> = [];
  for (const concepcao of fatosUnicos(concepcoes).filter(c => c.valida && c.confirmadaEm <= f.corte)) {
    const correspondentes = concepcao.tentativaId ? ciclos.filter(c => c.animalId === concepcao.animalId && c.servicos.some(s => s.id === concepcao.tentativaId && s.valido)) : [];
    const ciclo = correspondentes.length === 1 ? correspondentes[0] : null;
    const positivo = ciclo?.servicos.find(s => s.id === concepcao.tentativaId && s.valido);
    if (!ciclo || !positivo) {
      if (entre(concepcao.confirmadaEm, f.inicio, f.fim) && escopo(concepcao.localConfirmacao, f) === "INCLUIR") pendencias.push({ concepcaoId: concepcao.id,
        referencia: "CONFIRMACAO", data: concepcao.confirmadaEm, motivo: !concepcao.tentativaId ? "CONCEPCAO_SEM_TENTATIVA_COMPROVADA" : "CICLO_DA_TENTATIVA_NAO_COMPROVADO" });
      continue;
    }
    if (!entre(positivo.data, f.inicio, f.fim) || f.tiposTentativa && !f.tiposTentativa.includes(positivo.tipo)) continue;
    const e = escopo(positivo.local ?? { propriedadeId: positivo.propriedadeId }, f);
    if (e === "PENDENTE") pendencias.push({ concepcaoId: concepcao.id, referencia: "SERVICO", data: positivo.data, motivo: "ESCOPO_DO_SERVICO_NAO_COMPROVADO" });
    if (e !== "INCLUIR") continue;
    if (!concepcao.evidenciaIds.length || concepcao.confirmadaEm < positivo.data) {
      pendencias.push({ concepcaoId: concepcao.id, referencia: "SERVICO", data: positivo.data, motivo: "CONCEPCAO_SEM_PROVA_CRONOLOGICA" }); continue;
    }
    const servicos = fatosUnicos(ciclo.servicos).filter(s => s.valido && s.data >= ciclo.inicio && s.data <= positivo.data && (!ciclo.fim || s.data < ciclo.fim)
      && (!f.tiposTentativa || f.tiposTentativa.includes(s.tipo)));
    const intradia = servicos.some(s => s.id !== positivo.id && s.data === positivo.data);
    const ordemAferivel = !intradia || servicos.filter(s => s.data === positivo.data).every(s => Number.isInteger(s.ordem) && s.ordem! > 0)
      && new Set(servicos.filter(s => s.data === positivo.data).map(s => s.ordem)).size === servicos.filter(s => s.data === positivo.data).length;
    const anteriores = servicos.filter(s => s.data < positivo.data || !ordemAferivel || !intradia || s.ordem! <= positivo.ordem!)
      .sort((a,b) => a.data.localeCompare(b.data) || (a.ordem ?? 0)-(b.ordem ?? 0) || a.id.localeCompare(b.id));
    linhas.push({ concepcaoId: concepcao.id, animalId: concepcao.animalId, cicloId: ciclo.id, tentativaId: positivo.id, servicoEm: positivo.data,
      confirmadaEm: concepcao.confirmadaEm, numeroTentativas: ordemAferivel ? anteriores.length : null, tentativaIds: anteriores.map(s=>s.id),
      tipos: anteriores.map(s=>s.tipo), evidenciaIds: unicos(concepcao.evidenciaIds), pendencias: ordemAferivel ? [] : ["ORDEM_INTRADIARIA_NAO_COMPROVADA"] });
  }
  return { estado: "CALCULADO" as const, referenciaPeriodo: "SERVICO_CONCEPTIVO" as const, contagem: "ACUMULADA_NO_CICLO_SEM_REINICIAR_NA_PERDA" as const,
    linhas, pendencias, concepcoes: linhas.length, comContagemComprovada: linhas.filter(l=>l.numeroTentativas!==null).length,
    mediaTentativas: media(linhas.flatMap(l=>l.numeroTentativas===null?[]:[l.numeroTentativas])) };
}

/** Envelope aditivo. Taxas V1 e suas emissões permanecem sob seu contrato original. */
export function calcularAcompanhamentoIndicadores(dados: DadosAcompanhamentoIndicadores, filtros: FiltrosAcompanhamentoIndicadores) {
  return { pendenciasOrigemCiclo:dados.pendenciasOrigemCiclo??[],versao: 2 as const, versaoMetodologia: VERSAO_ACOMPANHAMENTO_INDICADORES, filtros: { ...filtros },
    metodologia: { unidade: "DIAS_CORRIDOS", esperaCoorte: "INICIO_CICLO", esperaFila: "CORTE", perdasCoorte: "PRIMEIRO_DG_POSITIVO",
      perdasSemPrimeiroDg: "CONTAGEM_COM_PENDENCIA", iepPeriodo: "SEGUNDO_PARTO_QUALIFICANTE", localizacao: "NA_DATA_DA_POPULACAO",
      tentativasPorConcepcao: "SERVICO_CONCEPTIVO_NO_PERIODO_CONTAGEM_ACUMULADA_NO_CICLO" },
    espera: calcularEsperaAcompanhamento(dados.ciclos, filtros), perdas: calcularPerdasAcompanhamento(dados.gestacoes, filtros), iep: calcularIepAcompanhamento(dados.partos, filtros),
    tentativasPorConcepcao: dados.concepcoes === undefined ? { estado: "NAO_CARREGADO" as const } : calcularTentativasPorConcepcao(dados.ciclos, dados.concepcoes, filtros) };
}
export type SnapshotAcompanhamentoIndicadores = ReturnType<typeof calcularAcompanhamentoIndicadores>;
