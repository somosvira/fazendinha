import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  animalFindFirst: vi.fn(), reprodutorFindFirst: vi.fn(), classificacaoFindUnique: vi.fn(),
  coletaFindFirst: vi.fn(), coletaCreate: vi.fn(), coletaUpdate: vi.fn(), coletaDelete: vi.fn(),
  fertilizacaoFindFirst: vi.fn(), fertilizacaoCreate: vi.fn(), fertilizacaoUpdate: vi.fn(),
  embriaoCount: vi.fn(), embriaoCreate: vi.fn(), embriaoFindMany: vi.fn(), embriaoUpdate: vi.fn(),
  estoqueFindFirst: vi.fn(), estoqueUpdateMany: vi.fn(), estoqueUpdate: vi.fn(), transaction: vi.fn(),
}));

vi.mock("../../db.js", () => ({ prisma: {
  animal: { findFirst: mocks.animalFindFirst }, reprodutor: { findFirst: mocks.reprodutorFindFirst },
  embriaoClassificacao: { findUnique: mocks.classificacaoFindUnique },
  coleta: { findFirst: mocks.coletaFindFirst },
  fertilizacaoColeta: { findFirst: mocks.fertilizacaoFindFirst },
  embriaoColeta: { findMany: mocks.embriaoFindMany, count: mocks.embriaoCount },
  $transaction: mocks.transaction,
} }));

import { FivError, adicionarEmbriao, adicionarFertilizacao, atualizarColeta, cancelarFertilizacao, criarColeta, listarEmbrioesDisponiveis } from "./fiv.js";

const coleta = { id: 10, doadoraId: 31, data: new Date("2026-07-27T00:00:00Z"), tecnico: "Dra. Ana", metodo: "FIV", laboratorio: null, status: "RASCUNHO", observacao: null, propriedadeId: 7, oocitos: [], fertilizacoes: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.animalFindFirst.mockResolvedValue({ id: 31 }); mocks.reprodutorFindFirst.mockResolvedValue({ id: 44 });
  mocks.classificacaoFindUnique.mockResolvedValue({ id: 2 });
  mocks.coletaFindFirst.mockResolvedValue({ ...coleta, fertilizacoes: [] });
  mocks.fertilizacaoFindFirst.mockResolvedValue({ id: 20, coletaId: 10, estoqueSemenId: 18, doseBaixada: true, status: "ATIVA", coleta: { propriedadeId: 7 } });
  mocks.embriaoCount.mockResolvedValue(0);
  mocks.estoqueFindFirst.mockResolvedValue({ id: 18, reprodutorId: 44, dosesDisponiveis: 3, propriedadeId: 7 });
  mocks.estoqueUpdateMany.mockResolvedValue({ count: 1 }); mocks.coletaCreate.mockResolvedValue(coleta); mocks.coletaUpdate.mockResolvedValue(coleta);
  mocks.fertilizacaoCreate.mockResolvedValue({ id: 20, coletaId: 10, reprodutorId: 44, estoqueSemenId: 18, doseBaixada: true, status: "ATIVA" });
  mocks.fertilizacaoUpdate.mockResolvedValue({ id: 20, status: "CANCELADA" });
  mocks.embriaoCreate.mockResolvedValue({ id: 70, fertilizacaoId: 20, classificacaoId: 2, estado: "DISPONIVEL", propriedadeId: 7 });
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    coleta: { create: mocks.coletaCreate, update: mocks.coletaUpdate, delete: mocks.coletaDelete },
    fertilizacaoColeta: { create: mocks.fertilizacaoCreate, update: mocks.fertilizacaoUpdate },
    embriaoColeta: { count: mocks.embriaoCount, create: mocks.embriaoCreate, update: mocks.embriaoUpdate },
    estoqueSemen: { findFirst: mocks.estoqueFindFirst, updateMany: mocks.estoqueUpdateMany, update: mocks.estoqueUpdate },
  }));
});

