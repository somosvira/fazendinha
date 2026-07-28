import { beforeEach, describe, expect, it, vi } from "vitest";
import { importarFivLegado, type DadosFivLegado, type DbFiv } from "./import-fiv.js";

function criarDb() {
  const embriaoClassificacao = { upsert: vi.fn(async ({ create }) => ({ id: 900, ...create })) };
  const animal = {
    findFirst: vi.fn<(args?: { select?: { propriedadeId?: boolean } }) => Promise<{ id?: number; propriedadeId?: number | null } | null>>(
      async (args) => args?.select?.propriedadeId ? { propriedadeId: 1 } : { id: 31 },
    ),
  };
  const reprodutor = { findFirst: vi.fn(async () => ({ id: 44 })) };
  const coleta = { upsert: vi.fn(async ({ where }) => ({ id: 10, ideagriId: where.ideagriId })) };
  const oocitoColeta = { deleteMany: vi.fn(async () => ({})), createMany: vi.fn(async () => ({})) };
  const fertilizacaoColeta = { upsert: vi.fn(async ({ where }) => ({ id: 20, ideagriId: where.ideagriId })) };
  const embriaoColeta = { upsert: vi.fn(async ({ where }) => ({ id: 70, ideagriId: where.ideagriId })) };
  const grupoPoolDoadora = { upsert: vi.fn(async () => ({ id: 5 })) };
  const itemGrupoPoolDoadora = { deleteMany: vi.fn(async () => ({})), createMany: vi.fn(async () => ({})) };
  const eventoReprodutivo = { findMany: vi.fn<() => Promise<{ id: number; ideagriEmbriaoId: number }[]>>(async () => []), update: vi.fn(async () => ({})) };
  const db = { embriaoClassificacao, animal, reprodutor, coleta, oocitoColeta, fertilizacaoColeta, embriaoColeta, grupoPoolDoadora, itemGrupoPoolDoadora, eventoReprodutivo } as unknown as DbFiv;
  return { db, mocks: { embriaoClassificacao, coleta, fertilizacaoColeta, embriaoColeta, animal, reprodutor, grupoPoolDoadora, oocitoColeta, eventoReprodutivo } };
}

const dados: DadosFivLegado = {
  embriaoClassificacoes: [{ ideagriId: 3, sigla: "BX", nome: "Blastocisto", ordem: 4 }],
  coletas: [{ ideagriId: 7, doadoraNumero: "D-44", data: "2026-07-27", tecnico: "Ana", metodo: "FIV", laboratorio: "Lab", status: "CONCLUIDA" }],
  oocitosColeta: [{ coletaIdeagriId: 7, qualidade: "A", viavel: true, quantidade: 8 }],
  fertilizacoes: [{ ideagriId: 20, coletaIdeagriId: 7, reprodutorIdeagriId: 44, tipoSemenSigla: null, data: "2026-07-27", tecnica: "ICSI" }],
  embrioesColeta: [{ ideagriId: 70, fertilizacaoIdeagriId: 20, classificacaoSigla: "BX", codigoInterno: "E-70", estagio: "BLASTOCISTO", viavel: true }],
  gruposPool: [{ ideagriId: 2, nome: "Elite" }],
  itensGrupoPool: [{ grupoIdeagriId: 2, doadoraNumero: "D-44" }],
};

let db: DbFiv; let mocks: ReturnType<typeof criarDb>["mocks"];
beforeEach(() => { const c = criarDb(); db = c.db; mocks = c.mocks; });

describe("importarFivLegado", () => {
  it("faz upsert idempotente por ideagriId e conta os registros", async () => {
    const r = await importarFivLegado(db, dados);
    expect(mocks.coleta.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { ideagriId: 7 } }));
    expect(mocks.embriaoColeta.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { ideagriId: 70 } }));
    expect(r).toEqual(expect.objectContaining({ coletas: 1, fertilizacoes: 1, embrioes: 1, grupos: 1 }));
  });

  it("aborta quando a doadora da coleta não existe", async () => {
    mocks.animal.findFirst.mockImplementation(async (args?: { select?: { propriedadeId?: boolean } }) => args?.select?.propriedadeId ? { propriedadeId: 1 } : null);
    await expect(importarFivLegado(db, dados)).rejects.toThrow(/doadora/i);
  });

  it("aborta quando a fertilização referencia coleta ausente", async () => {
    await expect(importarFivLegado(db, { ...dados, fertilizacoes: [{ ...dados.fertilizacoes![0], coletaIdeagriId: 999 }] })).rejects.toThrow(/coleta/i);
  });

  it("reconcilia embrião com TE existente e aborta em origem ambígua", async () => {
    mocks.eventoReprodutivo.findMany.mockResolvedValue([{ id: 50, ideagriEmbriaoId: 70 }]);
    await importarFivLegado(db, dados);
    expect(mocks.eventoReprodutivo.update).toHaveBeenCalledWith({ where: { id: 50 }, data: { embriaoColetaId: 70 } });
    expect(mocks.embriaoColeta.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ estado: "TRANSFERIDO" }) }));

    mocks.eventoReprodutivo.findMany.mockResolvedValue([{ id: 50, ideagriEmbriaoId: 70 }, { id: 51, ideagriEmbriaoId: 70 }]);
    await expect(importarFivLegado(db, dados)).rejects.toThrow(/ambígu/i);
  });

  it("no-op quando não há blocos FIV", async () => {
    const r = await importarFivLegado(db, {});
    expect(r).toEqual({ classificacoes: 0, coletas: 0, oocitos: 0, fertilizacoes: 0, embrioes: 0, grupos: 0, itens: 0, embrioesReconciliados: 0 });
    expect(mocks.coleta.upsert).not.toHaveBeenCalled();
  });
});
