import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
import { analisarCategorias } from "./analise-categorias.js";
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: { movimentoConta: { findMany } } }));
beforeEach(() => vi.resetAllMocks());
const movimento = (id: string, tipo: string, direcao: string, valor: string, original?: string) => ({
  id, contaId: "conta", direcao, valor: new Prisma.Decimal(valor),
  transacao: { id, tipo, status: "CONFIRMADA", operacaoId: null, operacao: null, descricao: id, data: new Date("2026-10-08T23:30:00Z"), reversaoDe: original ? { tipo: original } : null },
});
it("reconcilia pagamentos avulsos, retiradas e estornos com o dashboard e inclui todo o último dia", async () => {
  findMany.mockResolvedValue([
    movimento("pagamento", "PAGAMENTO", "SAIDA", "100.10"),
    movimento("retirada", "RETIRADA", "SAIDA", "25.05"),
    movimento("estorno", "REVERSAO", "ENTRADA", "20.00", "PAGAMENTO"),
    movimento("transferencia", "TRANSFERENCIA", "SAIDA", "500.00"),
    movimento("estorno-transferencia", "REVERSAO", "ENTRADA", "500.00", "TRANSFERENCIA"),
    movimento("recebimento", "RECEBIMENTO", "ENTRADA", "200.00"),
  ]);
  const resultado = await analisarCategorias({ inicio: "2026-10-08", fim: "2026-10-08", base: "pagamentos" }, 7);
  expect(resultado.total).toBe("105.15");
  expect(resultado.linhas.map(item => item.valor)).toEqual(["100.10", "25.05", "-20.00"]);
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { transacao: { propriedadeId: 7, data: { gte: new Date("2026-10-08T00:00:00Z"), lte: new Date("2026-10-08T23:59:59.999Z") } } } }));
});
it("filtra categoria sem incluir valores avulsos em categorias vinculadas", async () => {
  findMany.mockResolvedValue([movimento("pagamento", "PAGAMENTO", "SAIDA", "100")]);
  const resultado = await analisarCategorias({ inicio: "2026-10-01", fim: "2026-10-31", base: "pagamentos", categoriaId: "categoria" }, 7);
  expect(resultado.total).toBe("0.00"); expect(resultado.linhas).toHaveLength(0);
});

it("preserva rateio, centavos e centro de custo da categoria em pagamento parcial", async () => {
  const original = movimento("parcial", "PAGAMENTO", "SAIDA", "100.01");
  const operacao = { valorTotal: 200, itens: [
    { ordem: 1, categoriaId: "silagem", categoriaNome: "Silagem", classificacao: "CUSTEIO", centroCustoId: "rebanho", centroCustoNome: "Rebanho", valorTotal: 100 },
    { ordem: 2, categoriaId: "frete", categoriaNome: "Frete", valorTotal: 100 },
  ], transacoes: [{ id: "parcial", seq: 1, tipo: "PAGAMENTO", status: "CONFIRMADA", valorTotal: 100.01, reversaoDeId: null }] };
  findMany.mockResolvedValue([{ ...original, transacao: { ...original.transacao, operacaoId: "op", operacao } }]);
  const resultado = await analisarCategorias({ inicio: "2026-10-01", fim: "2026-10-31", base: "pagamentos", categoriaId: "silagem", centroCustoId: "rebanho" }, 7);
  expect(resultado.total).toBe("50.01");
  expect(resultado.linhas).toEqual([expect.objectContaining({ categoriaId: "silagem", centroCusto: "Rebanho", valor: "50.01", operacaoId: "op" })]);
});
