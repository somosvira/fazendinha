import { describe, expect, it } from "vitest";
import { agregarPesoLote, diasEntre, gmdEntre, gmdPeriodo, resumoPeso } from "./peso.calc.js";

describe("diasEntre", () => {
  it("conta dias corridos entre duas datas", () => {
    expect(diasEntre("2026-01-01", "2026-01-31")).toBe(30);
  });

  it("é negativo quando a segunda data vem antes", () => {
    expect(diasEntre("2026-01-31", "2026-01-01")).toBe(-30);
  });
});

describe("gmdEntre", () => {
  it("calcula o ganho médio diário com 3 casas", () => {
    expect(gmdEntre({ data: "2026-01-01", pesoKg: 200 }, { data: "2026-01-31", pesoKg: 215 })).toBe(0.5);
  });

  it("arredonda para 3 casas mesmo com dízima", () => {
    // 10 kg em 3 dias = 3.3333... -> 3.333
    expect(gmdEntre({ data: "2026-01-01", pesoKg: 200 }, { data: "2026-01-04", pesoKg: 210 })).toBe(3.333);
  });

  it("perda de peso dá GMD negativo", () => {
    expect(gmdEntre({ data: "2026-01-01", pesoKg: 220 }, { data: "2026-01-11", pesoKg: 210 })).toBe(-1);
  });

  it("pesagens no mesmo dia: sem GMD (null)", () => {
    expect(gmdEntre({ data: "2026-01-01", pesoKg: 200 }, { data: "2026-01-01", pesoKg: 205 })).toBeNull();
  });

  it("fora de ordem (final antes da inicial): sem GMD (null)", () => {
    expect(gmdEntre({ data: "2026-01-10", pesoKg: 200 }, { data: "2026-01-01", pesoKg: 190 })).toBeNull();
  });
});

describe("gmdPeriodo", () => {
  const pesagens = [
    { data: "2026-01-01", pesoKg: 180 },
    { data: "2026-02-01", pesoKg: 200 },
    { data: "2026-03-01", pesoKg: 220 },
  ];

  it("usa a primeira e a última pesagem dentro da janela", () => {
    const r = gmdPeriodo(pesagens, "2026-01-01", "2026-03-01");
    expect(r.pesagens).toBe(3);
    expect(r.dias).toBe(59);
    expect(r.valor).toBe(arredondar((220 - 180) / 59));
  });

  it("de nulo: sem limite inferior (todo o histórico até `ate`)", () => {
    const r = gmdPeriodo(pesagens, null, "2026-02-01");
    expect(r.pesagens).toBe(2);
    expect(r.dias).toBe(31);
  });

  it("uma só pesagem na janela: insuficiente (null)", () => {
    const r = gmdPeriodo(pesagens, "2026-02-15", "2026-03-01");
    expect(r).toEqual({ dias: null, valor: null, pesagens: 1 });
  });

  it("janela sem pesagens: zero pesagens, sem GMD", () => {
    const r = gmdPeriodo(pesagens, "2025-01-01", "2025-06-01");
    expect(r).toEqual({ dias: null, valor: null, pesagens: 0 });
  });

  function arredondar(v: number): number {
    return Math.round(v * 1000) / 1000;
  }
});

