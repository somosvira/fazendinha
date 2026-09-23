import { describe, expect, it } from "vitest";
import { calcularCategoriaCliente, idadeEmMesesCliente } from "./categoria";

describe("idadeEmMesesCliente", () => {
  it("conta meses completos, não arredonda para cima", () => {
    expect(idadeEmMesesCliente("2025-01-15", "2026-01-14")).toBe(11);
    expect(idadeEmMesesCliente("2025-01-15", "2026-01-15")).toBe(12);
  });
});

describe("calcularCategoriaCliente", () => {
  it("fêmea sem partos: bezerra antes de 12 meses, novilha depois", () => {
    expect(calcularCategoriaCliente({ sexo: "F", dataNascimento: "2026-01-01", partosAntesDaEntrada: 0, hoje: "2026-06-01" })).toBe("BEZERRA");
    expect(calcularCategoriaCliente({ sexo: "F", dataNascimento: "2024-01-01", partosAntesDaEntrada: 0, hoje: "2026-06-01" })).toBe("NOVILHA");
  });
  it("fêmea com pelo menos um parto é vaca independente da idade", () => {
    expect(calcularCategoriaCliente({ sexo: "F", dataNascimento: "2025-06-01", partosAntesDaEntrada: 1, hoje: "2026-01-01" })).toBe("VACA");
  });
  it("macho: bezerro < 12m, garrote 12-24m, touro >= 24m", () => {
    expect(calcularCategoriaCliente({ sexo: "M", dataNascimento: "2026-01-01", partosAntesDaEntrada: 0, hoje: "2026-06-01" })).toBe("BEZERRO");
    expect(calcularCategoriaCliente({ sexo: "M", dataNascimento: "2024-06-01", partosAntesDaEntrada: 0, hoje: "2026-01-01" })).toBe("GARROTE");
    expect(calcularCategoriaCliente({ sexo: "M", dataNascimento: "2023-01-01", partosAntesDaEntrada: 0, hoje: "2026-01-01" })).toBe("TOURO");
  });
});
