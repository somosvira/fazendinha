import { projetarAptidaoReprodutiva, type AptidaoReprodutiva } from "./aptidao-geral.calc.js";
import { resolverClasseReprodutiva } from "./classe-reprodutiva.calc.js";
import { avaliarCriteriosAptidao, type EvidenciaPesoAptidao, type EvidenciaEccAptidao, type NecessidadeAptidao, type ClasseReprodutivaAptidao } from "./criterios-aptidao.calc.js";
import { type EvidenciaToqueAptidao, type AptidaoClinica } from "./toque-aptidao.calc.js";
import { desfechoGestacao } from "./desfecho-gestacao.calc.js";
import type { ParametrosElegibilidade } from "./elegibilidade.schemas.js";
import { calcularContextoAnimalNaData, dataCalendarioContexto, type HistoricoContextoAnimal } from "./contexto-animal.calc.js";
import { resolverPapelReprodutivo, type EvidenciaPapel } from "../rebanho/papel-reprodutivo.calc.js";
import { parametrosElegibilidadeSchema } from "./elegibilidade.schemas.js";

export type CicloElegibilidade = {
  chaveCiclo: string; inicioCiclo: Date; partoId: string | null;
  aborto: boolean; paridade: number | null; aptaDesdeInicial: Date | null;
};
export type DecisaoElegibilidade = {
  exameAptidaoId?: string | null; exameAptidaoSnapshot?: unknown;
  id: string; data: Date; tipo: string; aptaDesde: Date | null; status: string; criadoEm: Date;
};
export type EntradaElegibilidade = {
  animalId: string; propriedadeId: number; referencia: Date; sexo: string;
  propriedadeNaData: number | null; localizacaoConflitante: boolean; baixaEm: Date | null;
  ciclo: CicloElegibilidade | null;
  vinculo: { id: string; politicaId: string | null; chaveCiclo: string } | null;
  politica: { id: string; versao: number; parametros: ParametrosElegibilidade } | null;
  politicaInvalida?: { id: string; versao: number };
  parametrosNecessidade?: ParametrosElegibilidade;
  politicaNecessidade?: { id: string; versao: number };
  decisoes: readonly DecisaoElegibilidade[];
  papel: string | null; papelConflitante: boolean; descarte: boolean | null;
  restricoes: readonly { id: string; data: Date; ate: Date | null; status: string }[];
  impedimentosSanitarios?: readonly { id: string; data: Date; ate: Date | null; status: string }[];
  situacaoReprodutiva: string; perdaGestacionalEm: Date | null;
  pendenciasContexto?: string[];
  classeReprodutiva?: ClasseReprodutivaAptidao;
  classeReprodutivaConflitante?: boolean; evidenciaClasseIds?: string[];
  dataNascimento?: Date | null;
  pesagens?: EvidenciaPesoAptidao[]; escores?: EvidenciaEccAptidao[]; toques?: EvidenciaToqueAptidao[];
};
export type ElegibilidadeNaData = {
  animalId: string; propriedadeId: number; dataReferencia: string;
  aptidao: AptidaoReprodutiva;
  situacaoReprodutiva: string;
  estado: "ELEGIVEL" | "NAO_ELEGIVEL" | "PENDENTE";
  /** Alias legado da aptidão geral. Indicadores publicados usam calculadora versionada própria. */
  baseElegivel: boolean | null; elegivel: boolean | null;
  aptidaoClinica?: AptidaoClinica; necessidadeAptidao?: NecessidadeAptidao | null;
  pevOriginalAte?: string | null; revisaoDecisaoNecessaria?: boolean;
  aptaDesde: string | null; ciclo: { chaveCiclo: string; inicioCiclo: string; partoId: string | null } | null;
  vinculoCicloId: string | null; politicaId: string | null; politicaVersao: number | null;
  metodologia: "IDEAGRI_IILB_BASE_V1"; decisaoId: string | null;
  motivos: string[]; alertas: string[]; restricaoIds: string[];
};
const diaTexto = (d: Date) => dataCalendarioContexto(d).toISOString().slice(0, 10);
const somarDias = (d: Date, n: number) => new Date(dataCalendarioContexto(d).getTime() + n * 86_400_000);

