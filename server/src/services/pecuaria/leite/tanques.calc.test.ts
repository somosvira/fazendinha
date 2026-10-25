import { describe, expect, it } from "vitest";
import {
  conferirConversaoTanque,
  proximaAfericaoIndividual,
} from "./tanques.calc.js";
import { tanqueLeiteSchema } from "./tanques.schemas.js";
describe("aferição do tanque e periodicidade individual", () => {
  const tanque = {
    capacidadeLitros: 3000,
    tabelaConversao: [
      { mm: 0, litros: 22.5 },
      { mm: 100, litros: 336.7 },
    ],
  };
  it("mantém litros e régua independentes, inclusive zero e pontos ausentes na tabela", () => {
    expect(conferirConversaoTanque({ litros: 22.5, reguaMm: 0 }, tanque)).toBe("LITROS_INFORMADOS");
    expect(conferirConversaoTanque({ litros: 0, reguaMm: 0 }, tanque)).toBe("LITROS_INFORMADOS");
    expect(conferirConversaoTanque({ litros: 338, reguaMm: 100.5 }, tanque)).toBe("LITROS_INFORMADOS");
    expect(conferirConversaoTanque({ litros: 4000, reguaMm: 100 }, null)).toBe("LITROS_INFORMADOS");
  });
  it("recusa apenas volume acima da capacidade cadastrada e permite zero explícito", () => {
    expect(() => conferirConversaoTanque({ litros: 3001 }, tanque)).toThrow("capacidade");
    expect(conferirConversaoTanque({ litros: 0 }, tanque)).toBe("LITROS_INFORMADOS");
  });
  it("diferencia mês civil de 30 dias e respeita fevereiro", () => {
    expect(proximaAfericaoIndividual("2026-01-31", 1, "MESES")).toBe(
      "2026-02-28",
    );
    expect(proximaAfericaoIndividual("2026-01-31", 30, "DIAS")).toBe(
      "2026-03-02",
    );
    expect(proximaAfericaoIndividual("2028-01-31", 1, "MESES")).toBe(
      "2028-02-29",
    );
  });
  it("recusa tabela ambígua, invertida ou acima da capacidade", () => {
    const base = {
      chave: "00000000-0000-4000-8000-000000000001",
      identidadeId: "00000000-0000-4000-8000-000000000002",
      propriedadeId: 1,
      versaoEsperada: 0,
      nome: "Tanque",
      capacidadeLitros: 3000,
      vigenteDesde: "2026-10-23",
      referenciaTabela: "Fabricante",
    };
    for (const tabelaConversao of [
      [
        { mm: 0, litros: 1 },
        { mm: 0, litros: 2 },
      ],
      [
        { mm: 0, litros: 5 },
        { mm: 1, litros: 4 },
      ],
      [{ mm: 1, litros: 4000 }],
    ])
      expect(
        tanqueLeiteSchema.safeParse({ ...base, tabelaConversao }).success,
      ).toBe(false);
  });
});
