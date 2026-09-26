import { describe, expect, it } from "vitest";
import { FinanceiroError } from "./regras.js";
import { simularParcelas } from "./parcelas.calc.js";

describe("simulação de parcelas", () => {
  it.each([
    [
      { itens: [], valorTotal: 300, valorPagoAgora: 100, quantidadeParcelas: 2, frequencia: "MENSAL", primeiroVencimento: "2026-10-01" },
      '{"totalOperacao":"300","valorPagoAgora":"100","saldoAPrazo":"200","parcelas":[{"valor":"100","dataVencimento":"2026-10-01"},{"valor":"100","dataVencimento":"2026-11-01"}]}',
    ],
    [
      { itens: [{ quantidade: 0.335, valorUnitario: 1 }, { quantidade: 3, valorTotal: 100.005 }], valorPagoAgora: 0.1, quantidadeParcelas: 3, frequencia: "SEMANAL", primeiroVencimento: "2026-01-31" },
      '{"totalOperacao":"100.35","valorPagoAgora":"0.1","saldoAPrazo":"100.25","parcelas":[{"valor":"33.42","dataVencimento":"2026-01-31"},{"valor":"33.42","dataVencimento":"2026-02-07"},{"valor":"33.41","dataVencimento":"2026-02-14"}]}',
    ],
    [
      { itens: [], valorTotal: 100, quantidadeParcelas: 3, frequencia: "MENSAL", primeiroVencimento: "2026-01-31" },
      '{"totalOperacao":"100","valorPagoAgora":"0","saldoAPrazo":"100","parcelas":[{"valor":"33.34","dataVencimento":"2026-01-31"},{"valor":"33.33","dataVencimento":"2026-02-28"},{"valor":"33.33","dataVencimento":"2026-03-31"}]}',
    ],
    [
      { itens: [{ quantidade: 1.005, valorUnitario: 1.005 }], valorTotal: 7, quantidadeParcelas: 1, frequencia: "MENSAL", primeiroVencimento: "2024-02-29" },
      '{"totalOperacao":"1.01","valorPagoAgora":"0","saldoAPrazo":"1.01","parcelas":[{"valor":"1.01","dataVencimento":"2024-02-29"}]}',
    ],
  ] as const)("devolve o mesmo JSON da rota (%#)", (input, json) => {
    expect(JSON.stringify(simularParcelas(input as never))).toBe(json);
  });

  it("erro de validação vira FinanceiroError com o campo", () => {
    const erro = (() => { try { simularParcelas({ itens: [], valorTotal: 1, quantidadeParcelas: 1, frequencia: "MENSAL", primeiroVencimento: "2026-02-30" }); } catch (e) { return e; } })();
    expect(erro).toBeInstanceOf(FinanceiroError);
    expect(erro).toMatchObject({ code: "VALIDACAO", message: "Informe um primeiro vencimento válido", campo: "primeiroVencimento" });
  });
});
