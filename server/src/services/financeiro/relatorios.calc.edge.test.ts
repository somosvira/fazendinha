import { describe, expect, it, vi } from "vitest";

// Exercita o Decimal real do bundle do Worker; o Node também expõe round().
vi.mock("@prisma/client", async (importOriginal) => {
  const client = await importOriginal<typeof import("@prisma/client")>();
  const { Decimal } = await import("@prisma/client/runtime/wasm-compiler-edge");
  return { ...client, Prisma: { ...client.Prisma, Decimal } };
});

import { comporItens, type OperacaoComposicao } from "./relatorios.calc.js";

function compra(id: number, valor: string, categoria: string, centro: string): OperacaoComposicao {
  return {
    id, data: new Date("2026-09-01T00:00:00Z"), tipo: "COMPRA_CONSUMO_DIRETO", status: "CONFIRMADA",
    descricao: "Compra", valorTotal: valor, centroCustoId: id, centroCusto: { nome: centro }, parceiro: null,
    categoriaId: id, categoriaNome: categoria, classificacao: "CUSTEIO", itens: [],
  };
}

describe("composição do relatório no runtime do Worker", () => {
  it("calcula percentuais por categoria e centro com arredondamento a duas casas", () => {
    const { despesas } = comporItens([
      compra(1, "1.00", "Ração", "Pecuária"),
      compra(2, "5.00", "Adubo", "Agronomia"),
    ]);

    expect(despesas.total).toBe("6.00");
    expect(despesas.porCategoria.map(({ nome, pct }) => ({ nome, pct }))).toEqual([
      { nome: "Adubo", pct: 83.33 }, { nome: "Ração", pct: 16.67 },
    ]);
    expect(despesas.porCentro.map(({ nome, pct }) => ({ nome, pct }))).toEqual([
      { nome: "Agronomia", pct: 83.33 }, { nome: "Pecuária", pct: 16.67 },
    ]);
  });

  it("retorna percentuais zero quando o total das despesas é zero", () => {
    const { despesas } = comporItens([compra(1, "0.00", "Ração", "Pecuária")]);

    expect(despesas.porCategoria[0].pct).toBe(0);
    expect(despesas.porCentro[0].pct).toBe(0);
  });
});
