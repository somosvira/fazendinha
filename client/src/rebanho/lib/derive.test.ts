import { describe, it, expect } from "vitest";
import { diffDias, del, idadeMeses } from "./derive";

describe("diffDias", () => {
  it("conta dias entre duas datas ISO", () => {
    expect(diffDias("2026-01-22", "2026-06-16")).toBe(145);
  });
  it("é negativo quando a segunda data é anterior", () => {
    expect(diffDias("2026-06-16", "2026-01-22")).toBe(-145);
  });
});

describe("del", () => {
  it("dias em leite = hoje - dataParto", () => {
    expect(del("2026-01-22", "2026-06-16")).toBe(145);
  });
  it("undefined se não há parto", () => {
    expect(del(undefined, "2026-06-16")).toBeUndefined();
  });
});

describe("idadeMeses", () => {
  it("retorna idade em meses inteiros", () => {
    expect(idadeMeses("2020-03-12", "2026-06-16")).toBe(75);
  });
});
