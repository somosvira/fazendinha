import { describe, expect, it, vi } from "vitest";
import { calcularCustoMedio, consultarCustoMedio } from "./custo-medio.js";
import { consultarResumo } from "./resumo.js";
vi.mock("./resumo.js", () => ({ consultarResumo: vi.fn() }));
const lote = (animalDias: number, custoConhecido: string | null, coberturaCustoCompleta = true) => ({ custos: { animalDias, custoConhecido, coberturaCustoCompleta } });
describe("média nutricional com base conhecida", () => {
  it("pondera animal-dias e exclui bases sem custo, parciais e vazias", () => {
    expect(calcularCustoMedio([lote(10, "100"), lote(90, "1800"), lote(30, null), lote(50, "10", false), lote(0, "0")])).toEqual({ custoPorAnimalDia: "19.00", custoConhecido: "1900.00", animalDias: 100, lotesIncluidos: 2, lotesTotal: 5 });
  });
  it("distingue média zero de ausência de base", () => {
    expect(calcularCustoMedio([lote(0, "0")]).custoPorAnimalDia).toBeNull();
    expect(calcularCustoMedio([lote(10, "0")]).custoPorAnimalDia).toBe("0.00");
  });
  it("não consulta custos nem entrega a base monetária sem permissão", async () => {
    expect(await consultarCustoMedio(7, false)).toBeNull();
    expect(consultarResumo).not.toHaveBeenCalled();
  });
});
