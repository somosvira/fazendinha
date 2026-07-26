import { describe, expect, it } from "vitest";
import { atualizarProtocoloSchema, criarProtocoloSchema } from "./iatf.schemas.js";
import { executarEtapaLoteSchema } from "./iatf-lote.schemas.js";

const protocolo = {
  nome: "TETF receptoras",
  finalidade: "TETF",
  etapas: [{ dia: 0, acao: "Implante" }, { dia: 9, acao: "Transferir embrião" }],
};

describe("finalidade do protocolo", () => {
  it("aceita IATF/TETF na criação e atualização", () => {
    expect(criarProtocoloSchema.parse(protocolo).finalidade).toBe("TETF");
    expect(atualizarProtocoloSchema.parse({ finalidade: "IATF" })).toEqual({ finalidade: "IATF" });
  });

  it("rejeita finalidade desconhecida", () => {
    expect(criarProtocoloSchema.safeParse({ ...protocolo, finalidade: "FIV" }).success).toBe(false);
  });
});

describe("executarEtapaLoteSchema", () => {
  it("aceita etapa coletiva com exceções e campos operacionais", () => {
    expect(executarEtapaLoteSchema.parse({
      dia: 7,
      ordem: 0,
      status: "CONCLUIDA",
      dataExecucao: "2026-07-13",
      excecoesAnimalIds: [101, 102],
      produto: "PGF2α",
      dose: "2 ml",
      observacao: "aplicação no curral",
    })).toMatchObject({ status: "CONCLUIDA", excecoesAnimalIds: [101, 102] });
  });

  it("rejeita data fora de YYYY-MM-DD e status desconhecido", () => {
    expect(executarEtapaLoteSchema.safeParse({ dia: 7, ordem: 0, status: "FEITA", dataExecucao: "13/07/2026" }).success).toBe(false);
  });
});
