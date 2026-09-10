import { describe, expect, it } from "vitest";
import {
  operacaoSchema,
} from "./index.js";

const uuid = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

describe("contratos offline-first compartilhados", () => {
  it("preserva as identidades do agregado financeiro", () => {
    const input = {
      id: uuid("1"),
      registradoEm: "2026-09-10T12:00:00.000Z",
      tipo: "COMPRA_ESTOQUE" as const,
      data: "2026-09-10",
      descricao: "Compra de ração",
      parceiroId: uuid("2"),
      itens: [{
        id: uuid("3"),
        produtoId: 5,
        ordem: 0,
        descricao: "Ração",
        quantidade: 10,
        unidade: "kg",
        valorUnitario: 2,
        estocavel: true,
      }],
      financeiro: {
        condicao: "A_PRAZO" as const,
        parcelas: [{ id: uuid("6"), numeroParcela: 1, valor: 20, dataVencimento: "2026-10-10" }],
      },
    };

    const parsed = operacaoSchema.parse(input);
    expect(parsed.id).toBe(input.id);
    expect(parsed.itens[0].id).toBe(input.itens[0].id);
    expect(parsed.financeiro.condicao === "A_PRAZO" && parsed.financeiro.parcelas[0].id).toBe(input.financeiro.parcelas[0].id);
  });
});
