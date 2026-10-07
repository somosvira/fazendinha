import { describe, expect, it } from "vitest";
import { concluirColetaSchema, prepararColetaSchema, rascunhoColetaSchema, salvarColetaSchema } from "./schemas.js";

const propriedadeId = 17;
const loteId = "11111111-1111-4111-8111-111111111111";
const animalId = "22222222-2222-4222-8222-222222222222";
const coletaId = "33333333-3333-4333-8333-333333333333";
const tipoExameId = "44444444-4444-4444-8444-444444444444";

describe("schemas de coletas de campo", () => {
  it("exige ficha identificada, data civil, tipo, título e lotes", () => {
    const preparada = prepararColetaSchema.parse({
      id: coletaId, propriedadeId, data: "2026-10-06", tipo: "PESAGEM", titulo: "Rotina da manhã", loteIds: [loteId],
    });
    expect(preparada).toMatchObject({ id: coletaId, propriedadeId, tipo: "PESAGEM", titulo: "Rotina da manhã" });
    expect(() => prepararColetaSchema.parse({ ...preparada, data: "06/10/2026" })).toThrow();
    expect(() => prepararColetaSchema.parse({ ...preparada, tipo: "PROTOCOLO" })).toThrow();
    expect(() => prepararColetaSchema.parse({ ...preparada, loteIds: [] })).toThrow();
    expect(() => prepararColetaSchema.parse({ ...preparada, propriedadeId: 0 })).toThrow();
    expect(() => prepararColetaSchema.parse({ ...preparada, extra: true })).toThrow();
  });

  it("aplica defaults do rascunho e mantém pendente separado de não realizado", () => {
    const rascunho = rascunhoColetaSchema.parse({ itens: [
      { animalId, situacao: "PENDENTE" },
      { animalId: "55555555-5555-4555-8555-555555555555", situacao: "NAO_REALIZADO", motivo: "Animal ausente" },
    ] });
    expect(rascunho).toMatchObject({
      tipoPesagem: "ROTINA", origemPesagem: "MANUAL",
      itens: [
        { situacao: "PENDENTE", peso: "", motivo: "", observacao: "" },
        { situacao: "NAO_REALIZADO", motivo: "Animal ausente", peso: "", observacao: "" },
      ],
    });
    expect(() => rascunhoColetaSchema.parse({ itens: [{ animalId, situacao: "NAO_REALIZADO", motivo: "abc" }] })).not.toThrow();
    expect(() => rascunhoColetaSchema.parse({ itens: [{ animalId, situacao: "NAO_MEDIDO" }] })).toThrow();
  });

  it("aceita campos específicos de exame e restringe payloads desconhecidos", () => {
    const rascunho = rascunhoColetaSchema.parse({
      tipoExameId, responsavel: "Equipe de campo",
      itens: [{ animalId, situacao: "REALIZADO" }],
    });
    expect(rascunho).toMatchObject({ tipoExameId, responsavel: "Equipe de campo" });
    expect(() => rascunhoColetaSchema.parse({
      itens: [{ animalId, situacao: "REALIZADO", resultadoNumero: 0 }],
    })).toThrow();
    expect(() => rascunhoColetaSchema.parse({
      tipoExameId, itens: [{ animalId, situacao: "REALIZADO", desconhecido: "valor" }],
    })).toThrow();
  });

  it("valida versão positiva e escopo nos comandos de salvar e concluir", () => {
    const salvar = salvarColetaSchema.parse({
      propriedadeId, versao: 2, rascunho: { itens: [{ animalId, situacao: "PENDENTE" }] },
    });
    expect(salvar.versao).toBe(2);
    expect(concluirColetaSchema.parse({ propriedadeId, versao: 2 })).toEqual({ propriedadeId, versao: 2 });
    expect(() => salvarColetaSchema.parse({ ...salvar, versao: 0 })).toThrow();
    expect(() => concluirColetaSchema.parse({ propriedadeId, versao: 1, coletaId })).toThrow();
  });
});
