import { describe, expect, it } from "vitest";
import { patchTemMudanca, type PatchBulk } from "./bulk.calc.js";

describe("patchTemMudanca", () => {
  it("patch vazio → false", () => {
    expect(patchTemMudanca({})).toBe(false);
  });
  it("só grupoId → true", () => {
    expect(patchTemMudanca({ grupoId: 3 })).toBe(true);
    expect(patchTemMudanca({ grupoId: null })).toBe(true); // mover para nenhum grupo é mudança
  });
  it("só setor → true", () => {
    expect(patchTemMudanca({ setor: "Curral B" })).toBe(true);
    expect(patchTemMudanca({ setor: null })).toBe(true);
  });
  it("grupo e setor → true", () => {
    const p: PatchBulk = { grupoId: 2, setor: "Curral C" };
    expect(patchTemMudanca(p)).toBe(true);
  });
});
