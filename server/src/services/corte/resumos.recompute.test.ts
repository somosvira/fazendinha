import { describe, it, expect } from "vitest";
import { calcularResumo, type PesagemInput, type ManejoInput } from "./resumos.recompute.js";

const HOJE = "2026-05-28";
const lote = (over: Partial<Parameters<typeof calcularResumo>[0]["lote"]> = {}) => ({
  fase: "RECRIA",
  numCabecas: 28,
  numCabecasEntrada: 29,
  dataFormacao: "2025-07-08",
  ...over,
});

describe("calcularResumo — núcleo puro", () => {
  it("sem pesagens: campos de peso nulos, mortalidade ainda computa", () => {
    const r = calcularResumo({ pesagens: [], lote: lote(), hoje: HOJE });
    expect(r.pesoMedio).toBeNull();
    expect(r.gmd).toBeNull();
    expect(r.ua).toBeNull();
    expect(r.arrobasEstimadas).toBeNull();
    expect(r.diasSemPesar).toBeNull();
    // (29 - 28) / 29 * 100
    expect(r.mortalidadeAcumulada).toBeCloseTo(3.45, 2);
  });

  it("GMD = (peso2 - peso1) / dias entre as duas últimas pesagens", () => {
    const pesagens: PesagemInput[] = [
      { data: "2025-07-08", pesoMedio: 178, numCabecas: 29 },
      { data: "2026-04-02", pesoMedio: 240, numCabecas: 28 },
      { data: "2026-05-02", pesoMedio: 268, numCabecas: 28 }, // +28 kg em 30 dias
    ];
    const r = calcularResumo({ pesagens, lote: lote(), hoje: HOJE });
    expect(r.pesoMedio).toBe(268);
    expect(r.pesoMedioEntrada).toBe(178);
    expect(r.ultimaPesagem).toBe("2026-05-02");
    expect(r.gmd).toBeCloseTo(28 / 30, 3); // 0.933
    expect(r.diasSemPesar).toBe(26); // 2026-05-02 → 2026-05-28
  });

  it("GMD acumulado = (último - entrada) / dias desde dataFormacao", () => {
    const pesagens: PesagemInput[] = [
      { data: "2025-07-08", pesoMedio: 178, numCabecas: 29 },
      { data: "2026-05-02", pesoMedio: 268, numCabecas: 28 },
    ];
    const r = calcularResumo({ pesagens, lote: lote({ dataFormacao: "2025-07-08" }), hoje: HOJE });
    const dias = Math.round((Date.parse("2026-05-02") - Date.parse("2025-07-08")) / 86_400_000);
    expect(r.gmdAcumulado).toBeCloseTo(90 / dias, 3);
  });

  it("UA = pesoMedio × numCabecas / 450", () => {
    const r = calcularResumo({
      pesagens: [{ data: "2026-05-02", pesoMedio: 450, numCabecas: 10 }],
      lote: lote({ numCabecas: 10 }),
      hoje: HOJE,
    });
    expect(r.ua).toBeCloseTo(10, 2); // 450*10/450
  });

  it("arrobas estimadas = pesoMedio × 0,52 / 15", () => {
    const r = calcularResumo({
      pesagens: [{ data: "2026-05-02", pesoMedio: 502, numCabecas: 14 }],
      lote: lote(),
      hoje: HOJE,
    });
    expect(r.arrobasEstimadas).toBeCloseTo((502 * 0.52) / 15, 2); // ≈ 17.40
  });

  it("mortalidade acumulada percentual", () => {
    const r = calcularResumo({ pesagens: [], lote: lote({ numCabecasEntrada: 20, numCabecas: 18 }), hoje: HOJE });
    expect(r.mortalidadeAcumulada).toBe(10);
  });

  it("mortalidade = 0 quando numCabecasEntrada = 0 (sem div0)", () => {
    const r = calcularResumo({ pesagens: [], lote: lote({ numCabecasEntrada: 0, numCabecas: 0 }), hoje: HOJE });
    expect(r.mortalidadeAcumulada).toBeNull();
  });

  it("alvo de venda só em TERMINACAO; diasParaAlvo pelo GMD", () => {
    const pesagens: PesagemInput[] = [
      { data: "2026-04-02", pesoMedio: 480, numCabecas: 22 },
      { data: "2026-05-02", pesoMedio: 510, numCabecas: 22 }, // GMD 1.0
    ];
    const r = calcularResumo({ pesagens, lote: lote({ fase: "TERMINACAO" }), hoje: HOJE });
    expect(r.pesoAlvoVenda).toBe(540);
    expect(r.gmd).toBeCloseTo(1, 3);
    expect(r.diasParaAlvo).toBe(30); // (540 - 510) / 1
  });

  it("recria não tem alvo de venda", () => {
    const r = calcularResumo({
      pesagens: [{ data: "2026-05-02", pesoMedio: 268, numCabecas: 28 }],
      lote: lote({ fase: "RECRIA" }),
      hoje: HOJE,
    });
    expect(r.pesoAlvoVenda).toBeNull();
    expect(r.diasParaAlvo).toBeNull();
  });

  it("GMD null quando duas pesagens no mesmo dia (guard div0)", () => {
    const pesagens: PesagemInput[] = [
      { data: "2026-05-02", pesoMedio: 268, numCabecas: 28 },
      { data: "2026-05-02", pesoMedio: 270, numCabecas: 28 },
    ];
    const r = calcularResumo({ pesagens, lote: lote(), hoje: HOJE });
    expect(r.gmd).toBeNull();
  });

  it("GMD negativo (vaca matriz perdendo peso na seca)", () => {
    const pesagens: PesagemInput[] = [
      { data: "2026-03-15", pesoMedio: 440, numCabecas: 48 },
      { data: "2026-05-14", pesoMedio: 432, numCabecas: 48 }, // -8 kg em 60 dias
    ];
    const r = calcularResumo({ pesagens, lote: lote({ fase: "REPRODUCAO" }), hoje: HOJE });
    expect(r.gmd).toBeLessThan(0);
    expect(r.diasParaAlvo).toBeNull(); // GMD <= 0 → sem estimativa
  });

  it("próxima vacina/vermífugo: dose futura mais próxima por família", () => {
    const manejos: ManejoInput[] = [
      { tipo: "VACINA_AFTOSA", data: "2025-11-08", proximaDose: "2026-11-08" },
      { tipo: "VACINA_CLOSTRIDIOSE", data: "2026-01-10", proximaDose: "2026-06-10" },
      { tipo: "VERMIFUGACAO_5811", data: "2026-05-22", proximaDose: "2026-08-22" },
      { tipo: "VACINA_BRUCELOSE_B19", data: "2025-02-01", proximaDose: "2025-08-01" }, // passada — ignora
    ];
    const r = calcularResumo({ pesagens: [], lote: lote(), manejos, hoje: HOJE });
    expect(r.proximaVacina).toBe("2026-06-10"); // mais próxima futura
    expect(r.proximoVermifugo).toBe("2026-08-22");
  });

  it("diasSemPesar nunca negativo (pesagem no futuro vira 0)", () => {
    const r = calcularResumo({
      pesagens: [{ data: "2026-06-20", pesoMedio: 446, numCabecas: 22 }],
      lote: lote(),
      hoje: HOJE,
    });
    expect(r.diasSemPesar).toBe(0);
  });
});
