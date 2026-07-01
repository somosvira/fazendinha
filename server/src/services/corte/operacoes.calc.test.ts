import { describe, it, expect } from "vitest";
import { calcularOperacao } from "./operacoes.js";
import {
  pesagemToTimeline,
  manejoToTimeline,
  suplementacaoToTimeline,
  operacaoToTimeline,
} from "./timeline.js";

describe("calcularOperacao — núcleo puro", () => {
  it("pesoTotal = pesoMedio × numCabecas; arrobas = pesoTotal × 0,52 / 15", () => {
    const r = calcularOperacao({ numCabecas: 14, pesoMedio: 502 });
    expect(r.pesoTotal).toBe(7028); // 502 * 14
    // 7028 * 0.52 / 15 = 243.6053… → 243.61
    expect(r.arrobas).toBeCloseTo((7028 * 0.52) / 15, 2);
    expect(r.receitaTotal).toBeNull(); // sem precoArroba
  });

  it("receitaTotal = arrobas × precoArroba quando precoArroba dado", () => {
    const r = calcularOperacao({ numCabecas: 14, pesoMedio: 502, precoArroba: 339 });
    expect(r.receitaTotal).toBeCloseTo(r.arrobas * 339, 2);
    expect(r.receitaTotal).not.toBeNull();
  });

  it("arrobas explícito no input tem precedência sobre o cálculo", () => {
    const r = calcularOperacao({ numCabecas: 10, pesoMedio: 500, arrobas: 200, precoArroba: 300 });
    expect(r.arrobas).toBe(200);
    expect(r.receitaTotal).toBe(60000); // 200 * 300
  });

  it("uma única cabeça (descarte avulso)", () => {
    const r = calcularOperacao({ numCabecas: 1, pesoMedio: 458, precoArroba: 280 });
    expect(r.pesoTotal).toBe(458);
    expect(r.arrobas).toBeCloseTo((458 * 0.52) / 15, 2);
  });
});

describe("timeline mappers — corte", () => {
  it("pesagem → dominio pesagem, id pes-, GMD no detalhe", () => {
    const e = pesagemToTimeline({
      id: 7,
      loteId: 1,
      data: new Date("2026-06-20"),
      pesoMedio: 446,
      gmdDesdeUltima: 1.42,
      responsavel: "Equipe",
    });
    expect(e.id).toBe("pes-7");
    expect(e.dominio).toBe("pesagem");
    expect(e.titulo).toBe("Pesagem do lote");
    expect(e.detalhe).toContain("446 kg");
    expect(e.detalhe).toContain("GMD 1.42");
    expect(e.data).toBe("2026-06-20");
  });

  it("manejo aftosa → titulo humano, dominio sanidade, id san-, próxima dose", () => {
    const e = manejoToTimeline({
      id: 3,
      loteId: 1,
      data: new Date("2025-11-08"),
      tipo: "VACINA_AFTOSA",
      numCabecas: 48,
      produto: "Aftosa trivalente",
      proximaDose: new Date("2026-11-08"),
    });
    expect(e.id).toBe("san-3");
    expect(e.dominio).toBe("sanidade");
    expect(e.titulo).toBe("Vacinação aftosa");
    expect(e.detalhe).toContain("48 cabeças");
    expect(e.proximoPasso).toContain("2026-11-08");
  });

  it("manejo com carência ativa → alerta true", () => {
    const e = manejoToTimeline(
      {
        id: 4,
        loteId: 1,
        data: new Date("2026-05-25"),
        tipo: "CONTROLE_CARRAPATO",
        numCabecas: 20,
        carenciaDias: 21,
      },
      "2026-05-28"
    );
    expect(e.alerta).toBe(true); // 2026-05-25 + 21d = 2026-06-15 ≥ hoje
  });

  it("manejo com carência expirada → sem alerta", () => {
    const e = manejoToTimeline(
      {
        id: 5,
        loteId: 1,
        data: new Date("2026-01-01"),
        tipo: "CONTROLE_CARRAPATO",
        numCabecas: 20,
        carenciaDias: 21,
      },
      "2026-05-28"
    );
    expect(e.alerta).toBeUndefined();
  });

  it("suplementação ativa (dataFim null) → dominio nutricao, id nut-, marcador ativa", () => {
    const e = suplementacaoToTimeline({
      id: 2,
      loteId: 1,
      dataInicio: new Date("2026-04-01"),
      dataFim: null,
      tipo: "MINERAL",
      produto: "Mineral 90",
      consumoCabecaDiaG: 120,
    });
    expect(e.id).toBe("nut-2");
    expect(e.dominio).toBe("nutricao");
    expect(e.titulo).toBe("Início suplementação mineral");
    expect(e.marcador).toBe("ativa");
  });

  it("operação venda ao abate → dominio comercial, id com-, impacto positivo", () => {
    const e = operacaoToTimeline({
      id: 1,
      loteId: 11,
      data: new Date("2026-06-25"),
      tipo: "VENDA_ABATE",
      numCabecas: 14,
      arrobas: 243.6,
      receitaTotal: 82580,
    });
    expect(e.id).toBe("com-1");
    expect(e.dominio).toBe("comercial");
    expect(e.titulo).toBe("Venda ao abate");
    expect(e.detalhe).toContain("14 cabeças");
    expect(e.detalhe).toContain("243.6 @");
    expect(e.impacto?.startsWith("+")).toBe(true);
  });

  it("operação compra → impacto com sinal negativo", () => {
    const e = operacaoToTimeline({
      id: 2,
      loteId: 6,
      data: new Date("2025-07-08"),
      tipo: "COMPRA",
      numCabecas: 29,
      arrobas: 100,
      receitaTotal: 30000,
    });
    expect(e.titulo).toBe("Compra de animais");
    expect(e.impacto?.startsWith("−")).toBe(true);
  });
});
