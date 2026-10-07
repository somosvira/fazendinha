import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { FinanceiroError } from "./regras.js";

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).map(([chave, item]) => [chave, ordenar(item)]));
  return valor;
}

export function hashConfirmacao(valor: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(ordenar(JSON.parse(JSON.stringify(valor))))).digest("hex");
}

export const includeOperacaoConfirmada = { itens: true, compromissos: true, transacoes: { include: { movimentos: true } }, movimentosEstoque: true,
  documentos: { select: { id: true, tipo: true, nome: true, numero: true, mimeType: true, tamanhoBytes: true, createdAt: true } }, parceiro: true } as const;

export async function conferirReenvioOperacaoTx(tx: Prisma.TransactionClient, input: { chave?: string; propriedadeId: number; usuarioId?: number | null }) {
  if (!input.chave) return null;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fin-confirmacao:${input.chave}`}))`;
  const anterior = await tx.auditoriaFinanceira.findFirst({ where: { acao: "CONFIRMACAO_OPERACAO_IDEMPOTENTE", estadoPosterior: { path: ["chave"], equals: input.chave } } });
  if (!anterior) return null;
  const resultado = anterior.estadoPosterior as { hash: string; propriedadeId: number };
  const autor = input.usuarioId && input.usuarioId > 0 ? input.usuarioId : null;
  if (resultado.hash !== hashConfirmacao(input) || resultado.propriedadeId !== input.propriedadeId || anterior.usuarioId !== autor) throw new FinanceiroError("CONFLITO", "Chave de reenvio usada com outros dados. Confira a operação antes de confirmar novamente.");
  return tx.operacao.findUniqueOrThrow({ where: { id: anterior.entidadeId }, include: includeOperacaoConfirmada });
}