/** Projeção clínica por data. Sem acesso ao banco, defaults clínicos ou estimativa de prenhez. */
export function calcularElegibilidadeNaData(input: EntradaElegibilidade): ElegibilidadeNaData {
  const ref = dataCalendarioContexto(input.referencia);
  const aptidao = projetarAptidaoReprodutiva({ ...input, referencia: ref });
  const ciclo = input.ciclo && input.ciclo.inicioCiclo <= ref ? input.ciclo : null;
  const politica = input.politica ?? (input.parametrosNecessidade && input.politicaNecessidade ? { ...input.politicaNecessidade, parametros: input.parametrosNecessidade } : null);
  const parametros = politica?.parametros;
  const criterios = input.parametrosNecessidade?.criteriosAptidao ?? parametros?.criteriosAptidao;
  const necessidadeAptidao = criterios ? avaliarCriteriosAptidao({
    ...criterios, animalId: input.animalId, chaveCiclo: ciclo?.chaveCiclo ?? "INICIAL", referencia: ref,
    classeReprodutiva: input.classeReprodutiva ?? (ciclo?.partoId ? "VACA" : "NAO_DETERMINADA"),
    parto: ciclo?.partoId ? ciclo.inicioCiclo : null, dataNascimento: input.dataNascimento ?? null,
    pesagens: input.pesagens ?? [], escores: input.escores ?? [],
  }) : null;
  if (necessidadeAptidao) {
    necessidadeAptidao.evidenciaIds.push(...input.evidenciaClasseIds ?? []);
    if (input.classeReprodutivaConflitante) necessidadeAptidao.pendencias = necessidadeAptidao.pendencias.map(p => p === "CLASSE_REPRODUTIVA_NAO_COMPROVADA" ? "CLASSE_REPRODUTIVA_CONFLITANTE" : p);
    Object.assign(necessidadeAptidao, { politicaId: input.politicaNecessidade?.id ?? politica?.id ?? null, politicaVersao: input.politicaNecessidade?.versao ?? politica?.versao ?? null });
  }
  // O prazo é contexto histórico, não uma segunda decisão nem um veto ao exame apto.
  const pevOriginalAte = ciclo?.partoId && !ciclo.aborto && input.politica && ciclo.paridade !== null
    ? diaTexto(somarDias(ciclo.inicioCiclo, ciclo.paridade === 1 ? input.politica.parametros.pevPrimiparasDias : input.politica.parametros.pevMultiparasDias)) : null;
  const elegivel = aptidao.estado === "APTA" ? true : aptidao.estado === "NAO_APTA" ? false : null;
  return { animalId: input.animalId, propriedadeId: input.propriedadeId, dataReferencia: diaTexto(ref), aptidao, situacaoReprodutiva: input.situacaoReprodutiva === "APTA" ? "DESCONHECIDA" : input.situacaoReprodutiva,
    // Aliases de transporte mantidos para consumidores históricos; mesma fonte de decisão.
    estado: elegivel === true ? "ELEGIVEL" : elegivel === false ? "NAO_ELEGIVEL" : "PENDENTE", elegivel, baseElegivel: elegivel,
    aptidaoClinica: { ...aptidao, estado: aptidao.estado === "PENDENTE" ? "NAO_DETERMINADA" : aptidao.estado, resultado: null },
    necessidadeAptidao, pevOriginalAte, revisaoDecisaoNecessaria: false,
    aptaDesde: elegivel ? aptidao.data : null, ciclo: ciclo ? { chaveCiclo: ciclo.chaveCiclo, inicioCiclo: diaTexto(ciclo.inicioCiclo), partoId: ciclo.partoId } : null,
    vinculoCicloId: input.vinculo?.id ?? null, politicaId: politica?.id ?? null, politicaVersao: politica?.versao ?? null,
    metodologia: "IDEAGRI_IILB_BASE_V1", decisaoId: aptidao.bloqueioAnteriorId, motivos: aptidao.motivos,
    alertas: pevOriginalAte && aptidao.estado === "APTA" && aptidao.data && aptidao.data < pevOriginalAte ? ["PEV_ANTECIPADO_POR_EXAME"] : [],
    restricaoIds: input.restricoes.filter(r => r.status === "VALIDO" && r.data <= ref && (!r.ate || r.ate > ref)).map(r => r.id) };

}

