import { describe, it, expect } from "vitest";
import {
  agregarDashboardCultivo,
  type SafraCultivoAgg,
  type SiloAgg,
  type ResumoCultivoAgg,
} from "./dashboard.agg.js";

const resumo = (over: Partial<ResumoCultivoAgg> = {}): ResumoCultivoAgg => ({
  areaHa: 0,
  producaoGraoSc: 0,
  producaoSilagemTon: 0,
  custeioTotal: 0,
  investimentoTotal: 0,
  custoSaca: null,
  ...over,
});

describe("agregarDashboardCultivo", () => {
  it("soma read-models e conta safras ativas/fechadas", () => {
    const safras: SafraCultivoAgg[] = [
      { fechada: false, resumo: resumo({ areaHa: 10, producaoGraoSc: 100, custeioTotal: 5000, custoSaca: 50 }) },
      { fechada: true, resumo: resumo({ areaHa: 20, producaoGraoSc: 300, custeioTotal: 12000, custoSaca: 40 }) },
    ];
    const d = agregarDashboardCultivo(safras, []);
    expect(d.k.safrasAtivas).toBe(1);
    expect(d.k.safrasFechadas).toBe(1);
    expect(d.k.areaHa).toBe(30);
    expect(d.k.producaoGraoSc).toBe(400);
    expect(d.k.custeioTotal).toBe(17000);
    // custo/saca médio ponderado = custeio ÷ produção grão = 17000 / 400 = 42.5
    expect(d.k.custoSacaMedio).toBe(42.5);
  });

  it("custoSacaMedio é null quando não há produção de grão", () => {
    const safras: SafraCultivoAgg[] = [{ fechada: false, resumo: resumo({ producaoSilagemTon: 50 }) }];
    const d = agregarDashboardCultivo(safras, []);
    expect(d.k.custoSacaMedio).toBeNull();
  });

  it("ocupação de silo e alerta > 90%", () => {
    const silos: SiloAgg[] = [
      { saldoAtual: 95, capacidade: 100, ativo: true }, // 95% → alerta
      { saldoAtual: 50, capacidade: 100, ativo: true }, // 50%
    ];
    const d = agregarDashboardCultivo([], silos);
    expect(d.k.silosAtivos).toBe(2);
    expect(d.k.siloSaldoTotal).toBe(145);
    expect(d.k.siloOcupacaoPct).toBe(72.5); // 145/200
    const alSilo = d.alertas.find((a) => a.tab === "mil-silos")!;
    expect(alSilo.n).toBe(1);
  });

  it("siloOcupacaoPct é null sem capacidade cadastrada", () => {
    const d = agregarDashboardCultivo([], [{ saldoAtual: 30, capacidade: null, ativo: true }]);
    expect(d.k.siloOcupacaoPct).toBeNull();
  });

  it("alerta de safra ativa sem produção", () => {
    const safras: SafraCultivoAgg[] = [
      { fechada: false, resumo: resumo({ producaoGraoSc: 0, producaoSilagemTon: 0 }) },
      { fechada: false, resumo: resumo({ producaoGraoSc: 10 }) },
    ];
    const d = agregarDashboardCultivo(safras, []);
    const al = d.alertas.find((a) => a.tab === "mil-producao")!;
    expect(al.n).toBe(1);
  });
});
