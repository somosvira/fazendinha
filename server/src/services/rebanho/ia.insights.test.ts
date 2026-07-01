import { describe, it, expect } from "vitest";
import { gerarInsightsRebanho } from "./ia.insights.js";
import type { ContextoRebanho } from "./ia.context.js";

// Contexto "limpo" — nenhuma condição de alerta bate → nenhum card.
const ctxLimpo: ContextoRebanho = {
  totais: { ativos: 10, emLactacao: 6, secas: 2, gestantes: 2, vazias: 0 },
  producaoMediaRebanho: 24,
  prenhezPct: 80,
  ccsAlto: [],
  vaziasAtrasadas: [],
  aSecar: [],
  partosPrevistos: [],
  lotes: [],
};

describe("gerarInsightsRebanho", () => {
  it("contexto limpo → nenhum card", () => {
    expect(gerarInsightsRebanho(ctxLimpo)).toEqual([]);
  });

  it("dispara card de secagem com número e nome reais", () => {
    const ctx: ContextoRebanho = {
      ...ctxLimpo,
      aSecar: [{ numero: "1234", nome: "Jurema", previsaoSecagem: "2026-07-10", diasGestacao: 250 }],
    };
    const cards = gerarInsightsRebanho(ctx);
    const secar = cards.find((c) => c.id === "rb-secar");
    expect(secar).toBeDefined();
    expect(secar!.escopo).toBe("rebanho");
    expect(secar!.dominio).toBe("reproducao");
    expect(secar!.texto).toContain("<b>Jurema #1234</b>");
    expect(secar!.texto).toContain("2026-07-10");
    expect(secar!.acoes.length).toBeGreaterThan(0);
  });

  it("card de CCS aponta a pior vaca e vira card do animal", () => {
    const ctx: ContextoRebanho = {
      ...ctxLimpo,
      ccsAlto: [
        { numero: "1450", nome: "Tulipa", ccs: 512, tendencia: "subindo" },
        { numero: "1460", nome: "Rosa", ccs: 410, tendencia: "estavel" },
      ],
    };
    const ccs = gerarInsightsRebanho(ctx).find((c) => c.id === "rb-ccs");
    expect(ccs).toBeDefined();
    expect(ccs!.escopo).toBe("animal");
    expect(ccs!.animalId).toBe("1450");
    expect(ccs!.texto).toContain("<b>512 mil</b>");
    expect(ccs!.texto).toContain("<b>2</b>");
  });

  it("respeita o teto de 4 cards", () => {
    const ctx: ContextoRebanho = {
      ...ctxLimpo,
      aSecar: [{ numero: "1", nome: "A", previsaoSecagem: "2026-07-01", diasGestacao: 250 }],
      ccsAlto: [{ numero: "2", nome: "B", ccs: 500, tendencia: "subindo" }],
      vaziasAtrasadas: [{ numero: "3", nome: "C", del: 120 }],
      partosPrevistos: [{ numero: "4", nome: "D", diasGestacao: 270 }],
    };
    expect(gerarInsightsRebanho(ctx).length).toBeLessThanOrEqual(4);
  });
});
