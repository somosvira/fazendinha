import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ animalFindFirst: vi.fn(), eventoFindFirst: vi.fn(), transaction: vi.fn(), txEmbriaoFindFirst: vi.fn(), txEmbriaoUpdateMany: vi.fn(), txEmbriaoUpdate: vi.fn(), txEventoCreate: vi.fn(), txEventoDelete: vi.fn(), txAnimalFindUnique: vi.fn(), txAnimalUpdate: vi.fn(), txLactacaoFindMany: vi.fn(), txControleFindMany: vi.fn(), txResumoUpsert: vi.fn(), getNumero: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: { animal: { findFirst: mocks.animalFindFirst }, eventoReprodutivo: { findFirst: mocks.eventoFindFirst }, $transaction: mocks.transaction } }));
vi.mock("./parametros.js", () => ({ getNumero: mocks.getNumero }));
import { criarEventoSchema } from "./eventos.schemas.js";
import { excluirEvento, registrarEvento } from "./eventos.js";
const eventoTe = (overrides: Record<string, unknown> = {}) => ({ id: 50, animalId: 31, tipo: "TRANSFERENCIA_EMBRIAO", data: new Date("2026-07-27T00:00:00Z"), reprodutor: "Touro GEN", protocolo: null, observacao: null, estoqueSemenId: null, estoqueSemenDoseBaixada: false, embriaoColetaId: 70, motivoSecagem: null, tipoParto: null, animal: { propriedadeId: 7 }, ...overrides });
const embriao = { id: 70, estado: "DISPONIVEL", propriedadeId: 7, fertilizacao: { reprodutor: { nome: "Touro GEN", codigo: "TG-1" }, coleta: { doadoraId: 44, doadora: { numero: "D-44", nome: "Doadora Elite" } } } };
beforeEach(() => {
  vi.clearAllMocks(); mocks.animalFindFirst.mockResolvedValue({ id: 31, propriedadeId: 7 }); mocks.txEmbriaoFindFirst.mockResolvedValue(embriao); mocks.txEmbriaoUpdateMany.mockResolvedValue({ count: 1 }); mocks.txEventoCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => eventoTe(data)); mocks.txEventoDelete.mockResolvedValue(eventoTe()); mocks.txAnimalFindUnique.mockResolvedValue({ id: 31, categoria: "VACA", numPartosEntrada: 0, eventosReprodutivos: [] }); mocks.txLactacaoFindMany.mockResolvedValue([]); mocks.txControleFindMany.mockResolvedValue([]); mocks.getNumero.mockResolvedValue(null);
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ embriaoColeta: { findFirst: mocks.txEmbriaoFindFirst, updateMany: mocks.txEmbriaoUpdateMany, update: mocks.txEmbriaoUpdate }, eventoReprodutivo: { create: mocks.txEventoCreate, delete: mocks.txEventoDelete }, animal: { findUnique: mocks.txAnimalFindUnique, update: mocks.txAnimalUpdate }, lactacao: { findMany: mocks.txLactacaoFindMany, create: vi.fn(), update: vi.fn(), delete: vi.fn() }, controleLeiteiro: { findMany: mocks.txControleFindMany }, resumoAnimal: { upsert: mocks.txResumoUpsert } }));
});
describe("schema TE com embrião interno", () => {
  it("aceita embriaoColetaId positivo e preserva TE livre", () => {
    expect(criarEventoSchema.safeParse({ tipo: "TRANSFERENCIA_EMBRIAO", data: "2026-07-27", embriaoColetaId: 70 }).success).toBe(true);
    expect(criarEventoSchema.safeParse({ tipo: "TRANSFERENCIA_EMBRIAO", data: "2026-07-27", doadoraId: 44, reprodutor: "Texto livre" }).success).toBe(true);
  });
});
describe("registrar TE com estoque de embrião", () => {
  it("transfere atomicamente e deriva genética do embrião", async () => {
    await registrarEvento(31, { tipo: "TRANSFERENCIA_EMBRIAO", data: "2026-07-27", embriaoColetaId: 70 }, 7);
    expect(mocks.txEmbriaoFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 70, propriedadeId: 7 } }));
    expect(mocks.txEmbriaoUpdateMany).toHaveBeenCalledWith({ where: { id: 70, propriedadeId: 7, estado: "DISPONIVEL", viavel: true }, data: { estado: "TRANSFERIDO" } });
    expect(mocks.txEventoCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ embriaoColetaId: 70, doadoraId: 44, doadoraNumero: "D-44", doadoraNome: "Doadora Elite", reprodutor: "Touro GEN · TG-1" }) });
  });
  it("recusa corrida quando outro evento consome primeiro", async () => {
    mocks.txEmbriaoUpdateMany.mockResolvedValue({ count: 0 });
    await expect(registrarEvento(31, { tipo: "TRANSFERENCIA_EMBRIAO", data: "2026-07-27", embriaoColetaId: 70 }, 7)).rejects.toEqual(expect.objectContaining({ code: "CONFLITO" }));
    expect(mocks.txEventoCreate).not.toHaveBeenCalled();
  });
  it("recusa embrião de outro sítio sem revelar existência", async () => {
    mocks.txEmbriaoFindFirst.mockResolvedValue(null);
    await expect(registrarEvento(31, { tipo: "TRANSFERENCIA_EMBRIAO", data: "2026-07-27", embriaoColetaId: 70 }, 7)).rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));
  });
});
describe("excluir TE devolve embrião", () => {
  it("devolve transferido para disponível antes de excluir", async () => {
    mocks.eventoFindFirst.mockResolvedValue(eventoTe()); mocks.txEmbriaoFindFirst.mockResolvedValue({ id: 70, estado: "TRANSFERIDO" });
    await excluirEvento(50, 7);
    expect(mocks.txEmbriaoUpdate).toHaveBeenCalledWith({ where: { id: 70 }, data: { estado: "DISPONIVEL" } });
    expect(mocks.txEventoDelete).toHaveBeenCalledWith({ where: { id: 50 } });
  });
  it("TE livre não toca estoque de embrião", async () => {
    mocks.eventoFindFirst.mockResolvedValue(eventoTe({ embriaoColetaId: null })); await excluirEvento(50, 7);
    expect(mocks.txEmbriaoFindFirst).not.toHaveBeenCalled(); expect(mocks.txEmbriaoUpdate).not.toHaveBeenCalled();
  });
});
