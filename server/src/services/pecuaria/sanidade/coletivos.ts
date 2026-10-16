import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { recuperarRequisicaoTx, guardarRequisicaoTx } from "../requisicoes.js";
export async function confirmarColetivo<T extends { animalId: string; propriedadeId: number }>(input: { chave: string; propriedadeId: number; itens: T[] }, usuarioId: number | null, operacao: string, criar: (tx: Prisma.TransactionClient, item: T, usuarioId: number | null) => Promise<{ id: string; animalId: string }>) {
  const ids = input.itens.map((i) => i.animalId);
  if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length || input.itens.some((i) => i.propriedadeId !== input.propriedadeId)) throw new RebanhoError("VALIDACAO", "Selecione de 1 a 100 animais distintos do mesmo sítio");
  const hashPayload = crypto.createHash("sha256").update(JSON.stringify({ ...input, itens: [...input.itens].sort((a, b) => a.animalId.localeCompare(b.animalId)) })).digest("hex");
  return transacaoPecuaria(async (tx) => {
    await travarAnimais(tx, ids);
    const identidade = { chave: input.chave, propriedadeId: input.propriedadeId, usuarioId, operacao, hashPayload };
    const anterior = await recuperarRequisicaoTx(tx, identidade);
    if (anterior) {
      return { resultados: anterior.resultadoIds };
    }
    const resultados = [];
    for (const [linha, item] of input.itens.entries()) {
      try { const criado = await criar(tx, item, usuarioId); resultados.push({ id: criado.id, animalId: criado.animalId }); }
      catch (e) { if (e instanceof RebanhoError) throw new RebanhoError(e.code, `Linha ${linha + 1}: ${e.message}. Nenhum item do conjunto foi gravado.`, `itens.${linha}.${e.campo ?? "animalId"}`); throw e; }
    }
    await guardarRequisicaoTx(tx, identidade, resultados);
    return { resultados };
  });
}
