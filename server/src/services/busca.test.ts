import { describe, it, expect } from "vitest";
import { uid } from "../lib/uid.fixture";
import {
  qValido,
  mapearCategoria,
  mapearFornecedor,
} from "./busca.js";

describe("qValido", () => {
  it("rejeita string vazia e 1 caractere (com/sem espaço)", () => {
    expect(qValido("")).toBe(false);
    expect(qValido(" ")).toBe(false);
    expect(qValido("a")).toBe(false);
    expect(qValido("  a  ")).toBe(false);
  });
  it("aceita 2+ caracteres após trim", () => {
    expect(qValido("ca")).toBe(true);
    expect(qValido("  CA ")).toBe(true);
    expect(qValido("CATARINA")).toBe(true);
  });
});

describe("mapearCategoria", () => {
  it("sublabel = nome do grupo", () => {
    const id = uid(8);
    expect(mapearCategoria({ id, nome: "Ração" })).toEqual({
      tipo: "categoria",
      entidadeId: id,
      label: "Ração",
      sublabel: "Categoria financeira",
      tab: "plano",
      grupo: "Categorias",
    });
  });
});

describe("mapearFornecedor", () => {
  it("sublabel = tipo da pessoa", () => {
    const id = uid(2);
    expect(mapearFornecedor({ id, nome: "Agropecuária Central", tipo: "FORNECEDOR" })).toEqual({
      tipo: "fornecedor",
      entidadeId: id,
      label: "Agropecuária Central",
      sublabel: "FORNECEDOR",
      tab: "cadastros",
      grupo: "Fornecedores",
    });
  });
});
