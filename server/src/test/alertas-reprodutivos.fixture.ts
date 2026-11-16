import type { Prisma } from "@prisma/client";

/** Remove somente projeções dos animais criados pela própria suíte. */
export async function limparAlertasReprodutivosFixtureTx(
  tx: Prisma.TransactionClient,
  animalIds: readonly string[],
) {
  const ids = [...new Set(animalIds)];
  if (!ids.length) return;

  const alertas = await tx.alerta.findMany({
    where: {
      proprietario: "fazendinha",
      produtor: "reproducao",
      sujeitoTipo: "ANIMAL",
      sujeitoId: { in: ids },
    },
    select: { id: true },
  });
  await tx.necessidadeReprodutiva.deleteMany({
    where: { animalId: { in: ids } },
  });
  if (!alertas.length) return;

  const alertaId = { in: alertas.map(alerta => alerta.id) };
  await tx.eventoAlerta.deleteMany({ where: { alertaId } });
  await tx.alerta.deleteMany({ where: { id: alertaId } });
  // AvaliacaoAlertas é cobertura global do produtor, sem FK para estas fixtures.
}
