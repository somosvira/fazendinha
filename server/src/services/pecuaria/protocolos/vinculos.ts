import { reconciliarParticipacaoAlertaTx } from "../sanidade/alertas/protocolos.js";
import { registrarInicioNaExecucaoTx } from "./calendario.js";
import { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";
export type VinculoFato = { aplicacaoId?: string | null; exameId?: string | null; tentativaId?: string | null; manejoId?: string | null };
export async function encerrarVinculoAtualTx(tx: Prisma.TransactionClient, tarefaId: string, estado: "SUBSTITUIDO" | "ENCERRADO" | "REABERTO", motivo: string) {
  await tx.vinculoTarefaProtocolo.updateMany({ where: { tarefaId, estado: "ATUAL" }, data: { estado, encerradoEm: new Date(), motivo } });
}

/** Mantém cada execução anterior; o vínculo atual não depende da ordem de criação dos fatos. */
export async function vincularFatoTarefaTx(tx: Prisma.TransactionClient, tarefaId: string, dados: VinculoFato, usuarioId: number | null, modo: "EXECUCAO" | "REGULARIZACAO" = "EXECUCAO", motivo?: string) {
  if ([dados.aplicacaoId, dados.exameId, dados.tentativaId,dados.manejoId].filter(Boolean).length !== 1) throw new RebanhoError("VALIDACAO", "A execução precisa identificar exatamente um fato");
  await tx.$queryRaw`SELECT id FROM pecuaria."TarefaProtocolo" WHERE id=${tarefaId} FOR UPDATE`;
  const tarefa = await tx.tarefaProtocolo.findUniqueOrThrow({ where: { id: tarefaId }, include: { etapa: true, execucao: true, vinculos: { include: { aplicacao: true, exame: true, tentativa: true, manejo:true } } } });
  const fato = dados.aplicacaoId ? await tx.aplicacaoProduto.findUniqueOrThrow({ where: { id: dados.aplicacaoId } })
    : dados.exameId ? await tx.exameAnimal.findUniqueOrThrow({ where: { id: dados.exameId } })
    : dados.manejoId ? await tx.manejoAnimal.findUniqueOrThrow({where:{id:dados.manejoId}}) : await tx.tentativaReprodutiva.findUniqueOrThrow({ where: { id: dados.tentativaId! } });
  const natureza = dados.aplicacaoId ? "APLICACAO" : dados.exameId ? "EXAME" : dados.manejoId ? ("tipo" in fato && fato.tipo==="RETIRADA_DISPOSITIVO"?"RETIRADA":"MANEJO") : "TENTATIVA";
  if (fato.status !== "VALIDO" || fato.animalId !== tarefa.execucao.animalId || tarefa.etapa.tipo !== natureza || fato.tarefaId && fato.tarefaId !== tarefaId)
    throw new RebanhoError("CONFLITO", "Fato incompatível com o animal, ação ou vínculo desta tarefa");
  const atual = tarefa.vinculos.find(v => v.estado === "ATUAL");
  if (atual && atual.aplicacaoId === (dados.aplicacaoId ?? null) && atual.exameId === (dados.exameId ?? null) && atual.tentativaId === (dados.tentativaId ?? null) && atual.manejoId === (dados.manejoId??null)) return atual;
  const evidenciaAtual = atual?.aplicacao ?? atual?.exame ?? atual?.tentativa ?? atual?.manejo;
  if (evidenciaAtual?.status === "VALIDO" && !("realizacao" in evidenciaAtual && evidenciaAtual.realizacao==="NAO_REALIZADO")) throw new RebanhoError("CONFLITO", "A tarefa já possui uma execução válida");
  if (modo === "EXECUCAO" && tarefa.vinculos.some(v => v.aplicacao?.consumoMantido || v.tentativa?.consumoMantido || v.manejo?.realizacaoMantida))
    throw new RebanhoError("CONFLITO", "Regularize a execução anterior com consumo mantido; esta tarefa não pode consumir material novamente");
  await encerrarVinculoAtualTx(tx, tarefaId, "SUBSTITUIDO", motivo ?? "Nova execução após anulação da evidência anterior");
  if (dados.aplicacaoId) await tx.aplicacaoProduto.update({ where: { id: dados.aplicacaoId }, data: { tarefaId } });
  if (dados.exameId) await tx.exameAnimal.update({ where: { id: dados.exameId }, data: { tarefaId } });
  if (dados.tentativaId) await tx.tentativaReprodutiva.update({ where: { id: dados.tentativaId }, data: { tarefaId } });
  if (dados.manejoId) await tx.manejoAnimal.update({where:{id:dados.manejoId},data:{tarefaId}});
  if (modo === "EXECUCAO" && !tarefa.realizadaEm) await tx.tarefaProtocolo.update({ where: { id: tarefaId }, data: { realizadaEm: "aplicadaEm" in fato && fato.aplicadaEm ? fato.aplicadaEm : "realizadaEm" in fato && fato.realizadaEm ? fato.realizadaEm : fato.data, precisaoRealizacao: ("aplicadaEm" in fato && fato.aplicadaEm || "realizadaEm" in fato && fato.realizadaEm) ? "HORA" : "DIA" } });
  if (modo === "EXECUCAO") await registrarInicioNaExecucaoTx(tx, tarefa.execucaoId,
    "aplicadaEm" in fato && fato.aplicadaEm ? fato.aplicadaEm : "realizadaEm" in fato && fato.realizadaEm ? fato.realizadaEm : fato.data,
    ("aplicadaEm" in fato && fato.aplicadaEm || "realizadaEm" in fato && fato.realizadaEm) ? "HORA" : "DIA", usuarioId);
  const criado = await tx.vinculoTarefaProtocolo.create({ data: { tarefaId, ordem: Math.max(0, ...tarefa.vinculos.map(v => v.ordem)) + 1, ...dados, origem: modo, registradoPorId: usuarioId, motivo } });
  await reconciliarParticipacaoAlertaTx(tx, tarefa.execucaoId, usuarioId);
  return criado;
}
