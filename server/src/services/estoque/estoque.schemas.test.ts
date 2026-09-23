import { describe, it, expect } from "vitest";
import { movimentoSchema, ajusteContagemSchema } from "./estoque.js";

const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

describe("movimentoSchema", () => {
  it("aceita um ajuste válido", () => {
    const r = movimentoSchema.safeParse({ produtoId: 1, tipo: "AJUSTE", data: ontem, quantidade: 1000, custoUnitario: 2.1, observacao: "Ajuste conferido" });
    expect(r.success).toBe(true);
  });
  it("custoUnitario é opcional", () => {
    const r = movimentoSchema.safeParse({ produtoId: 1, tipo: "AJUSTE", data: ontem, quantidade: 300, observacao: "Ajuste conferido" });
    expect(r.success).toBe(true);
  });
  it.each(["ENTRADA", "SAIDA"])("rejeita %s — entradas/saídas nascem de operação financeira ou evento operacional", (tipo) => {
    expect(movimentoSchema.safeParse({ produtoId: 1, tipo, data: ontem, quantidade: 10, observacao: "Ajuste conferido" }).success).toBe(false);
  });
  it("rejeita sem produtoId", () => {
    expect(movimentoSchema.safeParse({ tipo: "AJUSTE", data: ontem, quantidade: 10, observacao: "Ajuste conferido" }).success).toBe(false);
  });
  it("rejeita quantidade zero", () => {
    expect(movimentoSchema.safeParse({ produtoId: 1, tipo: "AJUSTE", data: ontem, quantidade: 0, observacao: "Ajuste conferido" }).success).toBe(false);
  });
  it("aceita AJUSTE com quantidade negativa (correção de saldo)", () => {
    expect(movimentoSchema.safeParse({ produtoId: 1, tipo: "AJUSTE", data: ontem, quantidade: -5, observacao: "Contagem física corrigida" }).success).toBe(true);
  });
  it("rejeita data futura", () => {
    expect(movimentoSchema.safeParse({ produtoId: 1, tipo: "AJUSTE", data: amanha, quantidade: 10, observacao: "Ajuste conferido" }).success).toBe(false);
  });
  it("rejeita tipo inválido", () => {
    expect(movimentoSchema.safeParse({ produtoId: 1, tipo: "DEVOLUCAO", data: ontem, quantidade: 10, observacao: "Ajuste conferido" }).success).toBe(false);
  });
  it("rejeita ajuste sem justificativa", () => {
    expect(movimentoSchema.safeParse({ produtoId: 1, tipo: "AJUSTE", data: ontem, quantidade: 10 }).success).toBe(false);
  });
});

describe("ajusteContagemSchema", () => {
  const base = { produtoId: 1, saldoEsperado: 10, quantidadeContada: 0, observacao: "Contagem física" };
  it("aceita contagem zero", () => expect(ajusteContagemSchema.safeParse(base).success).toBe(true));
  it.each([-1, 1.0005, Infinity, NaN])("rejeita contagem inválida %s", quantidadeContada => expect(ajusteContagemSchema.safeParse({ ...base, quantidadeContada }).success).toBe(false));
  it("exige justificativa real", () => expect(ajusteContagemSchema.safeParse({ ...base, observacao: "     " }).success).toBe(false));

  it("aceita quantidadeContada/saldoEsperado com 3 casas decimais (Decimal(12,3))", () => {
    expect(ajusteContagemSchema.safeParse({ ...base, quantidadeContada: 1.005, saldoEsperado: 1.005 }).success).toBe(true);
  });
  it("rejeita quantidadeContada com 4 casas decimais", () => {
    expect(ajusteContagemSchema.safeParse({ ...base, quantidadeContada: 1.0005 }).success).toBe(false);
  });
  it("rejeita saldoEsperado com 4 casas decimais", () => {
    expect(ajusteContagemSchema.safeParse({ ...base, saldoEsperado: 1.0005 }).success).toBe(false);
  });
  it("aceita quantidade no limite máximo (999.999.999,999) e rejeita acima", () => {
    expect(ajusteContagemSchema.safeParse({ ...base, quantidadeContada: 999_999_999.999 }).success).toBe(true);
    expect(ajusteContagemSchema.safeParse({ ...base, quantidadeContada: 1_000_000_000 }).success).toBe(false);
  });
});
