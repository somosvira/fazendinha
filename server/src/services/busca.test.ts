import { describe, it, expect } from "vitest";
import {
  qValido,
  mapearTalhao,
  mapearAnimal,
  mapearLote,
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

describe("mapearAnimal", () => {
  it("label junta número + nome; sublabel junta categoria + raça", () => {
    expect(mapearAnimal({ id: 12, numero: "CA-100", nome: "Catarina", categoria: "VACA", raca: { nome: "Girolando" } })).toEqual({
      tipo: "animal",
      entidadeId: "12",
      label: "CA-100 · Catarina",
      sublabel: "VACA · Girolando",
      tab: "reb-animal",
      grupo: "Animais",
    });
  });
  it("sem nome e sem raça", () => {
    const r = mapearAnimal({ id: 9, numero: "200", nome: null, categoria: "NOVILHA", raca: null });
    expect(r.label).toBe("200");
    expect(r.sublabel).toBe("NOVILHA");
  });
  it("brinco eletrônico entra no sublabel quando presente (A6)", () => {
    const r = mapearAnimal({ id: 3, numero: "CA-7", nome: null, categoria: "VACA", raca: { nome: "Holandês" }, brincoEletronico: "982000123456789" });
    expect(r.sublabel).toBe("VACA · Holandês · brinco 982000123456789");
  });
});

describe("mapearLote", () => {
  it("label = código · nome; sublabel = categoria · N cab", () => {
    expect(mapearLote({ id: 5, codigo: "LT-01", nome: "Boiada A", categoria: "BOI_GORDO", numCabecas: 42 })).toEqual({
      tipo: "lote",
      entidadeId: "5",
      label: "LT-01 · Boiada A",
      sublabel: "BOI_GORDO · 42 cab",
      tab: "cor-lote",
      grupo: "Lotes de corte",
    });
  });
});

describe("mapearCategoria", () => {
  it("sublabel = nome do grupo", () => {
    expect(mapearCategoria({ id: 8, nome: "Ração", grupoCategoria: { nome: "Custeio" } })).toEqual({
      tipo: "categoria",
      entidadeId: "8",
      label: "Ração",
      sublabel: "Custeio",
      tab: "plano",
      grupo: "Categorias",
    });
  });
});

describe("mapearFornecedor", () => {
  it("sublabel = tipo da pessoa", () => {
    expect(mapearFornecedor({ id: 2, nome: "Agropecuária Central", tipo: "FORNECEDOR" })).toEqual({
      tipo: "fornecedor",
      entidadeId: "2",
      label: "Agropecuária Central",
      sublabel: "FORNECEDOR",
      tab: "cadastros",
      grupo: "Fornecedores",
    });
  });
});
