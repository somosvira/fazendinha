import { describe, it, expect } from "vitest";
import { converterUA } from "./ua.calc.js";

const PESOS = { VACA: 500, NOVILHA: 280, BEZERRA: 120 };
const UA_REF = 450;

describe("converterUA", () => {
  it("converte cabeças por categoria em UA (cabecas * pesoRef / pesoUaRefKg)", () => {
    const r = converterUA(
      [{ categoria: "VACA", cabecas: 10 }, { categoria: "NOVILHA", cabecas: 5 }],
      PESOS, UA_REF,
    );
    // VACA: 10*500/450 = 11.11 ; NOVILHA: 5*280/450 = 3.11
    const vaca = r.linhas.find((l) => l.categoria === "VACA")!;
    const nov = r.linhas.find((l) => l.categoria === "NOVILHA")!;
    expect(vaca.ua).toBe(11.11);
    expect(nov.ua).toBe(3.11);
    expect(r.totalCabecas).toBe(15);
    expect(r.totalUA).toBe(14.22);
  });

  it("ordena linhas por UA desc", () => {
    const r = converterUA(
      [{ categoria: "BEZERRA", cabecas: 2 }, { categoria: "VACA", cabecas: 10 }],
      PESOS, UA_REF,
    );
    expect(r.linhas.map((l) => l.categoria)).toEqual(["VACA", "BEZERRA"]);
  });

  it("categoria sem peso-ref → pesoRef 0, ua 0, semPeso true", () => {
    const r = converterUA([{ categoria: "TOURO", cabecas: 3 }], PESOS, UA_REF);
    const touro = r.linhas.find((l) => l.categoria === "TOURO")!;
    expect(touro.pesoRef).toBe(0);
    expect(touro.ua).toBe(0);
    expect(touro.semPeso).toBe(true);
    expect(r.totalUA).toBe(0);
  });

  it("com área → UA/ha; sem área → null", () => {
    const semArea = converterUA([{ categoria: "VACA", cabecas: 9 }], PESOS, UA_REF);
    expect(semArea.uaPorHa).toBeNull();
    expect(semArea.areaHa).toBeNull();

    // VACA: 9*500/450 = 10 UA ; em 4 ha → 2.5 UA/ha
    const comArea = converterUA([{ categoria: "VACA", cabecas: 9 }], PESOS, UA_REF, 4);
    expect(comArea.totalUA).toBe(10);
    expect(comArea.uaPorHa).toBe(2.5);
    expect(comArea.areaHa).toBe(4);
  });

  it("área 0 ou negativa → uaPorHa null (não divide por zero)", () => {
    expect(converterUA([{ categoria: "VACA", cabecas: 9 }], PESOS, UA_REF, 0).uaPorHa).toBeNull();
    expect(converterUA([{ categoria: "VACA", cabecas: 9 }], PESOS, UA_REF, -3).uaPorHa).toBeNull();
  });

  it("vazio → zeros", () => {
    const r = converterUA([], PESOS, UA_REF);
    expect(r).toEqual({ linhas: [], totalCabecas: 0, totalUA: 0, uaPorHa: null, areaHa: null });
  });

  it("pesoUaRefKg inválido (0) → UA 0 sem NaN/Infinity", () => {
    const r = converterUA([{ categoria: "VACA", cabecas: 10 }], PESOS, 0);
    expect(r.totalUA).toBe(0);
    expect(r.linhas[0].ua).toBe(0);
  });
});
