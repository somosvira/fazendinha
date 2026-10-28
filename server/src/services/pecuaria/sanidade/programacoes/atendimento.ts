import type { Prisma } from "@prisma/client";
import { RebanhoError, auditar } from "../../rebanho/regras.js";
import { publicarAlertaTx } from "../../../alertas/publicacao.js";
import type { AutorAlerta } from "../../../alertas/contratos.js";
import type { OrigemAlertaAplicacao } from "../alertas/atendimento.js";
export async function publicarEstadoProgramacaoTx(tx: Prisma.TransactionClient, id: string, autor: AutorAlerta, comando: "PUBLICAR" | "ENCERRAR" | "INVALIDAR" | "REABRIR", alteracoes?: { motivo?: string; prazo?: Date }) {
  const n = await tx.necessidadeProgramacaoSanitaria.findUniqueOrThrow({ where: { id } });
  if (!n.alertaId || n.regraNecessidadeId) throw new RebanhoError("CONFLITO", "O cuidado deve ser atendido na regra equivalente");
  const a = await tx.alerta.findUniqueOrThrow({ where: { id: n.alertaId } });
  return publicarAlertaTx(tx, { proprietario: a.proprietario, produtor: a.produtor, tipo: a.tipo, versaoContrato: 1, chaveOcorrencia: a.chaveOcorrencia,
    revisaoOrigem: n.revisao, eventoId: `programacao:${n.id}:${n.revisao}`, comando, origemId: n.id, sujeitoTipo: n.sujeitoTipo, sujeitoId: n.sujeitoId,
    propriedadeId: n.propriedadeId, chaveAgrupamento: JSON.stringify([n.programacaoId,n.periodo,n.propriedadeId]), titulo: a.titulo, motivo: alteracoes?.motivo ?? a.motivo, situacao: n.situacao,
    resumo: a.resumo as Prisma.InputJsonObject, dataReferencia: a.dataReferencia, visivelDesde: a.visivelDesde, prazo: alteracoes?.prazo ?? a.prazo }, autor);
}
export async function obterNecessidadeProgramaTx(tx: Prisma.TransactionClient, alertaId: string, propriedadeId: number, revisao: number) {
  const n = await tx.necessidadeProgramacaoSanitaria.findFirst({ where: { alertaId, propriedadeId, regraNecessidadeId: null }, include: { programacao: true } });
  if (!n) throw new RebanhoError("NAO_ENCONTRADO", "Cuidado programado não encontrado neste sítio");
  if (n.revisao !== revisao) throw new RebanhoError("CONFLITO", "O cuidado mudou. Confira novamente");
  if (n.aplicacaoId || n.exameId || ["REALIZADO", "DISPENSADO", "ENCERRADO", "INVALIDADO"].includes(n.situacao)) throw new RebanhoError("CONFLITO", "O cuidado já tem atendimento ou decisão");
  if (n.alertaId) {
    const a = await tx.alerta.findUniqueOrThrow({ where: { id: n.alertaId } });
    const snapshot = (a.resumo as Prisma.JsonObject).programacaoSnapshot;
    if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) return { ...n, programacao: { ...n.programacao, executor: typeof snapshot.executor === "string" ? snapshot.executor : null, produtoId: typeof snapshot.produtoId === "string" ? snapshot.produtoId : null, tipoExameId: typeof snapshot.tipoExameId === "string" ? snapshot.tipoExameId : null } };
  }
  return n;
}
function autorReal(usuarioId: number | null): asserts usuarioId is number { if (!usuarioId || usuarioId < 1) throw new RebanhoError("VALIDACAO", "Atendimento exige pessoa autenticada"); }
export async function vincularAplicacaoProgramacaoTx(tx: Prisma.TransactionClient, input: OrigemAlertaAplicacao, fato: { id: string; animalId: string; propriedadeId: number | null; produtoId: string | null; data: Date }, usuarioId: number | null, historica = false) {
  if (!input.alertaId) return;
  autorReal(usuarioId);
  if (!fato.propriedadeId || !input.alertaRevisao || input.confirmarCuidadoAlerta !== true) throw new RebanhoError("VALIDACAO", "Confira sítio, revisão e cuidado da programação");
  const n = await obterNecessidadeProgramaTx(tx, input.alertaId, input.propriedadeAtendimentoId ?? fato.propriedadeId, input.alertaRevisao);
  if (n.sujeitoTipo !== "ANIMAL" || n.sujeitoId !== fato.animalId || n.programacao.executor !== "APLICACAO" || n.programacao.produtoId !== fato.produtoId) throw new RebanhoError("VALIDACAO", "Animal, produto ou executor incompatível com o cuidado");
  if (!historica && !["PENDENTE", "PROXIMO", "ADIADO"].includes(n.situacao)) throw new RebanhoError("CONFLITO", "Confira a necessidade antes de aplicar");
  const atual = await tx.aplicacaoProduto.findUnique({ where: { id: fato.id } });
  if (!atual || atual.status !== "VALIDO") throw new RebanhoError("CONFLITO", "Aplicação não disponível");
  await tx.vinculoAtendimentoAlerta.create({ data: { aplicacaoId: fato.id, necessidadeProgramaId: n.id, criadoPorId: usuarioId } });
  await tx.necessidadeProgramacaoSanitaria.update({ where: { id: n.id }, data: { aplicacaoId: fato.id, situacao: "REALIZADO", revisao: { increment: 1 } } });
  await publicarEstadoProgramacaoTx(tx, n.id, { usuarioId }, "ENCERRAR");
  await auditar(tx, { entidade: "NecessidadeProgramacaoSanitaria", entidadeId: n.id, animalId: fato.animalId, propriedadeId: n.propriedadeId, acao: historica ? "APLICACAO_ANTERIOR_RECONHECIDA" : "APLICACAO_VINCULADA", usuarioId, antes: n, depois: { aplicacaoId: fato.id, situacao: "REALIZADO" } });
}
export async function vincularExameProgramacaoTx(tx: Prisma.TransactionClient, input: OrigemAlertaAplicacao, fato: { id: string; animalId: string; propriedadeId: number | null; tipoExameId: string; status: string; realizacao: string }, usuarioId: number | null) {
  if (!input.alertaId) return; autorReal(usuarioId);
  if (!fato.propriedadeId || !input.alertaRevisao || input.confirmarCuidadoAlerta !== true) throw new RebanhoError("VALIDACAO", "Confira revisão e cuidado do exame");
  const n = await obterNecessidadeProgramaTx(tx, input.alertaId, fato.propriedadeId, input.alertaRevisao);
  if (n.sujeitoTipo !== "ANIMAL" || n.sujeitoId !== fato.animalId || n.programacao.executor !== "EXAME_ANIMAL" || n.programacao.tipoExameId !== fato.tipoExameId || fato.status !== "VALIDO" || fato.realizacao !== "REALIZADO") throw new RebanhoError("VALIDACAO", "Exame e resultado não comprovam o cuidado programado");
  if (!["PENDENTE", "PROXIMO", "ADIADO"].includes(n.situacao)) throw new RebanhoError("CONFLITO", "Confira a necessidade antes do exame");
  await tx.vinculoAtendimentoAlerta.create({ data: { exameId: fato.id, necessidadeProgramaId: n.id, criadoPorId: usuarioId } });
  await tx.necessidadeProgramacaoSanitaria.update({ where: { id: n.id }, data: { exameId: fato.id, situacao: "REALIZADO", revisao: { increment: 1 } } });
  await publicarEstadoProgramacaoTx(tx, n.id, { usuarioId }, "ENCERRAR");
  await auditar(tx, { entidade: "NecessidadeProgramacaoSanitaria", entidadeId: n.id, animalId: fato.animalId, propriedadeId: n.propriedadeId, acao: "EXAME_VINCULADO", usuarioId, antes: n, depois: { exameId: fato.id, situacao: "REALIZADO" } });
}
export async function revisarFatoProgramacaoTx(tx: Prisma.TransactionClient, fato: { aplicacaoId?: string; exameId?: string }, motivo: string, usuarioId: number | null) {
  const itens = await tx.necessidadeProgramacaoSanitaria.findMany({ where: { ...fato, regraNecessidadeId: null } });
  if (!itens.length) return; autorReal(usuarioId);
  for (const n of itens) {
    if (n.situacao === "NECESSITA_REVISAO") continue;
    await tx.necessidadeProgramacaoSanitaria.update({ where: { id: n.id }, data: { situacao: "NECESSITA_REVISAO", revisao: { increment: 1 } } });
    await publicarEstadoProgramacaoTx(tx, n.id, { usuarioId }, "REABRIR");
    await auditar(tx, { entidade: "NecessidadeProgramacaoSanitaria", entidadeId: n.id, animalId: n.sujeitoTipo === "ANIMAL" ? n.sujeitoId : undefined, propriedadeId: n.propriedadeId, acao: "EVIDENCIA_REVISADA", usuarioId, antes: n, depois: { ...fato, motivo, situacao: "NECESSITA_REVISAO" } });
  }
}
