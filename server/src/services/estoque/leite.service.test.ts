import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { valoresMovimentosLeiteTx } from "./leite.js";

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
