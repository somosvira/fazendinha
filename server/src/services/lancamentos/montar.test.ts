import { describe, it, expect } from "vitest";
import { montarDadosLancamento } from "./montar.js";

// Testa o NÚCLEO PURO de montagem do Lancamento (sem Prisma): natureza,
// dataLiquidacao (pago → mesma data; senão null → ABERTO), datas de
// competência/vencimento, valor positivo e resolução de fornecedor.

const data = new Date(Date.UTC(2026, 4, 28)); // 28/05/2026

describe("montarDadosLancamento (núcleo puro)", () => {
  it("DEBITO pago → dataLiquidacao = data informada, datas espelhadas", () => {
    const d = montarDadosLancamento(
      { natureza: "DEBITO", categoriaId: 3, centroCustoId: 5, pago: true },
      { valor: "230.00", data, clienteFornecedorId: 7 },
    );
    expect(d.natureza).toBe("DEBITO");
    expect(d.valor).toBe("230.00");
    expect(d.dataCompetencia).toBe(data);
    expect(d.dataVencimento).toBe(data);
    expect(d.dataLiquidacao).toBe(data); // pago → liquidado na mesma data
    expect(d.categoriaId).toBe(3);
    expect(d.centroCustoId).toBe(5);
    expect(d.clienteFornecedorId).toBe(7);
  });

  it("DEBITO não pago → dataLiquidacao null (fica ABERTO)", () => {
    const d = montarDadosLancamento(
      { natureza: "DEBITO", categoriaId: 3, centroCustoId: 5, pago: false },
      { valor: "38450.00", data, clienteFornecedorId: null },
    );
    expect(d.dataLiquidacao).toBeNull();
    expect(d.dataCompetencia).toBe(data);
    expect(d.dataVencimento).toBe(data);
  });

  it("CREDITO (receita) pago → natureza CREDITO e liquidado", () => {
    const d = montarDadosLancamento(
      { natureza: "CREDITO", categoriaId: 11, centroCustoId: 2, pago: true },
      { valor: "88830.00", data, clienteFornecedorId: 42 },
    );
    expect(d.natureza).toBe("CREDITO");
    expect(d.dataLiquidacao).toBe(data);
    expect(d.clienteFornecedorId).toBe(42);
  });

  it("CREDITO não pago (venda a prazo) → ABERTO", () => {
    const d = montarDadosLancamento(
      { natureza: "CREDITO", categoriaId: 11, centroCustoId: 2, pago: false },
      { valor: "1000.00", data, clienteFornecedorId: null },
    );
    expect(d.natureza).toBe("CREDITO");
    expect(d.dataLiquidacao).toBeNull();
  });

  it("sem fornecedor → clienteFornecedorId null", () => {
    const d = montarDadosLancamento(
      { natureza: "DEBITO", categoriaId: 3, centroCustoId: 5, pago: true },
      { valor: "10.00", data, clienteFornecedorId: null },
    );
    expect(d.clienteFornecedorId).toBeNull();
  });

  it("contaBancariaId ausente → null; descricao/numeroDocumento ausentes → null", () => {
    const d = montarDadosLancamento(
      { natureza: "DEBITO", categoriaId: 3, centroCustoId: 5, pago: false },
      { valor: "10.00", data, clienteFornecedorId: null },
    );
    expect(d.contaBancariaId).toBeNull();
    expect(d.descricao).toBeNull();
    expect(d.numeroDocumento).toBeNull();
  });

  it("propaga contaBancariaId, descricao e numeroDocumento quando presentes", () => {
    const d = montarDadosLancamento(
      {
        natureza: "DEBITO",
        categoriaId: 3,
        centroCustoId: 5,
        contaBancariaId: 9,
        pago: true,
        descricao: "compra de ração",
        numeroDocumento: "NF-123",
      },
      { valor: "10.00", data, clienteFornecedorId: null },
    );
    expect(d.contaBancariaId).toBe(9);
    expect(d.descricao).toBe("compra de ração");
    expect(d.numeroDocumento).toBe("NF-123");
  });
});
