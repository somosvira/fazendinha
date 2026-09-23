import { describe, expect, it } from "vitest";
import { UNIDADES, UNIDADES_ORDENADAS, converterQuantidade, mesmaBase, rotuloUnidade } from "./unidades";

// Snapshot literal da tabela do server (services/estoque/unidades.ts) — as duas
// listas devem bater em chaves, rótulos e base. Se o server mudar, este teste
// tem que ser atualizado junto (não há import cruzado entre os pacotes).
const SNAPSHOT_SERVIDOR: Record<string, { rotulo: string; base: string; fator: number }> = {
  UN: { rotulo: "un", base: "UN", fator: 1 },
  KG: { rotulo: "kg", base: "KG", fator: 1 },
  G: { rotulo: "g", base: "KG", fator: 0.001 },
  T: { rotulo: "t", base: "KG", fator: 1000 },
  L: { rotulo: "L", base: "L", fator: 1 },
  ML: { rotulo: "mL", base: "L", fator: 0.001 },
  SC: { rotulo: "sc", base: "SC", fator: 1 },
  DOSE: { rotulo: "dose", base: "DOSE", fator: 1 },
  CX: { rotulo: "cx", base: "CX", fator: 1 },
  M: { rotulo: "m", base: "M", fator: 1 },
  HA: { rotulo: "ha", base: "HA", fator: 1 },
};

describe("unidades (client) — paridade com o server", () => {
  it("mesmas chaves do server", () => {
    expect(Object.keys(UNIDADES).sort()).toEqual(Object.keys(SNAPSHOT_SERVIDOR).sort());
  });

  it("mesmos rótulos, base e fator do server", () => {
    for (const chave of Object.keys(SNAPSHOT_SERVIDOR)) {
      const esperado = SNAPSHOT_SERVIDOR[chave];
      const atual = UNIDADES[chave as keyof typeof UNIDADES];
      expect(atual.rotulo).toBe(esperado.rotulo);
      expect(atual.base).toBe(esperado.base);
      expect(atual.fator).toBe(esperado.fator);
    }
  });

  it("UNIDADES_ORDENADAS cobre todas as chaves", () => {
    expect([...UNIDADES_ORDENADAS].sort()).toEqual(Object.keys(UNIDADES).sort());
  });
});

describe("rotuloUnidade / mesmaBase / converterQuantidade", () => {
  it("rótulos", () => {
    expect(rotuloUnidade("KG")).toBe("kg");
    expect(rotuloUnidade("ML")).toBe("mL");
  });

  it("mesmaBase agrupa massa e volume", () => {
    expect(mesmaBase("KG", "T")).toBe(true);
    expect(mesmaBase("L", "ML")).toBe(true);
    expect(mesmaBase("KG", "L")).toBe(false);
  });

  it("converte dentro da mesma base", () => {
    expect(converterQuantidade(200, "ML", "L")).toBeCloseTo(0.2);
    expect(converterQuantidade(1, "T", "KG")).toBe(1000);
  });

  it("erro claro em bases diferentes", () => {
    expect(() => converterQuantidade(1, "ML", "KG")).toThrow();
  });
});
