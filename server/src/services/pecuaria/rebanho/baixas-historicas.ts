import { hashDados } from "../reproducao/operacoes.js";
import { Prisma } from "@prisma/client";
import { transacaoPecuaria } from "../transacao.js";
import { registrarBaixaTx, exigirNoEscopo } from "./animais.js";
import { auditar, exigirAfetadas, RebanhoError, travarAnimais } from "./regras.js";
import { mensagemMotivoRecusado, motivoAceito } from "./baixa.calc.js";
import {
  regularizarBaixaHistoricaSchema, revisarClassificacaoBaixaSchema,
  type RegularizarBaixaHistoricaInput, type RevisarClassificacaoBaixaInput,
} from "./schemas.js";

type Tx = Prisma.TransactionClient;
type Snapshot = RegularizarBaixaHistoricaInput & {
  usuarioId: number;
  registradaEm: string;
  revisao?: { dados: RevisarClassificacaoBaixaInput; usuarioId: number; registradaEm: string };
};
const json = (valor: unknown) => JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
const equivalente = (a: unknown, b: unknown) => hashDados(a) === hashDados(b);
function exigirAutor(usuarioId: number) {
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0)
    throw new RebanhoError("VALIDACAO", "Regularização histórica exige usuário real identificado.");
}
function snapshotDe(valor: Prisma.JsonValue | null): Snapshot {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor))
    throw new RebanhoError("CONFLITO", "Baixa sem regularização histórica comprovada.");
  const origem = regularizarBaixaHistoricaSchema.strip().safeParse(valor);
  if (!origem.success || typeof valor.usuarioId !== "number")
    throw new RebanhoError("CONFLITO", "Origem da regularização exige conferência.");
  return valor as unknown as Snapshot;
}
async function exigirLocalNoEscopoTx(tx: Tx, animalId: string, escopo: number | null, localizacaoId?: string | null) {
  if (escopo === null) return;
  const local = localizacaoId
    ? await tx.localizacaoAnimal.findFirst({ where: { id: localizacaoId, animalId } })
    : await tx.localizacaoAnimal.findFirst({ where: { animalId, ate: null } });
  if (!local || local.propriedadeId !== escopo)
    throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
}
function dto(baixa: { id: string; animalId: string; data: Date; tipo: string; motivoId: string | null; estornadaEm: Date | null; regularizacaoHistoricaSnapshot: Prisma.JsonValue | null }) {
  const origem = snapshotDe(baixa.regularizacaoHistoricaSnapshot);
  return {
    id: baixa.id, animalId: baixa.animalId, data: baixa.data.toISOString().slice(0, 10),
    tipo: baixa.tipo, motivoId: baixa.motivoId, estornadaEm: baixa.estornadaEm?.toISOString() ?? null,
    regularizacaoHistorica: { bancoOrigem: origem.bancoOrigem, chaveOrigem: origem.chaveOrigem, evidencia: origem.evidencia, motivo: origem.motivo, usuarioId: origem.usuarioId, registradaEm: origem.registradaEm, revisao: origem.revisao ?? null },
  };
}

/** Mantém a identidade da origem mesmo após revisão ou estorno. Não relança
 * nem reativa uma saída estornada por reenvio do mesmo documento. */
export async function regularizarBaixaHistoricaTx(tx: Tx, animalId: string, input: RegularizarBaixaHistoricaInput, usuarioId: number, escopo: number | null) {
  exigirAutor(usuarioId);
  const dados = regularizarBaixaHistoricaSchema.parse(input);
  await travarAnimais(tx, [animalId]);
  const referencia = JSON.stringify([dados.bancoOrigem, dados.chaveOrigem]);
  const existente = await tx.baixaAnimal.findUnique({ where: { referenciaHistorica: referencia } });
  if (existente) {
    await exigirLocalNoEscopoTx(tx, animalId, escopo, existente.localizacaoFechadaId);
    const origem = snapshotDe(existente.regularizacaoHistoricaSnapshot);
    if (existente.animalId !== animalId || origem.usuarioId !== usuarioId ||
      !equivalente(regularizarBaixaHistoricaSchema.strip().parse(origem), dados))
      throw new RebanhoError("CONFLITO", "Origem já regularizada com dados ou autoria diferentes; revise o registro existente.");
    return dto(existente);
  }
  await exigirNoEscopo(tx, animalId, escopo);
  await exigirLocalNoEscopoTx(tx, animalId, escopo);
  const baixa = await registrarBaixaTx(tx, {
    animalId, data: dados.data, tipo: "NAO_DETERMINADO", observacao: dados.motivo,
    cienciaSanitaria: dados.cienciaSanitaria, justificativaSanitaria: dados.justificativaSanitaria,
  }, usuarioId, { referencia, origem: dados });
  return dto(baixa);
}

