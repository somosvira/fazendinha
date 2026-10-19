import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  exames: vi.fn(), origem: vi.fn(), partos: vi.fn(), crias: vi.fn(), usuarios: vi.fn(), transaction: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: mocks.transaction } }));
import { obterPartoOperacional, emitirRelatorioPartos, periodoRelatorioPartosSchema } from "./relatorio-partos.js";

beforeEach(() => {
  vi.clearAllMocks(); mocks.exames.mockResolvedValue([]);
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({ exameAnimal: { findMany: mocks.exames }, partoAnimal: { findFirst: mocks.origem, findMany: mocks.partos }, criaParto: { findMany: mocks.crias }, usuario: { findMany: mocks.usuarios } }));
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

it("detalhe operacional rejeita parto fora do sítio sem procurar complementos", async () => {
  mocks.origem.mockResolvedValue(null);
  await expect(obterPartoOperacional("12345678-1234-4123-8123-123456789012",9)).rejects.toMatchObject({code:"NAO_ENCONTRADO"});
  expect(mocks.origem).toHaveBeenCalledWith(expect.objectContaining({where:{id:"12345678-1234-4123-8123-123456789012",propriedadeId:9}}));
  expect(mocks.partos).not.toHaveBeenCalled();
});
it("detalhe pontual usa identidade e data do parto, inclusive anulado, sem emissão persistida", async () => {
 const id="12345678-1234-4123-8123-123456789012";
 mocks.origem.mockResolvedValue({id,data:new Date("2026-01-03"),status:"ANULADO"});
 mocks.partos.mockResolvedValue([{id,versao:1,animal:{id:"a",brinco:"123",nome:null},data:new Date("2026-01-03"),ocorridoEm:null,horarioEstimado:false,desfecho:"NASCIMENTO",tipo:"NORMAL",induzido:null,dificuldade:null,assistenciaDescricao:null,retencaoPlacenta:null,responsavel:null,observacao:null,criadoPorId:null,criadoEm:new Date("2026-01-04"),ocorrenciasRetencaoPlacenta:[],vinculosPesagem:[],examesPosParto:[]}]);
 mocks.crias.mockResolvedValue([]);
 const p=await obterPartoOperacional(id,9);
 expect(p).toMatchObject({id,propriedadeId:9,status:"ANULADO"});
 expect(mocks.partos.mock.calls[0][0].where).toEqual({id,propriedadeId:9,data:{gte:new Date("2026-01-03"),lte:new Date("2026-01-03")}});
});
