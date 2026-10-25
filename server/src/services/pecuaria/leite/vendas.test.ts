import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ count: vi.fn(), linhas: vi.fn(), periodos: vi.fn(), transaction: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: f.transaction } }));
import { consultarVendasLeite, consultaVendasLeiteSchema } from "./estoque.js";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function versao(numero: number, recebimento = false) {
  const data = new Date("2026-10-19");
  return { alocacoesDemonstrativo: [], retiradaId: id(1), versao: numero, motivo: "Correção explicitamente documentada", retirada: { data, produtoId: id(2), quantidade: new Prisma.Decimal(100), versoesComerciaisLeite: [{ versao: 1 }, { versao: 2 }] },
    operacao: { id: id(10 + numero), numero, status: numero === 1 ? "CANCELADA" : "CONFIRMADA", parceiroId: id(3), parceiro: { nome: "Laticínio" }, data, valorTotal: new Prisma.Decimal(250), centroCustoId: null, corrigeOperacaoId: numero === 1 ? null : id(11), itens: [{ categoriaId: null, centroCustoId: null }],
      transacoes: recebimento ? [{ tipo: "RECEBIMENTO", status: "CONFIRMADA", valorTotal: new Prisma.Decimal(50) }] : [], compromissos: [{ status: numero === 1 ? "CANCELADO" : "PENDENTE", liquidacoes: [] }] } };
}
beforeEach(() => {
  vi.clearAllMocks(); f.count.mockResolvedValue(2); f.linhas.mockResolvedValue([versao(2), versao(1)]); f.periodos.mockResolvedValue([]);
  f.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ versaoComercialVendaLeite: { count: f.count, findMany: f.linhas }, periodoFinanceiro: { findMany: f.periodos } }));
});
describe("histórico comercial leiteiro", () => {
  it("exibe versões substituídas, só habilita a vigente e pagina no sítio/período/produto", async () => {
    const resultado = await consultarVendasLeite(consultaVendasLeiteSchema.parse({ produtoId: id(2), de: "2026-10-01", ate: "2026-10-31", pagina: 2 }), { propriedadeId: 7, usuarioId: 9 });
    expect(resultado).toMatchObject({ total: 2, pagina: 2, porPagina: 20, itens: [{ versaoComercial: 2, podeCorrigir: true, estadoFinanceiro: "A_RECEBER", quantidadeLitros: "100", valorTotal: "250.00", parceiroNome: "Laticínio" }, { versaoComercial: 1, podeCorrigir: false, estadoFinanceiro: "SUBSTITUIDA" }] });
    expect(f.linhas).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20, where: { operacao: { propriedadeId: 7, data: { gte: new Date("2026-10-01"), lte: new Date("2026-10-31") } }, retirada: { produtoId: id(2) } } }));
    expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  });
  it("recebimento parcial e período fechado apresentam bloqueio explícito", async () => {
    f.linhas.mockResolvedValueOnce([versao(2, true)]);
    let resultado = await consultarVendasLeite(consultaVendasLeiteSchema.parse({}), { propriedadeId: 7, usuarioId: 9 });
    expect(resultado.itens[0]).toMatchObject({ podeCorrigir: false, estadoFinanceiro: "PARCIAL", valorRecebidoConfirmado: "50.00" });
    expect(resultado.itens[0].motivoBloqueio).toMatch(/estorno financeiro explícito/);
    f.periodos.mockResolvedValueOnce([{ ano: 2026, mes: 10 }]);
    resultado = await consultarVendasLeite(consultaVendasLeiteSchema.parse({}), { propriedadeId: 7, usuarioId: 9 });
    expect(resultado.itens[0].motivoBloqueio).toMatch(/período financeiro fechado/);
  });
});
