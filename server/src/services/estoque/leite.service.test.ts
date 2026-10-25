import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { estornarBaixaLeiteTx, valoresMovimentosLeiteTx } from "./leite.js";

vi.mock("../../db.js", () => ({ prisma: {} }));

describe("histórico de custo do leite", () => {
  it("saída estornada conserva a última apropriação própria quando o saldo recebe outra apuração", async () => {
    const tx = { movimentoEstoque: { findMany: vi.fn(async () => [{ id: "saida", quantidade: new Prisma.Decimal(600), reversaoDeId: null,
      entradaProducaoLeite: null, alocacoesLeite: [{ id: "parcela", valorTotal: null, entrada: { apuracoes: [
        { versao: 2, apropriacoes: [] },
        { versao: 1, apropriacoes: [{ alocacaoId: "parcela", valorTotal: new Prisma.Decimal(900) }] },
      ] } }] }]) } };
    const valores = await valoresMovimentosLeiteTx(tx as unknown as Prisma.TransactionClient, ["saida"]);
    expect(valores.get("saida")?.valorTotal?.toFixed(2)).toBe("900.00");
    expect(valores.get("saida")?.custoUnitario?.toFixed(4)).toBe("1.5000");
  });
});


describe("data civil do estorno físico do leite", () => {
  afterEach(() => vi.useRealTimers());
  const preparar = () => {
    const original = { id: "saida", produtoId: "leite", metodoValorizacao: "LEITE_FIFO_V1", tipo: "SAIDA", origem: "NUTRICAO", operacaoId: null,
      reversaoDeId: null, revertidoPor: null, status: "CONFIRMADO", data: new Date("2026-10-23T00:00:00Z"), quantidade: new Prisma.Decimal(3), custoUnitario: null, valorTotal: null };
    const tx = { $executeRaw: vi.fn(async () => 1), movimentoEstoque: {
      findFirst: vi.fn(async () => ({ produtoId: original.produtoId })), findUniqueOrThrow: vi.fn(async () => original),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "inverso", ...data })), update: vi.fn(async () => ({ id: original.id })),
    }, retiradaOperacaoLeite: { findUnique: vi.fn(async () => null) }, periodoFinanceiro: { findUnique: vi.fn(async () => null) }, auditoriaFinanceira: { create: vi.fn() } };
    return { tx, banco: tx as unknown as Prisma.TransactionClient };
  };
  it.each([
    ["2026-10-25T00:30:00Z", "2026-10-24T00:00:00.000Z"],
    ["2026-10-25T03:30:00Z", "2026-10-25T00:00:00.000Z"],
  ])("relógio %s grava o inverso no dia da fazenda %s", async (instante, esperado) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(instante));
    const { tx, banco } = preparar();
    await estornarBaixaLeiteTx(banco, { movimentoId: "saida", propriedadeId: 1, usuarioId: 9, motivo: "Corrigir fornecimento demonstrativo" });
    const inverso = tx.movimentoEstoque.create.mock.calls[0][0].data;
    expect(inverso.data).toEqual(new Date(esperado));
    expect(inverso).toMatchObject({ tipo: "ENTRADA", reversaoDeId: "saida", quantidade: new Prisma.Decimal(3) });
    expect(tx.movimentoEstoque.update).toHaveBeenCalledWith({ where: { id: "saida" }, data: { status: "REVERTIDO" } });
  });
  it("preserva a data operacional explícita recebida do fluxo de origem", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-25T00:30:00Z"));
    const { tx, banco } = preparar(), data = new Date("2026-10-23T00:00:00Z");
    await estornarBaixaLeiteTx(banco, { movimentoId: "saida", propriedadeId: 1, usuarioId: 9, motivo: "Estorno na data operacional informada", data });
    expect(tx.movimentoEstoque.create.mock.calls[0][0].data.data).toBe(data);
  });
});
