import { describe, expect, it } from "vitest";
import { aplicarAptidaoAutomaticaSchema, registrarAptidaoSchema } from "./aptidao.schemas.js";

describe("registrarAptidaoSchema", () => {
  it("aceita lançamento manual com data, decisão e motivo", () => {
    expect(registrarAptidaoSchema.parse({
      data: "2026-07-26",
      apta: true,
      motivo: "Avaliação do técnico",
    })).toEqual({
      data: "2026-07-26",
      apta: true,
      motivo: "Avaliação do técnico",
    });
  });

  it("rejeita data fora de YYYY-MM-DD", () => {
    expect(() => registrarAptidaoSchema.parse({ data: "26/07/2026", apta: true })).toThrow();
  });
});

describe("aplicarAptidaoAutomaticaSchema", () => {
  it("aceita data opcional para materialização determinística", () => {
    expect(aplicarAptidaoAutomaticaSchema.parse({ data: "2026-07-26" })).toEqual({ data: "2026-07-26" });
    expect(aplicarAptidaoAutomaticaSchema.parse({})).toEqual({});
  });
});
