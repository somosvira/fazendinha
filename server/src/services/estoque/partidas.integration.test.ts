import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../db.js";
import { ativarRastreio, listarPartidas, prepararPartidasTx } from "./partidas.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const produtos: string[] = [];
const propriedades: number[] = [];

afterAll(async () => {
  if (!produtos.length) return;
  await prisma.auditoriaFinanceira.deleteMany({ where: { entidade: "Produto", entidadeId: { in: produtos } } });
  // Somente o banco descartável do teste desliga o rastreio para desmontar a fixture.
  await prisma.produto.updateMany({ where: { id: { in: produtos } }, data: { rastrearPartidas: false } });
  await prisma.alocacaoPartidaEstoque.deleteMany({ where: { partida: { produtoId: { in: produtos } } } });
  await prisma.movimentoEstoque.deleteMany({ where: { produtoId: { in: produtos } } });
  await prisma.partidaProduto.deleteMany({ where: { produtoId: { in: produtos } } });
  await prisma.produto.deleteMany({ where: { id: { in: produtos } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: propriedades } } });
});

describeComBanco("rastreio de partidas no estoque único", () => {
  it("atribui o razão anterior ao legado e recusa movimento novo sem distribuição", async () => {
    const propriedade = await prisma.propriedade.create({ data: { nome: `Pec V3 partidas ${run}` } });
    propriedades.push(propriedade.id);
    const produto = await prisma.produto.create({ data: { nome: `Vacina V3 ${run}`, unidade: "UN" } });
    produtos.push(produto.id);
    await prisma.movimentoEstoque.create({ data: {
      produtoId: produto.id, propriedadeId: propriedade.id, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL",
      data: new Date("2026-09-01"), quantidade: 10, custoUnitario: 12, valorTotal: 120,
    } });
    const ativacao = await ativarRastreio(produto.id, null);
    expect(ativacao.movimentosLegados).toBe(1);
    const [legado] = await listarPartidas(produto.id, propriedade.id);
    expect(legado).toMatchObject({ codigo: "LEGADO_NAO_IDENTIFICADO", saldo: "10" });
    await expect(prisma.movimentoEstoque.create({ data: {
      produtoId: produto.id, propriedadeId: propriedade.id, tipo: "SAIDA", origem: "SANIDADE",
      data: new Date("2026-09-02"), quantidade: 1, custoUnitario: 12, valorTotal: 12,
    } })).rejects.toThrow();
    const saida = await prisma.$transaction(async (tx) => {
      const distribuicao = await prepararPartidasTx(tx, { produtoId: produto.id, rastrearPartidas: true,
        propriedadeId: propriedade.id, tipo: "SAIDA", quantidade: new Prisma.Decimal(1),
        partidas: [{ partidaId: legado.id, quantidade: 1 }] });
      return tx.movimentoEstoque.create({ data: {
        produtoId: produto.id, propriedadeId: propriedade.id, tipo: "SAIDA", origem: "SANIDADE",
        data: new Date("2026-09-02"), quantidade: 1, custoUnitario: 12, valorTotal: 12,
        alocacaoPartidaEstoques: { create: distribuicao.map((p) => ({ partidaId: p.partidaId, quantidade: p.quantidade })) },
      } });
    });
    expect((await listarPartidas(produto.id, propriedade.id))[0].saldo).toBe("9");
    expect(saida.produtoId).toBe(produto.id);
  });
});
