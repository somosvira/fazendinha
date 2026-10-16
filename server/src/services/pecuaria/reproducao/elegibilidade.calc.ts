import type { ParametrosElegibilidade } from "./elegibilidade.schemas.js";
import { calcularContextoAnimalNaData, dataCalendarioContexto, type HistoricoContextoAnimal } from "./contexto-animal.calc.js";
import { resolverPapelReprodutivo, type EvidenciaPapel } from "../rebanho/papel-reprodutivo.calc.js";
import { parametrosElegibilidadeSchema } from "./elegibilidade.schemas.js";

export type CicloElegibilidade = {
  chaveCiclo: string; inicioCiclo: Date; partoId: string | null;
  aborto: boolean; paridade: number | null; aptaDesdeInicial: Date | null;
};
export type DecisaoElegibilidade = {
  id: string; data: Date; tipo: string; aptaDesde: Date | null; status: string; criadoEm: Date;
};
export type EntradaElegibilidade = {
  animalId: string; propriedadeId: number; referencia: Date; sexo: string;
  propriedadeNaData: number | null; localizacaoConflitante: boolean; baixaEm: Date | null;
  ciclo: CicloElegibilidade | null;
  vinculo: { id: string; politicaId: string | null; chaveCiclo: string } | null;
  politica: { id: string; versao: number; parametros: ParametrosElegibilidade } | null;
  politicaInvalida?: { id: string; versao: number };
  decisoes: readonly DecisaoElegibilidade[];
  papel: string | null; papelConflitante: boolean; descarte: boolean | null;
  restricoes: readonly { id: string; data: Date; ate: Date | null; status: string }[];
  situacaoReprodutiva: string; perdaGestacionalEm: Date | null;
};
export type ElegibilidadeNaData = {
  animalId: string; propriedadeId: number; dataReferencia: string;
  estado: "ELEGIVEL" | "NAO_ELEGIVEL" | "PENDENTE";
  /** Base antes do resultado gestacional; usada para tratar tentativas pendentes no indicador. */
  baseElegivel: boolean | null; elegivel: boolean | null;
  aptaDesde: string | null; ciclo: { chaveCiclo: string; inicioCiclo: string; partoId: string | null } | null;
  vinculoCicloId: string | null; politicaId: string | null; politicaVersao: number | null;
  metodologia: "IDEAGRI_IILB_BASE_V1"; decisaoId: string | null;
  motivos: string[]; alertas: string[]; restricaoIds: string[];
};
const diaTexto = (d: Date) => dataCalendarioContexto(d).toISOString().slice(0, 10);
const depois = (a: Date, b: Date) => dataCalendarioContexto(a) > dataCalendarioContexto(b);
const somarDias = (d: Date, n: number) => new Date(dataCalendarioContexto(d).getTime() + n * 86_400_000);

