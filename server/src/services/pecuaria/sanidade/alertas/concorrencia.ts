import type { Prisma } from "@prisma/client";
import { RebanhoError } from "../../rebanho/regras.js";

/** Um lote deve soltar o checkpoint antes de tentar novamente: nunca espera animal/configuração. */
export class ConflitoAvaliacaoSanitaria extends RebanhoError {
  constructor() { super("CONFLITO", "O cuidado mudou durante a avaliação. Consulte novamente"); }
}

/** Mesma chave de travarAnimais; a tentativa sem espera evita checkpoint → animal → checkpoint. */
export async function tentarTravarAnimaisAlertasTx(tx: Prisma.TransactionClient, ids: string[]) {
  if (!ids.length) return;
  const chaves = [...new Set(ids)].map(id => `pec-animal:${id}`);
  const [resultado] = await tx.$queryRaw<Array<{ adquirido: boolean }>>`
    SELECT bool_and(pg_try_advisory_xact_lock(h)) AS adquirido
    FROM (SELECT DISTINCT hashtext(k)::bigint AS h FROM unnest(${chaves}::text[]) AS k ORDER BY h) chaves`;
  if (!resultado?.adquirido) throw new ConflitoAvaliacaoSanitaria();
}

export async function tentarTravarConfiguracaoAlertaTx(tx: Prisma.TransactionClient, tipo: "regra" | "programacao", id: string) {
  const [resultado] = await tx.$queryRaw<Array<{ adquirido: boolean }>>`
    SELECT pg_try_advisory_xact_lock(hashtextextended(${`${tipo}:${id}`}, 0)) AS adquirido`;
  if (!resultado?.adquirido) throw new ConflitoAvaliacaoSanitaria();
}

/** Gestão pode esperar: não possui checkpoint nem adquire as travas dos animais depois desta. */
export async function travarConfiguracaoAlertaTx(tx: Prisma.TransactionClient, tipo: "regra" | "programacao", id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tipo}:${id}`}, 0))`;
}
