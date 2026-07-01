import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { jsonSafe } from "./serialize.js";

describe("jsonSafe", () => {
  it("converte Decimal para number", () => {
    expect(jsonSafe(new Prisma.Decimal("12.34"))).toBe(12.34);
  });

  it("converte bigint para number", () => {
    expect(jsonSafe(10n)).toBe(10);
  });

  it("converte Date para YYYY-MM-DD", () => {
    expect(jsonSafe(new Date("2026-05-28T12:00:00Z"))).toBe("2026-05-28");
  });

  it("percorre arrays e objetos aninhados", () => {
    const v = jsonSafe({
      total: new Prisma.Decimal("100.5"),
      itens: [{ qtd: 3n, data: new Date("2026-01-02T00:00:00Z") }],
      nome: "x",
      nulo: null,
    });
    expect(v).toEqual({
      total: 100.5,
      itens: [{ qtd: 3, data: "2026-01-02" }],
      nome: "x",
      nulo: null,
    });
  });
});