/** Projeção clínica por data. Sem acesso ao banco, defaults clínicos ou estimativa de prenhez. */
export function calcularElegibilidadeNaData(input: EntradaElegibilidade): ElegibilidadeNaData {
  const ref = dataCalendarioContexto(input.referencia);
  const motivos: string[] = [], alertas: string[] = [];
  const ciclo = input.ciclo && !depois(input.ciclo.inicioCiclo, ref) ? input.ciclo : null;
  const vinculo = input.vinculo?.chaveCiclo === ciclo?.chaveCiclo ? input.vinculo : null;
  const politica = vinculo?.politicaId === input.politica?.id ? input.politica : null;
  const decisoes = input.decisoes.filter(d => d.status === "VALIDO" && !depois(d.data, ref) && ciclo && !depois(ciclo.inicioCiclo, d.data))
    .sort((a, b) => b.data.getTime() - a.data.getTime() || b.criadoEm.getTime() - a.criadoEm.getTime() || b.id.localeCompare(a.id));
  const decisao = vinculo ? decisoes[0] ?? null : null;
  let aptaDesde: Date | null = null;
  const base: { valor: boolean | null } = { valor: true };
  const excluir = (motivo: string) => { motivos.push(motivo); base.valor = false; };
  const pendente = (motivo: string) => { motivos.push(motivo); if (base.valor !== false) base.valor = null; };
  if (input.sexo !== "F") excluir("ANIMAL_NAO_FEMEA");
  if (input.baixaEm && !depois(input.baixaEm, ref)) excluir("ANIMAL_BAIXADO");
  else if (input.localizacaoConflitante) pendente("LOCALIZACOES_CONFLITANTES");
  else if (input.propriedadeNaData === null) pendente("LOCALIZACAO_DESCONHECIDA");
  else if (input.propriedadeNaData !== input.propriedadeId) excluir("FORA_DO_SITIO");
  if (!ciclo) pendente("CICLO_DESCONHECIDO");
  else if (!vinculo) pendente("POLITICA_CICLO_NAO_CONGELADA");
  else if (input.politicaInvalida) pendente("POLITICA_INVALIDA");
  else if (!politica && decisao?.tipo !== "LIBERAR") pendente("POLITICA_AUSENTE_NO_INICIO_CICLO");
  else if (!politica) {
    aptaDesde = decisao?.aptaDesde ?? null;
    alertas.push("LIBERACAO_INDIVIDUAL_SEM_POLITICA");
    if (!aptaDesde) pendente("LIBERACAO_EXPLICITA_NECESSARIA");
    else if (depois(aptaDesde, ref)) excluir("EM_ESPERA_PARA_LIBERACAO");
    if (input.descarte) excluir("MATRIZ_DESCARTE");
    if (input.papelConflitante || !input.papel) pendente("PAPEL_DESCONHECIDO");
  }
  const parametros = politica?.parametros;
  if (decisao?.tipo === "BLOQUEAR") excluir("BLOQUEIO_INDIVIDUAL");
  if (parametros && ciclo) {
    if (input.papelConflitante) pendente("PAPEIS_CONFLITANTES");
    else if (!input.papel) pendente("PAPEL_DESCONHECIDO");
    else if (!parametros.papeisIncluidos.some(p => p === input.papel)) excluir("PAPEL_EXCLUIDO");
    if (input.descarte === null) pendente("DESCARTE_DESCONHECIDO");
    else if (input.descarte && parametros.descarte === "EXCLUIR") excluir("MATRIZ_DESCARTE");
    if (ciclo.partoId) {
      if (ciclo.aborto) {
        if (parametros.aborto === "PEV_CONFIGURADO" && parametros.pevAposAbortoDias !== null)
          aptaDesde = somarDias(ciclo.inicioCiclo, parametros.pevAposAbortoDias);
      } else if (ciclo.paridade !== null && ciclo.paridade >= 1)
        aptaDesde = somarDias(ciclo.inicioCiclo, ciclo.paridade === 1 ? parametros.pevPrimiparasDias : parametros.pevMultiparasDias);
    } else aptaDesde = ciclo.aptaDesdeInicial;
    if (decisao?.tipo === "LIBERAR") aptaDesde = decisao.aptaDesde;
    if (!aptaDesde && decisao?.tipo !== "BLOQUEAR") pendente("LIBERACAO_EXPLICITA_NECESSARIA");
    if (aptaDesde && depois(aptaDesde, ref)) excluir("EM_ESPERA_PARA_LIBERACAO");
    if (input.perdaGestacionalEm && !depois(input.perdaGestacionalEm, ref) && parametros.perdaGestacional === "EXIGE_LIBERACAO"
      && !(decisao?.tipo === "LIBERAR" && !depois(input.perdaGestacionalEm, decisao.data))) excluir("PERDA_AGUARDA_LIBERACAO");
  }
  const restricoes = input.restricoes.filter(r => r.status === "VALIDO" && !depois(r.data, ref) && (!r.ate || depois(r.ate, ref)));
  if (restricoes.length) {
    if (!parametros || parametros.restricoes === "EXCLUIR") excluir("RESTRICAO_REPRODUTIVA");
    else alertas.push("RESTRICAO_REPRODUTIVA");
  }
  let elegivel: boolean | null = base.valor;
  if (input.situacaoReprodutiva === "GESTANTE") { elegivel = false; motivos.push("GESTACAO_CONFIRMADA"); }
  else if (base.valor !== false && input.situacaoReprodutiva === "AGUARDANDO_DIAGNOSTICO") { elegivel = null; motivos.push("DIAGNOSTICO_PENDENTE"); }
  else if (base.valor !== false && !["VAZIA", "APTA"].includes(input.situacaoReprodutiva)) { elegivel = null; motivos.push("SITUACAO_REPRODUTIVA_DESCONHECIDA"); }
  if (elegivel === true) motivos.push(decisao?.tipo === "LIBERAR" ? "LIBERACAO_INDIVIDUAL" : "LIBERACAO_PELA_POLITICA");
  return { animalId: input.animalId, propriedadeId: input.propriedadeId, dataReferencia: diaTexto(ref),
    estado: elegivel === true ? "ELEGIVEL" : elegivel === false ? "NAO_ELEGIVEL" : "PENDENTE", baseElegivel: base.valor, elegivel,
    aptaDesde: aptaDesde ? diaTexto(aptaDesde) : null,
    ciclo: ciclo ? { chaveCiclo: ciclo.chaveCiclo, inicioCiclo: diaTexto(ciclo.inicioCiclo), partoId: ciclo.partoId } : null,
    vinculoCicloId: vinculo?.id ?? null, politicaId: politica?.id ?? input.politicaInvalida?.id ?? null, politicaVersao: politica?.versao ?? input.politicaInvalida?.versao ?? null,
    metodologia: "IDEAGRI_IILB_BASE_V1", decisaoId: decisao?.id ?? null, motivos, alertas, restricaoIds: restricoes.map(r => r.id).sort() };
}

