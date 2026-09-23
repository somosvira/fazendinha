import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  animalFindFirst: vi.fn(),
  eventoFindFirst: vi.fn(),
  eventoFindMany: vi.fn(),
  produtoFindUnique: vi.fn(),
  periodoFindUnique: vi.fn(),
  propriedadeFindFirst: vi.fn(),
  exameQuartoFindMany: vi.fn(),
  resumoUpsert: vi.fn(),
  movimentoCreate: vi.fn(),
  movimentoUpdate: vi.fn(),
  movimentoDelete: vi.fn(),
  movimentoFindMany: vi.fn(),
  movimentoGroupBy: vi.fn(),
  movimentoFindUnique: vi.fn(),
  movimentoFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  queryRaw: vi.fn(),
  eventoDelete: vi.fn(),
  eventoCreate: vi.fn(),
  eventoUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    animal: { findFirst: mocks.animalFindFirst },
    eventoSanitario: {
      findFirst: mocks.eventoFindFirst,
      findMany: mocks.eventoFindMany,
      create: mocks.eventoCreate,
      update: mocks.eventoUpdate,
    },
    produto: { findUnique: mocks.produtoFindUnique },
    periodoFinanceiro: { findUnique: mocks.periodoFindUnique },
    propriedade: { findFirst: mocks.propriedadeFindFirst },
    exameQuarto: { findMany: mocks.exameQuartoFindMany },
    resumoAnimal: { upsert: mocks.resumoUpsert },
    movimentoEstoque: { create: mocks.movimentoCreate, update: mocks.movimentoUpdate, delete: mocks.movimentoDelete },
    $transaction: mocks.transaction,
  },
}));

import { Prisma } from "@prisma/client";
import { registrarSanidade, editarSanidade, excluirSanidade } from "./eventos-sanidade.js";

const D = (v: number) => new Prisma.Decimal(v);
// Base do custo médio agregada no banco: compras 10×5 + 10×7 → 20 / R$ 120 (médio 6).
const basesCusto = [{ produtoId: 3, _sum: { quantidade: D(20), valorTotal: D(120) } }];
const movAnterior = {
  id: 77, produtoId: 3, tipo: "SAIDA", origem: "SANIDADE", status: "CONFIRMADO", data: new Date("2026-02-05"),
  quantidade: D(2), custoUnitario: D(5), valorTotal: D(10), propriedadeId: 5, operacaoId: null, reversaoDeId: null, revertidoPor: null, centroCustoId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      movimentoEstoque: {
        create: mocks.movimentoCreate, update: mocks.movimentoUpdate, delete: mocks.movimentoDelete,
        findMany: mocks.movimentoFindMany, groupBy: mocks.movimentoGroupBy, findUnique: mocks.movimentoFindUnique, findFirst: mocks.movimentoFindFirst,
      },
      eventoSanitario: { create: mocks.eventoCreate, update: mocks.eventoUpdate, delete: mocks.eventoDelete },
      periodoFinanceiro: { findUnique: mocks.periodoFindUnique },
      auditoriaFinanceira: { create: mocks.auditCreate },
      $queryRaw: mocks.queryRaw,
    }),
  );
  mocks.periodoFindUnique.mockResolvedValue(null);
  mocks.propriedadeFindFirst.mockResolvedValue({ id: 5 });
  mocks.exameQuartoFindMany.mockResolvedValue([]);
  mocks.eventoFindMany.mockResolvedValue([]);
  mocks.resumoUpsert.mockResolvedValue({});
  mocks.movimentoFindMany.mockResolvedValue([]);
  mocks.movimentoGroupBy.mockResolvedValue(basesCusto);
  mocks.movimentoFindUnique.mockResolvedValue(movAnterior);
  mocks.movimentoFindFirst.mockResolvedValue(movAnterior);
  mocks.movimentoCreate.mockResolvedValue({ id: 90 });
  mocks.movimentoUpdate.mockResolvedValue({});
  mocks.queryRaw.mockResolvedValue([]);
  mocks.auditCreate.mockResolvedValue({});
});

