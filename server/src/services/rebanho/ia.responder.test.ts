import { describe, it, expect } from "vitest";
import { responderDemo } from "./ia.responder.js";
import type { ContextoRebanho } from "./ia.context.js";

const ctx: ContextoRebanho = {
  totais: { ativos: 5, emLactacao: 4, secas: 0, gestantes: 1, vazias: 1 },
  producaoMediaRebanho: 24,
  prenhezPct: 25,
  ccsAlto: [{ numero: "1450", nome: "Tulipa", ccs: 512, tendencia: "subindo" }],
  vaziasAtrasadas: [{ numero: "1300", nome: "Cravina", del: 120 }],
  aSecar: [{ numero: "1234", nome: "Jurema", previsaoSecagem: "2026-06-15", diasGestacao: 260 }],
  partosPrevistos: [{ numero: "1234", nome: "Jurema", diasGestacao: 260 }],
  lotes: [
    { nome: "Lote Alta Produção", dietaNome: "Dieta TMR Lactação", numAnimais: 12, producaoMedia: 28 },
    { nome: "Lote Seca", dietaNome: null, numAnimais: 5, producaoMedia: null },
  ],
};

const ctxVazio: ContextoRebanho = {
  totais: { ativos: 0, emLactacao: 0, secas: 0, gestantes: 0, vazias: 0 },
  producaoMediaRebanho: null, prenhezPct: null,
  ccsAlto: [], vaziasAtrasadas: [], aSecar: [], partosPrevistos: [], lotes: [],
};

describe("responderDemo", () => {
  it("CCS → lista vacas ≥ 400 (acento/maiúsculas normalizados)", () => {
    const r = responderDemo("Quais vacas com CÉLULAS somáticas altas?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.resposta).toContain("400");
    expect(r.lista?.[0]).toContain("Tulipa #1450");
    expect(r.lista?.[0]).toContain("512");
  });

  it("CCS sem nenhuma → mensagem de vazio", () => {
    const r = responderDemo("e o ccs?", ctxVazio);
    expect(r.modo).toBe("demo");
    expect(r.resposta).toContain("Nenhuma");
  });

  it("Prenhez → % e gestantes, lista partos", () => {
    const r = responderDemo("Por que a prenhez caiu?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.resposta).toContain("25");
    expect(r.lista?.[0]).toContain("Jurema #1234");
  });

  it("Secagem → conta e lista", () => {
    const r = responderDemo("Quem eu vou secar esse mês?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.lista?.[0]).toContain("Jurema #1234");
    expect(r.lista?.[0]).toContain("2026-06-15");
  });

  it("Produção → média e lista por lote", () => {
    const r = responderDemo("produção média por lote", ctx);
    expect(r.modo).toBe("demo");
    expect(r.resposta).toContain("24");
    expect(r.lista?.[0]).toContain("Lote Alta Produção");
    expect(r.lista?.[0]).toContain("Dieta TMR Lactação");
  });

  it("Vazias → conta e lista DEL", () => {
    const r = responderDemo("tem vaca vazia atrasada?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.lista?.[0]).toContain("Cravina #1300");
    expect(r.lista?.[0]).toContain("120");
  });

  it("Fallback → ajuda quando não casa", () => {
    const r = responderDemo("qual a previsão do tempo?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.resposta.toLowerCase()).toContain("ccs");
    expect(r.resposta.toLowerCase()).toContain("prenhez");
  });
});
