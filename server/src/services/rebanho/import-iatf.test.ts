import { describe, expect, it, vi } from "vitest";
import { importarIatfLegado } from "./import-iatf.js";

function dbMock() {
  return {
    protocoloIATF: {
      upsert: vi.fn().mockResolvedValue({ id: 10 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 10,
        etapas: [{ dia: 7, acao: "luteólise", hormonio: "PGF2a", ordem: 0 }],
      }),
    },
    principioProtocoloIATF: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    etapaProtocoloIATF: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    programacaoIATFLote: {
      upsert: vi.fn().mockResolvedValue({ id: 20, protocoloId: 10, dataInicio: new Date("2026-07-06T00:00:00Z") }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 20,
        protocoloId: 10,
        dataInicio: new Date("2026-07-06T00:00:00Z"),
        protocolo: { etapas: [{ dia: 7, acao: "luteólise", hormonio: "PGF2a", ordem: 0 }] },
      }),
    },
    aplicacaoProtocoloIATF: { upsert: vi.fn().mockResolvedValue({ id: 30 }) },
  };
}

const dados = {
  protocolosIatf: [{ ideagriId: 1, nome: "P11", finalidade: "IATF" as const }],
  principiosProtocolo: [{ protocoloIdeagriId: 1, dia: 7, principio: "PGF2a", produto: "Ciosin", dose: "2 ml", uso: "luteólise" }],
  programacoesIatf: [{ ideagriId: 2, nome: "Novilhas", dataInicio: "2026-07-06", protocoloIdeagriId: 1 }],
  associacoesProgramacao: [{ numero: "1234", ideagriId: 3, programacaoIdeagriId: 2, usoCidr: true, estimulo: "eCG", perdaImplante: false }],
};

describe("importarIatfLegado", () => {
  it("usa identidades de origem e materializa execução para associação nova", async () => {
    const db = dbMock();
    const r = await importarIatfLegado(db as any, dados, new Map([["1234", 99]]));
    expect(db.protocoloIATF.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { ideagriId: 1 } }));
    expect(db.programacaoIATFLote.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { ideagriId: 2 } }));
    expect(db.aplicacaoProtocoloIATF.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { ideagriId: 3 },
      create: expect.objectContaining({
        animalId: 99,
        programacaoId: 20,
        usoCidr: true,
        estimulo: "eCG",
        execucoes: { create: [expect.objectContaining({ dia: 7, status: "PENDENTE" })] },
      }),
    }));
    expect(r).toEqual({ protocolos: 1, principios: 1, programacoes: 1, associacoes: 1 });
  });

  it("sem blocos IATF é no-op retrocompatível", async () => {
    const db = dbMock();
    const r = await importarIatfLegado(db as any, {}, new Map());
    expect(r).toEqual({ protocolos: 0, principios: 0, programacoes: 0, associacoes: 0 });
    expect(db.protocoloIATF.upsert).not.toHaveBeenCalled();
  });

  it("aborta quando uma associação referencia animal ausente", async () => {
    const db = dbMock();
    await expect(importarIatfLegado(db as any, dados, new Map()))
      .rejects.toThrow("animal 1234 não encontrado");
    expect(db.aplicacaoProtocoloIATF.upsert).not.toHaveBeenCalled();
  });
});
