import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { serieFluxo } from "./dashboard.js";

const movimento = (direcao: "ENTRADA" | "SAIDA", valor: string, data: string) => ({
  direcao,
  valor: new Prisma.Decimal(valor),
  transacao: { data: new Date(`${data}T12:00:00Z`) },
});

describe("série do dashboard financeiro", () => {
  it("detalha os dias de um único mês e preserva dias sem movimento", () => {
    const serie = serieFluxo([
      movimento("ENTRADA", "100.10", "2026-09-02"),
      movimento("SAIDA", "20.05", "2026-09-02"),
    ], new Date("2026-09-01T00:00:00Z"), new Date("2026-09-30T23:59:59Z"));
    expect(serie).toHaveLength(30);
    expect(serie[0]).toMatchObject({ data: "2026-09-01" });
    expect(serie[1].entradas.toString()).toBe("100.1");
    expect(serie[1].saidas.toString()).toBe("20.05");
  });

  it("consolida intervalos de vários meses, inclusive na virada do ano", () => {
    const serie = serieFluxo([
      movimento("ENTRADA", "300", "2025-12-20"),
      movimento("SAIDA", "75", "2026-02-01"),
    ], new Date("2025-12-01T00:00:00Z"), new Date("2026-02-28T23:59:59Z"));
    expect(serie.map((ponto) => ponto.data)).toEqual(["2025-12-01", "2026-01-01", "2026-02-01"]);
    expect(serie[0].entradas.toString()).toBe("300");
    expect(serie[1].entradas.toString()).toBe("0");
    expect(serie[2].saidas.toString()).toBe("75");
  });
});
