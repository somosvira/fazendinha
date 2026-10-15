import { contarPartos } from "../rebanho/partos.calc.js";
import { situacaoReprodutiva } from "./regras.calc.js";

/** Datas factuais de @db.Date, representadas por meia-noite UTC, sem fuso/horário presumidos. */
export function dataCalendarioContexto(data: Date): Date {
  if (!Number.isFinite(data.getTime())) throw new Error("Data de contexto inválida");
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
}

export function diasCalendarioContexto(inicio: Date, referencia: Date): number {
  return (dataCalendarioContexto(referencia).getTime() - dataCalendarioContexto(inicio).getTime()) / 86_400_000;
}

type Fato = { id: string; animalId: string; propriedadeId: number | null; data: Date; status: string };
export type PartoContexto = Fato & { tipo: string; incluidoSaldoAnterior: boolean };
export type TentativaContexto = Fato & { tipo: string; ciclo: number; ordem: number; criadoEm: Date };
export type LactacaoContexto = {
  id: string; animalId: string; propriedadeId: number | null; partoId: string | null;
  inicio: Date; encerradaEm: Date | null; origem: string;
};
export type GestacaoContexto = {
  id: string; animalId: string; propriedadeId: number | null; tentativaId: string | null;
  confirmadaEm: Date; encerradaEm: Date | null; status: string;
};
export type LocalizacaoContexto = {
  id: string; animalId: string; propriedadeId: number; loteId: string | null; desde: Date; ate: Date | null;
};
export type AvaliacaoContexto = { animalId: string; data: Date; resultado: string; status: string };
export type InicialContexto = { animalId: string; data: Date; situacao: string; status: string };
export type HistoricoContextoAnimal = {
  animal: { id: string; dataEntrada: Date; partosAntesDaEntrada: number };
  partos: readonly PartoContexto[];
  tentativas: readonly TentativaContexto[];
  lactacoes: readonly LactacaoContexto[];
  gestacoes: readonly GestacaoContexto[];
  localizacoes: readonly LocalizacaoContexto[];
  avaliacoes: readonly AvaliacaoContexto[];
  iniciais: readonly InicialContexto[];
};

export type SituacaoProdutivaContexto = "LACTANTE" | "SECA" | "SEM_LACTACAO" | "NAO_INFORMADA";
type LactacaoNoContexto = {
  id: string; inicio: string; encerradaEm: string | null; partoId: string | null;
  propriedadeId: number | null; origem: string;
};
type TentativaNoContexto = {
  id: string; data: string; tipo: string; ciclo: number; ordem: number; propriedadeId: number | null;
};
export type PendenciaContextoAnimal =
  | "LOCALIZACOES_SOBREPOSTAS" | "LACTACOES_SOBREPOSTAS" | "GESTACOES_SOBREPOSTAS"
  | "VINCULO_GESTACAO_SEM_TENTATIVA_VALIDA" | "VINCULO_GESTACAO_FORA_DO_CICLO"
  | "SALDO_PARTOS_SEM_DISTRIBUICAO_TEMPORAL" | "LACTACAO_COM_PARTO_INVALIDO"
  | "IDADE_EMBRIONARIA_TE_NAO_INFORMADA";

export type ContextoAnimalNaData = {
  animalId: string;
  dataReferencia: string;
  situacaoProdutiva: SituacaoProdutivaContexto;
  evidenciaSituacaoProdutiva: { tipo: "INICIO_LACTACAO" | "ENCERRAMENTO_LACTACAO"; lactacaoId: string; data: string } | null;
  lactacaoVigente: LactacaoNoContexto | null;
  ultimaLactacaoEncerrada: (LactacaoNoContexto & { duracaoDias: number }) | null;
  /** D0 no início; nulo após encerramento, inclusive no dia da secagem. */
  del: number | null;
  ultimoParto: { id: string; data: string; tipo: string; propriedadeId: number | null } | null;
  diasPosParto: number | null;
  /** Paridade factual; nunca antecipa a OP do próximo parto durante uma gestação. */
  partosRealizados: number | null;
  partosRegistrados: number;
  ultimaTentativa: TentativaNoContexto | null;
  ultimaTentativaCiclo: TentativaNoContexto | null;
  diasDesdeTentativa: number | null;
  tentativasCiclo: number;
  ordemNoCiclo: number | null;
  situacaoReprodutiva: string;
  gestacaoVigente: { id: string; confirmadaEm: string; tentativaId: string | null; propriedadeId: number | null } | null;
  diasDesdeConfirmacao: number | null;
  diasDesdeTentativaGestacao: number | null;
  /** Calendário desde a IA/cobertura vinculada. TE exige idade embrionária ainda não disponível. */
  idadeGestacionalDias: number | null;
  baseIdadeGestacional: { tipo: "TENTATIVA_COMPROVADA"; tentativaId: string; data: string; tipoTentativa: string } | null;
  localizacaoNaData: { id: string; propriedadeId: number; loteId: string | null; desde: string; ate: string | null } | null;
  pendencias: PendenciaContextoAnimal[];
};

