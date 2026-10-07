import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { confirmarProcedimentosServico } from "./servicos.js";
import crypto from "node:crypto";
type TipoRateio = "APLICACAO" | "EXAME" | "PROTOCOLO";
async function contexto(tx: Prisma.TransactionClient, servicoId: string, propriedadeId: number) {
  const servico = await tx.operacao.findFirst({ where: { id: servicoId, propriedadeId, tipo: "SERVICO", status: "CONFIRMADA" } });
  if (!servico) throw new RebanhoError("VALIDACAO", "Serviço confirmado não encontrado neste sítio");
  const [aplicacoes, exames, protocolos] = await Promise.all([
    tx.aplicacaoProduto.findMany({ where: { operacaoServicoId: servicoId, propriedadeId, status: "VALIDO" }, include: { tarefa: { select: { execucaoId: true } } } }),
    tx.exameAnimal.findMany({ where: { operacaoServicoId: servicoId, propriedadeId, status: "VALIDO" }, include: { tarefa: { select: { execucaoId: true } }, tipoExame: { select: { nome: true } } } }),
    tx.execucaoProtocoloSanitario.findMany({ where: { operacaoServicoId: servicoId, propriedadeId, canceladaEm: null }, include: { protocolo: { select: { nome: true } } } }),
  ]);
  const itens = [
    ...aplicacoes.map((a) => ({ id: a.id, tipo: "APLICACAO" as const, animalId: a.animalId, nome: a.nomeProdutoAplicado, valor: a.valorServicoAtribuido, execucaoId: a.tarefa?.execucaoId })),
    ...exames.map((e) => ({ id: e.id, tipo: "EXAME" as const, animalId: e.animalId, nome: e.tipoExame.nome, valor: e.valorServicoAtribuido, execucaoId: e.tarefa?.execucaoId })),
    ...protocolos.map((p) => ({ id: p.id, tipo: "PROTOCOLO" as const, animalId: p.animalId, nome: p.protocolo.nome, valor: p.valorServicoAtribuido, execucaoId: p.id })),
  ];
  return { servico, itens };
}
export async function listarRateios(servicoId: string, propriedadeId: number) {
  return prisma.$transaction(async (tx) => {
    const c = await contexto(tx, servicoId, propriedadeId);
    const total = c.itens.reduce((s, i) => s.plus(i.valor ?? 0), new Prisma.Decimal(0));
    return { valorConfirmado: c.servico.valorTotal.toString(), totalAtribuido: total.toString(), disponivel: c.servico.valorTotal.minus(total).toString(), itens: c.itens.map((i) => ({ ...i, valor: i.valor?.toString() ?? null })) };
  });
}
export async function salvarRateio(input: { servicoId: string; propriedadeId: number; tipo: TipoRateio; id: string; valor: string | null; motivo: string }, usuarioId: number | null) {
  await confirmarProcedimentosServico({ servicoId: input.servicoId, propriedadeId: input.propriedadeId, chaveIdempotencia: crypto.randomUUID(), motivo: input.motivo, itens: [{ id: input.id, tipo: input.tipo, valor: input.valor }] }, usuarioId);
  const consulta = await listarRateios(input.servicoId, input.propriedadeId);
  return { id: input.id, valor: input.valor, totalAtribuido: consulta.totalAtribuido };
}
