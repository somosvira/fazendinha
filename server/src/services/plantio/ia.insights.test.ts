import { describe, it, expect } from "vitest";
import { gerarInsightsPlantio } from "./ia.insights.js";
import type { ContextoPlantio } from "./ia.context.js";

const custoZero = {
  custoSaca: null,
  custoHa: null,
  custeioTotal: 0,
  investimentoTotal: 0,
  sacasPeriodo: 0,
  periodoMeses: 12,
  breakdown: [] as { categoria: string; valor: number; pct: number }[],
};

// Contexto "limpo" — sem ferrugem, sem colheita pronta, custo nulo, análises em dia.
const ctxLimpo: ContextoPlantio = {
  totais: { ativos: 8, areaHa: 40, produtividadeMediaEsperada: 45 },
  porFase: [{ fase: "GRANACAO", n: 8 }],
  faseDominante: "GRANACAO",
  alertaFerrugem: [],
  alertaBroca: [],
  prontosColher: [],
  foliarVencida: [],
  soloVencido: [],
  custo: custoZero,
  colheita: { passadas: 0, sacasBeneficiadas: 0 },
  estoqueBaixo: [],
};

describe("gerarInsightsPlantio", () => {
  it("contexto limpo → nenhum card", () => {
    expect(gerarInsightsPlantio(ctxLimpo)).toEqual([]);
  });

  it("dispara card de ferrugem com códigos e % reais", () => {
    const ctx: ContextoPlantio = {
      ...ctxLimpo,
      alertaFerrugem: [
        { codigo: "T-001", nome: "Cafundó alto", ferrugem: 12, tendencia: "subindo" },
        { codigo: "T-004", nome: null, ferrugem: 7, tendencia: "estavel" },
      ],
    };
    const ferrugem = gerarInsightsPlantio(ctx).find((c) => c.id === "pl-ferrugem");
    expect(ferrugem).toBeDefined();
    expect(ferrugem!.dominio).toBe("fitossanidade");
    expect(ferrugem!.texto).toContain("T-001");
    expect(ferrugem!.texto).toContain("T-004");
    expect(ferrugem!.texto).toContain("<b>12%</b>");
  });

  it("dispara card de colheita quando cereja ≥ 60", () => {
    const ctx: ContextoPlantio = {
      ...ctxLimpo,
      prontosColher: [{ codigo: "T-009", nome: "Tijuco", maturacaoCereja: 71 }],
    };
    const col = gerarInsightsPlantio(ctx).find((c) => c.id === "pl-colheita");
    expect(col).toBeDefined();
    expect(col!.dominio).toBe("colheita");
    expect(col!.texto).toContain("<b>71% cereja</b>");
    expect(col!.texto).toContain("T-009");
  });

  it("dispara card de custo/saca com R$ real", () => {
    const ctx: ContextoPlantio = {
      ...ctxLimpo,
      custo: {
        ...custoZero,
        custoSaca: 780,
        custeioTotal: 156000,
        sacasPeriodo: 200,
        breakdown: [{ categoria: "Adubação", valor: 60000, pct: 38 }],
      },
    };
    const custo = gerarInsightsPlantio(ctx).find((c) => c.id === "pl-custo");
    expect(custo).toBeDefined();
    expect(custo!.texto).toContain("R$ 780/saca");
    expect(custo!.texto).toContain("Adubação");
  });
});
