import { describe, expect, it } from "vitest";
import { calcularCategoria, filtroCategoria, idadeEmMeses } from "./categoria.calc.js";

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

describe("filtroCategoria equivale a calcularCategoria", () => {
  const atende = (f: ReturnType<typeof filtroCategoria>, sexo: "F" | "M", nasc: Date, partos: number) =>
    f.sexo === sexo
    && (f.semPartos === undefined || (f.semPartos ? partos === 0 : partos > 0))
    && (f.nascidoAte === undefined || nasc.getTime() <= f.nascidoAte.getTime())
    && (f.nascidoApos === undefined || nasc.getTime() > f.nascidoApos.getTime());

  const hojes = ["2026-09-23", "2026-03-31", "2026-02-28", "2028-02-29", "2027-03-01", "2026-12-31"];
  const categorias = ["BEZERRA", "NOVILHA", "VACA", "BEZERRO", "GARROTE", "TOURO"] as const;

  it.each(hojes)("varredura de nascimentos em 30 meses para hoje=%s", (hoje) => {
    const h = new Date(hoje);
    for (let dias = 0; dias <= 30 * 31; dias += 1) {
      const nasc = new Date(h.getTime() - dias * 86_400_000);
      for (const sexo of ["F", "M"] as const) {
        for (const partos of [0, 1]) {
          const esperada = calcularCategoria({ sexo, dataNascimento: nasc, partos, hoje: h });
          const casadas = categorias.filter((c) => atende(filtroCategoria(c, h), sexo, nasc, partos));
          expect(casadas).toEqual([esperada]);
        }
      }
    }
  });
});
