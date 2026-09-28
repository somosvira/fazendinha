import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);

export async function listarDoencas() {
  return prisma.doenca.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });
}

export async function criarDoenca(nome: string, motivoBaixaSugeridoId: string | null, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    if (motivoBaixaSugeridoId && !(await tx.motivoBaixa.findUnique({ where: { id: motivoBaixaSugeridoId } }))) {
      throw new RebanhoError("VALIDACAO", "Motivo de baixa não encontrado", "motivoBaixaSugeridoId");
    }
    const doenca = await tx.doenca.create({ data: { nome: nome.trim(), motivoBaixaSugeridoId } });
    await auditar(tx, { entidade: "Doenca", entidadeId: doenca.id, acao: "CADASTRO", usuarioId, depois: doenca });
    return doenca;
  });
}

export async function listarOcorrencias(animalId: string | undefined, propriedadeId: number | null) {
  return prisma.ocorrenciaSanitaria.findMany({ where: { ...(animalId ? { animalId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) },
    include: { doenca: { select: { id: true, nome: true } }, _count: { select: { aplicacoes: true, exames: true, execucoes: true } } },
    orderBy: [{ inicio: "desc" }, { criadoEm: "desc" }], take: 100 });
}

export async function criarOcorrencia(input: { animalId: string; propriedadeId: number; doencaId: string; inicio: string; observacao?: string | null }, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [input.animalId]);
    const inicio = dia(input.inicio);
    const local = await tx.localizacaoAnimal.findFirst({ where: { animalId: input.animalId, propriedadeId: input.propriedadeId,
      desde: { lte: inicio }, OR: [{ ate: null }, { ate: { gt: inicio } }] } });
    if (!local) throw new RebanhoError("VALIDACAO", "Animal não estava neste sítio na data da ocorrência", "inicio");
    if (!(await tx.doenca.findFirst({ where: { id: input.doencaId, ativo: true } }))) throw new RebanhoError("VALIDACAO", "Selecione uma doença ativa", "doencaId");
    const baixa = await tx.baixaAnimal.findFirst({ where: { animalId: input.animalId, estornadaEm: null } });
    if (baixa && inicio >= baixa.data) throw new RebanhoError("VALIDACAO", "Ocorrência não pode iniciar após a baixa", "inicio");
    const criada = await tx.ocorrenciaSanitaria.create({ data: { animalId: input.animalId, propriedadeId: input.propriedadeId,
      doencaId: input.doencaId, inicio, observacao: input.observacao?.trim() || null } });
    await auditar(tx, { entidade: "OcorrenciaSanitaria", entidadeId: criada.id, animalId: input.animalId, acao: "REGISTRO", usuarioId, depois: criada });
    return criada;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function encerrarOcorrencia(id: string, propriedadeId: number, input: { fim: string; desfecho: string }, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.ocorrenciaSanitaria.findFirst({ where: { id, propriedadeId, status: "VALIDO" } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Ocorrência não encontrada");
    await travarAnimais(tx, [original.animalId]);
    const atual = await tx.ocorrenciaSanitaria.findUniqueOrThrow({ where: { id } });
    if (atual.fim) throw new RebanhoError("CONFLITO", "Ocorrência já encerrada");
    const fim = dia(input.fim);
    if (fim < atual.inicio) throw new RebanhoError("VALIDACAO", "O fim não pode anteceder o início", "fim");
    const salva = await tx.ocorrenciaSanitaria.update({ where: { id }, data: { fim, desfecho: input.desfecho.trim() } });
    await auditar(tx, { entidade: "OcorrenciaSanitaria", entidadeId: id, animalId: atual.animalId, acao: "ENCERRAMENTO", usuarioId,
      antes: atual, depois: salva });
    return salva;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function anularOcorrencia(id: string, propriedadeId: number, motivo: string, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.ocorrenciaSanitaria.findFirst({ where: { id, propriedadeId, status: "VALIDO" } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Ocorrência não encontrada");
    await travarAnimais(tx, [original.animalId]);
    const fatos = await Promise.all([
      tx.aplicacaoProduto.count({ where: { ocorrenciaId: id, status: "VALIDO" } }),
      tx.exameAnimal.count({ where: { ocorrenciaId: id, status: "VALIDO" } }),
      tx.execucaoProtocoloSanitario.count({ where: { ocorrenciaId: id, canceladaEm: null } }),
    ]);
    if (fatos.some(Boolean)) throw new RebanhoError("CONFLITO", "A ocorrência tem fatos clínicos ativos; revise-os antes de anular");
    const salva = await tx.ocorrenciaSanitaria.update({ where: { id }, data: { status: "ANULADO", motivoAnulacao: motivo, anuladoEm: new Date() } });
    await auditar(tx, { entidade: "OcorrenciaSanitaria", entidadeId: id, animalId: original.animalId, acao: "ANULACAO", usuarioId,
      antes: original, depois: { status: salva.status, motivo } });
    return salva;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
