import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), groupBy: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: { eventoReprodutivo: { findMany: mocks.findMany, groupBy: mocks.groupBy } } }));

import { contarEventosPorTipo, obterRelatorioReproducao } from "./relatorio-reproducao.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([
    { animalId: 1, tipo: "INSEMINACAO", data: new Date("2026-01-10T00:00:00Z"), resultado: null },
    { animalId: 1, tipo: "DIAGNOSTICO", data: new Date("2026-02-01T00:00:00Z"), resultado: "positivo" },
    { animalId: 1, tipo: "PARTO", data: new Date("2026-10-20T00:00:00Z"), resultado: null },
  ]);
  mocks.groupBy.mockResolvedValue([{ tipo: "INSEMINACAO", _count: { _all: 830 } }, { tipo: "PARTO", _count: { _all: 352 } }]);
});

describe("obterRelatorioReproducao", () => {
  it("lê eventos no escopo do sítio e agrega o relatório", async () => {
    const r = await obterRelatorioReproducao(7, {});
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { tipo: { in: ["INSEMINACAO", "COBERTURA", "TRANSFERENCIA_EMBRIAO", "DIAGNOSTICO", "PARTO"] }, animal: { propriedadeId: 7 } },
      select: { animalId: true, tipo: true, data: true, resultado: true },
    });
    expect(r.coberturas).toBe(1);
    expect(r.prenhes).toBe(1);
    expect(r.partos).toBe(1);
    expect(r.taxaConcepcao).toBe(1);
  });

  it("propaga a janela de/ate ao filtro de data", async () => {
    await obterRelatorioReproducao(null, { de: "2026-01-01", ate: "2026-06-30" });
    const arg = mocks.findMany.mock.calls[0][0];
    expect(arg.where.data).toEqual({ gte: new Date("2026-01-01T00:00:00Z"), lte: new Date("2026-06-30T00:00:00Z") });
    expect(arg.where.animal).toBeUndefined();
  });
});

describe("contarEventosPorTipo", () => {
  it("agrupa por tipo no escopo e devolve um Record", async () => {
    await expect(contarEventosPorTipo(7)).resolves.toEqual({ INSEMINACAO: 830, PARTO: 352 });
    expect(mocks.groupBy).toHaveBeenCalledWith({ by: ["tipo"], where: { animal: { propriedadeId: 7 } }, _count: { _all: true } });
  });
});
