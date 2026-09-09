import { describe, expect, it } from "vitest";
import { operacaoSchema, rascunhoOperacaoSchema, tipoDocumentoFinanceiroSchema } from "./schemas.js";

const base = {
  data: "2026-09-02",
  descricao: "Operação de teste",
  parceiroId: 1,
  financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" as const },
};

const item = {
  produtoId: 1,
  descricao: "Ração",
  quantidade: 10,
  unidade: "kg",
  valorUnitario: 5,
  estocavel: true,
};

describe("schema de criação de operação", () => {
  it("aceita serviço com valor total e sem item físico", () => {
    const resultado = operacaoSchema.safeParse({ ...base, tipo: "SERVICO", valorTotal: 500, itens: [] });
    expect(resultado.success).toBe(true);
  });

  it("exige item em operação física", () => {
    const resultado = operacaoSchema.safeParse({ ...base, tipo: "COMPRA_ESTOQUE", itens: [] });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.some((issue) => issue.path[0] === "itens")).toBe(true);
  });

  it("exige parceiro em compra, venda ou serviço", () => {
    const resultado = operacaoSchema.safeParse({ ...base, parceiroId: undefined, tipo: "SERVICO", valorTotal: 500, itens: [] });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.some((issue) => issue.path[0] === "parceiroId")).toBe(true);
  });

  it("impede efeito financeiro em inventário e ajustes físicos", () => {
    const resultado = operacaoSchema.safeParse({ ...base, tipo: "INVENTARIO_INICIAL", itens: [item], financeiro: { condicao: "A_VISTA", contaId: 1 } });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.some((issue) => issue.path.join(".") === "financeiro.condicao")).toBe(true);
  });

  it("aceita parcelas que serão transformadas em compromissos", () => {
    const resultado = operacaoSchema.safeParse({ ...base, tipo: "COMPRA_ESTOQUE", itens: [item], financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 50, dataVencimento: "2026-10-02" }] } });
    expect(resultado.success).toBe(true);
  });
});

describe("documentos financeiros", () => {
  it.each(["NOTA_FISCAL", "BOLETO", "CONTRATO", "RECIBO", "COMPROVANTE", "JUSTIFICATIVA", "OUTRO"])("aceita o tipo %s", (tipo) => {
    expect(tipoDocumentoFinanceiroSchema.safeParse(tipo).success).toBe(true);
  });
});

describe("rascunho de operação", () => {
  it("aceita dados parciais sem aplicar a validação da confirmação", () => {
    expect(rascunhoOperacaoSchema.safeParse({ dados: { formulario: { descricao: "" }, operacao: { tipo: "COMPRA_ESTOQUE" } } }).success).toBe(true);
  });

  it("valida a versão otimista quando informada", () => {
    expect(rascunhoOperacaoSchema.safeParse({ dados: {}, versao: 0 }).success).toBe(false);
    expect(rascunhoOperacaoSchema.safeParse({ dados: {}, versao: 2 }).success).toBe(true);
  });
});
