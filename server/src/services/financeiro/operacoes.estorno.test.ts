import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  periodo: vi.fn(),
  transacaoFindFirst: vi.fn(),
  transacaoCreate: vi.fn(),
  transacaoUpdate: vi.fn(),
  compromissoFindUniqueOrThrow: vi.fn(),
  compromissoFindUnique: vi.fn(),
  compromissoUpdate: vi.fn(),
  compromissoUpdateMany: vi.fn(),
  liquidacaoCreate: vi.fn(),
  operacaoFindFirst: vi.fn(),
  operacaoFindFirstDireto: vi.fn(),
  operacaoUpdate: vi.fn(),
  movimentoEstoqueCreate: vi.fn(),
  movimentoEstoqueUpdate: vi.fn(),
  auditoriaCreate: vi.fn(),
  contaFindFirst: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("../../db.js", () => {
  const tx = {
    periodoFinanceiro: { findUnique: mocks.periodo },
    transacaoFinanceira: { findFirst: mocks.transacaoFindFirst, create: mocks.transacaoCreate, update: mocks.transacaoUpdate },
    compromissoFinanceiro: { findUniqueOrThrow: mocks.compromissoFindUniqueOrThrow, findUnique: mocks.compromissoFindUnique, update: mocks.compromissoUpdate, updateMany: mocks.compromissoUpdateMany },
    liquidacao: { create: mocks.liquidacaoCreate },
    operacao: { findFirst: mocks.operacaoFindFirst, update: mocks.operacaoUpdate },
    movimentoEstoque: { create: mocks.movimentoEstoqueCreate, update: mocks.movimentoEstoqueUpdate },
    auditoriaFinanceira: { create: mocks.auditoriaCreate },
    contaFinanceira: { findFirst: mocks.contaFindFirst },
    $queryRaw: mocks.queryRaw,
  };
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  return { prisma: { $transaction: mocks.transaction, operacao: { findFirst: mocks.operacaoFindFirstDireto } } };
});

import { estornarOperacao, estornarTransacao, liquidarCompromisso, obterOperacao, simularParcelas } from "./operacoes.js";

const decimal = (valor: Prisma.Decimal.Value) => new Prisma.Decimal(valor);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryRaw.mockResolvedValue([{ id: 5 }]); // bloqueio FOR NO KEY UPDATE encontra a linha
  mocks.periodo.mockResolvedValue(null); // sem PeriodoFinanceiro cadastrado = mês aberto
  mocks.transacaoCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 900, ...data, movimentos: [] }));
  mocks.transacaoUpdate.mockResolvedValue({});
  mocks.compromissoUpdate.mockResolvedValue({});
  mocks.compromissoUpdateMany.mockResolvedValue({ count: 0 });
  mocks.auditoriaCreate.mockResolvedValue({});
  mocks.operacaoUpdate.mockResolvedValue({ id: 1, status: "CANCELADA" });
});

