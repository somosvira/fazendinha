import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  periodo: vi.fn(),
  operacaoFindUnique: vi.fn(),
  operacaoFindUniqueOrThrow: vi.fn(),
  operacaoCreate: vi.fn(),
  transacaoFindUnique: vi.fn(),
  transacaoCreate: vi.fn(),
  compromissoFindUnique: vi.fn(),
  compromissoCount: vi.fn(),
  auditoriaCreate: vi.fn(),
}));

vi.mock("../../db.js", () => {
  const db = {
    periodoFinanceiro: { findUnique: mocks.periodo },
    operacao: { findUnique: mocks.operacaoFindUnique, findUniqueOrThrow: mocks.operacaoFindUniqueOrThrow, create: mocks.operacaoCreate },
    transacaoFinanceira: { findUnique: mocks.transacaoFindUnique, create: mocks.transacaoCreate },
    compromissoFinanceiro: { findUnique: mocks.compromissoFindUnique, count: mocks.compromissoCount },
    auditoriaFinanceira: { create: mocks.auditoriaCreate },
  };
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(db));
  return { prisma: { ...db, $transaction: mocks.transaction } };
});

import { criarOperacao, liquidarCompromisso, transferir } from "./operacoes.js";

const data = new Date("2026-09-02T12:00:00Z");
const violacaoPk = () => new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" });
const transacaoGravada = { id: uid(30), tipo: "PAGAMENTO", movimentos: [{ contaId: uid(2), direcao: "SAIDA" }] };
const operacaoInput = {
  id: uid(10), tipo: "SERVICO" as const, data, descricao: "Serviço", valorTotal: 100, parceiroId: uid(1),
  centroCustoId: uid(4), itens: [], financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" as const }, propriedadeId: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.periodo.mockResolvedValue(null);
});

describe("liquidação com id da transação", () => {
  it("reenvio devolve a transação já gravada sem criar nada nem auditar", async () => {
    mocks.transacaoFindUnique.mockResolvedValue({ ...transacaoGravada, liquidacoes: [{ compromissoId: uid(20) }] });
    const r = await liquidarCompromisso(uid(20), { transacaoId: uid(30), contaId: uid(2), valor: 10, data });
    expect(r).toEqual(transacaoGravada);
    expect(mocks.compromissoFindUnique).not.toHaveBeenCalled();
    expect(mocks.transacaoCreate).not.toHaveBeenCalled();
    expect(mocks.auditoriaCreate).not.toHaveBeenCalled();
  });

  it("id de transação de outro compromisso é conflito", async () => {
    mocks.transacaoFindUnique.mockResolvedValue({ ...transacaoGravada, liquidacoes: [{ compromissoId: uid(21) }] });
    await expect(liquidarCompromisso(uid(20), { transacaoId: uid(30), contaId: uid(2), valor: 10, data }))
      .rejects.toMatchObject({ code: "CONFLITO" });
  });

  it("quem perde a corrida na chave primária devolve a transação de quem ganhou", async () => {
    mocks.transacaoFindUnique.mockResolvedValue({ ...transacaoGravada, liquidacoes: [{ compromissoId: uid(20) }] });
    mocks.transaction.mockRejectedValueOnce(violacaoPk());
    const r = await liquidarCompromisso(uid(20), { transacaoId: uid(30), contaId: uid(2), valor: 10, data });
    expect(r).toEqual(transacaoGravada);
  });

  it("sem id, a falha original é propagada sem releitura", async () => {
    mocks.transaction.mockRejectedValueOnce(violacaoPk());
    await expect(liquidarCompromisso(uid(20), { contaId: uid(2), valor: 10, data })).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(mocks.transacaoFindUnique).not.toHaveBeenCalled();
  });
});

describe("operação com id do cliente", () => {
  it("reenvio da mesma operação devolve a gravada sem checar período nem auditar", async () => {
    // Id é global — a mesma operação reenviada de outra propriedade também conta como reenvio.
    mocks.operacaoFindUnique.mockResolvedValue({ id: uid(10), numero: 7, propriedadeId: 2, tipo: "SERVICO" });
    expect(await criarOperacao(operacaoInput)).toEqual({ id: uid(10), numero: 7, propriedadeId: 2, tipo: "SERVICO" });
    expect(mocks.periodo).not.toHaveBeenCalled();
    expect(mocks.operacaoCreate).not.toHaveBeenCalled();
    expect(mocks.auditoriaCreate).not.toHaveBeenCalled();
  });

  it("id de operação de outro tipo é conflito", async () => {
    mocks.operacaoFindUnique.mockResolvedValue({ propriedadeId: 1, tipo: "VENDA" });
    await expect(criarOperacao(operacaoInput)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.operacaoCreate).not.toHaveBeenCalled();
  });

  it("id de parcela já usado por outro compromisso é conflito", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(null);
    mocks.compromissoCount.mockResolvedValue(1);
    await expect(criarOperacao({ ...operacaoInput, financeiro: { condicao: "A_PRAZO", parcelas: [{ id: uid(40), valor: 100, dataVencimento: data }] } }))
      .rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.operacaoCreate).not.toHaveBeenCalled();
  });
});

describe("transferência com id do cliente", () => {
  const entrada = { id: uid(50), contaOrigemId: uid(2), contaDestinoId: uid(3), valor: 10, data, propriedadeId: 1 };

  it("reenvio devolve a transação da transferência gravada", async () => {
    mocks.operacaoFindUnique.mockResolvedValue({ tipo: "TRANSFERENCIA_FINANCEIRA", transacoes: [{ id: uid(51), tipo: "TRANSFERENCIA", movimentos: [] }] });
    expect(await transferir(entrada)).toEqual({ id: uid(51), tipo: "TRANSFERENCIA", movimentos: [] });
    expect(mocks.operacaoFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: uid(50) } }));
    expect(mocks.operacaoCreate).not.toHaveBeenCalled();
  });

  it("id de outra operação é conflito", async () => {
    mocks.operacaoFindUnique.mockResolvedValue({ tipo: "SERVICO" });
    await expect(transferir(entrada)).rejects.toMatchObject({ code: "CONFLITO" });
  });
});