describe("coletas FIV", () => {
  it("cria coleta no sítio com oócitos normalizados", async () => {
    await criarColeta({ doadoraId: 31, data: "2026-07-27", metodo: "FIV", tecnico: "Dra. Ana", oocitos: [{ qualidade: " a ", viavel: true, quantidade: 8 }] }, 7);
    expect(mocks.animalFindFirst).toHaveBeenCalledWith({ where: { id: 31, propriedadeId: 7 }, select: { id: true } });
    expect(mocks.coletaCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ doadoraId: 31, data: new Date("2026-07-27T00:00:00Z"), propriedadeId: 7, oocitos: { create: [{ qualidade: "A", viavel: true, quantidade: 8 }] } }) }));
  });

  it("recusa doadora de outro sítio e oócitos duplicados", async () => {
    mocks.animalFindFirst.mockResolvedValueOnce(null);
    await expect(criarColeta({ doadoraId: 31, data: "2026-07-27", metodo: "FIV", oocitos: [] }, 7)).rejects.toEqual(expect.objectContaining<Partial<FivError>>({ code: "NAO_ENCONTRADO" }));
    await expect(criarColeta({ doadoraId: 31, data: "2026-07-27", metodo: "FIV", oocitos: [{ qualidade: "A", viavel: true, quantidade: 1 }, { qualidade: " a ", viavel: true, quantidade: 2 }] }, 7)).rejects.toEqual(expect.objectContaining<Partial<FivError>>({ code: "CONFLITO" }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("trava alteração estrutural quando já existem embriões", async () => {
    mocks.coletaFindFirst.mockResolvedValue({ ...coleta, fertilizacoes: [{ _count: { embrioes: 1 } }] });
    await expect(atualizarColeta(10, { doadoraId: 99 }, 7)).rejects.toEqual(expect.objectContaining<Partial<FivError>>({ code: "CONFLITO", message: expect.stringMatching(/embri/i) }));
    expect(mocks.coletaUpdate).not.toHaveBeenCalled();
  });
});

describe("fertilização e estoque de sêmen", () => {
  it("consome uma dose atomicamente e registra o marcador", async () => {
    const resultado = await adicionarFertilizacao(10, { reprodutorId: 44, estoqueSemenId: 18, data: "2026-07-27" }, 7);
    expect(mocks.estoqueUpdateMany).toHaveBeenCalledWith({ where: { id: 18, propriedadeId: 7, reprodutorId: 44, dosesDisponiveis: { gte: 1 } }, data: { dosesDisponiveis: { decrement: 1 } } });
    expect(mocks.fertilizacaoCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ doseBaixada: true }) });
    expect(resultado).not.toHaveProperty("aviso");
  });

  it("registra sem baixa e avisa quando a última dose some em corrida", async () => {
    mocks.estoqueUpdateMany.mockResolvedValue({ count: 0 });
    const resultado = await adicionarFertilizacao(10, { reprodutorId: 44, estoqueSemenId: 18 }, 7);
    expect(mocks.fertilizacaoCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ doseBaixada: false }) });
    expect(resultado).toEqual(expect.objectContaining({ aviso: expect.stringMatching(/estoque zerado/i) }));
  });

  it("cancela sem embriões e devolve exatamente uma dose", async () => {
    await cancelarFertilizacao(20, { motivo: "Falha laboratorial" }, 7);
    expect(mocks.estoqueUpdate).toHaveBeenCalledWith({ where: { id: 18 }, data: { dosesDisponiveis: { increment: 1 } } });
    expect(mocks.fertilizacaoUpdate).toHaveBeenCalledWith({ where: { id: 20 }, data: { status: "CANCELADA", canceladaEm: expect.any(Date), motivoCancelamento: "Falha laboratorial", doseBaixada: false } });
  });

  it("preserva fertilização quando já existem embriões", async () => {
    mocks.embriaoCount.mockResolvedValue(1);
    await expect(cancelarFertilizacao(20, { motivo: "Correção" }, 7)).rejects.toEqual(expect.objectContaining<Partial<FivError>>({ code: "CONFLITO" }));
    expect(mocks.estoqueUpdate).not.toHaveBeenCalled();
  });
});

describe("embriões", () => {
  it("cria embrião com propriedade herdada da coleta", async () => {
    await adicionarEmbriao(20, { classificacaoId: 2, estagio: "MORULA", viavel: true }, 7);
    expect(mocks.embriaoCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ fertilizacaoId: 20, propriedadeId: 7, estado: "DISPONIVEL" }) });
  });

  it("lista somente disponíveis e viáveis do sítio", async () => {
    mocks.embriaoFindMany.mockResolvedValue([]);
    await listarEmbrioesDisponiveis(7);
    expect(mocks.embriaoFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 7, estado: "DISPONIVEL", viavel: true } }));
  });
});
