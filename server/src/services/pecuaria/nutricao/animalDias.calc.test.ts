import { describe, expect, it } from "vitest";
import { calcularAnimalDias } from "./animalDias.calc.js";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("animal-dias de um lote", () => {
  it("conta entrada no dia 6 e não duplica intervalos", () => {
    const permanencias = Array.from({ length: 10 }, (_, i) => ({ animalId: `A${i}`, desde: d("2026-09-01"), ate: d("2026-09-11") }));
    permanencias.push({ animalId: "B1", desde: d("2026-09-06"), ate: d("2026-09-11") });
    permanencias.push({ animalId: "B2", desde: d("2026-09-06"), ate: d("2026-09-11") });
    expect(calcularAnimalDias(permanencias, d("2026-09-01"), d("2026-09-10")).animalDias).toBe(110);
  });
  it("dia de saída não conta e intervalos sobrepostos do mesmo animal não duplicam", () => {
    expect(calcularAnimalDias([
      { animalId: "A", desde: d("2026-09-01"), ate: d("2026-09-06") },
      { animalId: "A", desde: d("2026-09-03"), ate: d("2026-09-06") },
    ], d("2026-09-01"), d("2026-09-10"))).toEqual({ animalDias: 5, participacoes: [{ animalId: "A", dias: 5 }] });
  });
});
