import { describe, it, expect } from "vitest";
import { responderDemo } from "./ia.responder.js";
import type { ContextoCorte } from "./ia.context.js";

// Contexto sintético — números REAIS plausíveis do plantel de corte.
const ctx: ContextoCorte = {
  totais: { lotesAtivos: 3, cabecas: 76, uaTotal: 64.2, arrobasEstoque: 980, gmdMedio: 0.42 },
  porFase: [
    { fase: "TERMINACAO", n: 2 },
    { fase: "RECRIA", n: 1 },
  ],
  porCategoria: [
    { categoria: "BOI_GORDO", n: 1 },
    { categoria: "VACA_DESCARTE", n: 1 },
    { categoria: "GAROTE", n: 1 },
  ],
  prontosVenda: [
    { codigo: "TER-02", nome: "Terminação 02", numCabecas: 14, pesoMedio: 502, arrobasTotal: 244.0, valorSpot: 59780 },
    { codigo: "DES-01", nome: "Descarte 01", numCabecas: 6, pesoMedio: 458, arrobasTotal: 95.3, valorSpot: 23349 },
  ],
  alertas: [
    { tipo: "gmd_baixo", codigo: "RDM-01", nome: "Recria machos", detalhe: "GMD 0.27 kg/dia (< 0.35)" },
    { tipo: "mortalidade_alta", codigo: "BMM-02", nome: "Bezerros 02", detalhe: "mortalidade 9%" },
  ],
  economia: {
    receita: 110193.96,
    custeioTotal: 14540.8,
    custoArroba: 40.88,
    custoPorCabeca: 191.32,
    arrobasProduzidas: 355.64,
    valorBiologicoEstoque: 240100,
    precoArrobaSpot: 245,
  },
  operacoesRecentes: [
    { data: "2026-05-10", tipo: "VENDA_ABATE", numCabecas: 12, arrobas: 243.64, receitaTotal: 82593.96 },
  ],
  lotes: [
    {
      codigo: "TER-02", nome: "Terminação 02", categoria: "BOI_GORDO", fase: "TERMINACAO", raca: "Nelore",
      numCabecas: 14, pesoMedio: 502, gmd: 0.42, ua: 15.6, arrobasEstimadas: 17.4, mortalidade: 0,
      diasSemPesar: 12, proximaVacina: "2026-11-15", proximoVermifugo: null, pesoAlvoVenda: 540, diasParaAlvo: 90,
    },
    {
      codigo: "RDM-01", nome: "Recria machos", categoria: "GAROTE", fase: "RECRIA", raca: "Nelore",
      numCabecas: 28, pesoMedio: 268, gmd: 0.27, ua: 16.7, arrobasEstimadas: 9.29, mortalidade: 2,
      diasSemPesar: 20, proximaVacina: "2026-07-01", proximoVermifugo: "2026-08-01", pesoAlvoVenda: null, diasParaAlvo: null,
    },
  ],
};

const ctxVazio: ContextoCorte = {
  totais: { lotesAtivos: 0, cabecas: 0, uaTotal: 0, arrobasEstoque: 0, gmdMedio: null },
  porFase: [], porCategoria: [], prontosVenda: [], alertas: [], economia: null, operacoesRecentes: [], lotes: [],
};

describe("responderDemo (corte)", () => {
  it("prontos pra venda → lista lotes com @ e valor spot REAIS", () => {
    const r = responderDemo("quais lotes estão prontos pra venda?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.resposta).toContain("2 lote");
    expect(r.lista?.[0]).toContain("TER-02");
    expect(r.lista?.[0]).toContain("502 kg");
    expect(r.lista?.some((x) => x.includes("DES-01"))).toBe(true);
  });

  it("prontos vazio → mensagem de nenhum", () => {
    const r = responderDemo("tem boi pronto pra abate?", ctxVazio);
    expect(r.modo).toBe("demo");
    expect(r.resposta).toContain("Nenhum");
  });

  it("GMD → média real e lista lotes com GMD baixo", () => {
    const r = responderDemo("como está o GMD?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.resposta).toContain("0.42");
    expect(r.lista?.[0]).toContain("RDM-01");
  });

  it("sanidade → próxima vacina real do plantel", () => {
    const r = responderDemo("quando é a próxima vacina de aftosa?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.resposta).toContain("2026-07-01"); // menor data futura
    expect(r.lista?.some((x) => x.includes("TER-02"))).toBe(true);
  });

  it("mortalidade → lista lotes com mortalidade alta", () => {
    const r = responderDemo("algum lote com mortalidade alta?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.lista?.[0]).toContain("BMM-02");
    expect(r.lista?.[0]).toContain("9%");
  });

  it("custo → custeio, custo/@ e receita REAIS", () => {
    const r = responderDemo("qual o custo por arroba?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.resposta).toContain("40,88"); // custo/@ formatado pt-BR
    expect(r.resposta).toContain("110.193,96"); // receita
  });

  it("fallback → ajuda quando não casa", () => {
    const r = responderDemo("qual a previsão do tempo?", ctx);
    expect(r.modo).toBe("demo");
    expect(r.resposta.toLowerCase()).toContain("gmd");
    expect(r.resposta.toLowerCase()).toContain("venda");
  });
});
