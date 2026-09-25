import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { UNIDADES, converterQuantidade, mesmaBase, rotuloUnidade } from "./unidades.js";

describe("unidades", () => {
  it("rotuloUnidade devolve o rótulo curto em pt-BR", () => {
    expect(rotuloUnidade("KG")).toBe("kg");
    expect(rotuloUnidade("ML")).toBe("mL");
    expect(rotuloUnidade("HA")).toBe("ha");
  });

  it("mesmaBase agrupa massa e volume", () => {
    expect(mesmaBase("KG", "G")).toBe(true);
    expect(mesmaBase("KG", "T")).toBe(true);
    expect(mesmaBase("L", "ML")).toBe(true);
    expect(mesmaBase("KG", "L")).toBe(false);
    expect(mesmaBase("UN", "SC")).toBe(false);
  });

  it("converte dentro da mesma base", () => {
    expect(converterQuantidade(1, "T", "KG").toNumber()).toBe(1000);
    expect(converterQuantidade(1000, "G", "KG").toNumber()).toBe(1);
    expect(converterQuantidade(500, "ML", "L").toNumber()).toBe(0.5);
    expect(converterQuantidade(2, "L", "ML").toNumber()).toBe(2000);
  });

  it("identidade não perde precisão", () => {
    expect(converterQuantidade(new Prisma.Decimal("12.345"), "KG", "KG").toString()).toBe("12.345");
  });

  it("erro claro ao converter bases diferentes", () => {
    expect(() => converterQuantidade(1, "ML", "KG")).toThrow(/mL.*kg|kg.*mL/i);
  });

  it("todas as unidades têm rótulo e base declarados", () => {
    const chaves = Object.keys(UNIDADES).sort();
    expect(chaves).toEqual(["CX", "DOSE", "G", "HA", "KG", "L", "M", "ML", "SC", "T", "UN"]);
  });
});
