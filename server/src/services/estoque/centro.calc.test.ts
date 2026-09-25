import { describe, expect, it } from "vitest";
import { resolverCentroSaida } from "./centro.calc.js";

describe("resolverCentroSaida", () => {
  it("usa o contexto quando informado, mesmo com produto em vários centros", () => {
    expect(resolverCentroSaida({ produtoCentroIds: [1, 2], contextoCentroId: 7 })).toBe(7);
  });

  it("usa o contexto quando informado, mesmo sem centros no produto", () => {
    expect(resolverCentroSaida({ produtoCentroIds: [], contextoCentroId: 7 })).toBe(7);
  });

  it("infere o único centro do produto quando não há contexto", () => {
    expect(resolverCentroSaida({ produtoCentroIds: [3], contextoCentroId: null })).toBe(3);
  });

  it("infere o único centro do produto quando contexto é undefined", () => {
    expect(resolverCentroSaida({ produtoCentroIds: [3], contextoCentroId: undefined })).toBe(3);
  });

  it("retorna null quando não há contexto e o produto tem múltiplos centros", () => {
    expect(resolverCentroSaida({ produtoCentroIds: [1, 2], contextoCentroId: null })).toBeNull();
  });

  it("retorna null quando não há contexto e o produto não tem centro", () => {
    expect(resolverCentroSaida({ produtoCentroIds: [], contextoCentroId: null })).toBeNull();
  });
});
