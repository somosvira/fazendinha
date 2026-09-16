import { describe, expect, it, vi } from "vitest";

// Usa a implementação real selecionada pelo Prisma no bundle do Worker.
// O Decimal do Node possui métodos extras e não reproduz esse erro.
vi.mock("@prisma/client", async (importOriginal) => {
  const client = await importOriginal<typeof import("@prisma/client")>();
  const { Decimal } = await import("@prisma/client/runtime/wasm-compiler-edge");
  return { ...client, Prisma: { ...client.Prisma, Decimal } };
});

import { Prisma } from "@prisma/client";
import { classificarFluxo, ratearCategorias, ratearCompromissos } from "./classificacao.js";

describe("classificação no runtime do Worker", () => {
  const operacao = {
    valorTotal: new Prisma.Decimal("0.03"),
    itens: [
      { id: 1, categoriaId: 1, categoriaNome: "Custeio", valorTotal: new Prisma.Decimal("0.01") },
      { id: 2, categoriaId: 2, categoriaNome: "Investimento", valorTotal: new Prisma.Decimal("0.02") },
    ],
    transacoes: [
      { id: 1, tipo: "PAGAMENTO", valorTotal: new Prisma.Decimal("0.01"), reversaoDeId: null, status: "CONFIRMADA" },
    ],
  };

  it("rateia centavos sem os atalhos round/floor disponíveis apenas no Node", () => {
    expect(ratearCategorias(operacao, "0.01").map(p => p.valor.toFixed(2))).toEqual(["0.00", "0.01"]);
    expect(ratearCategorias(operacao, "-0.01").map(p => p.valor.toFixed(2))).toEqual(["0.00", "-0.01"]);
    expect(ratearCategorias(null, "1.235")[0].valor.toFixed(2)).toBe("1.24");
  });

  it("conserva o saldo por categoria após pagamento parcial e estorno", () => {
    expect(classificarFluxo(operacao).saldo.map(p => p.valor.toFixed(2))).toEqual(["0.01", "0.01"]);
    const compromissos = [{ id: 1, status: "PARCIAL", valorOriginal: new Prisma.Decimal("0.03"), liquidacoes: [{ transacaoId: 1, valor: new Prisma.Decimal("0.01") }] }];
    expect(ratearCompromissos({ ...operacao, compromissos }).get(1)!.map(p => p.valor.toFixed(2))).toEqual(["0.01", "0.01"]);
    const estornada = { ...operacao, transacoes: [...operacao.transacoes, { id: 2, tipo: "REVERSAO", valorTotal: new Prisma.Decimal("0.01"), reversaoDeId: 1, status: "CONFIRMADA" }] };
    expect(classificarFluxo(estornada).saldo.map(p => p.valor.toFixed(2))).toEqual(["0.01", "0.02"]);
  });
});
