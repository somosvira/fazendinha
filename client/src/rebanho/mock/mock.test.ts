import { describe, it, expect } from "vitest";
import { animais, resumos } from "./animais";
import { getAnimal, getResumo } from "./index";

describe("mock invariants", () => {
  it("todo resumo aponta pra um animal existente", () => {
    for (const r of resumos) expect(getAnimal(r.animalId), r.animalId).toBeDefined();
  });
  it("ids de animal são únicos", () => {
    expect(new Set(animais.map((a) => a.id)).size).toBe(animais.length);
  });
  it("getResumo encontra a Jurema", () => {
    expect(getResumo("1234")?.statusReprodutivo).toBe("PRENHE");
  });
});
