import { describe, expect, it } from "vitest";
import { infoReversao, operacaoDoCancelamento } from "./reversao";

describe("operacaoDoCancelamento", () => {
  it("extrai o id da operação da descrição padronizada do estorno por cancelamento", () => {
    expect(operacaoDoCancelamento("Cancelamento da operação #12: motivo qualquer")).toBe(12);
  });
  it("retorna null para descrições que não seguem o prefixo", () => {
    expect(operacaoDoCancelamento("Estorno #3: duplicado")).toBeNull();
    expect(operacaoDoCancelamento(null)).toBeNull();
  });
});

describe("infoReversao", () => {
  it("ignora transações que não são REVERSAO", () => {
    expect(infoReversao({ tipo: "PAGAMENTO", descricao: null })).toBeNull();
  });
  it("identifica reversão por cancelamento de operação com o id da operação original", () => {
    expect(infoReversao({ tipo: "REVERSAO", descricao: "Cancelamento da operação #5: fornecedor errado" }))
      .toEqual({ detalhe: "Estorno pelo cancelamento da OP-0005", operacaoId: 5 });
  });
  it("identifica estorno avulso de liquidação usando o tipo original", () => {
    expect(infoReversao({ tipo: "REVERSAO", descricao: "Estorno #9: motivo", reversaoDe: { tipo: "PAGAMENTO" } }))
      .toEqual({ detalhe: "Estorno de pagamento", operacaoId: null });
  });
});
