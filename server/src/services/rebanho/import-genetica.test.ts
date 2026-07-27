import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { importarGeneticaLegado } from "./import-genetica.js";

// Mock Prisma no estilo import-iatf.test.ts: só os delegates que o import usa.
// Cada dicionário devolve um id determinístico por ideagriId para o teste conferir
// os mapas sigla→id e o espelho de colunas legadas.
function dbMock() {
  return {
    $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(txMock)),
  } as any;
}

// tx é o objeto sobre o qual o import grava dentro da transação.
let txMock: any;
function novoTx() {
  return {
    propriedade: {
      findFirst: vi.fn().mockResolvedValue({ id: 1 }),
    },
    reprodutor: {
      upsert: vi.fn(async ({ where }: any) => ({ id: 500 + where.ideagriId })),
      update: vi.fn().mockResolvedValue({}),
    },
    raca: { findUnique: vi.fn().mockResolvedValue({ id: 7 }) },
    centralSemen: {
      findFirst: vi.fn().mockResolvedValue({ id: 9 }),
      findMany: vi.fn().mockResolvedValue([{ id: 9 }]),
    },
    indicadorGenetico: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([{ id: 42, colunaLegada: "ptaLeite" }]),
      upsert: vi.fn(async ({ where }: any) => ({
        id: 42,
        ideagriId: where.ideagriId,
        sigla: "PTAL",
        colunaLegada: "ptaLeite",
      })),
    },
    marcadorGenetico: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(async ({ where }: any) => ({ id: 80, ideagriId: where.ideagriId, sigla: "BLAD" })),
    },
    caseina: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(async ({ where }: any) => ({ id: 90, ideagriId: where.ideagriId, sigla: "K-CN" })),
    },
    tipoSemen: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(async ({ where }: any) => ({ id: 3, ideagriId: where.ideagriId, sigla: "SEX" })),
    },
    valorIndicadorReprodutor: { upsert: vi.fn().mockResolvedValue({}) },
    valorMarcadorReprodutor: { upsert: vi.fn().mockResolvedValue({}) },
    valorCaseinaReprodutor: { upsert: vi.fn().mockResolvedValue({}) },
    estoqueSemen: { upsert: vi.fn().mockResolvedValue({}) },
    pedigreeReprodutor: { upsert: vi.fn().mockResolvedValue({}) },
  };
}

const reprodutor = { ideagriId: 100, nome: "Touro Atlas", codigo: "ATL-1", racaSigla: "HO", centralSigla: "ABS" };
const indicador = {
  ideagriId: 42,
  sigla: "PTAL",
  nome: "PTA Leite",
  unidade: "kg",
  direcao: "maior_melhor",
  colunaLegada: "ptaLeite",
  ranking: true,
};