const dataTexto = (data: Date) => dataCalendarioContexto(data).toISOString().slice(0, 10);
const compararDatas = (a: Date, b: Date) => dataCalendarioContexto(a).getTime() - dataCalendarioContexto(b).getTime();
const ordenarFatos = <T extends { id: string; data: Date }>(a: T, b: T) => compararDatas(b.data, a.data) || a.id.localeCompare(b.id);
const mapearLactacao = (l: LactacaoContexto): LactacaoNoContexto => ({
  id: l.id, inicio: dataTexto(l.inicio), encerradaEm: l.encerradaEm ? dataTexto(l.encerradaEm) : null,
  partoId: l.partoId, propriedadeId: l.propriedadeId, origem: l.origem,
});
const mapearTentativa = (t: TentativaContexto): TentativaNoContexto => ({
  id: t.id, data: dataTexto(t.data), tipo: t.tipo, ciclo: t.ciclo, ordem: t.ordem, propriedadeId: t.propriedadeId,
});

/**
 * Projeção dos fatos atualmente válidos na data de referência, inclusive registros retroativos.
 * Não reconstitui o conhecimento de uma impressão anterior: esse conhecimento vem do snapshot.
 * Histórico ausente não comprova seca nem ausência de lactações anteriores (SEM_LACTACAO).
 */
