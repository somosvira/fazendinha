import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { mascararDto, valoresConta, valoresOperacao, valoresTransacao } from "./visibilidade.js";
const v = () => new Prisma.Decimal("987.65");
const transacao = () => ({ id: "tx", valorTotal: v(), movimentos: [{ id: "mc", valor: v(), contaId: "conta" }] });
const compromisso = () => ({ id: "c", valorOriginal: v(), valorLiquidado: v(), saldoPendente: v(), saldoExigivel: v(), totalParcelas: 7,
  liquidacoes: [{ valor: v(), transacao: transacao() }], operacao: { valorTotal: v(), numero: 8 } });
export const operacaoVisibilidade = (tipo = "COMPRA_ESTOQUE") => ({ id: "op", tipo, valorTotal: v(), numero: 42,
  itens: [{ id: "item", quantidade: "3.500", valorUnitario: v(), valorTotal: v(), valorProdutoAtribuido: v(), valorServicoAtribuido: v(), ordem: 1 }],
  compromissos: [compromisso()], transacoes: [transacao()],
  movimentosEstoque: [{ id: "mov", quantidade: "3.500", origem: "COMPRA", custoUnitario: v(), valorTotal: v(), valorTotalMovimento: v() }],
  perdas: [{ quantidade: "3.500", custoUnitario: v(), valorTotal: v() }], transferencias: [{ quantidade: "3.500", custoUnitario: v(), valorTotal: v() }], procedimentosServico: [{ valor: v(), animalId: "animal" }],
  resumoCancelamento: { compromissos: [compromisso()], transacoes: [transacao()], impactosPorConta: [{ entrada: v(), saida: v(), conta: { id: "conta" } }], documentosPreservados: 2, estoque: [{ quantidade: "3.500" }] },
});
describe("contratos de visibilidade financeira", () => {
  it.each(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "APORTE", "RETIRADA", "TRANSFERENCIA_FINANCEIRA", "TRANSFERENCIA_ESTOQUE", "AJUSTE_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO"])("mascara todos os ramos monetários de %s sem perder fatos", tipo => {
    const original = operacaoVisibilidade(tipo);
    const r = mascararDto(original, valoresOperacao);
    expect(JSON.stringify(r)).not.toContain("987.65");
    expect(r).toMatchObject({ id: "op", numero: 42, tipo, valorTotal: null, itens: [{ quantidade: "3.500", ordem: 1 }], compromissos: [{ totalParcelas: 7 }], resumoCancelamento: { documentosPreservados: 2, estoque: [{ quantidade: "3.500" }] } });
    expect(original.valorTotal.toFixed(2)).toBe("987.65");
  });
  it("contas e transações usam contratos próprios e não mascaram nomes arbitrários", () => {
    const conta = mascararDto({ saldoAtual: v(), saldoAbertura: v(), total: 3, saldoFisico: "12", nome: "Conta" }, valoresConta);
    expect(conta).toEqual({ saldoAtual: null, saldoAbertura: null, total: 3, saldoFisico: "12", nome: "Conta" });
    expect(JSON.stringify(mascararDto(transacao(), valoresTransacao))).not.toContain("987.65");
  });
});
