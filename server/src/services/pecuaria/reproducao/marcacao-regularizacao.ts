import { atualizarTarefaReprodutivaTx } from "../protocolos/reproducao.js";
import type { Prisma } from "@prisma/client";

/** Preserva a realização e o fato original até a regularização explícita; não move estoque. */
export async function marcarRegularizacaoFatoTx(tx: Prisma.TransactionClient, input: {
  fatoTipo: "TENTATIVA" | "AVALIACAO" | "APLICACAO" | "EXAME";
  fatoId: string;
  destinoConsumo: "DEVOLVER_ESTOQUE" | "MANTER_CONSUMO" | null;
  motivo: string;
  usuarioId: number | null;
}) {
  const evento = { acao: "FATO_ANULADO", ...input, data: new Date().toISOString() };
  const vinculo = input.fatoTipo === "TENTATIVA" ? { tentativaId: input.fatoId } : input.fatoTipo === "AVALIACAO" ? { avaliacaoId: input.fatoId } : input.fatoTipo === "EXAME" ? { exameId: input.fatoId } : { aplicacaoId: input.fatoId };
  const tarefas = await tx.tarefaIatf.findMany({ where: vinculo });
  const fatoModelo = { TENTATIVA: "TentativaReprodutiva", AVALIACAO: "AvaliacaoReprodutiva", APLICACAO: "AplicacaoProduto", EXAME: "ExameAnimal" }[input.fatoTipo];
  const participantes = await tx.participanteVisita.findMany({ where: { status: "CONFIRMADO", OR: [
    { fatoTipo: fatoModelo, fatoId: input.fatoId },
    { tarefaId: { in: tarefas.map((t) => t.id) } },
    { fatoTipo: "TarefaIatf", fatoId: { in: tarefas.map((t) => t.id) } },
  ] } });
  for (const tarefa of tarefas)
    await atualizarTarefaReprodutivaTx(tx, { usuarioId: input.usuarioId, where: { id: tarefa.id }, data: { regularizacaoPendente: true, historicoRegularizacao: [...(Array.isArray(tarefa.historicoRegularizacao) ? tarefa.historicoRegularizacao : []), evento] as Prisma.InputJsonValue } });
  for (const participante of participantes)
    await tx.participanteVisita.update({ where: { id: participante.id }, data: { regularizacaoPendente: true, historicoRegularizacao: [...(Array.isArray(participante.historicoRegularizacao) ? participante.historicoRegularizacao : []), evento] as Prisma.InputJsonValue } });
}
