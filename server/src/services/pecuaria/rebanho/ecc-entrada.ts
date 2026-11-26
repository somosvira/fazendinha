import type { Prisma } from "@prisma/client";
import { registrarExameTx } from "../sanidade/exames.js";
import { TIPO_EXAME_ESCORE_CORPORAL } from "../reproducao/escore-corporal.calc.js";
import { RebanhoError } from "./regras.js";

/** Registra a observação no mesmo commit do animal e preserva o formato versionado do exame. */
export async function registrarEccEntradaTx(tx: Prisma.TransactionClient, input: { animalId: string; propriedadeId: number; data: string; valor: number }, usuarioId: number | null) {
  try {
    return await registrarExameTx(tx, { animalId: input.animalId, propriedadeId: input.propriedadeId, data: input.data, tipoExameId: TIPO_EXAME_ESCORE_CORPORAL,
      resultados: [{ campo: "ESCORE", valor: input.valor }, { campo: "ESCALA_MIN", valor: 1 }, { campo: "ESCALA_MAX", valor: 5 }] }, usuarioId);
  } catch (erro) {
    if (erro instanceof RebanhoError) throw new RebanhoError(erro.code, erro.message, "eccEntrada");
    throw erro;
  }
}
