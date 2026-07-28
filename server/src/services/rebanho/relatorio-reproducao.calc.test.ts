import { describe, expect, it } from "vitest";
import { agregarRelatorioReproducao } from "./relatorio-reproducao.calc.js";

const ev = (animalId: number, tipo: string, data: string, resultado?: string) => ({ animalId, tipo, data, resultado });

describe("agregarRelatorioReproducao", () => {
  it("consolida coberturas, prenhezes, partos e taxa por método", () => {
    const r = agregarRelatorioReproducao([
      ev(1, "INSEMINACAO", "2026-01-10"), ev(1, "DIAGNOSTICO", "2026-02-01", "positivo"), ev(1, "PARTO", "2026-10-20"),
      ev(2, "INSEMINACAO", "2026-01-12"), ev(2, "DIAGNOSTICO", "2026-02-05", "negativo"),
      ev(3, "TRANSFERENCIA_EMBRIAO", "2026-01-15"), ev(3, "DIAGNOSTICO", "2026-02-08", "positivo"),
    ], {});
    expect(r.coberturas).toBe(3);
    expect(r.prenhes).toBe(2);
    expect(r.partos).toBe(1);
    expect(r.taxaConcepcao).toBeCloseTo(2 / 3, 5);
    const ia = r.porMetodo.find((m) => m.metodo === "IA");
    expect(ia).toEqual({ metodo: "IA", coberturas: 2, prenhes: 1, taxa: 0.5 });
  });

  it("filtra pela janela de/ate e reporta o período", () => {
    const r = agregarRelatorioReproducao([
      ev(1, "INSEMINACAO", "2025-12-31"), ev(2, "INSEMINACAO", "2026-01-05"), ev(3, "INSEMINACAO", "2026-02-20"),
    ], { de: "2026-01-01", ate: "2026-01-31" });
    expect(r.coberturas).toBe(1);
    expect(r.periodo).toEqual({ de: "2026-01-01", ate: "2026-01-31" });
  });

  it("taxa é null quando não há coberturas (nunca NaN)", () => {
    const r = agregarRelatorioReproducao([ev(1, "PARTO", "2026-03-01")], {});
    expect(r.coberturas).toBe(0);
    expect(r.partos).toBe(1);
    expect(r.taxaConcepcao).toBeNull();
  });
});