describe("eventos de sanidade — mês fechado só bloqueia quando há efeito de estoque", () => {
  it("registra um EXAME (sem produto) mesmo com o mês fechado", async () => {
    mocks.animalFindFirst.mockResolvedValue({ id: 1, propriedadeId: 5, grupo: null });
    mocks.periodoFindUnique.mockResolvedValue({ status: "FECHADO" });
    mocks.eventoCreate.mockResolvedValue({ id: 100, animalId: 1, tipo: "EXAME", data: new Date("2026-01-10") });

    await registrarSanidade(1, { tipo: "EXAME", data: "2026-01-10", ccs: 200 } as any);

    expect(mocks.eventoCreate).toHaveBeenCalled();
    expect(mocks.movimentoCreate).not.toHaveBeenCalled();
  });

  it("rejeita uma APLICACAO (com produto) em mês fechado", async () => {
    mocks.animalFindFirst.mockResolvedValue({ id: 1, propriedadeId: 5, grupo: null });
    mocks.produtoFindUnique.mockResolvedValue({ id: 3, centrosCusto: [] });
    mocks.periodoFindUnique.mockResolvedValue({ status: "FECHADO" });

    await expect(
      registrarSanidade(1, {
        tipo: "APLICACAO", data: "2026-01-10", produto: "Vermífugo", produtoId: 3, quantidadeUsada: 2,
      } as any),
    ).rejects.toEqual(expect.objectContaining({ code: "MES_FECHADO" }));
  });

  it("editarSanidade verifica também a data antiga quando ela muda e há movimento de estoque", async () => {
    mocks.eventoFindFirst.mockResolvedValue({
      id: 50, animalId: 1, tipo: "APLICACAO", data: new Date("2026-01-10"),
      movimentoEstoqueId: 77, produtoId: 3, quantidadeUsada: 2,
      animal: { propriedadeId: 5, grupo: null },
    });
    mocks.produtoFindUnique.mockResolvedValue({ id: 3, centrosCusto: [] });
    // Mês novo (fevereiro) aberto, mas mês antigo (janeiro) fechado.
    mocks.periodoFindUnique.mockImplementation(async ({ where }: any) => {
      return where.propriedadeId_ano_mes.mes === 1 ? { status: "FECHADO" } : null;
    });

    await expect(
      editarSanidade(50, {
        tipo: "APLICACAO", data: "2026-02-05", produto: "Vermífugo", produtoId: 3, quantidadeUsada: 2,
      } as any),
    ).rejects.toEqual(expect.objectContaining({ code: "MES_FECHADO" }));
  });

  it("editarSanidade não bloqueia por mês fechado quando o evento não tem efeito de estoque", async () => {
    mocks.eventoFindFirst.mockResolvedValue({
      id: 51, animalId: 1, tipo: "EXAME", data: new Date("2026-01-10"),
      movimentoEstoqueId: null, produtoId: null, quantidadeUsada: null,
      animal: { propriedadeId: 5, grupo: null },
    });
    mocks.periodoFindUnique.mockResolvedValue({ status: "FECHADO" });
    mocks.eventoUpdate.mockResolvedValue({ id: 51, animalId: 1, tipo: "EXAME", data: new Date("2026-02-05") });

    await editarSanidade(51, { tipo: "EXAME", data: "2026-02-05", ccs: 250 } as any);

    expect(mocks.eventoUpdate).toHaveBeenCalled();
  });
});

