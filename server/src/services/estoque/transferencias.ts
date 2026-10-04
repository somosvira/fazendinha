import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { EstoqueError, obterBaseCusto, statusSaldoEstoque } from "./estoque.js";
import { prepararPartidasTx, type SelecaoPartida } from "./partidas.js";
import { auditar, exigirPeriodoAberto } from "../financeiro/regras.js";
import { valorSaidaDaBase } from "./estoque.calc.js";
import { propriedadePrincipalId } from "../propriedade.js";
export async function transferirEstoque(input: { chave: string; produtoId: string; origemId: number; destinoId: number; quantidade: string; data: string; motivo: string; partidas?: SelecaoPartida[]; modo?: "PERDA" }, usuarioId: number | null) {
  if (!input.modo && input.origemId === input.destinoId) throw new EstoqueError("VALIDACAO", "Origem e destino devem ser diferentes");
  const hash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`estoque-transferencia:${input.chave}`}))`;
    const anterior = await tx.auditoriaFinanceira.findFirst({ where: { entidade: "TransferenciaEstoque", estadoPosterior: { path: ["chave"], equals: input.chave } } });
    if (anterior) {
      const d = anterior.estadoPosterior as { hash: string; operacaoId: string };
      if (d.hash !== hash || anterior.usuarioId !== usuarioId) throw new EstoqueError("CONFLITO", "Chave de reenvio utilizada com outros dados");
      return { operacaoId: d.operacaoId };
    }
    const idsSitios = input.modo ? [input.origemId] : [input.origemId, input.destinoId];
    const sitios = await tx.propriedade.count({ where: { id: { in: idsSitios }, ativo: true } });
    if (sitios !== idsSitios.length) throw new EstoqueError("VALIDACAO", "Selecione sítios ativos");
    for (const sitio of idsSitios.sort((a, b) => a - b)) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${sitio}:${input.produtoId}`}))`;
    const produto = await tx.produto.findFirst({ where: { id: input.produtoId, ativo: true } });
    const quantidade = new Prisma.Decimal(input.quantidade);
    if (!produto || !quantidade.isFinite() || quantidade.lte(0) || quantidade.decimalPlaces() > 3) throw new EstoqueError("VALIDACAO", "Produto ou quantidade inválida");
    const data = new Date(input.data + "T00:00:00Z");
    for (const sitio of idsSitios) await exigirPeriodoAberto(tx, sitio, data);
    const principal = await propriedadePrincipalId();
    const movimentos = await tx.movimentoEstoque.findMany({ where: { produtoId: produto.id, status: statusSaldoEstoque, ...(input.origemId === principal ? { OR: [{ propriedadeId: input.origemId }, { propriedadeId: null }] } : { propriedadeId: input.origemId }) }, select: { tipo: true, quantidade: true } });
    const saldo = movimentos.reduce((s, m) => m.tipo === "SAIDA" ? s.minus(m.quantidade) : s.plus(m.quantidade), new Prisma.Decimal(0));
    if (saldo.lt(quantidade)) throw new EstoqueError("CONFLITO", "Saldo insuficiente no sítio de origem");
    const partidas = await prepararPartidasTx(tx, { produtoId: produto.id, rastrearPartidas: produto.rastrearPartidas, propriedadeId: input.origemId, tipo: "SAIDA", quantidade, data, partidas: input.partidas, descarte: true });
    const valores = valorSaidaDaBase(quantidade, await obterBaseCusto(tx, produto.id, input.origemId));
    const operacao = await tx.operacao.create({ data: { tipo: input.modo ? "AJUSTE_ESTOQUE" : "TRANSFERENCIA_ESTOQUE", status: "CONFIRMADA", propriedadeId: input.origemId, data, descricao: input.modo ? `Perda: ${input.motivo}` : input.motivo, valorTotal: valores.valorTotal, criadoPorId: usuarioId } });
    const destinos: Array<["SAIDA" | "ENTRADA", number]> = input.modo ? [["SAIDA", input.origemId]] : [["SAIDA", input.origemId], ["ENTRADA", input.destinoId]];
    for (const [tipo, propriedadeId] of destinos) await tx.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId, tipo, origem: input.modo ? "PERDA" : "TRANSFERENCIA", data, quantidade, custoUnitario: valores.custoUnitario, valorTotal: valores.valorTotal, criadoPorId: usuarioId, operacaoId: operacao.id, observacao: input.motivo, ...(partidas.length ? { alocacaoPartidaEstoques: { create: partidas.map((p) => ({ partidaId: p.partidaId, quantidade: p.quantidade })) } } : {}) } });
    await auditar(tx, { entidade: "TransferenciaEstoque", entidadeId: operacao.id, acao: "CONFIRMADA", usuarioId, motivo: input.motivo, depois: { modo: input.modo ?? "TRANSFERENCIA", chave: input.chave, hash, operacaoId: operacao.id, produtoId: produto.id, origemId: input.origemId, destinoId: input.destinoId, quantidade: quantidade.toString(), partidas: partidas.map((p) => p.partidaId) } });
    return { operacaoId: operacao.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
