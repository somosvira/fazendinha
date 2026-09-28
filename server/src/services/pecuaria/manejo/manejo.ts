import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { validarDataPesagem } from "../rebanho/datas.calc.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);

async function conferirAnimal(tx: Prisma.TransactionClient, animalId: string, propriedadeId: number, data: string) {
  const animal = await tx.animal.findUnique({ where: { id: animalId } });
  if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
  const local = await tx.localizacaoAnimal.findFirst({ where: { animalId, propriedadeId, desde: { lte: dia(data) },
    OR: [{ ate: null }, { ate: { gt: dia(data) } }] } });
  if (!local) throw new RebanhoError("VALIDACAO", "Animal não estava neste sítio na data informada", "data");
  const baixa = await tx.baixaAnimal.findFirst({ where: { animalId, estornadaEm: null } });
  const erros = validarDataPesagem({ dataNascimento: animal.dataNascimento, dataBaixa: baixa?.data ?? null, dataPesagem: data });
  if (erros.length) throw new RebanhoError("VALIDACAO", erros[0].mensagem, erros[0].campo);
  return animal;
}

export async function registrarPesagensColetivas(input: { chave: string; propriedadeId: number; data: string;
  tipo: "ROTINA" | "ENTRADA" | "DESMAMA" | "SAIDA"; origem: "MANUAL" | "BALANCA";
  itens: Array<{ animalId: string; pesoKg: number; observacao?: string | null }> }, usuarioId: number | null) {
  const ids = input.itens.map((i) => i.animalId);
  if (!ids.length || ids.length > 500 || new Set(ids).size !== ids.length) throw new RebanhoError("VALIDACAO", "Selecione de 1 a 500 animais sem repetição", "itens");
  const hashPayload = crypto.createHash("sha256").update(JSON.stringify({ ...input, itens: [...input.itens].sort((a, b) => a.animalId.localeCompare(b.animalId)) })).digest("hex");
  return prisma.$transaction(async (tx) => {
    await travarAnimais(tx, ids);
    const anterior = await tx.requisicaoPecuaria.findUnique({ where: { chave: input.chave } });
    if (anterior) {
      if (anterior.hashPayload !== hashPayload || anterior.operacao !== "PESAGEM_COLETIVA" || anterior.propriedadeId !== input.propriedadeId) {
        throw new RebanhoError("CONFLITO", "Chave de repetição já usada com outros dados");
      }
      return { requisicaoId: anterior.chave, pesagens: anterior.resultadoIds };
    }
    for (const item of input.itens) {
      await conferirAnimal(tx, item.animalId, input.propriedadeId, input.data);
      if (!Number.isFinite(item.pesoKg) || item.pesoKg <= 0 || item.pesoKg > 99999.99 || new Prisma.Decimal(item.pesoKg).decimalPlaces() > 2) {
        throw new RebanhoError("VALIDACAO", "Peso inválido", "pesoKg");
      }
    }
    await tx.requisicaoPecuaria.create({ data: { chave: input.chave, propriedadeId: input.propriedadeId,
      usuarioId, operacao: "PESAGEM_COLETIVA", hashPayload, resultadoIds: [] } });
    const pesagens = [];
    for (const item of input.itens) {
      const criada = await tx.pesagem.create({ data: { animalId: item.animalId, data: dia(input.data),
        pesoKg: new Prisma.Decimal(item.pesoKg), tipo: input.tipo, origem: input.origem,
        observacao: item.observacao?.trim() || null, requisicaoId: input.chave, criadoPorId: usuarioId } });
      pesagens.push({ id: criada.id, animalId: criada.animalId });
      await auditar(tx, { entidade: "Pesagem", entidadeId: criada.id, animalId: item.animalId, propriedadeId: input.propriedadeId,
        requisicaoId: input.chave, acao: "REGISTRO_COLETIVO", usuarioId, depois: criada });
    }
    await tx.requisicaoPecuaria.update({ where: { chave: input.chave }, data: { resultadoIds: pesagens } });
    return { requisicaoId: input.chave, pesagens };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function registrarManejo(input: { animalId: string; propriedadeId: number; data: string; tipo: "DESMAMA" | "CASTRACAO";
  pesoKg?: number | null; responsavel?: string | null; observacao?: string | null }, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [input.animalId]);
    const animal = await conferirAnimal(tx, input.animalId, input.propriedadeId, input.data);
    if (input.tipo === "CASTRACAO" && animal.sexo !== "M") throw new RebanhoError("VALIDACAO", "Castração só se aplica a animal macho", "tipo");
    if (await tx.manejoAnimal.findFirst({ where: { animalId: input.animalId, tipo: input.tipo, status: "VALIDO" } })) {
      throw new RebanhoError("CONFLITO", "Este manejo já consta no histórico do animal");
    }
    if (input.pesoKg != null && (!Number.isFinite(input.pesoKg) || input.pesoKg <= 0 || new Prisma.Decimal(input.pesoKg).decimalPlaces() > 2)) {
      throw new RebanhoError("VALIDACAO", "Peso inválido", "pesoKg");
    }
    const pesagem = input.pesoKg != null ? await tx.pesagem.create({ data: { animalId: input.animalId, data: dia(input.data),
      pesoKg: new Prisma.Decimal(input.pesoKg), tipo: input.tipo === "DESMAMA" ? "DESMAMA" : "ROTINA", origem: "MANUAL",
      observacao: `Peso no manejo: ${input.tipo.toLowerCase()}`, criadoPorId: usuarioId } }) : null;
    const manejo = await tx.manejoAnimal.create({ data: { animalId: input.animalId, propriedadeId: input.propriedadeId,
      data: dia(input.data), tipo: input.tipo, pesagemId: pesagem?.id ?? null,
      responsavel: input.responsavel?.trim() || null, observacao: input.observacao?.trim() || null } });
    await auditar(tx, { entidade: "ManejoAnimal", entidadeId: manejo.id, animalId: input.animalId, propriedadeId: input.propriedadeId,
      acao: "REGISTRO", usuarioId, depois: manejo });
    if (pesagem) await auditar(tx, { entidade: "Pesagem", entidadeId: pesagem.id, animalId: input.animalId,
      propriedadeId: input.propriedadeId, acao: "REGISTRO_MANEJO", usuarioId, depois: pesagem });
    return manejo;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listarManejos(animalId: string | undefined, propriedadeId: number | null) {
  return prisma.manejoAnimal.findMany({ where: { ...(animalId ? { animalId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) },
    include: { pesagem: { select: { id: true, pesoKg: true } } }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], take: 100 });
}
