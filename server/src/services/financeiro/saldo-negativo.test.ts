import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { conferirSaldoNegativo, SaldoNegativoError } from "./saldo-negativo.js";

const decimal = (valor: number) => new Prisma.Decimal(valor);
function fixture() {
  const conta = { saldoAbertura: decimal(100) };
  const movimentos = [{ direcao: "SAIDA", valor: decimal(30) }, { direcao: "ENTRADA", valor: decimal(10) }];
  const tx = { $executeRaw: vi.fn(), contaFinanceira: { findFirst: vi.fn(async () => conta) }, movimentoConta: { findMany: vi.fn(async () => movimentos) } } as unknown as Prisma.TransactionClient;
  const input = { propriedadeId: 1, contaId: "conta", valor: decimal(90), intencao: { usuarioId: 7, chave: "chave" }, ciencia: { origem: "direta" as const } };
  return { tx, input, movimentos };
}

describe("ciência de saldo negativo", () => {
  it("soma abertura e movimentos, aceita ciência exata e recusa identidade ou saldo alterados", async () => {
    const { tx, input, movimentos } = fixture();
    const aviso = await conferirSaldoNegativo(tx, input).catch(e => e);
    expect(aviso).toBeInstanceOf(SaldoNegativoError);
    expect(aviso.saldoNegativo).toMatchObject({ saldoAtual: "80.00", valorPagamento: "90.00", saldoProjetado: "-10.00" });
    const ciencia = { ...input.ciencia, token: aviso.saldoNegativo.token };
    await expect(conferirSaldoNegativo(tx, { ...input, ciencia })).resolves.toBeUndefined();
    await expect(conferirSaldoNegativo(tx, { ...input, ciencia, intencao: { ...input.intencao, usuarioId: 8 } })).rejects.toMatchObject({ code: "SALDO_NEGATIVO" });
    await expect(conferirSaldoNegativo(tx, { ...input, ciencia: { ...ciencia, origem: "rascunho", rascunho: { id: "r", versao: 2 } } })).rejects.toMatchObject({ code: "SALDO_NEGATIVO" });
    movimentos.push({ direcao: "SAIDA", valor: decimal(1) });
    await expect(conferirSaldoNegativo(tx, { ...input, ciencia })).rejects.toMatchObject({ saldoNegativo: { saldoProjetado: "-11.00" } });
  });
  it("permite projeção zero sem ciência", async () => {
    const { tx, input } = fixture();
    await expect(conferirSaldoNegativo(tx, { ...input, valor: decimal(80) })).resolves.toBeUndefined();
  });
});
