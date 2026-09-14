import { describe, expect, it, vi } from "vitest";
import { contaSchema, patchContaSchema, parceiroSchema, patchParceiroSchema } from "./schemas.js";
import { papelCompativel, papeisLegados, tipoLegado } from "./papeis.js";
import { exigirParceiroAtivo } from "./regras.js";

describe("cadastros financeiros ampliados", () => {
  const conta = { nome: "Caixa", tipo: "CAIXA", saldoAbertura: 0, dataSaldoAbertura: "2026-09-11" };
  it("aceita saldo zero, recusa o tipo legado e mantém dinheiro como forma de pagamento", () => {
    expect(contaSchema.safeParse({ ...conta, tipo: "DINHEIRO" }).success).toBe(false);
    expect(contaSchema.parse(conta).saldoAbertura).toBe(0);
    expect(parceiroSchema.parse({ nome: "Maria", papeis: ["CLIENTE"], formaPagamentoPreferida: "DINHEIRO" }).formaPagamentoPreferida).toBe("DINHEIRO");
  });
  it.each([undefined, null, "", " ", false])("recusa abertura ausente ou inválida: %s", (valor) => {
    expect(contaSchema.safeParse({ ...conta, saldoAbertura: valor }).success).toBe(false);
    expect(contaSchema.safeParse({ ...conta, dataSaldoAbertura: valor }).success).toBe(false);
    if (valor !== undefined) expect(patchContaSchema.safeParse({ saldoAbertura: valor }).success).toBe(false);
  });
  it("valida dados extras sem tornar endereço ou preferências obrigatórios", () => {
    expect(parceiroSchema.parse({ nome: "Oficina", papeis: ["PRESTADOR_SERVICO"] }).papeis).toEqual(["PRESTADOR_SERVICO"]);
    expect(patchParceiroSchema.parse({ cep: "37000-000", uf: "mg" })).toEqual({ cep: "37000000", uf: "MG" });
    expect(patchParceiroSchema.safeParse({ uf: "XX" }).success).toBe(false);
    expect(patchParceiroSchema.safeParse({ prazosPagamento: [60, 30] }).success).toBe(false);
    expect(parceiroSchema.safeParse({ nome: "Oficina", papeis: [] }).success).toBe(false);
    expect(parceiroSchema.safeParse({ nome: "Oficina", papeis: ["CLIENTE", "CLIENTE"] }).success).toBe(false);
  });
  it("converte AMBOS e conserva a projeção legada", () => {
    expect(papeisLegados("AMBOS")).toEqual(["CLIENTE", "FORNECEDOR"]);
    expect(tipoLegado(["CLIENTE", "FORNECEDOR", "PRESTADOR_SERVICO"])).toBe("AMBOS");
  });
  it("filtra papéis por operação, não pela preferência de pagamento", () => {
    expect(papelCompativel(["PRESTADOR_SERVICO"], "SERVICO")).toBe(true);
    expect(papelCompativel(["FORNECEDOR"], "SERVICO")).toBe(true);
    expect(papelCompativel(["PRESTADOR_SERVICO"], "COMPRA_ESTOQUE")).toBe(false);
    expect(papelCompativel(["OUTRO"], "VENDA")).toBe(false);
    expect(papelCompativel(["CLIENTE", "FORNECEDOR"], "DEVOLUCAO")).toBe(true);
  });
  it("backend recusa papel incompatível e permite serviço com preferência diferente", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "1", tipo: "FORNECEDOR", ativo: true, papeis: [{ papel: "PRESTADOR_SERVICO" }], formaPagamentoPreferida: "BOLETO" });
    const db = { parceiro: { findFirst } } as unknown as Parameters<typeof exigirParceiroAtivo>[0];
    await expect(exigirParceiroAtivo(db, "1", "VENDA")).rejects.toMatchObject({ code: "VALIDACAO", campo: "parceiroId" });
    await expect(exigirParceiroAtivo(db, "1", "SERVICO")).resolves.toMatchObject({ id: "1" });
  });
});