describe("estornarTransacao", () => {
  it("preserva a Liquidacao, cria a REVERSAO com movimentos inversos e recalcula o compromisso para PARCIAL", async () => {
    mocks.transacaoFindFirst.mockResolvedValue({
      id: 10, status: "CONFIRMADA", propriedadeId: 1, operacaoId: 5, parceiroId: null, valorTotal: decimal("60.00"), revertidaPor: null,
      movimentos: [{ contaId: 3, direcao: "SAIDA", valor: decimal("60.00") }],
      liquidacoes: [{ id: 1, compromissoId: 77, valor: decimal("60.00") }],
    });
    mocks.compromissoFindUniqueOrThrow.mockResolvedValue({
      id: 77, status: "PARCIAL", valorOriginal: decimal("100.00"),
      liquidacoes: [{ valor: decimal("60.00"), transacao: { status: "REVERTIDA" } }],
    });

    await estornarTransacao(10, "Pagamento em duplicidade", { propriedadeId: 1, usuarioId: 1 });

    // Nunca apaga a liquidação original — só cria o evento inverso.
    expect(mocks.transacaoCreate).toHaveBeenCalledTimes(1);
    const [{ data: dadosEstorno }] = mocks.transacaoCreate.mock.calls[0];
    expect(dadosEstorno.tipo).toBe("REVERSAO");
    expect(dadosEstorno.reversaoDeId).toBe(10);
    expect(dadosEstorno.movimentos.create).toEqual([{ contaId: 3, direcao: "ENTRADA", valor: decimal("60.00") }]);
    expect(mocks.transacaoUpdate).toHaveBeenCalledWith({ where: { id: 10 }, data: { status: "REVERTIDA" } });
    // Sem liquidação CONFIRMADA restante → volta para PENDENTE, nunca some do compromisso.
    expect(mocks.compromissoUpdate).toHaveBeenCalledWith({ where: { id: 77 }, data: { status: "PENDENTE" } });
    expect(mocks.auditoriaCreate).toHaveBeenCalledTimes(1);
  });

  it("não reabre um compromisso já CANCELADO ao estornar a liquidação dele", async () => {
    mocks.transacaoFindFirst.mockResolvedValue({
      id: 11, status: "CONFIRMADA", propriedadeId: 1, operacaoId: 5, parceiroId: null, valorTotal: decimal("60.00"), revertidaPor: null,
      movimentos: [{ contaId: 3, direcao: "SAIDA", valor: decimal("60.00") }],
      liquidacoes: [{ id: 2, compromissoId: 88, valor: decimal("60.00") }],
    });
    mocks.compromissoFindUniqueOrThrow.mockResolvedValue({
      id: 88, status: "CANCELADO", valorOriginal: decimal("60.00"),
      liquidacoes: [{ valor: decimal("60.00"), transacao: { status: "REVERTIDA" } }],
    });

    await estornarTransacao(11, "Estorno após cancelamento", { propriedadeId: 1, usuarioId: 1 });
    expect(mocks.compromissoUpdate).not.toHaveBeenCalled();
  });

  it("recusa estornar uma transação que já foi revertida", async () => {
    mocks.transacaoFindFirst.mockResolvedValue({ id: 12, status: "REVERTIDA", propriedadeId: 1, revertidaPor: null, movimentos: [], liquidacoes: [] });
    await expect(estornarTransacao(12, "Duplo estorno", { propriedadeId: 1, usuarioId: 1 })).rejects.toMatchObject({ code: "JA_REVERTIDO" });
    expect(mocks.transacaoCreate).not.toHaveBeenCalled();
  });

  it("uma nova liquidação após o estorno pode usar o saldo integral (a estornada não conta mais)", async () => {
    mocks.compromissoFindUnique.mockResolvedValue({
      id: 77, operacaoId: 5, tipo: "PAGAR", parceiroId: null, status: "PENDENTE", valorOriginal: decimal("100.00"),
      operacao: { propriedadeId: 1 },
      // a liquidação antiga aponta para a transação REVERTIDA — não deve contar no cálculo do restante.
      liquidacoes: [{ id: 1, valor: decimal("60.00"), transacao: { status: "REVERTIDA" } }],
    });
    mocks.contaFindFirst.mockResolvedValue({ id: 3, ativo: true });

    await liquidarCompromisso(77, { valor: decimal("100.00"), data: new Date("2026-09-20T00:00:00Z"), contaId: 3, usuarioId: 1 } as never);

    expect(mocks.compromissoUpdate).toHaveBeenCalledWith({ where: { id: 77 }, data: { status: "LIQUIDADO" } });
  });
});

