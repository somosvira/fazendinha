import { describe, expect, it } from "vitest";
import { genitorIncompleto, mensagemGenitorIncompleto } from "./CampoGenitor";

describe("genitorIncompleto", () => {
  it("só acusa modo animal/externo sem seleção", () => {
    expect(genitorIncompleto({ tipo: "NENHUM" })).toBe(false);
    expect(genitorIncompleto({ tipo: "EXTERNO", id: "" })).toBe(true);
    expect(genitorIncompleto({ tipo: "ANIMAL", id: "", brinco: "", nome: null })).toBe(true);
    expect(genitorIncompleto({ tipo: "EXTERNO", id: "g1" })).toBe(false);
  });

  it("mensagem concorda com o sexo", () => {
    expect(mensagemGenitorIncompleto("Pai", "M")).toBe("Escolha o pai ou marque Desconhecido");
  });
});
