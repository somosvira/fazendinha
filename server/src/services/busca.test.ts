import { describe, it, expect } from "vitest";
import { uid } from "../lib/uid.fixture";
import {
  qValido,
  mapearTalhao,
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

describe("mapearTalhao", () => {
  it("label junta código + nome; sublabel usa variedade", () => {
    expect(mapearTalhao({ id: 7, codigo: "CAF-01", nome: "Cafundó alto", variedade: { nome: "Catuaí" }, lavoura: { nome: "Cafundó" } })).toEqual({
      tipo: "talhao",
      entidadeId: "7",
      label: "CAF-01 · Cafundó alto",
      sublabel: "Catuaí",
      tab: "pla-talhao",
      grupo: "Talhões",
    });
  });
  it("sem nome → label só código; sem variedade → lavoura; sem ambos → 'Talhão'", () => {
    expect(mapearTalhao({ id: 3, codigo: "CAF-02", nome: null, variedade: null, lavoura: { nome: "Baixada" } }).label).toBe("CAF-02");
    expect(mapearTalhao({ id: 3, codigo: "CAF-02", nome: null, variedade: null, lavoura: { nome: "Baixada" } }).sublabel).toBe("Baixada");
    expect(mapearTalhao({ id: 4, codigo: "CAF-03", nome: null, variedade: null, lavoura: null }).sublabel).toBe("Talhão");
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
