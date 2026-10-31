import type { Prisma } from "@prisma/client";
import { RebanhoError, auditar, hojeFazendaDate } from "../../rebanho/regras.js";
import { conferirDestinoAtivoTx, exigirAutorDecisao, obterNecessidadeAtendimentoTx, type OrigemAlertaAplicacao } from "./atendimento.js";
import { publicarNecessidadeTx } from "./produtor.js";

// Valores persistidos: mudanças de redação precisam reconhecer os motivos anteriores.
// Só o reconciliador pode resolver suas próprias revisões factuais; as de contexto
// (transferência, cadastro, destino) exigem conferência na origem e permanecem intactas.
const motivosRevisaoProtocolar = {
  regularizar: "Protocolo com evidência anulada exige regularização",
  semExecucao: "Protocolo cancelado ou encerrado sem execução integral",
  atrasado: "Protocolo com tarefa atrasada",
} as const;

export async function vincularParticipacaoAlertaTx(tx: Prisma.TransactionClient, input: OrigemAlertaAplicacao, participacao: { id: string; animalId: string; propriedadeId: number | null; protocoloId: string }, usuarioId: number | null) {
  if (!input.alertaId) return;
  exigirAutorDecisao(usuarioId);
  if (!input.alertaRevisao || input.confirmarCuidadoAlerta !== true || participacao.propriedadeId == null) throw new RebanhoError("VALIDACAO", "Confira o cuidado e a revisão do alerta");
  const n = await obterNecessidadeAtendimentoTx(tx, input.alertaId, participacao.propriedadeId, input.alertaRevisao);
  await conferirDestinoAtivoTx(tx, n.regra);
  if (n.animalId !== participacao.animalId || n.regra.protocoloId !== participacao.protocoloId) throw new RebanhoError("VALIDACAO", "Participação não corresponde ao animal e à versão de protocolo desta regra");
  if (!["PROXIMO", "PENDENTE", "ADIADO"].includes(n.situacao)) throw new RebanhoError("CONFLITO", "Confira a necessidade antes de programar o protocolo");
  await tx.necessidadeSanitaria.update({ where: { id: n.id }, data: { participacaoId: participacao.id, situacao: "PROGRAMADO", revisao: { increment: 1 }, decisaoEm: new Date(), decisaoPorId: usuarioId } });
  await publicarNecessidadeTx(tx, n.id, { usuarioId }, "PUBLICAR");
  await auditar(tx, { entidade: "NecessidadeSanitaria", entidadeId: n.id, animalId: n.animalId, propriedadeId: n.propriedadeId, acao: "PROTOCOLO_PROGRAMADO", usuarioId, antes: n, depois: { participacaoId: participacao.id, situacao: "PROGRAMADO" } });
}
/** Publica a situação dos executores comuns sem copiar tarefas ou executar fatos clínicos. */
export async function reconciliarParticipacaoAlertaTx(tx: Prisma.TransactionClient, participacaoId: string, usuarioId: number | null) {
  const necessidades = await tx.necessidadeSanitaria.findMany({ where: { participacaoId }, include: { alerta: { select: { ciclo: true } } } });
  if (!necessidades.length) return;
  const p = await tx.participacaoProtocolo.findUnique({ where: { id: participacaoId }, include: { tarefas: { include: { aplicacoes: true, exames: true, tentativas: true, manejos: true, vinculos: { include: { aplicacao: true, exame: true, tentativa: true, manejo: true } } } } } });
  if (!p) throw new RebanhoError("CONFLITO", "Participação vinculada não encontrada");
  const autor = usuarioId && usuarioId > 0 ? { usuarioId } : { tecnico: "sanidade:reconciliacao-protocolo" };
  const hoje = hojeFazendaDate();
  const atendida = (t: typeof p.tarefas[number]) => t.vinculos.some(v => v.estado === "ATUAL" && (v.aplicacao?.status === "VALIDO" || v.manejo?.status === "VALIDO" || v.tentativa?.status === "VALIDO" || v.exame?.status === "VALIDO" && v.exame.realizacao === "REALIZADO")) || t.aplicacoes.some(a => a.status === "VALIDO") || t.exames.some(e => e.status === "VALIDO" && e.realizacao === "REALIZADO") || t.tentativas.some(t => t.status === "VALIDO") || t.manejos.some(m => m.status === "VALIDO");
  const regularizar = p.tarefas.some(t => t.regularizacaoPendente);
  const semExecucao = p.canceladaEm || p.tarefas.some(t => t.dispensadaEm || t.vinculos.some(v => v.estado === "ENCERRADO"));
  const concluiu = p.tarefas.length > 0 && p.tarefas.every(atendida);
  const atrasado = p.tarefas.some(t => !atendida(t) && !t.previsaoPendente && t.previstaPara < hoje);
  const situacao = regularizar || semExecucao || atrasado ? "NECESSITA_REVISAO" : concluiu ? "REALIZADO" : "PROGRAMADO";
  const motivo = regularizar ? motivosRevisaoProtocolar.regularizar : semExecucao ? motivosRevisaoProtocolar.semExecucao : atrasado ? motivosRevisaoProtocolar.atrasado : concluiu ? "Todas as tarefas possuem fatos válidos vinculados" : "Atendimento assumido pelo protocolo vinculado";
  for (const n of necessidades) {
    if (n.situacao === "NECESSITA_REVISAO" && !Object.values(motivosRevisaoProtocolar).some(m => m === n.motivo)) continue;
    if (n.situacao === "ENCERRADO" || n.situacao === "DISPENSADO" || n.situacao === situacao && n.motivo === motivo) continue;
    await tx.necessidadeSanitaria.update({ where: { id: n.id }, data: { situacao, motivo, revisao: { increment: 1 } } });
    const comando = situacao === "REALIZADO" ? "ENCERRAR" : n.alerta?.ciclo && n.alerta.ciclo !== "ABERTO" ? "REABRIR" : "PUBLICAR";
    await publicarNecessidadeTx(tx, n.id, autor, comando);
    await auditar(tx, { entidade: "NecessidadeSanitaria", entidadeId: n.id, animalId: n.animalId, propriedadeId: n.propriedadeId, acao: "PROTOCOLO_RECONCILIADO", usuarioId, antes: n, depois: { situacao, motivo, participacaoId } });
  }
}

/** Correção de resultado/anulação deve atualizar as mesmas participações, inclusive vínculo comum sem tarefaId legado. */
export async function reconciliarExameProtocoladoTx(tx:Prisma.TransactionClient,exameId:string,tarefaId:string|null,usuarioId:number|null){
 const [tarefa,vinculos]=await Promise.all([tarefaId?tx.tarefaProtocolo.findUnique({where:{id:tarefaId},select:{execucaoId:true}}):null,tx.vinculoTarefaProtocolo.findMany({where:{exameId},select:{tarefa:{select:{execucaoId:true}}}})]);
 const ids=new Set([...(tarefa?[tarefa.execucaoId]:[]),...vinculos.map(v=>v.tarefa.execucaoId)]);
 for(const id of ids)await reconciliarParticipacaoAlertaTx(tx,id,usuarioId);
}
