import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../db.js";
import { ativarRastreio, identificarLegado, listarPartidas, prepararPartidasTx, previaAtivacaoRastreio } from "./partidas.js";
import { obterBaseCusto } from "./estoque.js";
import { transferirEstoque } from "./transferencias.js";
import { estornarOperacao } from "../financeiro/operacoes.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const produtos: string[] = [];
const propriedades: number[] = [];

afterAll(async () => {
  if (!produtos.length) return;
  const operacoes = await prisma.operacao.findMany({ where: { propriedadeId: { in: propriedades } }, select: { id: true } });
  await prisma.auditoriaFinanceira.deleteMany({ where: { entidadeId: { in: operacoes.map((o) => o.id) } } });
  await prisma.auditoriaFinanceira.deleteMany({ where: { entidade: "Produto", entidadeId: { in: produtos } } });
  // Somente o banco descartável do teste desliga o rastreio para desmontar a fixture.
  await prisma.produto.updateMany({ where: { id: { in: produtos } }, data: { rastrearPartidas: false } });
  await prisma.alocacaoPartidaEstoque.deleteMany({ where: { partida: { produtoId: { in: produtos } } } });
  await prisma.movimentoEstoque.deleteMany({ where: { produtoId: { in: produtos } } });
  await prisma.operacao.deleteMany({ where: { id: { in: operacoes.map((o) => o.id) } } });
  await prisma.partidaProduto.deleteMany({ where: { produtoId: { in: produtos } } });
  await prisma.produto.deleteMany({ where: { id: { in: produtos } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: propriedades } } });
});

