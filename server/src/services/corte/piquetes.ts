/* Serviço de Piquete (divisão física do pasto). Listagem read-only por enquanto.
 *
 * loteAtualId é derivado: o lote ATIVO que ocupa este piquete (se houver).
 */
import { prisma } from "../../db.js";
import { toPiqueteDTO } from "./lotes.mappers.js";
import type { Piquete } from "./mock.js";

export async function listarPiquetes(): Promise<Piquete[]> {
  const rows = await prisma.piquete.findMany({
    orderBy: { codigo: "asc" },
    include: { lotes: { where: { estado: "ATIVO" }, select: { id: true }, take: 1 } },
  });
  return rows.map((p) => toPiqueteDTO(p, p.lotes[0] ?? null));
}
