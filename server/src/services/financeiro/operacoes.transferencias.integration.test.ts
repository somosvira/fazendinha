import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../db.js";
import { obterOperacao, estornarOperacao } from "./operacoes.js";
import { transferirEstoque } from "../estoque/transferencias.js";
import { prepararPartidasTx, listarPartidas } from "../estoque/partidas.js";
import { obterBaseCusto, listarMovimentos } from "../estoque/estoque.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const execucao = crypto.randomUUID();
const sitios: number[] = [];
const produtos: string[] = [];
let origemId: number, destinoId: number, produtoId: string;
let detalhe: Awaited<ReturnType<typeof obterOperacao>>;

comBanco("detalhe de transferências — PostgreSQL isolado", () => {
  beforeAll(async () => {
    for (const nome of ["Origem", "Destino"]) { const sitio = await prisma.propriedade.create({ data: { nome: `Transferência ${execucao} ${nome}` } }); sitios.push(sitio.id); }
    [origemId, destinoId] = sitios;
    const produto = await prisma.produto.create({ data: { nome: `Transferência ${execucao}`, unidade: "ML", rastrearPartidas: true } }); produtoId = produto.id; produtos.push(produtoId);
    await prisma.$transaction(async (tx) => {
      const lotes = await prepararPartidasTx(tx, { produtoId, propriedadeId: origemId, rastrearPartidas: true, tipo: "ENTRADA", quantidade: new Prisma.Decimal(10), data: new Date("2026-10-01"), partidas: [{ quantidade: 5, nome: "Conhecido", validade: "2026-12-31" }, { quantidade: 5, nome: "Desconhecido", validade: null }] });
      await tx.movimentoEstoque.create({ data: { produtoId, propriedadeId: origemId, tipo: "ENTRADA", origem: "COMPRA", quantidade: 10, custoUnitario: 2, valorTotal: 20, data: new Date("2026-10-01"), alocacaoPartidaEstoques: { create: lotes.map((p) => ({ partidaId: p.partidaId, quantidade: p.quantidade })) } } });
    });
    const lotes = await listarPartidas(produtoId, origemId);
    const { operacaoId } = await transferirEstoque({ chave: crypto.randomUUID(), produtoId, origemId, destinoId, quantidade: "3", data: "2026-10-04", motivo: "Reposição entre sítios", partidas: lotes.map((l) => ({ partidaId: l.id, quantidade: l.validade ? 1 : 2, cienciaValidadeDesconhecida: !l.validade })) }, null);
    detalhe = await obterOperacao(operacaoId, origemId);
  });
  afterAll(async () => {
    if (!sitios.length) return;
    const operacoes = await prisma.operacao.findMany({ where: { propriedadeId: { in: sitios } }, select: { id: true } });
    await prisma.$transaction(async (tx) => {
      await tx.auditoriaFinanceira.deleteMany({ where: { entidadeId: { in: operacoes.map((o) => o.id) } } });
      await tx.alocacaoPartidaEstoque.deleteMany({ where: { partida: { produtoId: { in: produtos } } } });
      await tx.movimentoEstoque.deleteMany({ where: { produtoId: { in: produtos } } });
      await tx.operacao.deleteMany({ where: { id: { in: operacoes.map((o) => o.id) } } });
      await tx.partidaProduto.deleteMany({ where: { produtoId: { in: produtos }, lotePrincipalId: { not: null } } });
      await tx.partidaProduto.deleteMany({ where: { produtoId: { in: produtos } } });
      await tx.produto.deleteMany({ where: { id: { in: produtos } } });
      await tx.propriedade.deleteMany({ where: { id: { in: sitios } } });
    });
    expect(await prisma.produto.count({ where: { id: { in: produtos } } })).toBe(0);
    expect(await prisma.propriedade.count({ where: { id: { in: sitios } } })).toBe(0);
  });
  it("representa duas pontas como um deslocamento, com valores e lotes reais sem pagamentos", async () => {
    expect(detalhe.transferencias).toHaveLength(1); expect(detalhe.movimentosEstoque).toHaveLength(2);
    expect(detalhe.itens).toEqual([]); expect(detalhe.transacoes).toEqual([]); expect(detalhe.compromissos).toEqual([]);
    const t = detalhe.transferencias[0];
    expect(t).toMatchObject({ produtoId, unidade: "mL", motivo: "Reposição entre sítios", origem: { sitio: { id: origemId } }, destino: { sitio: { id: destinoId } } });
    expect(t.quantidade.toString()).toBe("3"); expect(t.valorTotal.toString()).toBe("6");
    expect(t.origem.lotes.map((l) => [l.nome, l.quantidade.toString(), l.validade?.toISOString().slice(0, 10) ?? null])).toEqual(expect.arrayContaining([["Conhecido", "1", "2026-12-31"], ["Desconhecido", "2", null]]));
    expect(t.destino?.lotes).toEqual(t.origem.lotes);
    expect(t.origem.id).toBe(detalhe.movimentosEstoque.find((m) => m.tipo === "SAIDA")?.id);
    expect(t.destino?.id).toBe(detalhe.movimentosEstoque.find((m) => m.tipo === "ENTRADA")?.id);
    const base = await obterBaseCusto(prisma, produtoId, null);
    expect(base?.quantidade.toString()).toBe("10"); expect(base?.valor.toString()).toBe("20");
    const destino = await obterBaseCusto(prisma, produtoId, destinoId);
    expect(destino?.quantidade.toString()).toBe("3"); expect(destino?.valor.toString()).toBe("6");
    await expect(obterOperacao(detalhe.id, destinoId)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
  });
  it("cancelamento preserva originais, lotes, custos e liga cada ponta à sua reversão exata", async () => {
    await estornarOperacao(detalhe.id, "Sítio de destino incorreto", { propriedadeId: origemId, usuarioId: null });
    const cancelada = await obterOperacao(detalhe.id, origemId);
    expect(cancelada.transferencias).toHaveLength(1); expect(cancelada.movimentosEstoque).toHaveLength(4);
    const anterior = detalhe.transferencias[0], t = cancelada.transferencias[0];
    expect(t.origem).toMatchObject({ id: anterior.origem.id, status: "REVERTIDO", lotes: anterior.origem.lotes });
    expect(t.destino).toMatchObject({ id: anterior.destino?.id, status: "REVERTIDO", lotes: anterior.destino?.lotes });
    expect(t.origem.reversao).toMatchObject({ reversaoDeId: t.origem.id, tipo: "ENTRADA" });
    expect(t.destino?.reversao).toMatchObject({ reversaoDeId: t.destino?.id, tipo: "SAIDA" });
    expect(t.origem.reversao?.id).not.toBe(t.destino?.reversao?.id);
    expect(t.valorTotal.toString()).toBe("6"); expect(t.quantidade.toString()).toBe("3");
    expect(cancelada.resumoCancelamento.estoque).toEqual([]);
    for (const ponta of [t.origem, t.destino]) {
      expect(ponta).not.toBeNull();
      if (!ponta?.sitio || !ponta.reversao) throw new Error("Ponta da transferência sem vínculo físico");
      const original = await listarMovimentos({ propriedadeId: ponta.sitio.id, movimentoId: ponta.id, pagina: 1, porPagina: 10 });
      const reversao = await listarMovimentos({ propriedadeId: ponta.sitio.id, movimentoId: ponta.reversao.id, pagina: 1, porPagina: 10 });
      expect(original.itens).toHaveLength(1); expect(original.itens[0]).toMatchObject({ id: ponta.id, status: "REVERTIDO", estorno: { id: ponta.reversao.id } });
      expect(reversao.itens).toHaveLength(1); expect(reversao.itens[0]).toMatchObject({ id: ponta.reversao.id, reversaoDeId: ponta.id });
      expect((await listarMovimentos({ propriedadeId: ponta.sitio.id === origemId ? destinoId : origemId, movimentoId: ponta.id })).itens).toEqual([]);
    }
    expect((await listarPartidas(produtoId, origemId)).map((l) => l.saldo)).toEqual(["5", "5"]);
    expect((await listarPartidas(produtoId, destinoId)).every((l) => l.saldo === "0")).toBe(true);
  });
  it("histórico sem entrada correspondente conserva saída e não inventa destino nem lotes", async () => {
    const produto = await prisma.produto.create({ data: { nome: `Transferência ${execucao} antigo`, unidade: "KG" } }); produtos.push(produto.id);
    const operacao = await prisma.operacao.create({ data: { tipo: "TRANSFERENCIA_ESTOQUE", propriedadeId: origemId, data: new Date("2026-10-01"), valorTotal: 0 } });
    const saida = await prisma.movimentoEstoque.create({ data: { produtoId: produto.id, operacaoId: operacao.id, propriedadeId: origemId, tipo: "SAIDA", origem: "TRANSFERENCIA", quantidade: 1, custoUnitario: 0, valorTotal: 0, data: operacao.data } });
    const historico = await obterOperacao(operacao.id, origemId);
    expect(historico.transferencias[0]).toMatchObject({ unidade: "kg", motivo: null, origem: { id: saida.id, lotes: [], reversao: null }, destino: null });
  });
  it("não associa entrada de outro produto nem escolhe entre pares ambíguos", async () => {
    const produto = await prisma.produto.create({ data: { nome: `Transferência ${execucao} ambíguo`, unidade: "KG" } }); produtos.push(produto.id);
    const operacao = await prisma.operacao.create({ data: { tipo: "TRANSFERENCIA_ESTOQUE", propriedadeId: origemId, data: new Date("2026-10-01"), valorTotal: 4 } });
    const base = { produtoId: produto.id, operacaoId: operacao.id, origem: "TRANSFERENCIA" as const, quantidade: 1, custoUnitario: 2, valorTotal: 2, data: operacao.data };
    await prisma.movimentoEstoque.create({ data: { ...base, tipo: "SAIDA", propriedadeId: origemId } });
    await prisma.movimentoEstoque.create({ data: { ...base, tipo: "ENTRADA", propriedadeId: destinoId, produtoId: produtos[1] } });
    expect((await obterOperacao(operacao.id, origemId)).transferencias[0].destino).toBeNull();
    await prisma.movimentoEstoque.create({ data: { ...base, tipo: "ENTRADA", propriedadeId: destinoId } });
    await prisma.movimentoEstoque.create({ data: { ...base, tipo: "SAIDA", propriedadeId: origemId } });
    const ambiguo = await obterOperacao(operacao.id, origemId);
    expect(ambiguo.transferencias).toHaveLength(2);
    expect(ambiguo.transferencias.every((t) => t.destino === null)).toBe(true);
  });
});
