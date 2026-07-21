import { describe, expect, it } from "vitest";
import { resumoLeite, resumoCaixa, resumoAtencao } from "./inicioDerive";

const rebanho = {
  herois: {
    producaoTotalDia: { valor: 980, unidade: "L", variacaoPercentual: 3 },
    vacasEmLactacao: { valor: 98, unidade: "", variacaoPercentual: null },
    producaoMediaVaca: { valor: 10, unidade: "L", variacaoPercentual: null },
  },
  alertas: [
    { chave: "ccs-alta", titulo: "CCS alta", quantidade: 5, severidade: "alta", tab: "sanidade", explicacao: "" },
    { chave: "parto-proximo", titulo: "Partos", quantidade: 2, severidade: "baixa", tab: "reproducao", explicacao: "" },
    { chave: "dg-pendente", titulo: "DG", quantidade: 0, severidade: "media", tab: "reproducao", explicacao: "" },
  ],
};

const financeiro = {
  // 23 meses; só o penúltimo tem movimento (mês corrente zerado = atraso do BPO)
  creditoTotal: [...Array(21).fill(0), 5000, 0],
  debitoTotal: [...Array(21).fill(0), 3000, 0],
  caixaHoje: { total: 12345.67 },
};

describe("resumoLeite", () => {
  it("extrai produção, lactação, média e tendência", () => {
    expect(resumoLeite(rebanho)).toEqual({ producaoDia: 980, emLactacao: 98, mediaVaca: 10, tendenciaPct: 3 });
  });
  it("payload vazio → tudo null", () => {
    expect(resumoLeite(null)).toEqual({ producaoDia: null, emLactacao: null, mediaVaca: null, tendenciaPct: null });
  });
});

describe("resumoCaixa", () => {
  it("saldo + último mês com dados (ignora mês corrente zerado)", () => {
    const r = resumoCaixa(financeiro);
    expect(r.saldo).toBe(12345.67);
    expect(r.entrada).toBe(5000);
    expect(r.saida).toBe(3000);
    expect(r.fluxo).toBe(2000);
    expect(r.mesLabel).toMatch(/\/\d{2}$/); // "mmm/aa"
  });
  it("sem mês com dados → mesLabel null mas saldo preservado", () => {
    expect(resumoCaixa({ creditoTotal: [0, 0], debitoTotal: [0, 0], caixaHoje: { total: 10 } }).mesLabel).toBeNull();
  });
});

describe("resumoAtencao", () => {
  it("ordena por severidade, corta quantidade 0, limita", () => {
    const a = resumoAtencao(rebanho, 4);
    expect(a.map((x) => x.chave)).toEqual(["ccs-alta", "parto-proximo"]);
  });
  it("payload vazio → []", () => {
    expect(resumoAtencao(null)).toEqual([]);
  });
});
