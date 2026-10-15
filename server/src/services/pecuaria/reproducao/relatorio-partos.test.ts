import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  partos: vi.fn(), crias: vi.fn(), usuarios: vi.fn(), transaction: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: mocks.transaction } }));
import { emitirRelatorioPartos, periodoRelatorioPartosSchema } from "./relatorio-partos.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({ partoAnimal: { findMany: mocks.partos }, criaParto: { findMany: mocks.crias }, usuario: { findMany: mocks.usuarios } }));
});
describe("emissão de partos por sítio do fato", () => {
  it("valida período inclusivo, datas reais e ordem", () => {
    expect(periodoRelatorioPartosSchema.safeParse({ inicio: "2026-02-30", fim: "2026-03-01" }).success).toBe(false);
    expect(periodoRelatorioPartosSchema.safeParse({ inicio: "2026-10-02", fim: "2026-10-01" }).success).toBe(false);
    expect(periodoRelatorioPartosSchema.safeParse({ inicio: "2026-10-01", fim: "2026-10-01" }).success).toBe(true);
  });
  it("consulta parto pelo sítio e restringe complementos; sem localização atual ou custos", async () => {
    mocks.partos.mockResolvedValue([]);
    const relatorio = await emitirRelatorioPartos({ propriedadeId: 9, inicio: "2026-01-01", fim: "2026-01-31" });
    const consulta = mocks.partos.mock.calls[0][0];
    expect(consulta.where).toEqual({ propriedadeId: 9, status: "VALIDO", data: { gte: new Date("2026-01-01"), lte: new Date("2026-01-31") } });
    expect(consulta.include.examesPosParto.where.propriedadeId).toBe(9);
    expect(consulta.include.ocorrenciasRetencaoPlacenta.where.propriedadeId).toBe(9);
    expect(JSON.stringify(consulta)).not.toContain("localizacoes");
    expect(JSON.stringify(consulta)).not.toContain("custo");
    expect(relatorio.totalPartos).toBe(0);
    expect(mocks.crias).not.toHaveBeenCalled();
    expect(mocks.transaction.mock.calls[0][1]).toEqual({ isolationLevel: "RepeatableRead" });
  });
  it("agrupa gêmeos e seus fornecimentos preservando quantidade desconhecida e zero", async () => {
    mocks.partos.mockResolvedValue([{ id: "p", versao: 2, animal: { id: "a", brinco: "123", nome: null },
      data: new Date("2026-01-03"), ocorridoEm: null, horarioEstimado: false, desfecho: "NASCIMENTO", tipo: "NORMAL", induzido: null,
      dificuldade: false, assistenciaDescricao: null, retencaoPlacenta: null, responsavel: "Veterinário", observacao: null,
      criadoPorId: 10, criadoEm: new Date("2026-01-04"), ocorrenciasRetencaoPlacenta: [], vinculosPesagem: [], examesPosParto: [] }]);
    mocks.usuarios.mockResolvedValue([{ id: 10, nome: "Lançador" }]);
    mocks.crias.mockResolvedValue([1, 2].map(i => ({ id: `c${i}`, partoId: "p", animalId: null, ordem: i, sexo: "F", viva: true, filiacaoSnapshot: {},
      fornecimentosColostro: [{ id: `f${i}`, data: new Date("2026-01-04"), ocorridoEm: null, quantidadeLitros: i === 1 ? null : { toString: () => "0" }, qualidadeBrix: null }] })));
    const relatorio = await emitirRelatorioPartos({ propriedadeId: 9, inicio: "2026-01-01", fim: "2026-01-31" });
    expect(relatorio.totalPartos).toBe(1);
    expect(relatorio.partos[0].crias).toHaveLength(2);
    expect(relatorio.partos[0].crias.map(c => c.colostro[0].quantidadeLitros)).toEqual([null, "0"]);
    expect(relatorio.partos[0].responsavel).toBe("Veterinário");
    expect(relatorio.partos[0].lancador?.nome).toBe("Lançador");
    const consultaCrias = mocks.crias.mock.calls[0][0];
    expect(consultaCrias.include.fornecimentosColostro.where).toEqual({ propriedadeId: 9, status: "VALIDO" });
  });
});
