import { travarUsosProduto } from "../../../estoque/usos.js";
import { vincularAplicacaoProgramacaoTx, revisarFatoProgramacaoTx } from "../programacoes/atendimento.js";
import type { Prisma } from "@prisma/client";
import { RebanhoError, auditar } from "../../rebanho/regras.js";
import { publicarNecessidadeTx, configuracaoNecessidadeTx } from "./produtor.js";

export type OrigemAlertaAplicacao = { alertaId?: string; alertaRevisao?: number; confirmarCuidadoAlerta?: boolean; propriedadeAtendimentoId?: number; motivoAlerta?: string };
type FatoAplicacao = { id: string; animalId: string; propriedadeId: number | null; produtoId: string | null; status?: string; data: Date };
export function exigirAutorDecisao(usuarioId: number | null): asserts usuarioId is number {
  if (!usuarioId || usuarioId < 1) throw new RebanhoError("VALIDACAO", "O atendimento do alerta exige uma pessoa autenticada");
}
/** A trava do animal precede estas operações, inclusive anulação e reconhecimento histórico. */
export async function obterNecessidadeAtendimentoTx(tx: Prisma.TransactionClient, alertaId: string, propriedadeId: number, revisao: number) {
  const n = await tx.necessidadeSanitaria.findFirst({ where: { alertaId, propriedadeId }, include: { regra: true, alerta: { select: { ciclo: true } } } });
  if (!n) throw new RebanhoError("NAO_ENCONTRADO", "Alerta não encontrado neste sítio");
  if (n.revisao !== revisao) throw new RebanhoError("CONFLITO", "O alerta mudou. Confira novamente antes de confirmar");
  if (n.aplicacaoId || n.participacaoId || ["REALIZADO", "DISPENSADO", "ENCERRADO"].includes(n.situacao)) throw new RebanhoError("CONFLITO", "O alerta já tem atendimento ou decisão; confira a origem");
  return { ...n, regra: await configuracaoNecessidadeTx(tx, n) };
}
export async function conferirDestinoAtivoTx(tx: Prisma.TransactionClient, regra: { produtoId: string | null; protocoloId: string | null }) {
  if (regra.produtoId) {
    await travarUsosProduto(tx, [regra.produtoId]);
    const produto = await tx.produto.findUnique({ where: { id: regra.produtoId }, select: { ativo: true, usoSanitario: true } });
    if (!produto?.ativo || !produto.usoSanitario) throw new RebanhoError("CONFLITO", "Produto do cuidado está inativo ou sem uso sanitário; confira a necessidade");
  }
  if (regra.protocoloId) {
    const protocolo = await tx.protocolo.findUnique({ where: { id: regra.protocoloId }, select: { ativo: true, publicadoEm: true } });
    if (!protocolo?.ativo || !protocolo.publicadoEm) throw new RebanhoError("CONFLITO", "Versão do protocolo não está disponível; confira a necessidade");
  }
}
/** Integra o executor sanitário existente: não cria fato, tarefa nem consumo. */
export async function vincularAplicacaoAlertaTx(tx: Prisma.TransactionClient, input: OrigemAlertaAplicacao, fato: FatoAplicacao, usuarioId: number | null, historica = false) {
  if (!input.alertaId) return;
  exigirAutorDecisao(usuarioId);
  if (fato.propriedadeId == null) throw new RebanhoError("VALIDACAO", "A aplicação precisa de sítio histórico conferido", "propriedadeId");
  if (!input.alertaRevisao || input.confirmarCuidadoAlerta !== true) throw new RebanhoError("VALIDACAO", "Confira a revisão e o cuidado do alerta", "alertaRevisao");
  if (await tx.necessidadeProgramacaoSanitaria.findFirst({ where: { alertaId: input.alertaId, regraNecessidadeId: null } })) return vincularAplicacaoProgramacaoTx(tx, input, fato, usuarioId, historica);
  const n = await obterNecessidadeAtendimentoTx(tx, input.alertaId, input.propriedadeAtendimentoId ?? fato.propriedadeId, input.alertaRevisao);
  if (n.animalId !== fato.animalId) throw new RebanhoError("NAO_ENCONTRADO", "Alerta não encontrado para este animal");
  if (!historica) await conferirDestinoAtivoTx(tx, n.regra);
  if (!historica && !["PROXIMO", "PENDENTE", "ADIADO"].includes(n.situacao)) throw new RebanhoError("CONFLITO", "Confira a necessidade antes de registrar aplicação");
  if (!n.regra.produtoId || n.regra.produtoId !== fato.produtoId) throw new RebanhoError("VALIDACAO", "O produto aplicado não corresponde ao cuidado do alerta", "produtoId");
  // Serialização pelo mesmo animal impede reconhecimento simultâneo à anulação.
  const atual = await tx.aplicacaoProduto.findUnique({ where: { id: fato.id } });
  if (!atual || atual.status !== "VALIDO") throw new RebanhoError("CONFLITO", "A aplicação foi anulada ou não está disponível para vínculo");
  if ((n.regra.tipoAplicacaoId && atual.tipoAplicacaoId !== n.regra.tipoAplicacaoId) || (historica && (!n.regra.tipoAplicacaoId || !n.regra.cuidado?.trim()))) throw new RebanhoError("VALIDACAO", "Confira o tipo de aplicação da regra e do fato antes de reconhecer o histórico", "aplicacaoId");
  await tx.vinculoAtendimentoAlerta.create({ data: { aplicacaoId: fato.id, necessidadeRegraId: n.id, criadoPorId: usuarioId } });
  await tx.necessidadeSanitaria.update({ where: { id: n.id }, data: { ...(input.motivoAlerta ? { motivo: input.motivoAlerta } : {}), aplicacaoId: fato.id, situacao: "REALIZADO", revisao: { increment: 1 }, decisaoEm: new Date(), decisaoPorId: usuarioId } });
  await publicarNecessidadeTx(tx, n.id, { usuarioId }, "ENCERRAR");
  await auditar(tx, { entidade: "NecessidadeSanitaria", entidadeId: n.id, animalId: n.animalId, propriedadeId: n.propriedadeId, acao: historica ? "APLICACAO_ANTERIOR_RECONHECIDA" : "APLICACAO_VINCULADA", usuarioId, antes: n, depois: { aplicacaoId: fato.id, situacao: "REALIZADO" } });
}
/** Preserva o vínculo e a evidência original, mesmo quando o consumo foi mantido. */
export async function revisarAplicacaoAnuladaTx(tx: Prisma.TransactionClient, aplicacaoId: string, motivo: string, usuarioId: number | null) {
  await revisarFatoProgramacaoTx(tx, { aplicacaoId }, motivo, usuarioId);
  const vinculadas = await tx.necessidadeSanitaria.findMany({ where: { aplicacaoId } });
  if (!vinculadas.length) return;
  exigirAutorDecisao(usuarioId);
  for (const n of vinculadas) {
    if (n.situacao === "NECESSITA_REVISAO") continue;
    await tx.necessidadeSanitaria.update({ where: { id: n.id }, data: { situacao: "NECESSITA_REVISAO", motivo: `Aplicação anulada: ${motivo}`, revisao: { increment: 1 }, decisaoEm: new Date(), decisaoPorId: usuarioId } });
    await publicarNecessidadeTx(tx, n.id, { usuarioId }, "REABRIR");
    await auditar(tx, { entidade: "NecessidadeSanitaria", entidadeId: n.id, animalId: n.animalId, propriedadeId: n.propriedadeId, acao: "EVIDENCIA_ANULADA", usuarioId, antes: n, depois: { situacao: "NECESSITA_REVISAO", aplicacaoId, motivo } });
  }
}
