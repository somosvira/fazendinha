import { describe, expect, it } from "vitest";
import { calcularCategoria, idadeEmMeses } from "./categoria.calc.js";

describe("idadeEmMeses", () => {
  it("aniversário exato de 12 meses conta os 12 meses completos", () => {
    expect(idadeEmMeses("2025-09-22", "2026-09-22")).toBe(12);
  });

  it("um dia antes do aniversário ainda conta 11 meses", () => {
    expect(idadeEmMeses("2025-09-22", "2026-09-21")).toBe(11);
  });

  it("nunca é negativo", () => {
    expect(idadeEmMeses("2026-09-22", "2026-01-01")).toBe(0);
  });
});

describe("calcularCategoria", () => {
  it("fêmea com menos de 12 meses é BEZERRA", () => {
    expect(calcularCategoria({ sexo: "F", dataNascimento: "2026-01-01", partos: 0, hoje: "2026-09-22" })).toBe("BEZERRA");
  });

  it("fêmea com 12 meses exatos e 0 partos é NOVILHA", () => {
    expect(calcularCategoria({ sexo: "F", dataNascimento: "2025-09-22", partos: 0, hoje: "2026-09-22" })).toBe("NOVILHA");
  });

  it("fêmea com partos é VACA independente da idade (partos antes da entrada)", () => {
    expect(calcularCategoria({ sexo: "F", dataNascimento: "2026-01-01", partos: 1, hoje: "2026-09-22" })).toBe("VACA");
  });

  it("macho com menos de 12 meses é BEZERRO", () => {
    expect(calcularCategoria({ sexo: "M", dataNascimento: "2026-01-01", partos: 0, hoje: "2026-09-22" })).toBe("BEZERRO");
  });

  it("macho entre 12 e 24 meses é GARROTE", () => {
    expect(calcularCategoria({ sexo: "M", dataNascimento: "2025-01-01", partos: 0, hoje: "2026-09-22" })).toBe("GARROTE");
  });

  it("macho com 24 meses exatos é TOURO", () => {
    expect(calcularCategoria({ sexo: "M", dataNascimento: "2024-09-22", partos: 0, hoje: "2026-09-22" })).toBe("TOURO");
  });

  it("aceita faixas customizadas", () => {
    const faixas = { mesesBezerro: 6, mesesGarrote: 18 };
    expect(calcularCategoria({ sexo: "M", dataNascimento: "2026-01-01", partos: 0, hoje: "2026-09-22", faixas })).toBe("GARROTE");
  });
});
