import { describe, expect, it } from "vitest";
import { categoriaCadastroSchema, centroCustoSchema, contaSchema, operacaoSchema, parceiroSchema, patchCategoriaCadastroSchema, patchCentroCustoSchema, patchContaSchema, patchParceiroSchema, patchProdutoFinanceiroSchema, produtoFinanceiroSchema, rascunhoOperacaoSchema, tipoDocumentoFinanceiroSchema } from "./schemas.js";

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

describe("schemas de conta e parceiro (cadastros)", () => {
  it("patch de conta não reaplica defaults quando a chave está ausente", () => {
    const r = patchContaSchema.parse({ nome: "Caixa" });
    expect(r).toEqual({ nome: "Caixa" });
    expect("saldoAbertura" in r).toBe(false); expect("incluirNoSaldoGeral" in r).toBe(false);
  });

  it("patch de conta aceita tipo, saldo e data de abertura", () => {
    const r = patchContaSchema.parse({ tipo: "APLICACAO", saldoAbertura: "10.5", dataSaldoAbertura: "2026-01-02" });
    expect(r.tipo).toBe("APLICACAO"); expect(r.saldoAbertura).toBe(10.5); expect(r.dataSaldoAbertura).toBeInstanceOf(Date);
  });

  it("conta: instituição e identificação vazias viram null", () => {
    const r = contaSchema.parse({ nome: "Banco", tipo: "BANCO", saldoAbertura: 0, dataSaldoAbertura: "2026-01-01", instituicao: "  ", identificacao: "" });
    expect(r.instituicao).toBeNull(); expect(r.identificacao).toBeNull();
  });

  it("parceiro: normaliza documento para dígitos e valida tamanho", () => {
    expect(parceiroSchema.parse({ nome: "Zé", tipo: "CLIENTE", documento: "123.456.789-09" }).documento).toBe("12345678909");
    expect(parceiroSchema.parse({ nome: "Zé", tipo: "CLIENTE", documento: "12.345.678/0001-95" }).documento).toBe("12345678000195");
    expect(parceiroSchema.parse({ nome: "Zé", tipo: "CLIENTE", documento: "" }).documento).toBeNull();
    expect(parceiroSchema.parse({ nome: "Zé", tipo: "CLIENTE", documento: "111.111.111-11" }).documento).toBe("11111111111");
    expect(parceiroSchema.safeParse({ nome: "Zé", tipo: "CLIENTE", documento: "1234567890" }).success).toBe(false);
  });

  it("parceiro: e-mail vazio vira null e inválido é rejeitado", () => {
    expect(parceiroSchema.parse({ nome: "Zé", tipo: "CLIENTE", email: "" }).email).toBeNull();
    expect(parceiroSchema.safeParse({ nome: "Zé", tipo: "CLIENTE", email: "x" }).success).toBe(false);
    expect(patchParceiroSchema.parse({ ativo: false })).toEqual({ ativo: false });
  });
});

describe("schemas de categorias e centros de custo", () => {
  it("normaliza os defaults na criação", () => {
    expect(categoriaCadastroSchema.parse({ nome: " Insumos " })).toEqual({ nome: "Insumos", classificacao: null, ordem: 0 });
    expect(centroCustoSchema.parse({ nome: " Leite " })).toEqual({ nome: "Leite", ordem: 0 });
  });

  it("patches não reaplicam defaults ausentes e aceitam desativação", () => {
    expect(patchCategoriaCadastroSchema.parse({ ativo: false })).toEqual({ ativo: false });
    expect(patchCentroCustoSchema.parse({ ativo: false })).toEqual({ ativo: false });
  });

  it("rejeita nomes curtos, ordem negativa", () => {
    expect(categoriaCadastroSchema.safeParse({ nome: "A" }).success).toBe(false);
    expect(centroCustoSchema.safeParse({ nome: "Leite", ordem: -1 }).success).toBe(false);
  });
});

describe("schema financeiro de produto", () => {
  it("aceita produto sem fornecedor e aplica defaults", () => {
    expect(produtoFinanceiroSchema.parse({ nome: " Sal mineral " })).toMatchObject({ nome: "Sal mineral", tipo: "INSUMO", unidade: "un", fornecedorIds: [] });
  });

  it("rejeita fornecedores repetidos e preserva patch parcial", () => {
    expect(produtoFinanceiroSchema.safeParse({ nome: "Ração", fornecedorIds: [7, 7] }).success).toBe(false);
    expect(patchProdutoFinanceiroSchema.parse({ ativo: false })).toEqual({ ativo: false });
  });
});