/** Conjunto carregado uma vez para avaliar várias datas sem consultas por animal/dia. */
export type DadosElegibilidade = {
  animais: Array<HistoricoContextoAnimal["animal"] & { sexo: string; dataNascimento?: Date | null }>;
  partos: Array<HistoricoContextoAnimal["partos"][number] & { desfecho: string | null; gestacaoId: string | null;observacao?:string|null;origem?:string;crias?:Array<{viva:boolean}> }>;
  tentativas: Array<HistoricoContextoAnimal["tentativas"][number]>;
  lactacoes: Array<HistoricoContextoAnimal["lactacoes"][number]>;
  gestacoes: Array<HistoricoContextoAnimal["gestacoes"][number] & { motivoEncerramento: string | null; tipoEncerramento?: string | null }>;
  localizacoes: Array<HistoricoContextoAnimal["localizacoes"][number]>;
  avaliacoes: Array<HistoricoContextoAnimal["avaliacoes"][number] & {tentativaId?:string|null;gestacaoId?:string|null}>;
  iniciais: Array<HistoricoContextoAnimal["iniciais"][number] & { id: string; aptaDesde: Date | null; criadoEm: Date; classeReprodutiva?: string | null }>;
  vinculos: Array<{ id: string; animalId: string; chaveCiclo: string; inicioCiclo: Date; politicaId: string | null; situacaoInicialId?: string | null }>;
  politicas: Array<{ id: string; versao: number; parametros: unknown; propriedadeId?: number; vigenteDesde?: Date }>;
  decisoes: Array<DecisaoElegibilidade & { vinculoCicloId: string }>;
  restricoes: Array<{ id: string; animalId: string; data: Date; ate: Date | null; status: string; tipo: string; propriedadeId?: number | null; motivo?: string }>;
  papeis: Array<EvidenciaPapel & { animalId: string }>;
  pesagens?: Array<EvidenciaPesoAptidao & { animalId: string }>;
  escores?: Array<EvidenciaEccAptidao & { animalId: string }>;
  toques?: EvidenciaToqueAptidao[];
  impedimentosSanitarios?: Array<{ id: string; animalId: string; data: Date; ate: Date | null; status: string; propriedadeId?: number | null; nome?: string }>;
  baixas: Array<{ animalId: string; data: Date; estornadaEm: Date | null }>;
};

