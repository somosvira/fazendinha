import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  produtoFindUnique: vi.fn(),
  produtoFindFirst: vi.fn(),
  centroFindFirst: vi.fn(),
  periodoFindUnique: vi.fn(),
  movFindMany: vi.fn(),
  movFindFirst: vi.fn(),
  movCreate: vi.fn(),
  movUpdate: vi.fn(),
  opCreate: vi.fn(),
  auditCreate: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  propriedadePrincipalId: vi.fn(),
}));

vi.mock("../../db.js", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("../propriedade.js", () => ({ propriedadePrincipalId: mocks.propriedadePrincipalId, escopoPadraoLeitura: vi.fn().mockResolvedValue(1) }));

import { ajustarContagem, excluirMovimento, estornarMovimentoTx, registrarMovimento } from "./estoque.js";

const tx = () => ({
  produto: { findUnique: mocks.produtoFindUnique, findFirst: mocks.produtoFindFirst },
  centroCusto: { findFirst: mocks.centroFindFirst },
  periodoFinanceiro: { findUnique: mocks.periodoFindUnique },
  movimentoEstoque: { findMany: mocks.movFindMany, findFirst: mocks.movFindFirst, create: mocks.movCreate, update: mocks.movUpdate },
  operacao: { create: mocks.opCreate },
  auditoriaFinanceira: { create: mocks.auditCreate },
  $queryRaw: mocks.queryRaw,
});

const produto = { id: 3, nome: "Ureia", unidade: "KG", ativo: true, estocavel: true, centrosCusto: [{ centroCustoId: 9 }, { centroCustoId: 11 }] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx()));
  mocks.produtoFindUnique.mockResolvedValue(produto);
  mocks.produtoFindFirst.mockResolvedValue(produto);
  mocks.centroFindFirst.mockResolvedValue({ id: 11, ativo: true });
  mocks.periodoFindUnique.mockResolvedValue(null);
  mocks.opCreate.mockResolvedValue({ id: 50, itens: [{ id: 51 }] });
  mocks.movCreate.mockResolvedValue({ id: 100, quantidade: new Prisma.Decimal(1) });
  mocks.movUpdate.mockResolvedValue({});
  mocks.auditCreate.mockResolvedValue({});
  mocks.queryRaw.mockResolvedValue([]);
  mocks.propriedadePrincipalId.mockResolvedValue(1);
});

describe("ajustarContagem", () => {
  it("propaga o centro de custo escolhido ao movimento e audita", async () => {
    mocks.movFindMany.mockResolvedValue([{ tipo: "ENTRADA", quantidade: new Prisma.Decimal(10) }]);
    await ajustarContagem({ produtoId: 3, quantidadeContada: 8, saldoEsperado: 10, observacao: "Contagem física", propriedadeId: 1, centroCustoId: 11, usuarioId: 7 });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: "AJUSTE", origem: "AJUSTE_INVENTARIO", centroCustoId: 11, quantidade: -2, criadoPorId: 7, propriedadeId: 1 }) });
    expect(mocks.opCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipo: "AJUSTE_ESTOQUE", criadoPorId: 7 }) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ entidade: "Operacao", entidadeId: "50", acao: "AJUSTE_CONTAGEM", usuarioId: 7 }) });
  });
});

describe("registrarMovimento", () => {
  it("grava criadoPorId e audita AJUSTE_MANUAL", async () => {
    await registrarMovimento({ produtoId: 3, tipo: "AJUSTE", data: "2026-01-10", quantidade: 5, observacao: "Sobrou no galpão", propriedadeId: 1, usuarioId: 7 });
    expect(mocks.opCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ criadoPorId: 7 }) }));
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ criadoPorId: 7, operacaoId: 50 }) });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ entidade: "Operacao", entidadeId: "50", acao: "AJUSTE_MANUAL", usuarioId: 7 }) });
  });
  it("sem custo informado, valoriza o ajuste pelo custo médio do sítio", async () => {
    mocks.movFindMany.mockResolvedValue([
      { produtoId: 3, tipo: "ENTRADA", origem: "COMPRA", status: "CONFIRMADO", reversaoDeId: null, quantidade: new Prisma.Decimal(10), valorTotal: new Prisma.Decimal(50) },
      { produtoId: 3, tipo: "ENTRADA", origem: "COMPRA", status: "CONFIRMADO", reversaoDeId: null, quantidade: new Prisma.Decimal(10), valorTotal: new Prisma.Decimal(70) },
    ]);
    await registrarMovimento({ produtoId: 3, tipo: "AJUSTE", data: "2026-01-10", quantidade: 5, observacao: "Sobrou no galpão", propriedadeId: 1 });
    // propriedade 1 é a principal → inclui movimentos legados sem propriedade.
    expect(mocks.movFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ produtoId: { in: [3] }, status: "CONFIRMADO", reversaoDeId: null }) }));
    const data = mocks.movCreate.mock.calls[0][0].data;
    expect(Number(data.custoUnitario)).toBe(6);
    expect(Number(data.valorTotal)).toBe(30);
  });
  it("custo informado prevalece sobre o médio", async () => {
    mocks.movFindMany.mockResolvedValue([]);
    await registrarMovimento({ produtoId: 3, tipo: "AJUSTE", data: "2026-01-10", quantidade: 2, custoUnitario: 4, observacao: "Sobrou no galpão", propriedadeId: 1 });
    expect(Number(mocks.movCreate.mock.calls[0][0].data.valorTotal)).toBe(8);
    expect(mocks.movFindMany).not.toHaveBeenCalled();
  });
  it("sem usuário grava criadoPorId null", async () => {
    await registrarMovimento({ produtoId: 3, tipo: "AJUSTE", data: "2026-01-10", quantidade: 5, observacao: "Sobrou no galpão", propriedadeId: 1 });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ criadoPorId: null }) });
  });
});

