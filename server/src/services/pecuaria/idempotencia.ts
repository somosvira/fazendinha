import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { RebanhoError, travarAnimais } from "./rebanho/regras.js";
import { transacaoPecuaria } from "./transacao.js";

function ordenarJson(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarJson);
  if (valor !== null && typeof valor === "object") return Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).map(([chave, item]) => [chave, ordenarJson(item)]));
  return valor;
}

/** A resposta é relida para que o chamador reaplique permissões de custo no reenvio. */
export async function confirmarFato<T extends { animalId: string; propriedadeId: number; chave?: string }, R extends { id: string }>(
  input: T, usuarioId: number | null, operacao: string,
  criar: (tx: Prisma.TransactionClient, input: T, usuarioId: number | null) => Promise<R>,
  buscar: (tx: Prisma.TransactionClient, id: string) => Promise<R>,
): Promise<R> {
  const hashPayload = crypto.createHash("sha256").update(JSON.stringify(ordenarJson(input))).digest("hex");
  return transacaoPecuaria(async (tx) => {
    await travarAnimais(tx, [input.animalId]);
    if (!input.chave) return criar(tx, input, usuarioId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-requisicao:${input.chave}`}))`;
    const anterior = await tx.requisicaoPecuaria.findUnique({ where: { chave: input.chave } });
    if (anterior) {
      if (anterior.hashPayload !== hashPayload || anterior.usuarioId !== usuarioId || anterior.propriedadeId !== input.propriedadeId || anterior.operacao !== operacao) throw new RebanhoError("CONFLITO", "Chave de reenvio usada com outros dados");
      const ids = anterior.resultadoIds;
      if (!ids || typeof ids !== "object" || Array.isArray(ids) || typeof ids.id !== "string") throw new RebanhoError("CONFLITO", "Não foi possível recuperar a confirmação; recarregue o histórico");
      return buscar(tx, ids.id);
    }
    const fato = await criar(tx, input, usuarioId);
    await tx.requisicaoPecuaria.create({ data: { chave: input.chave, propriedadeId: input.propriedadeId, usuarioId, operacao, hashPayload, resultadoIds: { id: fato.id } } });
    return fato;
  });
}
