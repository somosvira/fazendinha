import { beforeEach, describe, expect, it, vi } from "vitest";
import { listarDietas } from "./dietas.js";
const mocks = vi.hoisted(() => ({ dietas: vi.fn(), vigencias: vi.fn(), transacao: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: mocks.transacao } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.transacao.mockImplementation(callback => callback({ dieta: { findMany: mocks.dietas }, vigenciaDietaLote: { findMany: mocks.vigencias } }));
  mocks.dietas.mockResolvedValue([{ id: "d1", itens: [] }, { id: "d2", itens: [] }]);
  mocks.vigencias.mockResolvedValue([{ dietaId: "d1", lote: { id: "l1", nome: "Matrizes", propriedade: { id: 7, nome: "Sítio" } } }]);
});
describe("catálogo de receitas com uso atual agregado", () => {
  it.each([7, null])("consulta em lote com escopo %s sem histórico ou custos", async propriedadeId => {
    const result = await listarDietas(propriedadeId);
    expect(result[0].lotesEmUso).toEqual([{ id: "l1", nome: "Matrizes", propriedade: { id: 7, nome: "Sítio" } }]);
    expect(result[1].lotesEmUso).toEqual([]);
    expect(mocks.dietas).toHaveBeenCalledTimes(1);
    expect(mocks.vigencias).toHaveBeenCalledTimes(1);
    const query = mocks.vigencias.mock.calls[0][0];
    expect(query.where.lote).toEqual({ ativo: true, ...(propriedadeId == null ? {} : { propriedadeId }) });
    expect(query.where.desde.lte).toBeInstanceOf(Date);
    expect(query.where.OR).toEqual([{ ate: null }, { ate: { gt: query.where.desde.lte } }]);
    expect(query.select).toEqual({ dietaId: true, lote: { select: { id: true, nome: true, propriedade: { select: { id: true, nome: true } } } } });
    expect(mocks.transacao).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  });
  it("não trunca lotes em uso nem consulta uma vez por lote", async () => {
    mocks.vigencias.mockResolvedValue(Array.from({ length: 1000 }, (_, i) => ({ dietaId: "d1", lote: { id: `l${i}` } })));
    expect((await listarDietas(7))[0].lotesEmUso).toHaveLength(1000);
    expect(mocks.vigencias).toHaveBeenCalledTimes(1);
  });
});
