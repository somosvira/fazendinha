import { Prisma, type TipoProtocolo } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { eventoRegularizacao, listarSubstitutosTx, substituirEvidenciaAplicacaoTx, validarSubstitutoTx, type RegularizacaoInput } from "../reproducao/regularizacao.js";
import { vincularFatoTarefaTx } from "./vinculos.js";

/** A mesma referência vigente orienta Sanidade, IATF e visitas; fatos antigos não são escolhidos pela data de criação. */
export async function contextoRegularizacaoTx(tx: Prisma.TransactionClient, id: string, propriedadeId: number, tipo?: TipoProtocolo) {
  const tarefa = await tx.tarefaProtocolo.findFirst({ where: { id, ...(tipo ? { execucao: { protocolo: { tipo } } } : {}) }, include: {
    etapa: true, execucao: { include: { rodada: true, protocolo: true } },
    vinculos: { orderBy: { ordem: "desc" }, include: { aplicacao: true, tentativa: true, exame: { include: { interpretacao: { select: { id: true } } } } } },
  } });
  if (!tarefa) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada neste contexto");
  const vinculo = tarefa.vinculos.find(v => v.estado === "ATUAL") ?? tarefa.vinculos[0];
  const fato = vinculo?.aplicacao ?? vinculo?.exame ?? vinculo?.tentativa;
  if (!fato || fato.propriedadeId !== propriedadeId) throw new RebanhoError("NAO_ENCONTRADO", "Execução não encontrada neste sítio");
  const avaliacaoId = vinculo.exame?.interpretacao?.id ?? null;
  const fatoTipo = vinculo.aplicacaoId ? "AplicacaoProduto" : vinculo.tentativaId ? "TentativaReprodutiva" : avaliacaoId ? "AvaliacaoReprodutiva" : "ExameAnimal";
  const fatoId = avaliacaoId ?? fato.id;
  return { tarefa, vinculo, fato, fatoTipo, fatoId };
}

export async function regularizarTarefaComumTx(tx: Prisma.TransactionClient, id: string, input: RegularizacaoInput, usuarioId: number | null, tipo?: TipoProtocolo, snapshotAnterior?: unknown) {
  const ref = await contextoRegularizacaoTx(tx, id, input.propriedadeId, tipo);
  await travarAnimais(tx, [ref.tarefa.execucao.animalId]);
  await tx.$queryRaw`SELECT id FROM pecuaria."TarefaProtocolo" WHERE id=${id} FOR UPDATE`;
  const { tarefa, vinculo, fato, fatoTipo, fatoId } = await contextoRegularizacaoTx(tx, id, input.propriedadeId, tipo);
  if (!tarefa.regularizacaoPendente || fato.status !== "ANULADO") throw new RebanhoError("CONFLITO", "Tarefa não exige regularização de fato anulado");
  if (input.acao === "REABRIR" && (tarefa.execucao.canceladaEm || tarefa.dispensadaEm || tarefa.execucao.rodada?.status !== undefined && tarefa.execucao.rodada.status !== "ABERTA"))
    throw new RebanhoError("CONFLITO", "A participação e a tarefa precisam estar abertas para reabrir a pendência");
  if (input.acao === "REABRIR" && tarefa.vinculos.some(v => v.aplicacao?.consumoMantido || v.tentativa?.consumoMantido))
    throw new RebanhoError("VALIDACAO", "Consumo mantido impede repetir a execução", "cienciaNaoExecutado");
  const anterior = snapshotAnterior ?? { id, realizadaEm: tarefa.realizadaEm, realizadoSnapshot: tarefa.realizadoSnapshot, desviosSnapshot: tarefa.desviosSnapshot,
    aplicacaoId: vinculo.aplicacaoId, tentativaId: vinculo.tentativaId, exameId: vinculo.exameId, avaliacaoId: fatoTipo === "AvaliacaoReprodutiva" ? fatoId : null };
  const historicoRegularizacao = eventoRegularizacao(tarefa.historicoRegularizacao, input, anterior, usuarioId);
  const visitas = await tx.participanteVisita.findMany({ where: { status: "CONFIRMADO", regularizacaoPendente: true, OR: [{ tarefaId: id }, { fatoTipo: "TarefaIatf", fatoId: id }, { fatoTipo, fatoId }] } });
  const atividades = await tx.atividadeVisita.findMany({ where: { id: { in: visitas.map(v => v.atividadeId) } } });
  const cabecalhos = await tx.visitaVeterinaria.findMany({ where: { id: { in: atividades.map(a => a.visitaId) } } });
  if (input.acao === "REABRIR" && cabecalhos.some(v => v.encerradaEm)) throw new RebanhoError("CONFLITO", "Atendimento pertence a visita encerrada; registre a intervenção em outra atividade");
  if (input.acao === "VINCULAR_SUBSTITUTO") {
    const substituto = await validarSubstitutoTx(tx, fatoTipo, input, tarefa.execucao.animalId, fato.data, fatoId);
    if ("tarefaId" in substituto && substituto.tarefaId && substituto.tarefaId !== id) throw new RebanhoError("CONFLITO", "Substituto já pertence a outra tarefa", "fatoId");
    if (await tx.participanteVisita.count({ where: { status: "CONFIRMADO", fatoTipo, fatoId: input.fatoId, id: { notIn: visitas.map(v => v.id) } } })) throw new RebanhoError("CONFLITO", "Substituto já pertence a outro atendimento", "fatoId");
    if (fatoTipo === "ExameAnimal" && await tx.interpretacaoReprodutiva.count({ where: { exameId: input.fatoId } })) throw new RebanhoError("CONFLITO", "O substituto deve preservar a natureza do exame original", "fatoId");
    const exameId = fatoTipo === "AvaliacaoReprodutiva" ? (await tx.interpretacaoReprodutiva.findUniqueOrThrow({ where: { id: input.fatoId } })).exameId : fatoTipo === "ExameAnimal" ? input.fatoId : undefined;
    if (fatoTipo === "AplicacaoProduto") await substituirEvidenciaAplicacaoTx(tx, vinculo.aplicacaoId, input, usuarioId);
    await vincularFatoTarefaTx(tx, id, { ...(exameId ? { exameId } : {}), ...(fatoTipo === "AplicacaoProduto" ? { aplicacaoId: input.fatoId } : {}), ...(fatoTipo === "TentativaReprodutiva" ? { tentativaId: input.fatoId } : {}) }, usuarioId, "REGULARIZACAO", input.motivo);
  } else await tx.vinculoTarefaProtocolo.update({ where: { id: vinculo.id }, data: { estado: input.acao === "REABRIR" ? "REABERTO" : "ENCERRADO", encerradoEm: new Date(), motivo: input.motivo } });
  const salva = await tx.tarefaProtocolo.update({ where: { id }, data: { regularizacaoPendente: false, historicoRegularizacao,
    ...(input.acao === "REABRIR" ? { realizadaEm: null, realizadoSnapshot: Prisma.DbNull, desviosSnapshot: Prisma.DbNull, motivoDispensa: input.motivo } : {}) } });
  for (const v of visitas) await tx.participanteVisita.update({ where: { id: v.id }, data: { regularizacaoPendente: false,
    historicoRegularizacao: eventoRegularizacao(v.historicoRegularizacao, input, v, usuarioId),
    ...(input.acao === "REABRIR" ? { status: "PENDENTE", fatoId: null, fatoTipo: null, rascunho: {}, versaoRascunho: { increment: 1 } } : input.acao === "VINCULAR_SUBSTITUTO" && v.fatoTipo !== "TarefaIatf" ? { fatoId: input.fatoId } : {}) } });
  if (input.acao === "REABRIR") await tx.visitaVeterinaria.updateMany({ where: { id: { in: cabecalhos.map(v => v.id) } }, data: { status: "PARCIAL" } });
  await auditar(tx, { entidade: tarefa.execucao.protocolo.tipo === "REPRODUTIVO" ? "TarefaIatf" : "TarefaProtocolo", entidadeId: id, animalId: tarefa.execucao.animalId, propriedadeId: input.propriedadeId, usuarioId, acao: "REGULARIZACAO", antes: anterior, depois: salva });
  return salva;
}

