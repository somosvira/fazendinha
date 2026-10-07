import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { confirmarFato } from "../idempotencia.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);

async function conferirAnimal(tx: Prisma.TransactionClient, animalId: string, propriedadeId: number, data: string) {
  return conferirAnimalNoFato(tx, animalId, propriedadeId, dia(data));
}

export async function registrarPesagensColetivas(input: { chave: string; propriedadeId: number; data: string;
  tipo: "ROTINA" | "ENTRADA" | "DESMAMA" | "SAIDA"; origem: "MANUAL" | "BALANCA";
  itens: Array<{ animalId: string; pesoKg: number; observacao?: string | null }> }, usuarioId: number | null) {
  const ids = input.itens.map((i) => i.animalId);
  if (!ids.length || ids.length > 500 || new Set(ids).size !== ids.length) throw new RebanhoError("VALIDACAO", "Selecione de 1 a 500 animais sem repetição", "itens");
  const hashPayload = crypto.createHash("sha256").update(JSON.stringify({ ...input, itens: [...input.itens].sort((a, b) => a.animalId.localeCompare(b.animalId)) })).digest("hex");
  return transacaoPecuaria(async (tx) => {
    await travarAnimais(tx, ids);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-requisicao:${input.chave}`}))`;
    const anterior = await tx.requisicaoPecuaria.findUnique({ where: { chave: input.chave } });
    if (anterior) {
      if (anterior.hashPayload !== hashPayload || anterior.usuarioId !== usuarioId || anterior.operacao !== "PESAGEM_COLETIVA" || anterior.propriedadeId !== input.propriedadeId) {
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
  });
}

async function registrarManejoTx(tx: Prisma.TransactionClient, input: { chave?: string; animalId: string; propriedadeId: number; data: string; tipo: "DESMAMA" | "CASTRACAO";
  pesoKg?: number | null; responsavel?: string | null; observacao?: string | null }, usuarioId: number | null) {
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
}

export async function registrarManejo(input: Parameters<typeof registrarManejoTx>[1], usuarioId: number | null) {
  return confirmarFato(input, usuarioId, "MANEJO", registrarManejoTx, (tx, id) => tx.manejoAnimal.findUniqueOrThrow({ where: { id } }));
}

export async function listarManejos(animalId: string | undefined, propriedadeId: number | null) {
  return prisma.manejoAnimal.findMany({ where: { ...(animalId ? { animalId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) },
    include: { pesagem: { select: { id: true, pesoKg: true } } }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], take: 100 });
}

export async function anularManejo(id: string, propriedadeId: number, motivo: string, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const original = await tx.manejoAnimal.findFirst({ where: { id, propriedadeId, status: "VALIDO" } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Manejo não encontrado ou já anulado");
    await travarAnimais(tx, [original.animalId]);
    const salvo = await tx.manejoAnimal.update({ where: { id }, data: { status: "ANULADO", motivoAnulacao: motivo, anuladoEm: new Date(), pesagemId: null } });
    await auditar(tx, { entidade: "ManejoAnimal", entidadeId: id, animalId: original.animalId, propriedadeId, acao: "ANULACAO", usuarioId, antes: original, depois: salvo });
    // A pesagem é um fato independente e não é removida pela anulação do manejo.
    return salvo;
  });
}
