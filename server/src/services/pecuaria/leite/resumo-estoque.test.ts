import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
import { consultarResumoEstoqueLeiteTx } from "./resumo-estoque.js";
vi.mock("../../../db.js", () => ({ prisma: {} }));
const D = (v: number) => new Prisma.Decimal(v);
const db = { produto: { findMany: vi.fn() }, movimentoEstoque: { groupBy: vi.fn() }, entradaProducaoLeite: { findMany: vi.fn() } };
const tx = db as unknown as Prisma.TransactionClient;
function origem(produtoId: string, litros: number, natureza: string, valor: number | null = null, alocacoes: unknown[] = []) {
  return { movimento: { produtoId, quantidade: D(litros) }, classificacoes: [{ natureza }], apuracoes: valor === null ? [] : [{ valorTotal: D(valor), apropriacoes: [] }], alocacoes };
}
const movimento = (produtoId: string, tipo: string, quantidade: number, metodoValorizacao = "LEITE_FIFO_V1") => ({ produtoId, tipo, metodoValorizacao, _sum: { quantidade: D(quantidade) } });
beforeEach(() => {
  vi.resetAllMocks();
  db.produto.findMany.mockResolvedValue([{ id: "p1", nome: "Leite 1", ativo: true, unidade: "L" }, { id: "p2", nome: "Leite 2", ativo: true, unidade: "L" }]);
  db.movimentoEstoque.groupBy.mockResolvedValue([movimento("p1", "ENTRADA", 100), movimento("p1", "SAIDA", 20), movimento("p2", "ENTRADA", 15)]);
  db.entradaProducaoLeite.findMany.mockResolvedValue([
    origem("p1", 100, "COMERCIAL", 150, [{ id: "a", quantidade: D(20), valorTotal: D(30), movimento: { status: "CONFIRMADO", reversaoDeId: null } }]),
    origem("p2", 10, "NAO_COMERCIAL"), origem("p2", 5, "COLOSTRO", 10),
  ]);
});
it("agrega vários produtos em lote e o resumo não se limita à página", async () => {
  const r = await consultarResumoEstoqueLeiteTx(tx, 3, { porPagina: 1 }, true);
  expect(r.total).toBe(2); expect(r.itens).toHaveLength(1);
  expect(r.resumo).toMatchObject({ confiavel: true, quantidadeLitros: "95", comercial: { quantidadeLitros: "80" }, descarteLitros: "10", colostroLitros: "5", custoPendenteLitros: "10", estadoValor: "PENDENTE", valorTotal: null });
  expect(r.itens[0].valorTotal).toBe("120.00");
  expect(db.produto.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { movimentos: { some: { propriedadeId: 3, metodoValorizacao: "LEITE_FIFO_V1" } } } }));
  expect(db.entradaProducaoLeite.findMany).toHaveBeenCalledTimes(1); expect(db.movimentoEstoque.groupBy).toHaveBeenCalledTimes(1);
});
it("estorno devolve saldo sem reaproveitar alocação revertida como consumo", async () => {
  db.produto.findMany.mockResolvedValue([{ id: "p1", nome: "Leite", ativo: true }]);
  db.movimentoEstoque.groupBy.mockResolvedValue([movimento("p1", "ENTRADA", 120), movimento("p1", "SAIDA", 20)]);
  db.entradaProducaoLeite.findMany.mockResolvedValue([origem("p1", 100, "COMERCIAL", 150, [{ id: "a", quantidade: D(20), valorTotal: D(30), movimento: { status: "REVERTIDO", reversaoDeId: null } }])]);
  const r = await consultarResumoEstoqueLeiteTx(tx, 3, {}, true);
  expect(r.resumo).toMatchObject({ confiavel: true, quantidadeLitros: "100", valorTotal: "150.00" });
});
it("divergência ou método estranho mantém saldo desconhecido no consolidado", async () => {
  db.movimentoEstoque.groupBy.mockResolvedValue([movimento("p1", "ENTRADA", 101), movimento("p2", "ENTRADA", 15)]);
  const r = await consultarResumoEstoqueLeiteTx(tx, 3, {}, true);
  expect(r.resumo.confiavel).toBe(false); expect(r.resumo.quantidadeLitros).toBeNull(); expect(r.resumo.comercial.quantidadeLitros).toBeNull();
  expect(r.itens[1].quantidadeLitros).toBe("15");
});
it("não libera disponibilidade comercial com classificação pendente", async () => {
  db.entradaProducaoLeite.findMany.mockResolvedValue([origem("p1", 80, "NAO_INFORMADA"), origem("p2", 15, "COLOSTRO")]);
  const r = await consultarResumoEstoqueLeiteTx(tx, 3, {}, true);
  expect(r.resumo.quantidadeLitros).toBe("95"); expect(r.resumo.classificacaoPendenteLitros).toBe("80");
  expect(r.resumo.comercial).toEqual({ confiavel: false, quantidadeLitros: null });
});
it("mascara todos os valores e estados auxiliares sem verValores", async () => {
  const r = await consultarResumoEstoqueLeiteTx(tx, 3, {}, false);
  expect(r.resumo.estadoValor).toBe("OCULTO"); expect(r.resumo.valorTotal).toBeNull(); expect(r.resumo.custoPendenteLitros).toBeNull();
  expect(r.itens.every(i => i.valorTotal === null && i.estadoValor === "OCULTO" && i.custoPendenteLitros === null)).toBe(true);
});
it("sem produtos ou origens não inventa zero nem consulta por produto", async () => {
  db.produto.findMany.mockResolvedValue([]);
  const r = await consultarResumoEstoqueLeiteTx(tx, 3, {}, true);
  expect(r.resumo.quantidadeLitros).toBeNull(); expect(r.total).toBe(0);
  expect(db.movimentoEstoque.groupBy).not.toHaveBeenCalled();
});