describe("importarGeneticaLegado", () => {
  it("upserta reprodutor e dicionários pela identidade de origem (ideagriId)", async () => {
    txMock = novoTx();
    const db = dbMock();
    const r = await importarGeneticaLegado(db, {
      reprodutoresGeneticos: [reprodutor],
      indicadores: [indicador],
      marcadores: [{ ideagriId: 8, sigla: "BLAD", nome: "Deficiência" }],
      caseinas: [{ ideagriId: 9, sigla: "K-CN", nome: "Kappa-caseína" }],
      tiposSemen: [{ ideagriId: 3, sigla: "SEX", nome: "Sexado" }],
    });

    expect(txMock.reprodutor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ideagriId: 100 } }),
    );
    expect(txMock.indicadorGenetico.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ideagriId: 42 } }),
    );
    expect(txMock.marcadorGenetico.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ideagriId: 8 } }),
    );
    expect(txMock.caseina.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ideagriId: 9 } }),
    );
    expect(txMock.tipoSemen.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ideagriId: 3 } }),
    );
    expect(r).toEqual({
      reprodutores: 1,
      indicadores: 1,
      valores: 0,
      marcadores: 1,
      caseinas: 1,
      tiposSemen: 1,
      estoques: 0,
      pedigrees: 0,
    });
  });

  it("executado duas vezes converge pelos mesmos upserts de origem", async () => {
    txMock = novoTx();
    const db = dbMock();
    const dados = {
      reprodutoresGeneticos: [reprodutor],
      indicadores: [indicador],
      marcadores: [{ ideagriId: 8, sigla: "BLAD", nome: "Deficiência" }],
      caseinas: [{ ideagriId: 9, sigla: "K-CN", nome: "Kappa-caseína" }],
      tiposSemen: [{ ideagriId: 3, sigla: "SEX", nome: "Sexado" }],
    };

    const primeira = await importarGeneticaLegado(db, dados);
    const segunda = await importarGeneticaLegado(db, dados);

    expect(segunda).toEqual(primeira);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(txMock.reprodutor.upsert.mock.calls.map(([args]: any[]) => args.where)).toEqual([
      { ideagriId: 100 }, { ideagriId: 100 },
    ]);
    expect(txMock.indicadorGenetico.upsert.mock.calls.map(([args]: any[]) => args.where)).toEqual([
      { ideagriId: 42 }, { ideagriId: 42 },
    ]);
    expect(txMock.marcadorGenetico.upsert.mock.calls.map(([args]: any[]) => args.where)).toEqual([
      { ideagriId: 8 }, { ideagriId: 8 },
    ]);
    expect(txMock.caseina.upsert.mock.calls.map(([args]: any[]) => args.where)).toEqual([
      { ideagriId: 9 }, { ideagriId: 9 },
    ]);
    expect(txMock.tipoSemen.upsert.mock.calls.map(([args]: any[]) => args.where)).toEqual([
      { ideagriId: 3 }, { ideagriId: 3 },
    ]);
  });

  it("resolve racaSigla por código e centralSigla por nome sem inventar entidades", async () => {
    txMock = novoTx();
    const db = dbMock();
    await importarGeneticaLegado(db, { reprodutoresGeneticos: [reprodutor] });

    expect(txMock.raca.findUnique).toHaveBeenCalledWith({ where: { codigo: "HO" }, select: { id: true } });
    expect(txMock.centralSemen.findMany).toHaveBeenCalledWith({
      where: { nome: "ABS", OR: [{ propriedadeId: 1 }, { propriedadeId: null }] },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    expect(txMock.reprodutor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ racaId: 7, centralSemenId: 9, propriedadeId: 1 }),
        update: expect.objectContaining({ racaId: 7, centralSemenId: 9, propriedadeId: 1 }),
      }),
    );
  });

  it("aborta quando racaSigla informada não existe (não cria a raça)", async () => {
    txMock = novoTx();
    txMock.raca.findUnique.mockResolvedValue(null);
    const db = dbMock();
    await expect(
      importarGeneticaLegado(db, { reprodutoresGeneticos: [reprodutor] }),
    ).rejects.toThrow("raça HO não encontrada");
    expect(txMock.reprodutor.upsert).not.toHaveBeenCalled();
  });

  it("aborta quando centralSigla informada não existe", async () => {
    txMock = novoTx();
    txMock.centralSemen.findMany.mockResolvedValue([]);
    const db = dbMock();
    await expect(
      importarGeneticaLegado(db, { reprodutoresGeneticos: [reprodutor] }),
    ).rejects.toThrow("central de sêmen ABS não encontrada");
    expect(txMock.reprodutor.upsert).not.toHaveBeenCalled();
  });

  it("aborta quando centralSigla é ambígua no escopo da propriedade", async () => {
    txMock = novoTx();
    txMock.centralSemen.findMany.mockResolvedValue([{ id: 9 }, { id: 10 }]);
    const db = dbMock();
    await expect(
      importarGeneticaLegado(db, { reprodutoresGeneticos: [reprodutor] }),
    ).rejects.toThrow("central de sêmen ABS ambígua");
    expect(txMock.reprodutor.upsert).not.toHaveBeenCalled();
  });

  it("aceita reprodutor sem raça/central sem consultar ou criar catálogos", async () => {
    txMock = novoTx();
    const db = dbMock();
    await importarGeneticaLegado(db, {
      reprodutoresGeneticos: [{ ...reprodutor, racaSigla: null, centralSigla: null }],
    });

    expect(txMock.raca.findUnique).not.toHaveBeenCalled();
    expect(txMock.centralSemen.findMany).not.toHaveBeenCalled();
    expect(txMock.reprodutor.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ racaId: null, centralSemenId: null }),
      update: expect.objectContaining({ racaId: null, centralSemenId: null }),
    }));
  });

  it("upserta valores por chave composta e espelha a coluna legada gerenciada", async () => {
    txMock = novoTx();
    const db = dbMock();
    await importarGeneticaLegado(db, {
      reprodutoresGeneticos: [reprodutor],
      indicadores: [indicador],
      valoresIndicador: [{ reprodutorIdeagriId: 100, indicadorSigla: "PTAL", valor: 900.5 }],
    });

    // valor gravado por par [reprodutorId, indicadorId] (upsert composto, não createMany cego)
    const chamadaValor = txMock.valorIndicadorReprodutor.upsert.mock.calls[0][0];
    expect(chamadaValor.where).toEqual({
      reprodutorId_indicadorId: { reprodutorId: 600, indicadorId: 42 },
    });
    expect(chamadaValor.create).toEqual(expect.objectContaining({ reprodutorId: 600, indicadorId: 42 }));
    expect(chamadaValor.create.valor).toBeInstanceOf(Prisma.Decimal);
    expect(chamadaValor.create.valor.toString()).toBe("900.5");
    expect(chamadaValor.update.valor).toBeInstanceOf(Prisma.Decimal);
    expect(chamadaValor.update.valor.toString()).toBe("900.5");
    // espelho: a coluna legada gerenciada é limpa e reprojetada no mesmo update
    expect(txMock.reprodutor.update).toHaveBeenCalledWith({
      where: { id: 600 },
      data: { ptaLeite: 900.5 },
    });
  });

  it("limpa colunas legadas gerenciadas sem valor e preserva colunas não gerenciadas", async () => {
    txMock = novoTx();
    // dois indicadores gerenciam ptaLeite e tpi; só ptaLeite recebe valor nesta carga
    txMock.indicadorGenetico.upsert = vi.fn(async ({ where }: any) =>
      where.ideagriId === 42
        ? { id: 42, ideagriId: 42, sigla: "PTAL", colunaLegada: "ptaLeite" }
        : { id: 43, ideagriId: 43, sigla: "TPI", colunaLegada: "tpi" },
    );
    txMock.indicadorGenetico.findMany.mockResolvedValue([
      { id: 42, colunaLegada: "ptaLeite" },
      { id: 43, colunaLegada: "tpi" },
    ]);
    const db = dbMock();
    await importarGeneticaLegado(db, {
      reprodutoresGeneticos: [reprodutor],
      indicadores: [
        indicador,
        { ideagriId: 43, sigla: "TPI", nome: "TPI", unidade: null, direcao: "maior_melhor", colunaLegada: "tpi", ranking: false },
      ],
      valoresIndicador: [{ reprodutorIdeagriId: 100, indicadorSigla: "PTAL", valor: 900.5 }],
    });

    // tpi (gerenciada, sem valor) → null; ptaLeite → 900.5; ptaGordura/ptaProteina intocadas
    expect(txMock.reprodutor.update).toHaveBeenCalledWith({
      where: { id: 600 },
      data: { ptaLeite: 900.5, tpi: null },
    });
  });

  it("limpa a coluna gerenciada quando valoresIndicador está presente mas vazio", async () => {
    txMock = novoTx();
    txMock.indicadorGenetico.findMany.mockResolvedValue([
      { id: 42, colunaLegada: "ptaLeite" },
    ]);
    const db = dbMock();
    await importarGeneticaLegado(db, {
      reprodutoresGeneticos: [reprodutor],
      indicadores: [indicador],
      valoresIndicador: [],
    });

    expect(txMock.reprodutor.update).toHaveBeenCalledWith({
      where: { id: 600 },
      data: { ptaLeite: null },
    });
  });

  it("limpa todas as colunas gerenciadas pelo catálogo atual, mesmo fora do lote de indicadores", async () => {
    txMock = novoTx();
    txMock.indicadorGenetico.findMany.mockResolvedValue([
      { id: 42, colunaLegada: "ptaLeite" },
      { id: 99, colunaLegada: "ptaProteina" },
    ]);
    const db = dbMock();
    await importarGeneticaLegado(db, {
      reprodutoresGeneticos: [reprodutor],
      indicadores: [indicador],
      valoresIndicador: [{ reprodutorIdeagriId: 100, indicadorSigla: "PTAL", valor: 900.5 }],
    });

    expect(txMock.reprodutor.update).toHaveBeenCalledWith({
      where: { id: 600 },
      data: { ptaLeite: 900.5, ptaProteina: null },
    });
  });

  it("upserta valores de marcador e caseína pelas chaves compostas", async () => {
    txMock = novoTx();
    const db = dbMock();
    await importarGeneticaLegado(db, {
      reprodutoresGeneticos: [reprodutor],
      marcadores: [{ ideagriId: 8, sigla: "BLAD", nome: "Deficiência" }],
      valoresMarcador: [{ reprodutorIdeagriId: 100, marcadorSigla: "BLAD", resultado: "LIVRE" }],
      caseinas: [{ ideagriId: 9, sigla: "K-CN", nome: "Kappa-caseína" }],
      valoresCaseina: [{ reprodutorIdeagriId: 100, caseinaSigla: "K-CN", genotipo: "A2A2" }],
    });

    expect(txMock.valorMarcadorReprodutor.upsert).toHaveBeenCalledWith({
      where: { reprodutorId_marcadorId: { reprodutorId: 600, marcadorId: 80 } },
      create: { reprodutorId: 600, marcadorId: 80, resultado: "LIVRE" },
      update: { resultado: "LIVRE" },
    });
    expect(txMock.valorCaseinaReprodutor.upsert).toHaveBeenCalledWith({
      where: { reprodutorId_caseinaId: { reprodutorId: 600, caseinaId: 90 } },
      create: { reprodutorId: 600, caseinaId: 90, genotipo: "A2A2" },
      update: { genotipo: "A2A2" },
    });
  });

  it("upserta estoque por ideagriId resolvendo reprodutor e tipo por sigla", async () => {
    txMock = novoTx();
    const db = dbMock();
    await importarGeneticaLegado(db, {
      reprodutoresGeneticos: [reprodutor],
      tiposSemen: [{ ideagriId: 3, sigla: "SEX", nome: "Sexado" }],
      estoquesSemen: [{
        ideagriId: 7,
        reprodutorIdeagriId: 100,
        tipoSemenSigla: "SEX",
        lote: "L-22",
        localizacao: "Botijão 1",
        doses: 12,
      }],
    });

    expect(txMock.estoqueSemen.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ideagriId: 7 },
        create: expect.objectContaining({
          ideagriId: 7,
          reprodutorId: 600,
          tipoSemenId: 3,
          lote: "L-22",
          localizacao: "Botijão 1",
          dosesDisponiveis: 12,
          propriedadeId: 1,
        }),
        update: expect.objectContaining({
          reprodutorId: 600,
          tipoSemenId: 3,
          dosesDisponiveis: 12,
          propriedadeId: 1,
        }),
      }),
    );
  });

  it("upserta estoque sem tipo quando tipoSemenSigla é nula", async () => {
    txMock = novoTx();
    const db = dbMock();
    await importarGeneticaLegado(db, {
      reprodutoresGeneticos: [reprodutor],
      estoquesSemen: [{
        ideagriId: 8,
        reprodutorIdeagriId: 100,
        tipoSemenSigla: null,
        lote: null,
        localizacao: null,
        doses: 0,
      }],
    });

    expect(txMock.estoqueSemen.upsert).toHaveBeenCalledWith({
      where: { ideagriId: 8 },
      create: {
        ideagriId: 8, reprodutorId: 600, tipoSemenId: null, lote: null,
        localizacao: null, dosesDisponiveis: 0, propriedadeId: 1,
      },
      update: {
        reprodutorId: 600, tipoSemenId: null, lote: null,
        localizacao: null, dosesDisponiveis: 0, propriedadeId: 1,
      },
    });
  });

  it("aborta e nada grava quando estoque referencia reprodutor ausente do mapa", async () => {
    txMock = novoTx();
    const db = dbMock();
    await expect(
      importarGeneticaLegado(db, {
        // reprodutor 100 não está entre os reprodutoresGeneticos → mapa vazio
        estoquesSemen: [{
          ideagriId: 7,
          reprodutorIdeagriId: 100,
          tipoSemenSigla: null,
          lote: null,
          localizacao: null,
          doses: 12,
        }],
      }),
    ).rejects.toThrow("reprodutor IDEAGRI 100 não encontrado");
    expect(txMock.estoqueSemen.upsert).not.toHaveBeenCalled();
  });

  it.each([
    [
      "indicador",
      { valoresIndicador: [{ reprodutorIdeagriId: 100, indicadorSigla: "X", valor: 1 }] },
      "indicador X não encontrado",
    ],
    [
      "marcador",
      { valoresMarcador: [{ reprodutorIdeagriId: 100, marcadorSigla: "X", resultado: "LIVRE" }] },
      "marcador X não encontrado",
    ],
    [
      "caseína",
      { valoresCaseina: [{ reprodutorIdeagriId: 100, caseinaSigla: "X", genotipo: "A2A2" }] },
      "caseína X não encontrado",
    ],
    [
      "tipo de sêmen",
      { estoquesSemen: [{ ideagriId: 7, reprodutorIdeagriId: 100, tipoSemenSigla: "X", lote: null, localizacao: null, doses: 1 }] },
      "tipo de sêmen X não encontrado",
    ],
  ])("aborta quando a sigla de %s não foi resolvida", async (_entidade, bloco, mensagem) => {
    txMock = novoTx();
    const db = dbMock();
    await expect(importarGeneticaLegado(db, {
      reprodutoresGeneticos: [reprodutor],
      ...bloco,
    })).rejects.toThrow(mensagem);
  });

  it("upserta pedigree por reprodutor (chave de origem)", async () => {
    txMock = novoTx();
    const db = dbMock();
    await importarGeneticaLegado(db, {
      reprodutoresGeneticos: [reprodutor],
      pedigrees: [{
        reprodutorIdeagriId: 100,
        paiNome: "Pai Atlas", paiCodigo: "P-1",
        maeNome: "Mãe Lua", maeCodigo: "M-1",
        avoMaternoNome: null, avoMaternoCodigo: null,
        avoPaternoNome: null, avoPaternoCodigo: null,
      }],
    });

    expect(txMock.pedigreeReprodutor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reprodutorId: 600 },
        create: expect.objectContaining({ reprodutorId: 600, paiNome: "Pai Atlas", maeCodigo: "M-1" }),
        update: expect.objectContaining({ paiNome: "Pai Atlas", maeCodigo: "M-1" }),
      }),
    );
  });

  it("trata ideagriId/sigla conflitantes como conflito estrutural, não reatribuição silenciosa", async () => {
    txMock = novoTx();
    // Já existe um indicador de catálogo com a sigla PTAL, mas com outro ideagriId.
    txMock.indicadorGenetico.findUnique = vi.fn(async ({ where }: any) =>
      where.sigla === "PTAL" ? { id: 42, ideagriId: 999, sigla: "PTAL", colunaLegada: "ptaLeite" } : null,
    );
    const db = dbMock();
    await expect(
      importarGeneticaLegado(db, { indicadores: [indicador] }),
    ).rejects.toThrow(/conflito.*PTAL/i);
    expect(txMock.indicadorGenetico.upsert).not.toHaveBeenCalled();
  });

  it("reusa a linha de catálogo existente por sigla sem duplicar (ideagriId ainda ausente)", async () => {
    txMock = novoTx();
    // Linha criada pelo usuário: mesma sigla, sem ideagriId ainda.
    txMock.indicadorGenetico.findUnique = vi.fn(async ({ where }: any) =>
      where.sigla === "PTAL" ? { id: 42, ideagriId: null, sigla: "PTAL", colunaLegada: "ptaLeite" } : null,
    );
    const db = dbMock();
    await importarGeneticaLegado(db, { indicadores: [indicador] });

    // resolve pela linha existente e carimba o ideagriId por id — não cria segunda linha
    expect(txMock.indicadorGenetico.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 42 } }),
    );
  });

  it("aborta quando o ideagriId já está ligado a outra sigla", async () => {
    txMock = novoTx();
    txMock.indicadorGenetico.findUnique = vi.fn(async ({ where }: any) => {
      if (where.sigla === "PTAL") return null;
      if (where.ideagriId === 42) return { id: 77, ideagriId: 42, sigla: "OUTRA", colunaLegada: null };
      return null;
    });
    const db = dbMock();
    await expect(importarGeneticaLegado(db, { indicadores: [indicador] }))
      .rejects.toThrow(/conflito.*PTAL/i);
    expect(txMock.indicadorGenetico.upsert).not.toHaveBeenCalled();
  });

  it("sem nenhum bloco genético é no-op retrocompatível e não abre transação", async () => {
    txMock = novoTx();
    const db = dbMock();
    const r = await importarGeneticaLegado(db, {});
    expect(r).toEqual({
      reprodutores: 0,
      indicadores: 0,
      valores: 0,
      marcadores: 0,
      caseinas: 0,
      tiposSemen: 0,
      estoques: 0,
      pedigrees: 0,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("usa uma única transação quando algum array genético está presente, mesmo vazio", async () => {
    txMock = novoTx();
    const db = dbMock();
    const r = await importarGeneticaLegado(db, { indicadores: [] });
    expect(r).toEqual({
      reprodutores: 0,
      indicadores: 0,
      valores: 0,
      marcadores: 0,
      caseinas: 0,
      tiposSemen: 0,
      estoques: 0,
      pedigrees: 0,
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
