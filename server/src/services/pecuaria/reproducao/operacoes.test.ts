import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { hashDados } from "./operacoes.js";
describe("fingerprint de fatos e reenvios", () => {
  it("conserva datas e valores na assinatura de snapshots do banco", () => {
    const estado = {
      data: new Date("2026-09-01"),
      valor: new Prisma.Decimal("10.50"),
    };
    expect(hashDados(estado)).not.toBe(
      hashDados({ ...estado, data: new Date("2026-09-02") }),
    );
    expect(hashDados(estado)).not.toBe(
      hashDados({ ...estado, valor: new Prisma.Decimal("10.51") }),
    );
    expect(hashDados(estado)).toBe(
      hashDados({ valor: "10.5", data: "2026-09-01T00:00:00.000Z" }),
    );
  });
  it("ignora ordem de propriedades e preserva ordem das linhas levadas a campo", () => {
    expect(hashDados({ a: 1, b: { c: 2, d: 3 } })).toBe(
      hashDados({ b: { d: 3, c: 2 }, a: 1 }),
    );
    expect(hashDados([{ animalId: "A" }, { animalId: "B" }])).not.toBe(
      hashDados([{ animalId: "B" }, { animalId: "A" }]),
    );
  });
});
