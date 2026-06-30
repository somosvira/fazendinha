import { describe, it, expect } from "vitest";
import { responderDemo } from "./ia.responder.js";
import type { ContextoPlantio } from "./ia.context.js";

const ctx: ContextoPlantio = {
  totais: { ativos: 3, areaHa: 14.3, produtividadeMediaEsperada: 40 },
  porFase: [{ fase: "MATURACAO_CEREJA", n: 2 }, { fase: "COLHEITA", n: 1 }],
  faseDominante: "MATURACAO_CEREJA",
  alertaFerrugem: [
    { codigo: "CAF-02", nome: "Cafundó alto · setor 2", ferrugem: 11, tendencia: "subindo" },
    { codigo: "TIJ-02", nome: "Tijuco oeste", ferrugem: 5, tendencia: "estavel" },
  ],
  alertaBroca: [{ codigo: "CAF-02", nome: "Cafundó alto · setor 2", broca: 4.1 }],
  prontosColher: [{ codigo: "SEC-01", nome: "Mata Seca · Acauã", maturacaoCereja: 76 }],
  foliarVencida: [{ codigo: "CAF-02", nome: "Cafundó alto · setor 2", ultimaAnaliseFoliar: "2025-12-01" }],
  soloVencido: [{ codigo: "CAF-02", nome: "Cafundó alto · setor 2", ultimaAnaliseSolo: "2024-08-10" }],
  custo: {
    custoSaca: 780, custoHa: 12000, custeioTotal: 250000, investimentoTotal: 90000,
    sacasPeriodo: 320, periodoMeses: 12,
    breakdown: [{ categoria: "Mão de obra", valor: 90000, pct: 36 }],
  },
  colheita: { passadas: 4, sacasBeneficiadas: 320 },
  estoqueBaixo: [{ nome: "Cuprovinil", saldo: 12, unidade: "L", minimoEstoque: 40 }],
};

const ctxVazio: ContextoPlantio = {
  totais: { ativos: 0, areaHa: 0, produtividadeMediaEsperada: null },
  porFase: [], faseDominante: null,
  alertaFerrugem: [], alertaBroca: [], prontosColher: [], foliarVencida: [], soloVencido: [],
  custo: { custoSaca: null, custoHa: null, custeioTotal: 0, investimentoTotal: 0, sacasPeriodo: 0, periodoMeses: 12, breakdown: [] },
  colheita: { passadas: 0, sacasBeneficiadas: 0 },
  estoqueBaixo: [],
};

describe("responderDemo (plantio)", () => {
  it("ferrugem → conta e lista talhões ≥ 5% (acento/maiúsculas normalizados)", () => {
    const r = responderDemo("Como está a FERRUGEM?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.resposta).toContain("2");
    expect(r.lista?.[0]).toContain("CAF-02");
    expect(r.lista?.[0]).toContain("11%");
  });

  it("ferrugem sem nenhum → mensagem de vazio", () => {
    const r = responderDemo("e a ferrugem?", ctxVazio);
    expect(r.resposta).toContain("Nenhum");
  });

  it("broca → lista", () => {
    const r = responderDemo("tem broca?", ctx);
    expect(r.lista?.[0]).toContain("CAF-02");
    expect(r.lista?.[0]).toContain("4.1%");
  });

  it("colheita → prontos pra colher + sacas beneficiadas reais", () => {
    const r = responderDemo("quando começo a colheita?", ctx);
    expect(r.resposta).toContain("320 sc");
    expect(r.lista?.[0]).toContain("SEC-01");
    expect(r.lista?.[0]).toContain("76% cereja");
  });

  it("custo → custo/saca real e breakdown", () => {
    const r = responderDemo("qual o custo por saca?", ctx);
    expect(r.resposta).toContain("780");
    expect(r.lista?.[0]).toContain("Mão de obra");
  });

  it("adubação → foliar/solo vencidos reais", () => {
    const r = responderDemo("quais talhões precisam de adubação?", ctx);
    expect(r.resposta).toContain("1");
    expect(r.lista?.[0]).toContain("CAF-02");
  });

  it("fenologia → fase dominante e contagem por fase", () => {
    const r = responderDemo("em que fase está a lavoura?", ctx);
    expect(r.resposta).toContain("MATURACAO_CEREJA");
    expect(r.lista?.some((l) => l.includes("MATURACAO_CEREJA"))).toBe(true);
  });

  it("estoque → insumos abaixo do mínimo", () => {
    const r = responderDemo("tem insumo em falta no estoque?", ctx);
    expect(r.lista?.[0]).toContain("Cuprovinil");
  });

  it("fallback → ajuda quando não casa", () => {
    const r = responderDemo("qual a previsão do tempo?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.resposta.toLowerCase()).toContain("ferrugem");
    expect(r.resposta.toLowerCase()).toContain("custo");
  });
});
