import { describe, expect, it, vi } from "vitest";
import { carregarRetornosNaDataTx, contextoRetornoNaData } from "./contexto-retorno.js";

describe("retorno informado na data", () => {
  it("retorno usa dias de calendário, com atraso negativo e ausência explícita", () => {
    expect(contextoRetornoNaData(new Date("2026-10-15"), new Date("2026-10-14"))).toEqual({ retornoEm: "2026-10-15", diasAteRetorno: 1, retornoInformado: true });
    expect(contextoRetornoNaData(new Date("2026-10-13"), new Date("2026-10-14"))).toMatchObject({ diasAteRetorno: -1 });
    expect(contextoRetornoNaData(null, new Date("2026-10-14"))).toEqual({ retornoEm: null, diasAteRetorno: null, retornoInformado: false });
  });
  it("última avaliação sem retorno substitui retorno anterior e lê em lote na data", async () => {
    const tx = { avaliacaoReprodutiva: { findMany: vi.fn().mockResolvedValue([
      { animalId: "a", retornoEm: null }, { animalId: "a", retornoEm: new Date("2026-10-15") }, { animalId: "b", retornoEm: new Date("2026-10-16") },
    ]) } };
    const retornos = await carregarRetornosNaDataTx(tx as unknown as Parameters<typeof carregarRetornosNaDataTx>[0], ["a", "b", "a"], new Date("2026-10-14"));
    expect(retornos.get("a")).toBeNull();
    expect(retornos.get("b")).toEqual(new Date("2026-10-16"));
    expect(tx.avaliacaoReprodutiva.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { animalId: { in: ["a", "b"] }, status: "VALIDO", data: { lte: new Date("2026-10-14") } } }));
  });
});
