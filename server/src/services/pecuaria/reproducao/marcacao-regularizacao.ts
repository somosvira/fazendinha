import type { Prisma } from "@prisma/client";

/** Preserva a realização e o fato original até a regularização explícita; não move estoque. */
export async function marcarRegularizacaoFatoTx(tx: Prisma.TransactionClient, input: {
  fatoTipo: "TENTATIVA" | "AVALIACAO" | "APLICACAO" | "EXAME" | "MANEJO";
  fatoId: string;
  destinoConsumo: "DEVOLVER_ESTOQUE" | "MANTER_CONSUMO" | null;
  motivo: string;
  usuarioId: number | null;
}) {
  const evento = { acao: "FATO_ANULADO", ...input, data: new Date().toISOString() };
  const exameId = input.fatoTipo === "AVALIACAO" ? (await tx.interpretacaoReprodutiva.findUniqueOrThrow({ where: { id: input.fatoId } })).exameId : input.fatoTipo === "EXAME" ? input.fatoId : undefined;
  const vinculo = input.fatoTipo === "TENTATIVA" ? { tentativaId: input.fatoId } : exameId ? { exameId } : input.fatoTipo==="MANEJO"?{manejoId:input.fatoId}:{ aplicacaoId: input.fatoId };
  const vinculos = await tx.vinculoTarefaProtocolo.findMany({ where: { ...vinculo, estado: "ATUAL" }, include: { tarefa: true } });
  const tarefas = vinculos.map(v => v.tarefa);
  const fatoModelo = { TENTATIVA: "TentativaReprodutiva", AVALIACAO: "AvaliacaoReprodutiva", APLICACAO: "AplicacaoProduto", EXAME: "ExameAnimal", MANEJO:"ManejoAnimal" }[input.fatoTipo];
  const participantes = await tx.participanteVisita.findMany({ where: { status: "CONFIRMADO", OR: [
    { fatoTipo: fatoModelo, fatoId: input.fatoId },
    { tarefaId: { in: tarefas.map((t) => t.id) } },
    { fatoTipo: "TarefaIatf", fatoId: { in: tarefas.map((t) => t.id) } },
  ] } });
  for (const tarefa of tarefas)
    await tx.tarefaProtocolo.update({ where: { id: tarefa.id }, data: { regularizacaoPendente: true, historicoRegularizacao: [...(Array.isArray(tarefa.historicoRegularizacao) ? tarefa.historicoRegularizacao : []), evento] as Prisma.InputJsonValue } });
  for (const participante of participantes)
    await tx.participanteVisita.update({ where: { id: participante.id }, data: { regularizacaoPendente: true, historicoRegularizacao: [...(Array.isArray(participante.historicoRegularizacao) ? participante.historicoRegularizacao : []), evento] as Prisma.InputJsonValue } });
}
