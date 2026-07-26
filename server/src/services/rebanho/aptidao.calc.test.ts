import { describe, expect, it } from "vitest";
import { avaliarAptidao, listarAptas, type NovilhaAptidao } from "./aptidao.calc.js";

const criterio = { idadeMinMeses: 13, pesoMinKg: 320 };
const HOJE = "2026-07-26";

const novilha = (over: Partial<NovilhaAptidao> = {}): NovilhaAptidao => ({
  animalId: 1,
  numero: "1",
  categoria: "NOVILHA",
  dataNascimento: "2025-01-01", // ~18 meses em 2026-07
  ultimoPesoKg: 360,
  ...over,
});

describe("avaliarAptidao", () => {
  it("apta quando idade e peso atingem o critério", () => {
    expect(avaliarAptidao(novilha(), criterio, HOJE)).toMatchObject({ apta: true });
  });

  it("inapta por peso, com motivo específico", () => {
    const r = avaliarAptidao(novilha({ ultimoPesoKg: 300 }), criterio, HOJE);
    expect(r.apta).toBe(false);
    expect(r.motivo).toContain("peso");
  });

  it("inapta por idade, com motivo específico", () => {
    const r = avaliarAptidao(novilha({ dataNascimento: "2026-01-01" }), criterio, HOJE); // ~6 meses
    expect(r.apta).toBe(false);
    expect(r.motivo).toContain("idade");
  });

  it("inapta por idade quando não há data de nascimento", () => {
    const r = avaliarAptidao(novilha({ dataNascimento: null }), criterio, HOJE);
    expect(r.apta).toBe(false);
    expect(r.motivo).toContain("idade");
  });

  it("inapta por peso quando não há pesagem", () => {
    const r = avaliarAptidao(novilha({ ultimoPesoKg: null }), criterio, HOJE);
    expect(r.apta).toBe(false);
    expect(r.motivo).toContain("peso");
  });

  it("cita ambos os motivos quando idade e peso faltam", () => {
    const r = avaliarAptidao(novilha({ dataNascimento: "2026-06-01", ultimoPesoKg: 200 }), criterio, HOJE);
    expect(r.apta).toBe(false);
    expect(r.motivo).toContain("idade");
    expect(r.motivo).toContain("peso");
  });
});

describe("listarAptas", () => {
  it("retorna só novilhas aptas, ordenadas por número", () => {
    const entrada = [
      novilha({ animalId: 3, numero: "30" }),
      novilha({ animalId: 1, numero: "3", ultimoPesoKg: 300 }), // inapta
      novilha({ animalId: 2, numero: "5" }),
    ];
    expect(listarAptas(entrada, criterio, HOJE).map((a) => a.numero)).toEqual(["5", "30"]);
  });

  it("ignora animais que não são novilhas", () => {
    const entrada = [novilha({ animalId: 9, numero: "9", categoria: "VACA" })];
    expect(listarAptas(entrada, criterio, HOJE)).toEqual([]);
  });
});