describeComBanco("rastreio de partidas no estoque único", () => {
  it("recusa ativação se o razão mudar após a prévia e exige nova conferência", async () => {
    const propriedade = await prisma.propriedade.create({ data: { nome: `Revisão rastreio ${run}` } });
    propriedades.push(propriedade.id);
    const produto = await prisma.produto.create({ data: { nome: `Produto revisão ${run}`, unidade: "UN" } });
    produtos.push(produto.id);
    await prisma.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId: propriedade.id, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", data: new Date("2026-09-01"), quantidade: 5, custoUnitario: 1, valorTotal: 5 } });
    const previaAntiga = await previaAtivacaoRastreio(produto.id);
    await prisma.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId: propriedade.id, tipo: "ENTRADA", origem: "BONIFICACAO", data: new Date("2026-09-02"), quantidade: 2, custoUnitario: 1, valorTotal: 2 } });
    await expect(ativarRastreio(produto.id, null, previaAntiga.revisao)).rejects.toThrow(/mudou desde a prévia/);
    expect((await prisma.produto.findUniqueOrThrow({ where: { id: produto.id } })).rastrearPartidas).toBe(false);
    const previaAtual = await previaAtivacaoRastreio(produto.id);
    expect(previaAtual).toMatchObject({ movimentosLegados: 2, saldos: [{ propriedadeId: propriedade.id, quantidade: "7" }] });
    await ativarRastreio(produto.id, null, previaAtual.revisao);
    expect((await listarPartidas(produto.id, propriedade.id))[0].saldo).toBe("7");
  });

  it("atribui o razão anterior ao legado e recusa movimento novo sem distribuição", async () => {
    const propriedade = await prisma.propriedade.create({ data: { nome: `Pec V3 partidas ${run}` } });
    propriedades.push(propriedade.id);
    const produto = await prisma.produto.create({ data: { nome: `Vacina V3 ${run}`, unidade: "UN" } });
    produtos.push(produto.id);
    await prisma.movimentoEstoque.create({ data: {
      produtoId: produto.id, propriedadeId: propriedade.id, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL",
      data: new Date("2026-09-01"), quantidade: 10, custoUnitario: 12, valorTotal: 120,
    } });
    const previa = await previaAtivacaoRastreio(produto.id);
    expect(previa).toMatchObject({ movimentosLegados: 1, partidaTecnica: "LEGADO_NAO_IDENTIFICADO", alteracaoLiquidaQuantidade: "0", alteracaoLiquidaValor: "0" });
    const ativacao = await ativarRastreio(produto.id, null, previa.revisao);
    expect(ativacao.movimentosLegados).toBe(1);
    const [legado] = await listarPartidas(produto.id, propriedade.id);
    expect(legado).toMatchObject({ validade: null, saldo: "10", origemRastreio: "LEGADO_NAO_IDENTIFICADO" });
    await expect(prisma.movimentoEstoque.create({ data: {
      produtoId: produto.id, propriedadeId: propriedade.id, tipo: "SAIDA", origem: "SANIDADE",
      data: new Date("2026-09-02"), quantidade: 1, custoUnitario: 12, valorTotal: 12,
    } })).rejects.toThrow();
    const saida = await prisma.$transaction(async (tx) => {
      const distribuicao = await prepararPartidasTx(tx, { produtoId: produto.id, rastrearPartidas: true,
        propriedadeId: propriedade.id, tipo: "SAIDA", quantidade: new Prisma.Decimal(1),
        partidas: [{ partidaId: legado.id, quantidade: 1, cienciaValidadeDesconhecida: true }] });
      return tx.movimentoEstoque.create({ data: {
        produtoId: produto.id, propriedadeId: propriedade.id, tipo: "SAIDA", origem: "SANIDADE",
        data: new Date("2026-09-02"), quantidade: 1, custoUnitario: 12, valorTotal: 12,
        alocacaoPartidaEstoques: { create: distribuicao.map((p) => ({ partidaId: p.partidaId, quantidade: p.quantidade })) },
      } });
    });
    expect((await listarPartidas(produto.id, propriedade.id))[0].saldo).toBe("9");
    expect(saida.produtoId).toBe(produto.id);
    const custoAntes = await obterBaseCusto(prisma, produto.id, propriedade.id);
    await identificarLegado({ chave: crypto.randomUUID(), produtoId: produto.id, propriedadeId: propriedade.id, codigo: "FABRICANTE-TESTE", validade: "2026-12-31", quantidade: "4", motivo: "Conferência física do legado", data: "2026-09-03" }, null);
    const partidas = await listarPartidas(produto.id, propriedade.id);
    expect(partidas.find((p) => p.validade?.toISOString().slice(0, 10) === "2026-12-31")?.saldo).toBe("4");
    expect(partidas.find((p) => p.id === legado.id)?.saldo).toBe("5");
    const movimentos = await prisma.movimentoEstoque.findMany({ where: { produtoId: produto.id, origem: "IDENTIFICACAO_PARTIDA" } });
    expect(movimentos.reduce((s, m) => s.plus(m.quantidade), new Prisma.Decimal(0)).toString()).toBe("0");
    expect(movimentos.reduce((s, m) => s.plus(m.valorTotal), new Prisma.Decimal(0)).toString()).toBe("0");
    expect(await obterBaseCusto(prisma, produto.id, propriedade.id)).toEqual(custoAntes);
    const destino = await prisma.propriedade.create({ data: { nome: `Destino V3 ${run}` } }); propriedades.push(destino.id);
    const identificada = partidas.find((p) => p.validade?.toISOString().slice(0, 10) === "2026-12-31")!;
    const input = { chave: crypto.randomUUID(), produtoId: produto.id, origemId: propriedade.id, destinoId: destino.id, quantidade: "2", data: "2026-09-04", motivo: "Transferência física de teste", partidas: [{ partidaId: identificada.id, quantidade: 2 }] };
    const transferida = await transferirEstoque(input, null);
    expect(await transferirEstoque(input, null)).toEqual(transferida);
    expect((await listarPartidas(produto.id, destino.id)).find((p) => p.id === identificada.id)?.saldo).toBe("2");
    expect((await obterBaseCusto(prisma, produto.id, destino.id))?.valor.toString()).toBe("24");
    await estornarOperacao(transferida.operacaoId, "Estorno de teste de transferência", { propriedadeId: propriedade.id, usuarioId: null });
    expect((await listarPartidas(produto.id, destino.id)).find((p) => p.id === identificada.id)?.saldo).toBe("0");
    expect((await listarPartidas(produto.id, propriedade.id)).find((p) => p.id === identificada.id)?.saldo).toBe("4");
    const perda = await transferirEstoque({ ...input, chave: crypto.randomUUID(), destinoId: propriedade.id, quantidade: "1", partidas: [{ partidaId: identificada.id, quantidade: 1 }], modo: "PERDA" }, null);
    expect((await listarPartidas(produto.id, propriedade.id)).find((p) => p.id === identificada.id)?.saldo).toBe("3");
    await estornarOperacao(perda.operacaoId, "Revisão documentada da perda", { propriedadeId: propriedade.id, usuarioId: null });
    expect((await listarPartidas(produto.id, propriedade.id)).find((p) => p.id === identificada.id)?.saldo).toBe("4");
  });
});