describe("resumoPeso", () => {
  it("uma só pesagem: último peso presente, sem nenhum GMD", () => {
    const r = resumoPeso([{ data: "2026-01-01", pesoKg: 200 }], { hoje: "2026-02-01", periodoDias: 90 });
    expect(r.ultimo).toEqual({ kg: 200, data: "2026-01-01" });
    expect(r.gmdRecente).toBeNull();
    expect(r.gmdDesdeEntrada).toBeNull();
    expect(r.gmdPeriodo).toEqual({ dias: null, valor: null, pesagens: 1 });
  });

  it("sem nenhuma pesagem: tudo nulo", () => {
    const r = resumoPeso([], { hoje: "2026-02-01", periodoDias: 90 });
    expect(r.ultimo).toBeNull();
    expect(r.gmdRecente).toBeNull();
    expect(r.gmdDesdeEntrada).toBeNull();
    expect(r.gmdPeriodo).toEqual({ dias: null, valor: null, pesagens: 0 });
  });

  it("pesagens no mesmo dia (a mais recente vale como último peso, sem GMD recente)", () => {
    const r = resumoPeso([
      { data: "2026-01-01", pesoKg: 200 },
      { data: "2026-01-01", pesoKg: 205 },
    ], { hoje: "2026-02-01", periodoDias: 90 });
    expect(r.ultimo?.kg).toBe(205);
    expect(r.gmdRecente).toBeNull();
  });

  it("perda de peso: GMD recente e do período negativos", () => {
    const r = resumoPeso([
      { data: "2025-12-01", pesoKg: 230 },
      { data: "2026-01-01", pesoKg: 200 },
    ], { hoje: "2026-01-01", periodoDias: 90 });
    expect(r.gmdRecente).toBeLessThan(0);
    expect(r.gmdPeriodo.valor).toBeLessThan(0);
  });

  it("janela do período sem pesagens: gmdPeriodo nulo, mas gmdRecente/gmdDesdeEntrada seguem calculados com todo o histórico", () => {
    const r = resumoPeso([
      { data: "2025-01-01", pesoKg: 150 },
      { data: "2025-02-01", pesoKg: 170 },
    ], { hoje: "2026-06-01", periodoDias: 30 });
    expect(r.gmdPeriodo).toEqual({ dias: null, valor: null, pesagens: 0 });
    expect(r.gmdRecente).not.toBeNull();
    expect(r.gmdDesdeEntrada).not.toBeNull();
  });

  it("periodoDias nulo ('desde a entrada'): sem limite inferior, igual ao GMD desde a entrada", () => {
    const r = resumoPeso([
      { data: "2025-01-01", pesoKg: 150 },
      { data: "2025-06-01", pesoKg: 200 },
      { data: "2026-01-01", pesoKg: 260 },
    ], { hoje: "2026-01-01", periodoDias: null });
    expect(r.gmdPeriodo.valor).toBe(r.gmdDesdeEntrada);
    expect(r.gmdPeriodo.pesagens).toBe(3);
  });

  it("baixado: `ateData` corta o histórico na data da baixa, ignorando pesagens depois (e 'hoje' real)", () => {
    const pesagens = [
      { data: "2026-01-01", pesoKg: 200 },
      { data: "2026-02-01", pesoKg: 210 },
      // pesagem "fantasma" depois da baixa — não deveria existir no domínio, mas o cálculo é defensivo
      { data: "2026-06-01", pesoKg: 999 },
    ];
    const r = resumoPeso(pesagens, { hoje: "2026-09-01", periodoDias: 90, ateData: "2026-02-01" });
    expect(r.ultimo).toEqual({ kg: 210, data: "2026-02-01" });
    expect(r.gmdRecente).toBe(gmdEntreEsperado());
    function gmdEntreEsperado() {
      const dias = 31;
      return Math.round(((210 - 200) / dias) * 1000) / 1000;
    }
  });
});

describe("agregarPesoLote", () => {
  it("média, mínimo, máximo e contagem de sem-peso/com-GMD", () => {
    const r = agregarPesoLote([
      { ultimoKg: 200, gmdPeriodo: 0.5 },
      { ultimoKg: 220, gmdPeriodo: 0.6 },
      { ultimoKg: 180, gmdPeriodo: null },
      { ultimoKg: null, gmdPeriodo: null },
    ]);
    expect(r.peso.medioKg).toBe(200);
    expect(r.peso.minKg).toBe(180);
    expect(r.peso.maxKg).toBe(220);
    expect(r.peso.semPeso).toBe(1);
    expect(r.gmd.medio).toBe(0.55);
    expect(r.gmd.comGmd).toBe(2);
  });

  it("lote vazio: tudo nulo/zero", () => {
    const r = agregarPesoLote([]);
    expect(r).toEqual({ peso: { medioKg: null, minKg: null, maxKg: null, semPeso: 0 }, gmd: { medio: null, comGmd: 0 } });
  });

  it("ninguém com peso: semPeso conta todos", () => {
    const r = agregarPesoLote([{ ultimoKg: null, gmdPeriodo: null }, { ultimoKg: null, gmdPeriodo: null }]);
    expect(r.peso).toEqual({ medioKg: null, minKg: null, maxKg: null, semPeso: 2 });
  });
});
