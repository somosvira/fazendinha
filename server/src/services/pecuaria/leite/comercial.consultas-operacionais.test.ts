import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ retiradas: { count: vi.fn(), findMany: vi.fn() }, operacoes: { count: vi.fn(), findMany: vi.fn() } }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: async (f: (tx: unknown) => unknown) => f({ retiradaOperacaoLeite: m.retiradas, operacaoComercialLeite: m.operacoes }) } }));
import { consultarColetasOperacoesLeite, consultarVendasOperacoesLeite } from "./comercial.consultas-operacionais.js";
beforeEach(() => { vi.resetAllMocks(); m.retiradas.count.mockResolvedValue(1); m.operacoes.count.mockResolvedValue(1); });
it("coleta seleciona data física e mostra litros com preço pendente sem caixa ou financeiro", async () => {
  m.retiradas.findMany.mockResolvedValue([{ id: "r", comercialId: "o", referencia: "Coleta", movimento: { data: new Date("2026-10-31"), quantidade: new Prisma.Decimal(10), produto: { nome: "Leite" } }, comercial: { status: "ABERTA", inicio: new Date("2026-10-01"), fim: new Date("2026-11-01"), parceiro: { id: "p", nome: "Comprador" } }, comprovantes: [] }]);
  const r = await consultarColetasOperacoesLeite(2, { de: "2026-10-31", ate: "2026-10-31", pagina: 2 });
  expect(r.itens[0]).toMatchObject({ data: "2026-10-31", quantidadeLitros: "10", situacao: "PRECO_PENDENTE" });
  expect(m.retiradas.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, where: expect.objectContaining({ movimento: { status: "CONFIRMADO", data: { gte: new Date("2026-10-31"), lte: new Date("2026-10-31") } } }) }));
  expect(JSON.stringify(r)).not.toContain("valorTotal");
});
it("venda seleciona comprador/período e mascara preço/total sem esconder volume", async () => {
  m.operacoes.findMany.mockResolvedValue([{ id: "o", parceiroId: "p", inicio: new Date("2026-10-01"), fim: new Date("2026-10-31"), parceiro: { nome: "Comprador" }, referencia: "Outubro", fechamentos: [{ id: "f", versao: 1, volumeReconhecido: new Prisma.Decimal(10), precoUnitario: new Prisma.Decimal(2), operacao: { data: new Date("2026-11-01"), valorTotal: new Prisma.Decimal(20), numero: 123, status: "CONFIRMADA" }, amostras: [] }] }]);
  const r = await consultarVendasOperacoesLeite(2, { de: "2026-10-01", ate: "2026-10-31" }, false);
  expect(r.itens[0].fechamento).toMatchObject({ data: "2026-11-01", volumeReconhecido: "10", precoUnitario: null, valorTotal: null });
  expect(m.operacoes.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 2, status: "FECHADA", fim: { gte: new Date("2026-10-01") }, inicio: { lte: new Date("2026-10-31") } } }));
  const permitido = await consultarVendasOperacoesLeite(2, {}, true);
  expect(permitido.itens[0].fechamento?.valorTotal).toBe("20.00");
});
