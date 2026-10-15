import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { criteriosSelecaoSchema } from "./selecoes.schemas.js";

export const criarSelecaoSchema = z.object({ propriedadeId: z.number().int().positive(), nome: z.string().trim().min(2).max(120), criterios: criteriosSelecaoSchema }).strict();
export const atualizarSelecaoSchema = criarSelecaoSchema.extend({ versaoAtualId: z.string().uuid(), ativo: z.boolean().optional() }).strict();
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));
const incluirVersao = { versoes: { orderBy: { numero: "desc" as const }, take: 1 } };
export async function listarSelecoes(propriedadeId: number, incluirInativas = false, tx: Prisma.TransactionClient = prisma) {
  const selecoes = await tx.selecaoVisita.findMany({ where: { propriedadeId, ...(incluirInativas ? {} : { ativo: true }) }, include: incluirVersao, orderBy: [{ nome: "asc" }, { id: "asc" }] });
  return { selecoes: selecoes.map(({ versoes, ...selecao }) => ({ ...selecao, versaoAtual: versoes[0] ?? null })) };
}
export async function criarSelecao(input: z.infer<typeof criarSelecaoSchema>, usuarioId: number | null) {
  return transacaoPecuaria(tx => criarSelecaoTx(tx, input, usuarioId));
}
export async function criarSelecaoTx(tx: Prisma.TransactionClient, input: z.infer<typeof criarSelecaoSchema>, usuarioId: number | null) {
    const selecao = await tx.selecaoVisita.create({ data: { propriedadeId: input.propriedadeId, nome: input.nome, criadoPorId: usuarioId,
      versoes: { create: { numero: 1, criterios: json(input.criterios), criadoPorId: usuarioId } } }, include: incluirVersao });
    await auditar(tx, { entidade: "SelecaoVisita", entidadeId: selecao.id, propriedadeId: input.propriedadeId, acao: "CRIACAO", usuarioId, depois: selecao });
    const { versoes, ...dados } = selecao;
    return { ...dados, versaoAtual: versoes[0] };
}
export async function atualizarSelecao(id: string, input: z.infer<typeof atualizarSelecaoSchema>, usuarioId: number | null) {
  return transacaoPecuaria(tx => atualizarSelecaoTx(tx, id, input, usuarioId));
}
export async function atualizarSelecaoTx(tx: Prisma.TransactionClient, id: string, input: z.infer<typeof atualizarSelecaoSchema>, usuarioId: number | null) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-selecao:${id}`}))`;
    const antes = await tx.selecaoVisita.findFirst({ where: { id, propriedadeId: input.propriedadeId }, include: incluirVersao });
    if (!antes) throw new RebanhoError("NAO_ENCONTRADO", "Seleção não encontrada neste sítio");
    const atual = antes.versoes[0];
    if (!atual || atual.id !== input.versaoAtualId) throw new RebanhoError("CONFLITO", "A seleção mudou. Atualize os critérios antes de salvar", "versaoAtualId");
    const versaoAtual = await tx.versaoSelecaoVisita.create({ data: { selecaoId: id, numero: atual.numero + 1, criterios: json(input.criterios), criadoPorId: usuarioId } });
    const selecao = await tx.selecaoVisita.update({ where: { id }, data: { nome: input.nome, ...(input.ativo == null ? {} : { ativo: input.ativo }) } });
    const depois = { ...selecao, versaoAtual };
    await auditar(tx, { entidade: "SelecaoVisita", entidadeId: id, propriedadeId: input.propriedadeId, acao: input.ativo === false ? "INATIVACAO" : "NOVA_VERSAO", usuarioId, antes, depois });
    return depois;
}
export async function obterVersaoSelecaoTx(tx: Prisma.TransactionClient, id: string, propriedadeId: number) {
  const versao = await tx.versaoSelecaoVisita.findFirst({ where: { id, selecao: { propriedadeId, ativo: true } }, include: { selecao: true } });
  if (!versao) throw new RebanhoError("NAO_ENCONTRADO", "Versão de seleção não encontrada ou inativa neste sítio");
  const ultima = await tx.versaoSelecaoVisita.findFirst({ where: { selecaoId: versao.selecaoId }, orderBy: { numero: "desc" }, select: { id: true } });
  if (ultima?.id !== id) throw new RebanhoError("CONFLITO", "A seleção tem uma nova versão. Atualize a prévia", "selecaoVersaoId");
  return { ...versao, criterios: criteriosSelecaoSchema.parse(versao.criterios) };
}
