import { describe, expect, it } from "vitest";
import { EfeitosOperacaoError, preverEfeitosOperacao } from "./financeiro.ponte.calc.js";
import { operacaoSchema } from "./financeiro.schemas.js";

function base(overrides: Record<string, unknown>) {
  return operacaoSchema.parse({
    tipo: "SERVICO", data: "2026-09-08", descricao: "Teste", financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
    ...overrides,
  });
}

describe("preverEfeitosOperacao", () => {
  it("compra à vista: gera item estocável, movimento de estoque ENTRADA/COMPRA e transação PAGAMENTO", () => {
    const input = base({
      tipo: "COMPRA_ESTOQUE", parceiroId: 8,
      itens: [{ produtoId: 1, descricao: "Ração", quantidade: 10, unidade: "sc", valorUnitario: 50, estocavel: true }],
      financeiro: { condicao: "A_VISTA", contaId: 3, formaPagamento: "PIX" },
    });
    const previsto = preverEfeitosOperacao(input);
    expect(previsto.valorTotal).toBe(500);
    expect(previsto.temEfeitoEstoque).toBe(true);
    expect(previsto.movimentosEstoque).toEqual([{ produtoId: 1, tipo: "ENTRADA", origem: "COMPRA", quantidade: 10, custoUnitario: 50, valorTotal: 500 }]);
    expect(previsto.compromissos).toEqual([]);
    expect(previsto.transacao).toEqual({ tipo: "PAGAMENTO", direcao: "SAIDA", valorTotal: 500, contaId: 3, formaPagamento: "PIX" });
  });

  it("serviço a prazo em 2 parcelas: sem estoque, cria 2 compromissos PAGAR, sem transação", () => {
    const input = base({
      tipo: "SERVICO", parceiroId: 7, valorTotal: 1000,
      financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 600, dataVencimento: "2026-10-01" }, { valor: 400, dataVencimento: "2026-11-01" }] },
    });
    const previsto = preverEfeitosOperacao(input);
    expect(previsto.temEfeitoEstoque).toBe(false);
    expect(previsto.transacao).toBeNull();
    expect(previsto.compromissos).toHaveLength(2);
    expect(previsto.compromissos[0]).toMatchObject({ tipo: "PAGAR", valorOriginal: 600, numeroParcela: 1, totalParcelas: 2 });
    expect(previsto.compromissos[1]).toMatchObject({ tipo: "PAGAR", valorOriginal: 400, numeroParcela: 2, totalParcelas: 2 });
  });

  it("venda parcial: retira estoque, cria transação RECEBIMENTO pelo valor pago e 1 compromisso RECEBER pelo saldo", () => {
    const input = base({
      tipo: "VENDA", parceiroId: 9,
      itens: [{ produtoId: 2, descricao: "Bezerro", quantidade: 1, unidade: "un", valorUnitario: 1000, estocavel: true }],
      financeiro: { condicao: "PARCIAL", contaId: 4, valorPago: 400, parcelas: [{ valor: 600, dataVencimento: "2026-10-01" }] },
    });
    const previsto = preverEfeitosOperacao(input);
    expect(previsto.movimentosEstoque).toEqual([{ produtoId: 2, tipo: "SAIDA", origem: "AJUSTE_INVENTARIO", quantidade: 1, custoUnitario: 1000, valorTotal: 1000 }]);
    expect(previsto.transacao).toEqual({ tipo: "RECEBIMENTO", direcao: "ENTRADA", valorTotal: 400, contaId: 4, formaPagamento: undefined });
    expect(previsto.compromissos).toEqual([{ tipo: "RECEBER", valorOriginal: 600, dataVencimento: previsto.compromissos[0].dataVencimento, numeroParcela: 1, totalParcelas: 1 }]);
  });

  it("ajuste de estoque: gera movimento AJUSTE sem nenhum efeito financeiro", () => {
    const input = base({
      tipo: "AJUSTE_ESTOQUE",
      itens: [{ produtoId: 5, descricao: "Correção de contagem", quantidade: 3, unidade: "sc", valorUnitario: 20, estocavel: true }],
    });
    const previsto = preverEfeitosOperacao(input);
    expect(previsto.movimentosEstoque).toEqual([{ produtoId: 5, tipo: "AJUSTE", origem: "AJUSTE_INVENTARIO", quantidade: 3, custoUnitario: 20, valorTotal: 60 }]);
    expect(previsto.transacao).toBeNull();
    expect(previsto.compromissos).toEqual([]);
  });

  it("transferência de estoque não gera movimento (mesmo comportamento do server hoje — gap documentado, não corrigido aqui)", () => {
    const input = base({
      tipo: "TRANSFERENCIA_ESTOQUE",
      itens: [{ produtoId: 1, descricao: "Transferência", quantidade: 1, unidade: "sc", valorUnitario: 10, estocavel: true }],
    });
    expect(preverEfeitosOperacao(input).temEfeitoEstoque).toBe(false);
  });

  it("rejeita quando a soma das parcelas não bate com o total (A_PRAZO)", () => {
    const input = base({
      tipo: "SERVICO", parceiroId: 1, valorTotal: 1000,
      financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 500, dataVencimento: "2026-10-01" }] },
    });
    expect(() => preverEfeitosOperacao(input)).toThrow(EfeitosOperacaoError);
  });

  it("rejeita valorTotal informado que diverge da soma dos itens", () => {
    const input = base({
      tipo: "COMPRA_CONSUMO_DIRETO", parceiroId: 1, valorTotal: 999,
      itens: [{ descricao: "Item", quantidade: 1, unidade: "un", valorUnitario: 500, estocavel: false }],
      financeiro: { condicao: "A_VISTA", contaId: 1 },
    });
    expect(() => preverEfeitosOperacao(input)).toThrow(EfeitosOperacaoError);
  });
});
