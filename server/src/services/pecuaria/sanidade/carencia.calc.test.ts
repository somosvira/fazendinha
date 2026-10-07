import { describe, expect, it } from "vitest";
import { calcularPrazoCarencia } from "./carencia.calc.js";

describe("carência por animal", () => {
  const primeira = { data: new Date("2026-09-01"), aplicadaEm: new Date("2026-09-01T10:00:00-03:00"), precisaoTemporal: "HORA", carenciaLeiteHoras: 24, carenciaCarneHoras: 48 };
  it("não inventa uma data de carência sem aplicações", () => {
    expect(calcularPrazoCarencia([], "LEITE")).toEqual({ estado: "NENHUMA" });
  });
  it("guarda o término mais distante de cada destino", () => {
    const segunda = { ...primeira, aplicadaEm: new Date("2026-09-02T10:00:00-03:00"), carenciaLeiteHoras: 12 };
    expect(calcularPrazoCarencia([primeira, segunda], "LEITE")).toMatchObject({ estado: "CONHECIDO", ate: new Date("2026-09-02T22:00:00-03:00") });
    expect(calcularPrazoCarencia([primeira, segunda], "CARNE")).toMatchObject({ estado: "CONHECIDO", ate: new Date("2026-09-04T10:00:00-03:00") });
  });
  it("não trata ausência de prazo como zero", () => {
    expect(calcularPrazoCarencia([{ ...primeira, carenciaLeiteHoras: null }], "LEITE")).toEqual({ estado: "NAO_INFORMADO" });
    expect(calcularPrazoCarencia([{ ...primeira, carenciaLeiteHoras: 0 }], "LEITE")).toMatchObject({ estado: "CONHECIDO", ate: primeira.aplicadaEm });
  });
  it("indica prazo zero somente quando todas as aplicações relevantes confirmam zero", () => {
    const zero = { ...primeira, carenciaLeiteHoras: 0 };
    expect(calcularPrazoCarencia([zero], "LEITE")).toMatchObject({ estado: "CONHECIDO", prazoZero: true });
    expect(calcularPrazoCarencia([zero, { ...primeira, estadoCarenciaLeite: "NAO_APLICAVEL" }], "LEITE")).toMatchObject({ prazoZero: true });
    expect(calcularPrazoCarencia([zero, primeira], "LEITE")).not.toHaveProperty("prazoZero");
    expect(calcularPrazoCarencia([zero, { ...primeira, carenciaLeiteHoras: null }], "LEITE")).toEqual({ estado: "NAO_INFORMADO" });
  });
  it("distingue não aplicabilidade confirmada e não informação por destino", () => {
    const a = { ...primeira, carenciaLeiteHoras: null, estadoCarenciaLeite: "NAO_APLICAVEL", estadoCarenciaCarne: "INFORMADO" };
    expect(calcularPrazoCarencia([a], "LEITE")).toEqual({ estado: "NAO_APLICAVEL" });
    expect(calcularPrazoCarencia([a], "CARNE")).toMatchObject({ estado: "CONHECIDO" });
    expect(calcularPrazoCarencia([a, { ...a, estadoCarenciaLeite: "NAO_INFORMADO" }], "LEITE")).toEqual({ estado: "NAO_INFORMADO" });
    expect(calcularPrazoCarencia([a, primeira], "LEITE")).toMatchObject({ estado: "CONHECIDO" });
  });
});