const movBase = {
  id: 40, produtoId: 3, tipo: "ENTRADA", origem: "AJUSTE_INVENTARIO", status: "CONFIRMADO", data: new Date("2026-01-10"),
  quantidade: new Prisma.Decimal(5), custoUnitario: new Prisma.Decimal(2), valorTotal: new Prisma.Decimal(10),
  propriedadeId: 1, operacaoId: 50, reversaoDeId: null, revertidoPor: null, centroCustoId: 11, consumoPeriodoId: null,
};

describe("excluirMovimento", () => {
  it("bloqueia movimento de COMPRA (nasceu de operação financeira)", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, origem: "COMPRA" });
    await expect(excluirMovimento(40, 1, 7)).rejects.toMatchObject({ code: "ORIGEM_AUTOMATICA", message: expect.stringContaining("estorne a operação") });
    expect(mocks.movCreate).not.toHaveBeenCalled();
    expect(mocks.movUpdate).not.toHaveBeenCalled();
  });

  it.each(["SANIDADE", "NUTRICAO", "APLICACAO"])("bloqueia origem %s", async (origem) => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, origem, operacaoId: null });
    await expect(excluirMovimento(40, 1, 7)).rejects.toMatchObject({ code: "ORIGEM_AUTOMATICA" });
  });

  it("estorna AJUSTE_INVENTARIO: cria inverso, marca REVERTIDO e audita", async () => {
    mocks.movFindFirst.mockResolvedValue(movBase);
    await excluirMovimento(40, 1, 7);
    expect(mocks.queryRaw).toHaveBeenCalled(); // lock na Operacao
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      tipo: "SAIDA", origem: "AJUSTE_INVENTARIO", reversaoDeId: 40, operacaoId: 50, centroCustoId: 11, propriedadeId: 1, criadoPorId: 7,
    }) });
    expect(mocks.movUpdate).toHaveBeenCalledWith({ where: { id: 40 }, data: { status: "REVERTIDO" } });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ entidade: "MovimentoEstoque", entidadeId: "40", acao: "ESTORNO_MOVIMENTO", usuarioId: 7 }) });
  });

  it("recusa estornar duas vezes", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, status: "REVERTIDO" });
    await expect(excluirMovimento(40, 1)).rejects.toMatchObject({ code: "ORIGEM_AUTOMATICA", message: "movimento já estornado" });
  });

  it("recusa em período fechado", async () => {
    mocks.movFindFirst.mockResolvedValue(movBase);
    mocks.periodoFindUnique.mockResolvedValue({ status: "FECHADO" });
    await expect(excluirMovimento(40, 1)).rejects.toMatchObject({ code: "MES_FECHADO" });
  });
});

describe("estornarMovimentoTx", () => {
  it("não checa origem — estorna APLICACAO quando chamado pelo domínio dono, invertendo SAIDA em ENTRADA", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, tipo: "SAIDA", origem: "APLICACAO", operacaoId: null });
    const r = await estornarMovimentoTx(tx() as never, 40, { observacao: "Estorno: operação agrícola #9 excluída" });
    expect(mocks.movCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: "ENTRADA", reversaoDeId: 40, observacao: "Estorno: operação agrícola #9 excluída", criadoPorId: null }) });
    expect(r.inverso.id).toBe(100);
    expect(mocks.movUpdate).toHaveBeenCalledWith({ where: { id: 40 }, data: { status: "REVERTIDO" } });
  });
  it("AJUSTE é invertido negando a quantidade", async () => {
    mocks.movFindFirst.mockResolvedValue({ ...movBase, tipo: "AJUSTE", quantidade: new Prisma.Decimal(-3), valorTotal: new Prisma.Decimal(-6) });
    await estornarMovimentoTx(tx() as never, 40);
    const data = mocks.movCreate.mock.calls[0][0].data;
    expect(data.tipo).toBe("AJUSTE");
    expect(Number(data.quantidade)).toBe(3);
    expect(Number(data.valorTotal)).toBe(6);
  });
});
