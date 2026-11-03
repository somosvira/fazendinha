import { describe, expect, it } from "vitest";
import {
  prazoMes,
  proximoMes,
  somarDias,
  repartirQuantidade,
  configuracaoSchema,
} from "./mensal.calc.js";
describe("calendário e rateio mensal", () => {
  it("vence no mês seguinte, incluindo fevereiro e virada do ano", () => {
    expect(prazoMes("2026-01", 31)).toBe("2026-02-28");
    expect(prazoMes("2028-01", 31)).toBe("2028-02-29");
    expect(prazoMes("2026-12", 5)).toBe("2027-01-05");
    expect(proximoMes("2026-11-15")).toBe("2026-12-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("conserva quantidade e centavos em divisão desigual", () => {
    expect(repartirQuantidade("0.005", [1, 1, 1]).map(String)).toEqual([
      "0.002",
      "0.002",
      "0.001",
    ]);
    expect(repartirQuantidade("70", [10, 10, 5]).map(String)).toEqual([
      "28",
      "28",
      "14",
    ]);
    expect(repartirQuantidade("0.01", [1, 1, 1], 2).map(String)).toEqual([
      "0.01",
      "0",
      "0",
    ]);
    expect(() => repartirQuantidade("1", [0, 0])).toThrow();
    expect(repartirQuantidade("0", [0, 0]).map(String)).toEqual(["0", "0"]);
    expect(() => repartirQuantidade("-1", [1])).toThrow();
  });
  it("recusa data inexistente e dia de conferência inválido", () => {
    expect(
      configuracaoSchema.safeParse({
        propriedadeId: 1,
        loteId: null,
        modelo: "AUTOMATICO",
        diaConferencia: 32,
        autorizaValidade: false,
        desde: "2026-02-30",
      }).success,
    ).toBe(false);
  });
});

import { Prisma } from "@prisma/client";
import { distribuirPartidas } from "./mensal.calc.js";
it("distribui partidas mensais entre vários dias conservando os milésimos", () => {
  const r = distribuirPartidas(
    [
      {
        partidaId: "a",
        quantidade: "0.003",
        cienciaValidadeDesconhecida: true,
      },
      { partidaId: "b", quantidade: "0.002" },
    ],
    [new Prisma.Decimal("0.002"), new Prisma.Decimal("0.003")],
  );
  expect(r).toEqual([
    [
      {
        partidaId: "a",
        quantidade: "0.002",
        cienciaValidadeDesconhecida: true,
      },
    ],
    [
      {
        partidaId: "a",
        quantidade: "0.001",
        cienciaValidadeDesconhecida: true,
      },
      { partidaId: "b", quantidade: "0.002" },
    ],
  ]);
  expect(() =>
    distribuirPartidas([{ quantidade: "1" }], [new Prisma.Decimal("2")]),
  ).toThrow("complementar");
});
