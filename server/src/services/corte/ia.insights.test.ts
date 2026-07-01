import { describe, it, expect } from "vitest";
import { gerarInsightsCorte } from "./ia.insights.js";
import type { ContextoCorte } from "./ia.context.js";

// Contexto "limpo" — nada pronto pra venda, sem economia, sem alertas.
const ctxLimpo: ContextoCorte = {
  totais: { lotesAtivos: 4, cabecas: 120, uaTotal: 90, arrobasEstoque: 500, gmdMedio: 0.6 },
  porFase: [{ fase: "RECRIA", n: 4 }],
  porCategoria: [{ categoria: "GAROTE", n: 4 }],
  prontosVenda: [],
  alertas: [],
  economia: null,
  operacoesRecentes: [],
  lotes: [],
};

describe("gerarInsightsCorte", () => {
  it("contexto limpo → nenhum card", () => {
    expect(gerarInsightsCorte(ctxLimpo)).toEqual([]);
  });

  it("dispara card de venda com @ e R$ no spot", () => {
    const ctx: ContextoCorte = {
      ...ctxLimpo,
      prontosVenda: [
        { codigo: "TER-02", nome: "Terminação 2", numCabecas: 14, pesoMedio: 490, arrobasTotal: 238, valorSpot: 58310 },
      ],
    };
    const venda = gerarInsightsCorte(ctx).find((c) => c.id === "co-venda");
    expect(venda).toBeDefined();
    expect(venda!.dominio).toBe("comercial");
    expect(venda!.texto).toContain("TER-02");
    expect(venda!.texto).toContain("<b>238 @</b>");
    expect(venda!.texto).toContain("R$");
  });

  it("dispara card de custo/@ com a economia real (custoArroba > 0)", () => {
    const ctx: ContextoCorte = {
      ...ctxLimpo,
      economia: {
        receita: 100000,
        custeioTotal: 12000,
        custoArroba: 80,
        custoPorCabeca: 100,
        arrobasProduzidas: 150,
        valorBiologicoEstoque: 122500,
        precoArrobaSpot: 245,
      },
    };
    const custo = gerarInsightsCorte(ctx).find((c) => c.id === "co-custo-arroba");
    expect(custo).toBeDefined();
    expect(custo!.texto).toContain("R$ 80/@");
    expect(custo!.texto).toContain("R$ 245/@");
    // margem = 245 - 80 = 165
    expect(custo!.texto).toContain("R$ 165/@");
  });

  it("sem @ vendidas mas com estoque biológico → card de estoque bio", () => {
    const ctx: ContextoCorte = {
      ...ctxLimpo,
      economia: {
        receita: 0,
        custeioTotal: 5000,
        custoArroba: 0,
        custoPorCabeca: null,
        arrobasProduzidas: 0,
        valorBiologicoEstoque: 122500,
        precoArrobaSpot: 245,
      },
    };
    const cards = gerarInsightsCorte(ctx);
    expect(cards.find((c) => c.id === "co-custo-arroba")).toBeUndefined();
    expect(cards.find((c) => c.id === "co-estoque-bio")).toBeDefined();
  });

  it("GMD médio baixo e mortalidade alta disparam cards", () => {
    const ctx: ContextoCorte = {
      ...ctxLimpo,
      totais: { ...ctxLimpo.totais, gmdMedio: 0.38 },
      alertas: [
        { tipo: "gmd_baixo", codigo: "RDM-01", nome: "Recria machos", detalhe: "GMD 0.38 kg/dia (< 0.35)" },
        { tipo: "mortalidade_alta", codigo: "L-008", nome: "Garrotes", detalhe: "mortalidade 10%" },
      ],
    };
    const cards = gerarInsightsCorte(ctx);
    const gmd = cards.find((c) => c.id === "co-gmd");
    const mort = cards.find((c) => c.id === "co-mortalidade");
    expect(gmd).toBeDefined();
    expect(gmd!.texto).toContain("<b>0.38 kg/dia</b>");
    expect(mort).toBeDefined();
    expect(mort!.escopo).toBe("lote");
    expect(mort!.loteId).toBe("L-008");
    expect(mort!.texto).toContain("10%");
  });
});
