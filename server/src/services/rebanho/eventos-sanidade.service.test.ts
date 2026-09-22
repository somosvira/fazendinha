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

import { registrarSanidade, editarSanidade } from "./eventos-sanidade.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      movimentoEstoque: { create: mocks.movimentoCreate, update: mocks.movimentoUpdate, delete: mocks.movimentoDelete },
      eventoSanitario: { create: mocks.eventoCreate, update: mocks.eventoUpdate },
      periodoFinanceiro: { findUnique: mocks.periodoFindUnique },
    }),
  );
  mocks.periodoFindUnique.mockResolvedValue(null);
  mocks.propriedadeFindFirst.mockResolvedValue({ id: 5 });
  mocks.exameQuartoFindMany.mockResolvedValue([]);
  mocks.eventoFindMany.mockResolvedValue([]);
  mocks.resumoUpsert.mockResolvedValue({});
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
    mocks.produtoFindUnique.mockResolvedValue({ id: 3, custoUnitario: null, centrosCusto: [] });
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
    mocks.produtoFindUnique.mockResolvedValue({ id: 3, custoUnitario: null, centrosCusto: [] });
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
