import type { NecessidadeReprodutiva, Prisma } from "@prisma/client";
import { auditar, RebanhoError } from "../../rebanho/regras.js";
type Tx = Prisma.TransactionClient;
const json = (valor: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(valor));
export async function necessidadeAtualTx(
  tx: Pick<Tx, "necessidadeReprodutiva">,
  origem: NecessidadeReprodutiva,
) {
  return resolverIdentidadeNecessidade(origem, (id) =>
    tx.necessidadeReprodutiva.findUniqueOrThrow({ where: { id } }),
  );
}
export async function resolverIdentidadeNecessidade<
  T extends { id: string; convergidaParaId: string | null },
>(origem: T, carregar: (id: string) => Promise<T>) {
  let atual = origem;
  const visitadas = new Set<string>();
  while (atual.convergidaParaId) {
    if (visitadas.has(atual.id))
      throw new RebanhoError(
        "CONFLITO",
        "Convergência de cuidado inválida; confira o histórico",
      );
    visitadas.add(atual.id);
    atual = await carregar(atual.convergidaParaId);
  }
  return atual;
}
/** A demanda factual mantém sua identidade publicada; a tarefa anterior vira acesso histórico. */
export async function convergirNecessidadesTx(
  tx: Tx,
  destino: NecessidadeReprodutiva,
  origem: NecessidadeReprodutiva,
  usuarioId: number | null,
) {
  if (destino.id === origem.id) return { destino, origem };
  if (
    origem.animalId !== destino.animalId ||
    origem.convergidaParaId ||
    destino.convergidaParaId
  )
    throw new RebanhoError(
      "CONFLITO",
      "Necessidades não representam uma convergência válida",
    );
  // Uma decisão terminal de dispensa continua valendo; nos demais casos conserva-se a
  // decisão da identidade factual, ou a da tarefa quando ainda não havia decisão factual.
  const decisaoAdotada =
    origem.decisao === "DISPENSAR" && destino.decisao !== "DISPENSAR"
      ? origem
      : destino.decisao
        ? destino
        : origem;
  const historica = await tx.necessidadeReprodutiva.update({
    where: { id: origem.id },
    data: {
      convergidaParaId: destino.id,
      convergenciaSnapshot: json({
        versao: 1,
        origem,
        destino,
        decisaoAdotadaId: decisaoAdotada.id,
        usuarioId,
        registradaEm: new Date().toISOString(),
      }),
      tarefaId: null,
      demandaId: null,
      situacao: "ENCERRADO",
      motivo:
        "Cuidado reunido à identidade factual já publicada; histórico preservado",
      revisao: { increment: 1 },
    },
  });
  const atual =
    decisaoAdotada.id === origem.id && origem.decisao
      ? await tx.necessidadeReprodutiva.update({
          where: { id: destino.id },
          data: {
            decisao: origem.decisao,
            decisaoMotivo: origem.decisaoMotivo,
            decisaoPorId: origem.decisaoPorId,
            decisaoDestino: origem.decisaoDestino,
            revisaoEm: origem.revisaoEm,
            revisao: { increment: 1 },
          },
        })
      : destino;
  await auditar(tx, {
    entidade: "NecessidadeReprodutiva",
    entidadeId: origem.id,
    animalId: origem.animalId,
    propriedadeId: origem.propriedadeId,
    usuarioId,
    acao: "CONVERGENCIA",
    antes: origem,
    depois: { ...historica, identidadeAtualId: destino.id },
  });
  return { destino: atual, origem: historica };
}