/** Apenas a classificação da saída já comprovada muda. O executor não cria
 * baixa, localização, receita, consumo ou estorno. */
export async function revisarClassificacaoBaixaTx(tx: Tx, animalId: string, baixaId: string, input: RevisarClassificacaoBaixaInput, usuarioId: number, escopo: number | null) {
  exigirAutor(usuarioId);
  const dados = revisarClassificacaoBaixaSchema.parse(input);
  await travarAnimais(tx, [animalId]);
  const baixa = await tx.baixaAnimal.findUnique({ where: { id: baixaId } });
  if (!baixa || baixa.animalId !== animalId)
    throw new RebanhoError("NAO_ENCONTRADO", "Baixa não encontrada");
  await exigirLocalNoEscopoTx(tx, animalId, escopo, baixa.localizacaoFechadaId);
  const origem = snapshotDe(baixa.regularizacaoHistoricaSnapshot);
  if (origem.revisao?.dados.chave === dados.chave) {
    if (origem.revisao.usuarioId !== usuarioId || !equivalente(origem.revisao.dados, dados))
      throw new RebanhoError("CONFLITO", "Chave de revisão já utilizada com outros dados.");
    return dto(baixa);
  }
  if (baixa.estornadaEm || baixa.tipo !== "NAO_DETERMINADO")
    throw new RebanhoError("CONFLITO", "A classificação já foi revisada ou a baixa foi estornada.");
  if (dados.motivoId) {
    const motivo = await tx.motivoBaixa.findFirst({ where: { id: dados.motivoId, ativo: true } });
    if (!motivo) throw new RebanhoError("NAO_ENCONTRADO", "Motivo de baixa não encontrado", "motivoId");
    if (!motivoAceito(dados.tipo, motivo.classe))
      throw new RebanhoError("VALIDACAO", mensagemMotivoRecusado(dados.tipo, motivo.classe), "motivoId");
  }
  const { carenciaAnimalTx } = await import("../sanidade/aplicacoes.js");
  const carencias = await carenciaAnimalTx(tx, animalId, baixa.data.toISOString().slice(0, 10));
  const fimDia = new Date(`${baixa.data.toISOString().slice(0, 10)}T00:00:00-03:00`);
  const restricoes = [carencias.leite, carencias.carne].filter((p) => p.estado === "NAO_INFORMADO" || p.estado === "CONHECIDO" && p.ate > fimDia);
  if (["VENDA", "ABATE"].includes(dados.tipo) && restricoes.length && (!dados.cienciaSanitaria || !dados.justificativaSanitaria?.trim()))
    throw new RebanhoError("VALIDACAO", "Confira as carências históricas e justifique a classificação.", "justificativaSanitaria");
  const revisao = { dados, usuarioId, registradaEm: new Date().toISOString(), carencias };
  exigirAfetadas(await tx.baixaAnimal.updateMany({
    where: { id: baixaId, animalId, tipo: "NAO_DETERMINADO", estornadaEm: null },
    data: { tipo: dados.tipo, motivoId: dados.motivoId ?? null, regularizacaoHistoricaSnapshot: json({ ...origem, revisao }) },
  }), 1);
  const atualizada = await tx.baixaAnimal.findUniqueOrThrow({ where: { id: baixaId } });
  const local = baixa.localizacaoFechadaId ? await tx.localizacaoAnimal.findFirst({ where: { id: baixa.localizacaoFechadaId } }) : null;
  await auditar(tx, { entidade: "BaixaAnimal", entidadeId: baixaId, animalId, propriedadeId: local?.propriedadeId ?? null, acao: "RECLASSIFICACAO", usuarioId, antes: baixa, depois: atualizada });
  return dto(atualizada);
}

export function regularizarBaixaHistorica(animalId: string, input: RegularizarBaixaHistoricaInput, usuarioId: number, escopo: number | null) {
  return transacaoPecuaria(tx => regularizarBaixaHistoricaTx(tx, animalId, input, usuarioId, escopo));
}
export function revisarClassificacaoBaixa(animalId: string, baixaId: string, input: RevisarClassificacaoBaixaInput, usuarioId: number, escopo: number | null) {
  return transacaoPecuaria(tx => revisarClassificacaoBaixaTx(tx, animalId, baixaId, input, usuarioId, escopo));
}
