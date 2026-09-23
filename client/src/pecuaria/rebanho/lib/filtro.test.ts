import { describe, expect, it } from "vitest";
import type { AnimalResumo } from "../types";
import { filtrarLocal } from "./filtro";

function animal(overrides: Partial<AnimalResumo>): AnimalResumo {
  return {
    id: "id", brinco: "100", nome: null, sexo: "F", categoria: "VACA", idadeMeses: 40,
    dataNascimento: "2022-01-01", dataEntrada: "2022-01-01", origem: "NASCIDO",
    propriedade: null, lote: null, aptidao: "LEITE", papelReprodutivo: "NENHUM",
    composicaoRotulo: "Desconhecida", ultimoPeso: null, situacao: "ATIVO",
    ...overrides,
  };
}

describe("filtrarLocal", () => {
  it("sem termo devolve a lista original", () => {
    const lista = [animal({ id: "1" })];
    expect(filtrarLocal(lista, "")).toBe(lista);
  });

  it("filtra por brinco (case-insensitive)", () => {
    const lista = [animal({ id: "1", brinco: "ABC-01" }), animal({ id: "2", brinco: "999" })];
    expect(filtrarLocal(lista, "abc").map((a) => a.id)).toEqual(["1"]);
  });

  it("filtra por nome", () => {
    const lista = [animal({ id: "1", nome: "Estrela" }), animal({ id: "2", nome: "Lua" })];
    expect(filtrarLocal(lista, "estr").map((a) => a.id)).toEqual(["1"]);
  });
});