describe("estornarOperacao", () => {
  const operacaoBase = {
    id: 5, propriedadeId: 1, status: "CONFIRMADA",
    transacoes: [{ id: 10, status: "CONFIRMADA", tipo: "PAGAMENTO" }],
    compromissos: [{ id: 78, status: "PENDENTE" }],
    movimentosEstoque: [{ id: 30, status: "CONFIRMADO", tipo: "ENTRADA", produtoId: 4, quantidade: decimal("10"), custoUnitario: decimal("5"), valorTotal: decimal("50"), propriedadeId: 1, reversaoDeId: null, revertidoPor: null }],
  };

  it("com parcela paga: estorna a transação, reverte o estoque e cancela os compromissos pendentes numa única transação", async () => {
    mocks.operacaoFindFirst.mockResolvedValue(operacaoBase);
    mocks.transacaoFindFirst.mockResolvedValue({
      id: 10, status: "CONFIRMADA", propriedadeId: 1, operacaoId: 5, parceiroId: null, valorTotal: decimal("50"), revertidaPor: null,
      movimentos: [{ contaId: 3, direcao: "SAIDA", valor: decimal("50") }], liquidacoes: [],
    });
    mocks.movimentoEstoqueCreate.mockResolvedValue({});
    mocks.movimentoEstoqueUpdate.mockResolvedValue({});

    await estornarOperacao(5, "Compra cancelada pelo fornecedor", { propriedadeId: 1, usuarioId: 1 });

    expect(mocks.transacaoCreate).toHaveBeenCalledTimes(1); // reversão da transação
    expect(mocks.movimentoEstoqueCreate).toHaveBeenCalledTimes(1);
    expect(mocks.movimentoEstoqueCreate.mock.calls[0][0].data.tipo).toBe("SAIDA"); // inverte a ENTRADA original
    expect(mocks.movimentoEstoqueUpdate).toHaveBeenCalledWith({ where: { id: 30 }, data: { status: "REVERTIDO" } });
    expect(mocks.compromissoUpdateMany).toHaveBeenCalledWith({ where: { operacaoId: 5, status: { not: "CANCELADO" } }, data: { status: "CANCELADO" } });
    expect(mocks.operacaoUpdate).toHaveBeenCalledWith({ where: { id: 5 }, data: { status: "CANCELADA" } });
  });

  it("recusa cancelar uma operação já cancelada", async () => {
    mocks.operacaoFindFirst.mockResolvedValue({ ...operacaoBase, status: "CANCELADA" });
    await expect(estornarOperacao(5, "Motivo qualquer", { propriedadeId: 1, usuarioId: 1 })).rejects.toMatchObject({ code: "JA_REVERTIDO" });
    expect(mocks.operacaoUpdate).not.toHaveBeenCalled();
  });

  it("propaga a falha de uma reversão sem cancelar a operação (atomicidade)", async () => {
    mocks.operacaoFindFirst.mockResolvedValue(operacaoBase);
    mocks.transacaoFindFirst.mockResolvedValue({
      id: 10, status: "CONFIRMADA", propriedadeId: 1, operacaoId: 5, parceiroId: null, valorTotal: decimal("50"), revertidaPor: null,
      movimentos: [{ contaId: 3, direcao: "SAIDA", valor: decimal("50") }], liquidacoes: [],
    });
    mocks.transacaoCreate.mockRejectedValueOnce(new Error("conexão perdida"));

    await expect(estornarOperacao(5, "Compra cancelada", { propriedadeId: 1, usuarioId: 1 })).rejects.toThrow("conexão perdida");
    expect(mocks.movimentoEstoqueCreate).not.toHaveBeenCalled();
    expect(mocks.compromissoUpdateMany).not.toHaveBeenCalled();
    expect(mocks.operacaoUpdate).not.toHaveBeenCalled();
  });
});

describe("simularParcelas", () => {
  it("em liquidação parcial, divide só o saldo restante depois do valor pago agora", () => {
    const resultado = simularParcelas({ itens: [], valorTotal: 300, valorPagoAgora: 100, quantidadeParcelas: 2, frequencia: "MENSAL", primeiroVencimento: "2026-10-01" });
    expect(resultado.saldoAPrazo.toString()).toBe("200");
    expect(resultado.parcelas.map((p) => p.valor.toString())).toEqual(["100", "100"]);
  });

  it("recusa quando o valor pago agora consome o total (saldo a prazo zero)", () => {
    expect(() => simularParcelas({ itens: [], valorTotal: 100, valorPagoAgora: 100, quantidadeParcelas: 1, frequencia: "MENSAL", primeiroVencimento: "2026-10-01" }))
      .toThrow(expect.objectContaining({ code: "VALIDACAO", campo: "valorPagoAgora" }));
  });
});

describe("resumoCancelamento (via obterOperacao)", () => {
  it("usa a unidade e o nome reais do produto, não um literal fixo", async () => {
    mocks.operacaoFindFirstDireto.mockResolvedValue({
      id: 9, propriedadeId: 1, parceiro: null, itens: [],
      compromissos: [],
      transacoes: [{ id: 40, tipo: "PAGAMENTO", status: "CONFIRMADA", data: new Date("2026-09-10"), valorTotal: decimal("50"), tipoRevertida: null, revertidaPor: null, movimentos: [] }],
      movimentosEstoque: [{ id: 31, status: "CONFIRMADO", tipo: "ENTRADA", produtoId: 4, quantidade: decimal("10"), reversaoDeId: null, revertidoPor: null, produto: { id: 4, nome: "Ração bovina", unidade: "KG" } }],
      documentos: [],
    });

    const operacao = await obterOperacao(9);

    expect(operacao.resumoCancelamento.estoque).toEqual([{ id: 31, produtoId: 4, produtoNome: "Ração bovina", quantidade: decimal("10"), unidade: "kg", tipo: "ENTRADA" }]);
  });
});
