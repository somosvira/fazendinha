import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => {
  const tx = {
    contaFinanceira: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    movimentoConta: { findMany: vi.fn(), deleteMany: vi.fn() },
    parceiro: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    operacao: { updateMany: vi.fn() },
    compromissoFinanceiro: { updateMany: vi.fn() },
    transacaoFinanceira: { updateMany: vi.fn() },
    auditoriaFinanceira: { create: vi.fn() },
  };
  return { tx, transaction: vi.fn() };
});

vi.mock("../../db.js", () => ({ prisma: { $transaction: banco.transaction } }));

import { atualizarConta, criarConta } from "./contas.js";
import { atualizarParceiro, criarParceiro } from "./parceiros.js";

const agora = new Date("2026-09-01T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  banco.transaction.mockImplementation(async (executar: (tx: typeof banco.tx) => unknown) => executar(banco.tx));
  banco.tx.auditoriaFinanceira.create.mockResolvedValue({ id: 1 });
});

describe("persistência dos cadastros financeiros", () => {
  it("cria conta e parceiro ativos por contrato e registra a auditoria", async () => {
    const conta = { id: 1, nome: "Conta nova", tipo: "CAIXA", instituicao: null, identificacao: null, saldoAbertura: new Prisma.Decimal(50), dataSaldoAbertura: agora, incluirNoSaldoGeral: true, ativo: true, propriedadeId: 7, createdAt: agora, updatedAt: agora };
    const parceiro = { id: 2, nome: "Cliente novo", documento: null, tipo: "CLIENTE", telefone: null, email: null, ativo: true, createdAt: agora, updatedAt: agora };
    banco.tx.contaFinanceira.create.mockResolvedValue(conta);
    banco.tx.parceiro.create.mockResolvedValue(parceiro);

    const contaCriada = await criarConta({ nome: conta.nome, tipo: "CAIXA", saldoAbertura: 50, dataSaldoAbertura: agora, incluirNoSaldoGeral: true, ativo: true, propriedadeId: 7 });
    const parceiroCriado = await criarParceiro({ nome: parceiro.nome, tipo: "CLIENTE", ativo: true });

    expect(contaCriada.saldoAtual.equals(50)).toBe(true);
    expect(parceiroCriado).toBe(parceiro);
    expect(banco.tx.auditoriaFinanceira.create).toHaveBeenCalledTimes(2);
  });

  it("desativa a conta sem tocar movimentos e mantém o saldo derivado", async () => {
    const anterior = { id: 1, nome: "Conta", saldoAbertura: new Prisma.Decimal(100), ativo: true, propriedadeId: 7 };
    const atualizada = { ...anterior, ativo: false };
    banco.tx.contaFinanceira.findFirst.mockResolvedValue(anterior);
    banco.tx.contaFinanceira.update.mockResolvedValue(atualizada);
    banco.tx.movimentoConta.findMany.mockResolvedValue([
      { direcao: "ENTRADA", valor: new Prisma.Decimal(25) },
      { direcao: "SAIDA", valor: new Prisma.Decimal(10) },
    ]);

    const resultado = await atualizarConta(1, 7, { ativo: false }, 9);

    expect(banco.tx.contaFinanceira.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { ativo: false } });
    expect(resultado.saldoAtual.equals(115)).toBe(true);
    expect(banco.tx.movimentoConta.deleteMany).not.toHaveBeenCalled();
    expect(banco.tx.auditoriaFinanceira.create).toHaveBeenCalledWith({ data: expect.objectContaining({ entidade: "ContaFinanceira", entidadeId: "1", acao: "DESATIVADA", usuarioId: 9 }) });
  });

  it("desativa e reativa parceiro sem alterar nenhuma relação histórica", async () => {
    banco.tx.parceiro.findUnique.mockResolvedValueOnce({ id: 2, nome: "Parceiro", ativo: true }).mockResolvedValueOnce({ id: 2, nome: "Parceiro", ativo: false });
    banco.tx.parceiro.update.mockResolvedValueOnce({ id: 2, nome: "Parceiro", ativo: false }).mockResolvedValueOnce({ id: 2, nome: "Parceiro", ativo: true });

    await atualizarParceiro(2, { ativo: false }, 9);
    await atualizarParceiro(2, { ativo: true }, 9);

    expect(banco.tx.parceiro.delete).not.toHaveBeenCalled();
    expect(banco.tx.operacao.updateMany).not.toHaveBeenCalled();
    expect(banco.tx.compromissoFinanceiro.updateMany).not.toHaveBeenCalled();
    expect(banco.tx.transacaoFinanceira.updateMany).not.toHaveBeenCalled();
    expect(banco.tx.auditoriaFinanceira.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ acao: "DESATIVADO" }) });
    expect(banco.tx.auditoriaFinanceira.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ acao: "REATIVADO" }) });
  });
});
