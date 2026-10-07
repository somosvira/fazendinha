import { describe, expect, it } from "vitest";
import { criarRodadaSchema } from "./rodadas.schemas.js";

describe("schema de ciclos de protocolo", () => {
  it("aceita campos de justificativa vazios quando não há exceção", () => {
    const resultado = criarRodadaSchema.parse({
      chave: "11111111-1111-4111-8111-111111111111",
      propriedadeId: 1,
      nome: "Ciclo de outubro",
      protocoloId: "22222222-2222-4222-8222-222222222222",
      inicioReferencia: "2026-10-20",
      itens: [{
        animalId: "33333333-3333-4333-8333-333333333333",
        confirmarSobreposicao: false,
        justificativaInicio: "",
        justificativaSobreposicao: "   ",
      }],
    });

    expect(resultado.itens[0]).toMatchObject({ animalId: "33333333-3333-4333-8333-333333333333", confirmarSobreposicao: false });
    expect(resultado.itens[0].justificativaInicio).toBeUndefined();
    expect(resultado.itens[0].justificativaSobreposicao).toBeUndefined();
  });
});
