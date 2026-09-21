import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ movimentos: vi.fn(), compromissos: vi.fn(), operacoes: vi.fn(), count: vi.fn(), transacoes: vi.fn(), saldos: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: {
  movimentoConta: { findMany: mocks.movimentos }, compromissoFinanceiro: { findMany: mocks.compromissos },
  operacao: { groupBy: mocks.operacoes, count: mocks.count }, transacaoFinanceira: { findMany: mocks.transacoes },
} }));
vi.mock("./contas.js", () => ({ resumoSaldos: mocks.saldos }));
import { obterDashboard } from "./dashboard.js";
import { movimentoRealizado } from "./dashboard.calc.js";
const dinheiro = (valor: string) => new Prisma.Decimal(valor);
const inicio = new Date("2026-09-12T00:00:00Z"); const fim = new Date("2026-09-15T23:59:59.999Z");
const movimento = (id: number, tipo: string, direcao: string, valor: string, reversao?: string) => ({ id, direcao, valor: dinheiro(valor), transacao: { id, data: inicio, tipo, status: "CONFIRMADA", operacao: null, reversaoDe: reversao ? { tipo: reversao } : null } });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.movimentos.mockResolvedValue([]); mocks.compromissos.mockResolvedValue([]); mocks.count.mockResolvedValue(0); mocks.transacoes.mockResolvedValue([]);
  mocks.operacoes.mockResolvedValue([]); mocks.saldos.mockResolvedValue({ saldoGeral: dinheiro("1234.56"), contas: [] });
});
describe("dashboard no período global", () => {
  it("usa o mesmo intervalo e propriedade em fatos, vencimentos, transações e movimentos", async () => {
    const dashboard = await obterDashboard(7, inicio, fim);
    expect(mocks.movimentos).toHaveBeenCalledWith(expect.objectContaining({ where: { transacao: { propriedadeId: 7, data: { gte: inicio, lte: fim } } } }));
    expect(mocks.compromissos).toHaveBeenCalledWith(expect.objectContaining({ where: { operacao: { propriedadeId: 7 }, dataVencimento: { gte: inicio, lte: fim } } }));
    expect(mocks.operacoes).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 7, data: { gte: inicio, lte: fim }, status: "CONFIRMADA" } }));
    expect(mocks.transacoes).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 7, data: { gte: inicio, lte: fim } } }));
    expect(mocks.saldos).toHaveBeenCalledWith(7);
    expect(dashboard.saldoGeral.toString()).toBe("1234.56");
    expect(dashboard.despesasPorCategoria).toEqual([]);
    expect(dashboard.base.porTipo).toEqual([]);
    expect(dashboard.proximosCompromissos).toEqual([]);
    expect(dashboard.fluxo).toHaveLength(4);
  });
  it("estornos abatem a natureza original e transferências não inflam realizado nem categorias", async () => {
    mocks.movimentos.mockResolvedValue([
      movimento(1, "PAGAMENTO", "SAIDA", "100.10"), movimento(2, "REVERSAO", "ENTRADA", "100.10", "PAGAMENTO"),
      movimento(3, "RECEBIMENTO", "ENTRADA", "20.20"), movimento(4, "REVERSAO", "SAIDA", "5.10", "RECEBIMENTO"),
      movimento(5, "TRANSFERENCIA", "SAIDA", "900"), movimento(6, "TRANSFERENCIA", "ENTRADA", "900"),
      movimento(7, "REVERSAO", "ENTRADA", "900", "TRANSFERENCIA"), movimento(8, "REVERSAO", "SAIDA", "900", "TRANSFERENCIA"),
      movimento(9, "PAGAMENTO", "SAIDA", "0.10"), movimento(10, "PAGAMENTO", "SAIDA", "0.20"),
    ]);
    const dashboard = await obterDashboard(7, inicio, fim);
    expect(dashboard.realizado.entradas.toString()).toBe("15.1");
    expect(dashboard.realizado.saidas.toString()).toBe("0.3");
    expect(dashboard.despesasPorCategoria[0]).toMatchObject({ categoriaId: null, categoria: "Sem categoria" });
    expect(dashboard.despesasPorCategoria[0].valor.toString()).toBe("0.3");
    expect(dashboard.fluxo[0].saidas.toString()).toBe("0.3");
    expect(dashboard.base.movimentos.total).toBe(10);
  });
  it("mantém separado volume econômico, saldo pendente e dinheiro realizado; detecta vínculos ausentes", async () => {
    mocks.operacoes.mockImplementation(async ({ by }) => by[0] === "status" ? [{ status: "CONFIRMADA", _count: 2 }, { status: "CANCELADA", _count: 1 }] : [{ tipo: "SERVICO", _sum: { valorTotal: dinheiro("500") }, _count: 2 }, { tipo: "AJUSTE_ESTOQUE", _sum: { valorTotal: dinheiro("0") }, _count: 1 }]);
    mocks.compromissos.mockResolvedValue([
      { id: 1, tipo: "PAGAR", status: "PARCIAL", dataVencimento: inicio, valorOriginal: dinheiro("300"), liquidacoes: [{ valor: dinheiro("100"), transacao: { status: "CONFIRMADA" } }, { valor: dinheiro("50"), transacao: { status: "REVERTIDA" } }] },
      { id: 2, tipo: "PAGAR", status: "CANCELADO", dataVencimento: inicio, valorOriginal: dinheiro("999"), liquidacoes: [] },
    ]);
    mocks.movimentos.mockResolvedValue([movimento(1, "PAGAMENTO", "SAIDA", "100")]);
    mocks.transacoes.mockResolvedValue([{ id: 1, tipo: "PAGAMENTO", status: "CONFIRMADA", operacaoId: null, _count: { movimentos: 0, liquidacoes: 0 } }, { id: 2, tipo: "TRANSFERENCIA", status: "REVERTIDA", operacaoId: 1, _count: { movimentos: 1, liquidacoes: 1 } }]);
    const dashboard = await obterDashboard(7, inicio, fim);
    expect(dashboard.base.volumeEconomico.toString()).toBe("500");
    expect(dashboard.base.porTipo).toHaveLength(1);
    expect(dashboard.compromissos.aPagar.toString()).toBe("200");
    expect(dashboard.realizado.saidas.toString()).toBe("100");
    expect(dashboard.proximosCompromissos).toHaveLength(1);
    expect(dashboard.base.compromissos.estados).toEqual({ PARCIAL: 1, CANCELADO: 1 });
    expect(dashboard.base.transacoes).toMatchObject({ avulsas: 1, semMovimentos: 1, transferenciasIncompletas: 1, comLiquidacao: 1 });
    expect(dashboard.base.vinculosAusentes).toEqual([{ transacaoId: 1, operacaoId: null, motivo: "Sem movimento de conta" }, { transacaoId: 2, operacaoId: 1, motivo: "Transferência sem as duas pontas" }]);
  });
  it("estorno de outro período reduz somente o evento no período consultado", () => {
    expect(movimentoRealizado(movimento(1, "REVERSAO", "ENTRADA", "80", "PAGAMENTO"))?.valor.toString()).toBe("-80");
    expect(movimentoRealizado({ ...movimento(1, "PAGAMENTO", "SAIDA", "80"), transacao: { tipo: "PAGAMENTO", status: "CANCELADA" } })).toBeNull();
  });
});
it("preserva o abatimento de estorno isolado no total por categoria do período", async () => {
  mocks.movimentos.mockResolvedValue([movimento(1, "REVERSAO", "ENTRADA", "80", "PAGAMENTO")]);
  const dashboard = await obterDashboard(7, inicio, fim);
  expect(dashboard.realizado.saidas.toString()).toBe("-80");
  expect(dashboard.despesasPorCategoria[0].valor.toString()).toBe("-80");
});