export function calcularContextoAnimalNaData(historico: HistoricoContextoAnimal, dataReferencia: Date): ContextoAnimalNaData {
  const referencia = dataCalendarioContexto(dataReferencia);
  const { animal } = historico;
  const pertence = (f: { animalId: string }) => f.animalId === animal.id;
  const ateReferencia = (data: Date) => compararDatas(data, referencia) <= 0;
  const vigora = (inicio: Date, fim: Date | null) => ateReferencia(inicio) && (!fim || compararDatas(fim, referencia) > 0);
  const pendencias: PendenciaContextoAnimal[] = [];
  const partos = historico.partos.filter(p => pertence(p) && p.status === "VALIDO" && ateReferencia(p.data)).sort(ordenarFatos);
  const ultimoParto = partos[0] ?? null;
  const tentativas = historico.tentativas.filter(t => pertence(t) && t.status === "VALIDO" && ateReferencia(t.data))
    .sort((a, b) => compararDatas(b.data, a.data) || b.criadoEm.getTime() - a.criadoEm.getTime() || a.id.localeCompare(b.id));
  const tentativasCiclo = tentativas.filter(t => !ultimoParto || compararDatas(t.data, ultimoParto.data) > 0);
  const ultimaTentativa = tentativas[0] ?? null;
  const ultimaTentativaCiclo = tentativasCiclo[0] ?? null;
  const lactacoes = historico.lactacoes.filter(l => pertence(l) && ateReferencia(l.inicio));
  const vigentes = lactacoes.filter(l => vigora(l.inicio, l.encerradaEm));
  if (vigentes.length > 1) pendencias.push("LACTACOES_SOBREPOSTAS");
  // Havendo conflito, não escolher uma lactação arbitrária nem produzir DEL.
  const lactacaoVigente = vigentes.length === 1 ? vigentes[0] : null;
  const encerradas = lactacoes.filter(l => l.encerradaEm && ateReferencia(l.encerradaEm))
    .sort((a, b) => compararDatas(b.encerradaEm!, a.encerradaEm!) || a.id.localeCompare(b.id));
  const ultimaEncerrada = encerradas[0] ?? null;
  const partoDaLactacaoInvalido = lactacaoVigente?.partoId != null && !partos.some(p => p.id === lactacaoVigente.partoId);
  if (partoDaLactacaoInvalido) pendencias.push("LACTACAO_COM_PARTO_INVALIDO");
  const secagemComprovada = vigentes.length === 0 && ultimaEncerrada != null &&
    (!ultimoParto || compararDatas(ultimoParto.data, ultimaEncerrada.encerradaEm!) <= 0);
  const situacaoProdutiva: SituacaoProdutivaContexto = lactacaoVigente && !partoDaLactacaoInvalido ? "LACTANTE" : secagemComprovada ? "SECA" : "NAO_INFORMADA";
  const evidenciaSituacaoProdutiva: ContextoAnimalNaData["evidenciaSituacaoProdutiva"] = situacaoProdutiva === "LACTANTE" && lactacaoVigente
    ? { tipo: "INICIO_LACTACAO", lactacaoId: lactacaoVigente.id, data: dataTexto(lactacaoVigente.inicio) }
    : situacaoProdutiva === "SECA" && ultimaEncerrada
      ? { tipo: "ENCERRAMENTO_LACTACAO", lactacaoId: ultimaEncerrada.id, data: dataTexto(ultimaEncerrada.encerradaEm!) }
      : null;

  const gestacoes = historico.gestacoes.filter(g => pertence(g) && g.status === "VALIDO" && ateReferencia(g.confirmadaEm))
    .sort((a, b) => compararDatas(b.confirmadaEm, a.confirmadaEm) || a.id.localeCompare(b.id));
  const gestacoesVigentes = gestacoes.filter(g => vigora(g.confirmadaEm, g.encerradaEm));
  if (gestacoesVigentes.length > 1) pendencias.push("GESTACOES_SOBREPOSTAS");
  const gestacaoVigente = gestacoesVigentes.length === 1 ? gestacoesVigentes[0] : null;
  let tentativaGestacao = gestacaoVigente?.tentativaId ? tentativas.find(t => t.id === gestacaoVigente.tentativaId) ?? null : null;
  if (gestacaoVigente?.tentativaId && (!tentativaGestacao || compararDatas(tentativaGestacao.data, gestacaoVigente.confirmadaEm) > 0)) {
    pendencias.push("VINCULO_GESTACAO_SEM_TENTATIVA_VALIDA");
    tentativaGestacao = null;
  }
  if (tentativaGestacao && ultimoParto && compararDatas(ultimoParto.data, tentativaGestacao.data) >= 0) {
    pendencias.push("VINCULO_GESTACAO_FORA_DO_CICLO");
    tentativaGestacao = null;
  }
  if (tentativaGestacao?.tipo === "TE") pendencias.push("IDADE_EMBRIONARIA_TE_NAO_INFORMADA");
  const locais = historico.localizacoes.filter(l => pertence(l) && vigora(l.desde, l.ate));
  if (locais.length > 1) pendencias.push("LOCALIZACOES_SOBREPOSTAS");
  const local = locais.length === 1 ? locais[0] : null;
  const avaliacoes = historico.avaliacoes.filter(a => pertence(a) && a.status === "VALIDO" && ateReferencia(a.data));
  const inicial = historico.iniciais.filter(i => pertence(i) && i.status === "VALIDO" && ateReferencia(i.data))
    .sort((a, b) => compararDatas(b.data, a.data))[0];
  const saldoSemDistribuicao = animal.partosAntesDaEntrada > 0 && compararDatas(referencia, animal.dataEntrada) < 0;
  if (saldoSemDistribuicao) pendencias.push("SALDO_PARTOS_SEM_DISTRIBUICAO_TEMPORAL");

  return {
    animalId: animal.id, dataReferencia: dataTexto(referencia), situacaoProdutiva, evidenciaSituacaoProdutiva,
    lactacaoVigente: lactacaoVigente ? mapearLactacao(lactacaoVigente) : null,
    ultimaLactacaoEncerrada: ultimaEncerrada ? { ...mapearLactacao(ultimaEncerrada), duracaoDias: diasCalendarioContexto(ultimaEncerrada.inicio, ultimaEncerrada.encerradaEm!) } : null,
    del: situacaoProdutiva === "LACTANTE" && lactacaoVigente ? diasCalendarioContexto(lactacaoVigente.inicio, referencia) : null,
    ultimoParto: ultimoParto ? { id: ultimoParto.id, data: dataTexto(ultimoParto.data), tipo: ultimoParto.tipo, propriedadeId: ultimoParto.propriedadeId } : null,
    diasPosParto: ultimoParto ? diasCalendarioContexto(ultimoParto.data, referencia) : null,
    partosRealizados: saldoSemDistribuicao ? null : contarPartos(animal.partosAntesDaEntrada, partos, referencia),
    partosRegistrados: partos.length,
    ultimaTentativa: ultimaTentativa ? mapearTentativa(ultimaTentativa) : null,
    ultimaTentativaCiclo: ultimaTentativaCiclo ? mapearTentativa(ultimaTentativaCiclo) : null,
    diasDesdeTentativa: ultimaTentativaCiclo ? diasCalendarioContexto(ultimaTentativaCiclo.data, referencia) : null,
    tentativasCiclo: tentativasCiclo.length, ordemNoCiclo: ultimaTentativaCiclo ? tentativasCiclo.length : null,
    situacaoReprodutiva: situacaoReprodutiva({ referencia, gestacao: gestacoes[0], avaliacoes, ultimaTentativa, ultimoParto, inicial }),
    gestacaoVigente: gestacaoVigente ? { id: gestacaoVigente.id, confirmadaEm: dataTexto(gestacaoVigente.confirmadaEm), tentativaId: gestacaoVigente.tentativaId, propriedadeId: gestacaoVigente.propriedadeId } : null,
    diasDesdeConfirmacao: gestacaoVigente ? diasCalendarioContexto(gestacaoVigente.confirmadaEm, referencia) : null,
    diasDesdeTentativaGestacao: tentativaGestacao ? diasCalendarioContexto(tentativaGestacao.data, referencia) : null,
    idadeGestacionalDias: tentativaGestacao && tentativaGestacao.tipo !== "TE" ? diasCalendarioContexto(tentativaGestacao.data, referencia) : null,
    baseIdadeGestacional: tentativaGestacao ? { tipo: "TENTATIVA_COMPROVADA", tentativaId: tentativaGestacao.id, data: dataTexto(tentativaGestacao.data), tipoTentativa: tentativaGestacao.tipo } : null,
    localizacaoNaData: local ? { id: local.id, propriedadeId: local.propriedadeId, loteId: local.loteId, desde: dataTexto(local.desde), ate: local.ate ? dataTexto(local.ate) : null } : null,
    pendencias,
  };
}