describe("eventos de sanidade — baixa pelo custo médio e estorno em vez de edição/apagamento", () => {
  const aplicacao = (quantidadeUsada: number) => ({ tipo: "APLICACAO", data: "2026-02-05", produto: "Vermífugo", produtoId: 3, quantidadeUsada } as any);
  const eventoComBaixa = {
    id: 50, animalId: 1, tipo: "APLICACAO", data: new Date("2026-02-05"),
    movimentoEstoqueId: 77, produtoId: 3, quantidadeUsada: D(2),
    animal: { propriedadeId: 5, grupo: null },
  };

  it("registrar APLICACAO grava SAIDA com o custo médio do sítio", async () => {
    mocks.animalFindFirst.mockResolvedValue({ id: 1, propriedadeId: 5, grupo: null });
    mocks.produtoFindUnique.mockResolvedValue({ id: 3, centrosCusto: [] });
    mocks.eventoCreate.mockResolvedValue({ id: 100, animalId: 1, tipo: "APLICACAO", data: new Date("2026-02-05") });

    await registrarSanidade(1, aplicacao(3));

    const dados = mocks.movimentoCreate.mock.calls[0][0].data;
    expect(dados).toEqual(expect.objectContaining({ tipo: "SAIDA", origem: "SANIDADE", propriedadeId: 5 }));
    expect(Number(dados.custoUnitario)).toBe(6);
    expect(Number(dados.valorTotal)).toBe(18);
  });

  it("editar quantidade estorna o movimento antigo e cria outro — nunca update in-place", async () => {
    mocks.eventoFindFirst.mockResolvedValue(eventoComBaixa);
    mocks.produtoFindUnique.mockResolvedValue({ id: 3, centrosCusto: [] });
    mocks.eventoUpdate.mockResolvedValue({ id: 50, animalId: 1, tipo: "APLICACAO", data: new Date("2026-02-05") });

    await editarSanidade(50, aplicacao(4));

    expect(mocks.movimentoUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.movimentoUpdate).toHaveBeenCalledWith({ where: { id: 77 }, data: { status: "REVERTIDO" } });
    const [inverso, novo] = mocks.movimentoCreate.mock.calls.map((c) => c[0].data);
    expect(inverso).toEqual(expect.objectContaining({ tipo: "ENTRADA", reversaoDeId: 77 }));
    expect(novo).toEqual(expect.objectContaining({ tipo: "SAIDA", origem: "SANIDADE" }));
    expect(Number(novo.quantidade)).toBe(4);
    expect(Number(novo.valorTotal)).toBe(24);
    expect(mocks.movimentoDelete).not.toHaveBeenCalled();
    expect(mocks.eventoUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ movimentoEstoqueId: 90 }) }));
  });

  it("editar sem mudar a baixa mantém o movimento existente", async () => {
    mocks.eventoFindFirst.mockResolvedValue(eventoComBaixa);
    mocks.produtoFindUnique.mockResolvedValue({ id: 3, centrosCusto: [] });
    mocks.eventoUpdate.mockResolvedValue({ id: 50, animalId: 1, tipo: "APLICACAO", data: new Date("2026-02-05") });

    await editarSanidade(50, { ...aplicacao(2), observacao: "reforço" });

    expect(mocks.movimentoCreate).not.toHaveBeenCalled();
    expect(mocks.movimentoUpdate).not.toHaveBeenCalled();
    expect(mocks.eventoUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ movimentoEstoqueId: 77 }) }));
  });

  it("editar removendo o produto estorna a baixa", async () => {
    mocks.eventoFindFirst.mockResolvedValue(eventoComBaixa);
    mocks.eventoUpdate.mockResolvedValue({ id: 50, animalId: 1, tipo: "APLICACAO", data: new Date("2026-02-05") });

    await editarSanidade(50, { tipo: "APLICACAO", data: "2026-02-05", produto: "Vermífugo" } as any);

    expect(mocks.movimentoUpdate).toHaveBeenCalledWith({ where: { id: 77 }, data: { status: "REVERTIDO" } });
    expect(mocks.movimentoCreate).toHaveBeenCalledTimes(1); // só o inverso
    expect(mocks.eventoUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ movimentoEstoqueId: null }) }));
  });

  it("excluir estorna a baixa em vez de apagar o movimento", async () => {
    mocks.eventoFindFirst.mockResolvedValue(eventoComBaixa);
    mocks.eventoDelete.mockResolvedValue({});

    await excluirSanidade(50);

    expect(mocks.movimentoUpdate).toHaveBeenCalledWith({ where: { id: 77 }, data: { status: "REVERTIDO" } });
    expect(mocks.movimentoCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ reversaoDeId: 77 }) });
    expect(mocks.movimentoDelete).not.toHaveBeenCalled();
    expect(mocks.eventoDelete).toHaveBeenCalledWith({ where: { id: 50 } });
  });
});