/** Não reconstitui o conhecimento passado; snapshots preservam a emissão original. */
export function calcularElegibilidadesDoConjunto(dados: DadosElegibilidade, propriedadeId: number, referencia: Date, entradas?:Map<string,EntradaElegibilidade>): Map<string, ElegibilidadeNaData> {
  const ref = dataCalendarioContexto(referencia);
  const porAnimal = <T extends { animalId: string }>(lista: readonly T[], id: string) => lista.filter(f => f.animalId === id);
  const resultado = new Map<string, ElegibilidadeNaData>();
  for (const animal of dados.animais) {
    const partos = porAnimal(dados.partos, animal.id);
    const iniciais = porAnimal(dados.iniciais, animal.id).filter(i => i.status === "VALIDO" && i.data <= ref)
      .sort((a, b) => a.data.getTime() - b.data.getTime() || a.criadoEm.getTime() - b.criadoEm.getTime() || a.id.localeCompare(b.id));
    const contexto = calcularContextoAnimalNaData({ animal, partos, tentativas: porAnimal(dados.tentativas, animal.id),
      lactacoes: porAnimal(dados.lactacoes, animal.id), gestacoes: porAnimal(dados.gestacoes, animal.id), localizacoes: porAnimal(dados.localizacoes, animal.id),
      avaliacoes: porAnimal(dados.avaliacoes, animal.id), iniciais }, ref);
    const ultimoParto = contexto.ultimoParto;
    const chaveCiclo = ultimoParto ? `PARTO:${ultimoParto.id}` : "INICIAL";
    const vinculo = dados.vinculos.find(v => v.animalId === animal.id && v.chaveCiclo === chaveCiclo) ?? null;
    const parto = partos.find(p => p.id === ultimoParto?.id);
    const ciclo: CicloElegibilidade | null = ultimoParto ? {
      chaveCiclo, inicioCiclo: new Date(`${ultimoParto.data}T00:00:00Z`), partoId: ultimoParto.id,
      aborto: parto?.desfecho === "ABORTO" || parto?.tipo === "ABORTO", paridade: contexto.partosRealizados, aptaDesdeInicial: null,
    } : iniciais.length ? { chaveCiclo, inicioCiclo: vinculo?.inicioCiclo ?? iniciais[0].data, partoId: null, aborto: false,
      paridade: null, aptaDesdeInicial: iniciais.at(-1)?.situacao === "APTA" ? iniciais.at(-1)?.aptaDesde ?? null : null } : null;
    const politica = dados.politicas.find(p => p.id === vinculo?.politicaId);
    const parametros = politica ? parametrosElegibilidadeSchema.safeParse(politica.parametros) : null;
    const vigente = dados.politicas.filter(p => p.propriedadeId === propriedadeId && p.vigenteDesde && p.vigenteDesde <= ref).sort((a, b) => b.vigenteDesde!.getTime() - a.vigenteDesde!.getTime())[0];
    const parametrosNecessidade = vigente ? parametrosElegibilidadeSchema.safeParse(vigente.parametros) : null;
    const papel = resolverPapelReprodutivo(porAnimal(dados.papeis, animal.id), ref);
    const restricoes = porAnimal(dados.restricoes, animal.id).filter(r => r.status === "VALIDO" && r.data <= ref);
    const descarte = restricoes.some(r => r.tipo === "DESCARTE" && (!r.ate || r.ate > ref));
    const encerradas = porAnimal(dados.gestacoes, animal.id).filter(g => g.status === "VALIDO" && g.encerradaEm && g.encerradaEm <= ref
      && (!ciclo || g.encerradaEm >= ciclo.inicioCiclo) && !partos.some(p => p.status === "VALIDO" && p.gestacaoId === g.id));
    // Somente o tipo explícito e os vínculos factuais classificam o encerramento.
    const perda = encerradas.filter(g => desfechoGestacao(g, partos) === "PERDA")
      .sort((a, b) => b.encerradaEm!.getTime() - a.encerradaEm!.getTime())[0];
    const classe = resolverClasseReprodutiva({ referencia: ref, dataEntrada: animal.dataEntrada, partosAntesDaEntrada: animal.partosAntesDaEntrada, partos, iniciais });
    const entrada:EntradaElegibilidade={ classeReprodutiva: classe.classe, classeReprodutivaConflitante: classe.conflito, evidenciaClasseIds: classe.evidenciaIds, politicaNecessidade: parametrosNecessidade?.success && vigente ? { id: vigente.id, versao: vigente.versao } : undefined, parametrosNecessidade: parametrosNecessidade?.success ? parametrosNecessidade.data : undefined, dataNascimento: animal.dataNascimento, pesagens: porAnimal(dados.pesagens ?? [], animal.id),
      escores: porAnimal(dados.escores ?? [], animal.id), toques: porAnimal(dados.toques ?? [], animal.id).filter(e => !ciclo || e.data >= ciclo.inicioCiclo), animalId: animal.id, propriedadeId, referencia: ref, sexo: animal.sexo,
      propriedadeNaData: contexto.localizacaoNaData?.propriedadeId ?? null, localizacaoConflitante: contexto.pendencias.includes("LOCALIZACOES_SOBREPOSTAS"),
      baixaEm: porAnimal(dados.baixas, animal.id).find(b => !b.estornadaEm && b.data <= ref)?.data ?? null,
      ciclo, vinculo, politica: politica && parametros?.success ? { id: politica.id, versao: politica.versao, parametros: parametros.data } : null,
      politicaInvalida: politica && !parametros?.success ? { id: politica.id, versao: politica.versao } : undefined,
      decisoes: dados.decisoes.filter(d => d.vinculoCicloId === vinculo?.id), papel: papel.papel, papelConflitante: papel.estado === "CONFLITO", descarte,
      impedimentosSanitarios: porAnimal(dados.impedimentosSanitarios ?? [], animal.id),
      restricoes: restricoes.filter(r => r.tipo !== "DESCARTE"), situacaoReprodutiva: contexto.situacaoReprodutiva, perdaGestacionalEm: perda?.encerradaEm ?? null };
    const item=calcularElegibilidadeNaData(entrada);
    if (contexto.pendencias.includes("GESTACOES_SOBREPOSTAS")) {
      item.motivos.push("GESTACOES_CONFLITANTES");
      if (item.elegivel !== false) { item.elegivel = null; item.estado = "PENDENTE"; }
    }
    if (encerradas.some(g => desfechoGestacao(g, partos) === "NAO_IDENTIFICADO")) {
      item.motivos.push("ENCERRAMENTO_GESTACAO_DESCONHECIDO");
      if (item.elegivel !== false) { item.elegivel = null; item.estado = "PENDENTE"; }
    }
    entrada.pendenciasContexto=item.motivos.filter(m=>["GESTACOES_CONFLITANTES","ORIGEM_INICIAL_ANULADA","ENCERRAMENTO_GESTACAO_DESCONHECIDO"].includes(m));
    if (entrada.pendenciasContexto.length) {
      const atualizado = calcularElegibilidadeNaData(entrada);
      Object.assign(item, atualizado);
    }
    entradas?.set(animal.id,entrada);
    resultado.set(animal.id, item);
  }
  return resultado;
}

/** A avaliação pode acontecer durante o PEV; a conclusão alimenta a aptidão geral. */
export function permiteAvaliacaoAptidao(elegibilidade: Pick<ElegibilidadeNaData, "motivos">): boolean {
  return !elegibilidade.motivos.some(m => ["ANIMAL_NAO_FEMEA", "ANIMAL_BAIXADO", "FORA_DO_SITIO", "LOCALIZACAO_DESCONHECIDA", "LOCALIZACOES_CONFLITANTES"].includes(m));
}