export async function substitutosTarefaComum(id: string, propriedadeId: number, tipo?: TipoProtocolo) {
  const { tarefa, fatoTipo, fatoId } = await contextoRegularizacaoTx(prisma, id, propriedadeId, tipo);
  if (!tarefa.regularizacaoPendente) return [];
  const itens = await listarSubstitutosTx(prisma, fatoTipo, fatoId, tarefa.execucao.animalId, propriedadeId);
  // Não oferece um fato já pertencente a outra tarefa/visita como se estivesse disponível.
  const ids = itens.map(i => i.id);
  const ocupados = await prisma.participanteVisita.findMany({ where: { status: "CONFIRMADO", fatoTipo, fatoId: { in: ids }, OR: [{tarefaId:null},{tarefaId:{not:id}}] }, select: { fatoId: true } });
  const vinculos = await prisma.vinculoTarefaProtocolo.findMany({ where: { tarefaId: { not: id }, OR: [{ aplicacaoId: { in: ids } }, { tentativaId: { in: ids } }, { exameId: { in: ids } }, { exame: { interpretacao: { id: { in: ids } } } }] }, include: { exame: { select: { interpretacao: { select: { id: true } } } } } });
  const indisponiveis = new Set([...ocupados.map(p => p.fatoId), ...vinculos.flatMap(v => [v.aplicacaoId, v.tentativaId, v.exameId, v.exame?.interpretacao?.id])]);
  return itens.filter(i => !indisponiveis.has(i.id));
}
export const regularizarTarefaSanitaria = (id: string, input: RegularizacaoInput, usuarioId: number | null) => transacaoPecuaria(async tx => {
  const { tarefa } = await contextoRegularizacaoTx(tx, id, input.propriedadeId, "SANITARIO");
  await travarAnimais(tx, [tarefa.execucao.animalId]);
  return operacaoIdempotenteTx(tx, { ...input, tarefaId: id }, usuarioId, "REGULARIZACAO_SANITARIA", () => regularizarTarefaComumTx(tx, id, input, usuarioId, "SANITARIO"));
});
