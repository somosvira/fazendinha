import { describe, it, expect } from "vitest";
import { calcularTaxaConcepcao, type EvtConcepcao } from "./reproducao.concepcao.js";

// helper: evento mínimo pro cálculo (só o que a função lê)
const ev = (animalId: number, tipo: EvtConcepcao["tipo"], data: string, resultado?: string): EvtConcepcao => ({ animalId, tipo, data, resultado });
const byMetodo = (r: ReturnType<typeof calcularTaxaConcepcao>, m: "IA" | "MN" | "TE") => r.find((x) => x.metodo === m)!;

describe("calcularTaxaConcepcao", () => {
  it("retorna sempre IA, MN e TE, na ordem, mesmo sem eventos → taxa null (não NaN)", () => {
    const r = calcularTaxaConcepcao([]);
    expect(r.map((x) => x.metodo)).toEqual(["IA", "MN", "TE"]);
    expect(byMetodo(r, "IA")).toEqual({ metodo: "IA", coberturas: 0, prenhes: 0, taxa: null });
    expect(byMetodo(r, "MN")).toEqual({ metodo: "MN", coberturas: 0, prenhes: 0, taxa: null });
    expect(byMetodo(r, "TE")).toEqual({ metodo: "TE", coberturas: 0, prenhes: 0, taxa: null });
    // não pode ser NaN
    expect(Number.isNaN(byMetodo(r, "IA").taxa as number)).toBe(false);
  });

  it("só IA: 2 coberturas, 1 prenhe → taxa 0.5; MN e TE ficam null", () => {
    const evs = [
      ev(1, "INSEMINACAO", "2026-01-01"),
      ev(1, "DIAGNOSTICO", "2026-01-25", "positivo"),
      ev(2, "INSEMINACAO", "2026-02-01"),
      ev(2, "DIAGNOSTICO", "2026-02-25", "negativo"),
    ];
    const r = calcularTaxaConcepcao(evs);
    expect(byMetodo(r, "IA")).toEqual({ metodo: "IA", coberturas: 2, prenhes: 1, taxa: 0.5 });
    expect(byMetodo(r, "MN").taxa).toBeNull();
    expect(byMetodo(r, "TE")).toEqual({ metodo: "TE", coberturas: 0, prenhes: 0, taxa: null });
  });

  it("monta natural conta no bucket MN", () => {
    const evs = [
      ev(1, "COBERTURA", "2026-01-01"),
      ev(1, "DIAGNOSTICO", "2026-01-25", "positivo"),
      ev(2, "COBERTURA", "2026-02-01"),
      ev(2, "DIAGNOSTICO", "2026-02-25", "negativo"),
    ];
    const r = calcularTaxaConcepcao(evs);
    expect(byMetodo(r, "MN")).toEqual({ metodo: "MN", coberturas: 2, prenhes: 1, taxa: 0.5 });
  });

  it("só TE: 4 coberturas, 1 prenhe → 0.25", () => {
    const evs = [
      ev(10, "TRANSFERENCIA_EMBRIAO", "2026-01-01"), ev(10, "DIAGNOSTICO", "2026-01-30", "positivo"),
      ev(11, "TRANSFERENCIA_EMBRIAO", "2026-01-01"), ev(11, "DIAGNOSTICO", "2026-01-30", "negativo"),
      ev(12, "TRANSFERENCIA_EMBRIAO", "2026-01-01"), ev(12, "DIAGNOSTICO", "2026-01-30", "negativo"),
      ev(13, "TRANSFERENCIA_EMBRIAO", "2026-01-01"), ev(13, "DIAGNOSTICO", "2026-01-30", "negativo"),
    ];
    const r = calcularTaxaConcepcao(evs);
    expect(byMetodo(r, "TE")).toEqual({ metodo: "TE", coberturas: 4, prenhes: 1, taxa: 0.25 });
    expect(byMetodo(r, "IA").taxa).toBeNull();
  });

  it("misto: mesmo animal com IA (falha) depois TE (pega) — atribui ao método da cobertura anterior ao diagnóstico", () => {
    const evs = [
      ev(1, "INSEMINACAO", "2026-01-01"),
      ev(1, "DIAGNOSTICO", "2026-01-25", "negativo"),
      ev(1, "TRANSFERENCIA_EMBRIAO", "2026-02-15"),
      ev(1, "DIAGNOSTICO", "2026-03-10", "positivo"),
      ev(2, "INSEMINACAO", "2026-01-05"),
      ev(2, "DIAGNOSTICO", "2026-02-01", "positivo"),
    ];
    const r = calcularTaxaConcepcao(evs);
    expect(byMetodo(r, "IA")).toEqual({ metodo: "IA", coberturas: 2, prenhes: 1, taxa: 0.5 });
    expect(byMetodo(r, "TE")).toEqual({ metodo: "TE", coberturas: 1, prenhes: 1, taxa: 1 });
  });

  it("diagnóstico sem cobertura anterior é ignorado; positivo repetido não conta em dobro; case-insensitive", () => {
    const evs = [
      // DG solto (herança) — sem cobertura anterior → ignorado
      ev(1, "DIAGNOSTICO", "2026-01-01", "positivo"),
      // cobertura + 2 diagnósticos positivos (reconfirmação) → conta 1 só
      ev(2, "INSEMINACAO", "2026-02-01"),
      ev(2, "DIAGNOSTICO", "2026-02-25", "POSITIVO"),
      ev(2, "DIAGNOSTICO", "2026-03-20", "positivo"),
    ];
    const r = calcularTaxaConcepcao(evs);
    expect(byMetodo(r, "IA")).toEqual({ metodo: "IA", coberturas: 1, prenhes: 1, taxa: 1 });
    expect(byMetodo(r, "TE").taxa).toBeNull();
  });

  it("cobertura sem diagnóstico ainda entra no denominador (arrasta a taxa)", () => {
    const evs = [
      ev(1, "INSEMINACAO", "2026-05-01"), // pendente, sem DG ainda
      ev(2, "INSEMINACAO", "2026-01-01"), ev(2, "DIAGNOSTICO", "2026-01-25", "positivo"),
    ];
    const r = calcularTaxaConcepcao(evs);
    expect(byMetodo(r, "IA")).toEqual({ metodo: "IA", coberturas: 2, prenhes: 1, taxa: 0.5 });
  });
});