/** Conjunto carregado uma vez para avaliar várias datas sem consultas por animal/dia. */
export type DadosElegibilidade = {
  animais: Array<HistoricoContextoAnimal["animal"] & { sexo: string }>;
  partos: Array<HistoricoContextoAnimal["partos"][number] & { desfecho: string | null; gestacaoId: string | null }>;
  tentativas: Array<HistoricoContextoAnimal["tentativas"][number]>;
  lactacoes: Array<HistoricoContextoAnimal["lactacoes"][number]>;
  gestacoes: Array<HistoricoContextoAnimal["gestacoes"][number] & { motivoEncerramento: string | null }>;
  localizacoes: Array<HistoricoContextoAnimal["localizacoes"][number]>;
  avaliacoes: Array<HistoricoContextoAnimal["avaliacoes"][number]>;
  iniciais: Array<HistoricoContextoAnimal["iniciais"][number] & { id: string; aptaDesde: Date | null; criadoEm: Date }>;
  vinculos: Array<{ id: string; animalId: string; chaveCiclo: string; inicioCiclo: Date; politicaId: string | null; situacaoInicialId?: string | null }>;
  politicas: Array<{ id: string; versao: number; parametros: unknown }>;
  decisoes: Array<DecisaoElegibilidade & { vinculoCicloId: string }>;
  restricoes: Array<{ id: string; animalId: string; data: Date; ate: Date | null; status: string; tipo: string }>;
  papeis: Array<EvidenciaPapel & { animalId: string }>;
  baixas: Array<{ animalId: string; data: Date; estornadaEm: Date | null }>;
};

/** Não reconstitui o conhecimento passado; snapshots preservam a emissão original. */
export function calcularElegibilidadesDoConjunto(dados: DadosElegibilidade, propriedadeId: number, referencia: Date): Map<string, ElegibilidadeNaData> {
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
    const papel = resolverPapelReprodutivo(porAnimal(dados.papeis, animal.id), ref);
    const restricoes = porAnimal(dados.restricoes, animal.id).filter(r => r.status === "VALIDO" && r.data <= ref);
    const descarte = restricoes.some(r => r.tipo === "DESCARTE" && (!r.ate || r.ate > ref));
    const encerradas = porAnimal(dados.gestacoes, animal.id).filter(g => g.status === "VALIDO" && g.encerradaEm && g.encerradaEm <= ref
      && (!ciclo || g.encerradaEm >= ciclo.inicioCiclo) && !partos.some(p => p.status === "VALIDO" && p.gestacaoId === g.id));
    // Encerramento do parto não é perda: vínculo factual prevalece e prefixos legados são conservados.
    const perda = encerradas.filter(g => g.motivoEncerramento && g.motivoEncerramento !== "PARTO" && !g.motivoEncerramento.startsWith("PARTO_"))
      .sort((a, b) => b.encerradaEm!.getTime() - a.encerradaEm!.getTime())[0];
    const item = calcularElegibilidadeNaData({ animalId: animal.id, propriedadeId, referencia: ref, sexo: animal.sexo,
      propriedadeNaData: contexto.localizacaoNaData?.propriedadeId ?? null, localizacaoConflitante: contexto.pendencias.includes("LOCALIZACOES_SOBREPOSTAS"),
      baixaEm: porAnimal(dados.baixas, animal.id).find(b => !b.estornadaEm && b.data <= ref)?.data ?? null,
      ciclo, vinculo, politica: politica && parametros?.success ? { id: politica.id, versao: politica.versao, parametros: parametros.data } : null,
      politicaInvalida: politica && !parametros?.success ? { id: politica.id, versao: politica.versao } : undefined,
      decisoes: dados.decisoes.filter(d => d.vinculoCicloId === vinculo?.id), papel: papel.papel, papelConflitante: papel.estado === "CONFLITO", descarte,
      restricoes: restricoes.filter(r => r.tipo !== "DESCARTE"), situacaoReprodutiva: contexto.situacaoReprodutiva, perdaGestacionalEm: perda?.encerradaEm ?? null });
    if (contexto.pendencias.includes("GESTACOES_SOBREPOSTAS")) {
      item.motivos.push("GESTACOES_CONFLITANTES");
      if (item.elegivel !== false) { item.elegivel = null; item.estado = "PENDENTE"; }
    }
    if (vinculo?.situacaoInicialId && vinculo.inicioCiclo <= ref && !iniciais.some(i => i.id === vinculo.situacaoInicialId)) {
      item.motivos.push("ORIGEM_INICIAL_ANULADA");
      item.baseElegivel = null;
      if (item.elegivel !== false) { item.elegivel = null; item.estado = "PENDENTE"; }
    }
    if (encerradas.some(g => !g.motivoEncerramento || g.motivoEncerramento.startsWith("PARTO_DESVINCULADO"))) {
      item.motivos.push("ENCERRAMENTO_GESTACAO_DESCONHECIDO");
      if (item.elegivel !== false) { item.elegivel = null; item.estado = "PENDENTE"; }
    }
    resultado.set(animal.id, item);
  }
  return resultado;
}
