import { describe, expect, it } from "vitest";
import { ehCancelamentoDeOperacao, infoReversao } from "./reversao";
import { uid } from "../../lib/uid.fixture";

describe("ehCancelamentoDeOperacao", () => {
  it("reconhece o prefixo padronizado do estorno por cancelamento", () => {
    expect(ehCancelamentoDeOperacao("Cancelamento da operação #12: motivo qualquer")).toBe(true);
  });
  it("retorna false para descrições que não seguem o prefixo", () => {
    expect(ehCancelamentoDeOperacao("Estorno #3: duplicado")).toBe(false);
    expect(ehCancelamentoDeOperacao(null)).toBe(false);
  });
});

describe("infoReversao", () => {
  it("ignora transações que não são REVERSAO", () => {
    expect(infoReversao({ tipo: "PAGAMENTO", descricao: null })).toBeNull();
  });
  it("identifica reversão por cancelamento de operação com o id e o número da operação original", () => {
    expect(infoReversao({ tipo: "REVERSAO", descricao: "Cancelamento da operação #5: fornecedor errado", operacao: { id: uid(5), numero: 5 } }))
      .toEqual({ detalhe: "Estorno pelo cancelamento da OP-0005", operacaoId: uid(5), operacaoNumero: 5 });
  });
  it("identifica estorno avulso de liquidação usando o tipo original", () => {
    expect(infoReversao({ tipo: "REVERSAO", descricao: "Estorno #9: motivo", reversaoDe: { tipo: "PAGAMENTO" } }))
      .toEqual({ detalhe: "Estorno de pagamento", operacaoId: null, operacaoNumero: null });
  });
});
