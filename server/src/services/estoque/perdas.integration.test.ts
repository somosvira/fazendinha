import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../db.js";
import { transferirEstoque } from "./transferencias.js";
import { prepararPartidasTx, listarPartidas } from "./partidas.js";
import { obterOperacao, estornarOperacao } from "../financeiro/operacoes.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const execucao = crypto.randomUUID();
const produtos: string[] = [];
const sitios: number[] = [];
let produtoId: string;
let sitioId: number;
let lotes: Awaited<ReturnType<typeof listarPartidas>>;

comBanco("perdas físicas — PostgreSQL com fixtures próprias", () => {
  beforeAll(async () => {
    expect(await prisma.produto.count({ where: { nome: { startsWith: `Perdas fixture ${execucao}` } } })).toBe(0);
    const sitio = await prisma.propriedade.create({ data: { nome: `Perdas fixture ${execucao}` } }); sitios.push(sitio.id); sitioId = sitio.id;
    const produto = await prisma.produto.create({ data: { nome: `Perdas fixture ${execucao}`, unidade: "ML", rastrearPartidas: true } }); produtos.push(produto.id); produtoId = produto.id;
    await prisma.$transaction(async (tx) => {
      const alocacoes = await prepararPartidasTx(tx, { produtoId, propriedadeId: sitioId, rastrearPartidas: true, tipo: "ENTRADA", quantidade: new Prisma.Decimal(10), data: new Date("2026-10-01"), partidas: [
        { validade: "2026-10-02", nome: "Lote vencido", quantidade: 5 }, { validade: null, nome: "Lote sem validade", quantidade: 5 },
      ] });
      await tx.movimentoEstoque.create({ data: { produtoId, propriedadeId: sitioId, origem: "COMPRA", tipo: "ENTRADA", data: new Date("2026-10-01"), quantidade: 10, custoUnitario: 2, valorTotal: 20,
        alocacaoPartidaEstoques: { create: alocacoes.map((p) => ({ partidaId: p.partidaId, quantidade: p.quantidade })) },
      } });
    });
    lotes = await listarPartidas(produtoId, sitioId);
  });

  afterAll(async () => {
    if (!produtos.length && !sitios.length) return;
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

  it("recusa motivo curto no serviço sem saldo, operação ou auditoria alterados", async () => {
    await expect(transferirEstoque({ chave: crypto.randomUUID(), produtoId, origemId: sitioId, destinoId: sitioId, modo: "PERDA", quantidade: "3", data: "2026-10-04", motivo: "   abcd   " }, null)).rejects.toMatchObject({ code: "VALIDACAO", campo: "motivo" });
    expect(await prisma.operacao.count({ where: { propriedadeId: sitioId } })).toBe(0);
    expect((await listarPartidas(produtoId, sitioId)).map((p) => p.saldo)).toEqual(["5", "5"]);
  });

  it("conserva motivo, lotes e custo no reenvio e no cancelamento sem criar despesa", async () => {
    const conhecido = lotes.find((p) => p.validade)!;
    const desconhecido = lotes.find((p) => !p.validade)!;
    const input = { chave: crypto.randomUUID(), produtoId, origemId: sitioId, destinoId: sitioId, modo: "PERDA" as const, quantidade: "3", data: "2026-10-04", motivo: "  Frasco danificado na armazenagem  ", partidas: [
      { partidaId: conhecido.id, quantidade: 1 }, { partidaId: desconhecido.id, quantidade: 2, cienciaValidadeDesconhecida: true },
    ] };
    const { operacaoId } = await transferirEstoque(input, null);
    expect(await transferirEstoque({ ...input, motivo: input.motivo.trim() }, null)).toEqual({ operacaoId });
    await expect(transferirEstoque({ ...input, motivo: "Outro motivo válido" }, null)).rejects.toMatchObject({ code: "CONFLITO" });
    const detalhe = await obterOperacao(operacaoId, sitioId);
    expect(detalhe.itens).toHaveLength(0); expect(detalhe.transacoes).toHaveLength(0); expect(detalhe.compromissos).toHaveLength(0);
    expect(detalhe.movimentosEstoque).toHaveLength(1);
    expect(detalhe.perdas[0]).toMatchObject({ produtoId, produtoNome: `Perdas fixture ${execucao}`, unidade: "mL", sitio: { id: sitioId }, motivo: "Frasco danificado na armazenagem" });
    expect(detalhe.perdas[0].quantidade.toString()).toBe("3"); expect(detalhe.perdas[0].valorTotal.toString()).toBe("6");
    expect(detalhe.perdas[0].lotes.map((p) => [p.id, p.quantidade.toString()])).toEqual(expect.arrayContaining([[conhecido.id, "1"], [desconhecido.id, "2"]]));
    expect((await listarPartidas(produtoId, sitioId)).map((p) => p.saldo)).toEqual(["4", "3"]);
    const auditorias = await prisma.auditoriaFinanceira.findMany({ where: { entidadeId: operacaoId, acao: "CONFIRMADA" } });
    expect(auditorias).toHaveLength(1); expect(auditorias[0].motivo).toBe("Frasco danificado na armazenagem");
    await estornarOperacao(operacaoId, "Perda lançada no sítio errado", { propriedadeId: sitioId, usuarioId: null });
    const cancelada = await obterOperacao(operacaoId, sitioId);
    expect(cancelada.status).toBe("CANCELADA"); expect(cancelada.perdas).toEqual(detalhe.perdas);
    expect(cancelada.movimentosEstoque).toHaveLength(2);
    const estorno = cancelada.movimentosEstoque.find((m) => m.reversaoDeId)!;
    expect(estorno.valorTotal.toString()).toBe("6");
    expect(estorno.alocacaoPartidaEstoques.map((p) => [p.partidaId, p.quantidade.toString()])).toEqual(expect.arrayContaining([[conhecido.id, "1"], [desconhecido.id, "2"]]));
    expect((await listarPartidas(produtoId, sitioId)).map((p) => p.saldo)).toEqual(["5", "5"]);
    await expect(estornarOperacao(operacaoId, "Cancelamento repetido", { propriedadeId: sitioId, usuarioId: null })).rejects.toThrow();
    expect(await prisma.movimentoEstoque.count({ where: { operacaoId } })).toBe(2);
  });

  it("não extrai motivo de descrição histórica quando o movimento não informou motivo", async () => {
    const antigo = await prisma.produto.create({ data: { nome: `Perdas fixture ${execucao} histórico`, unidade: "ML", rastrearPartidas: false } }); produtos.push(antigo.id);
    const operacao = await prisma.operacao.create({ data: { tipo: "AJUSTE_ESTOQUE", status: "CONFIRMADA", propriedadeId: sitioId, data: new Date("2026-10-04"), valorTotal: 2, descricao: "Perda antiga" } });
    await prisma.movimentoEstoque.create({ data: { operacaoId: operacao.id, produtoId: antigo.id, propriedadeId: sitioId, origem: "PERDA", tipo: "SAIDA", data: new Date("2026-10-04"), quantidade: 1, custoUnitario: 2, valorTotal: 2, observacao: null } });
    const detalhe = await obterOperacao(operacao.id, sitioId);
    expect(detalhe.perdas[0].motivo).toBeNull();
    expect(detalhe.perdas[0].lotes).toEqual([]);
    await expect(obterOperacao(operacao.id, sitioId + 100000)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
  });
});
