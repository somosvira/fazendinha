import { describe, expect, it } from "vitest";
import { resolverCentroSaida } from "./centro.calc.js";
import { uid } from "../../lib/uid.fixture.js";

describe("resolverCentroSaida", () => {
  it("usa o contexto quando informado, mesmo com produto em vários centros", () => {
    expect(resolverCentroSaida({ produtoCentroIds: [uid(1), uid(2)], contextoCentroId: uid(7) })).toBe(uid(7));
  });

  it("usa o contexto quando informado, mesmo sem centros no produto", () => {
    expect(resolverCentroSaida({ produtoCentroIds: [], contextoCentroId: uid(7) })).toBe(uid(7));
  });

  it("infere o único centro do produto quando não há contexto", () => {
    expect(resolverCentroSaida({ produtoCentroIds: [uid(3)], contextoCentroId: null })).toBe(uid(3));
  });

  it("infere o único centro do produto quando contexto é undefined", () => {
    expect(resolverCentroSaida({ produtoCentroIds: [uid(3)], contextoCentroId: undefined })).toBe(uid(3));
  });

  it("retorna null quando não há contexto e o produto tem múltiplos centros", () => {
    expect(resolverCentroSaida({ produtoCentroIds: [uid(1), uid(2)], contextoCentroId: null })).toBeNull();
  });

  it("retorna null quando não há contexto e o produto não tem centro", () => {
    expect(resolverCentroSaida({ produtoCentroIds: [], contextoCentroId: null })).toBeNull();
  });
});
