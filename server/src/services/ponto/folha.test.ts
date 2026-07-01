import { describe, it, expect } from "vitest";
import {
  horasDoDia,
  apurarDia,
  apurarFuncionario,
  type FuncionarioInput,
  type RegistroInput,
} from "./folha.js";

const reg = (over: Partial<RegistroInput> = {}): RegistroInput => ({
  entrada: "07:00",
  saida: "17:00",
  intervaloMin: 60,
  tipoDia: "UTIL",
  ...over,
});

const func = (over: Partial<FuncionarioInput> = {}): FuncionarioInput => ({
  id: "1",
  nome: "Teste",
  cargo: "Peão",
  salarioMensal: 2200,
  cargaMensalHoras: 220,
  jornadaDiariaHoras: 8,
  ...over,
});

describe("horasDoDia", () => {
  it("desconta o intervalo: 07:00–17:00 com 60min = 9h", () => {
    expect(horasDoDia(reg())).toBe(9);
  });

  it("sem intervalo: 08:00–12:00 = 4h", () => {
    expect(horasDoDia(reg({ entrada: "08:00", saida: "12:00", intervaloMin: 0 }))).toBe(4);
  });

  it("FOLGA e FALTA → 0 mesmo com entrada/saída preenchidas", () => {
    expect(horasDoDia(reg({ tipoDia: "FOLGA" }))).toBe(0);
    expect(horasDoDia(reg({ tipoDia: "FALTA" }))).toBe(0);
  });

  it("faltando entrada ou saída → 0", () => {
    expect(horasDoDia(reg({ entrada: null }))).toBe(0);
    expect(horasDoDia(reg({ saida: null }))).toBe(0);
  });

  it("saída antes da entrada / intervalo maior que o período → clamp 0", () => {
    expect(horasDoDia(reg({ entrada: "17:00", saida: "07:00" }))).toBe(0);
    expect(horasDoDia(reg({ entrada: "08:00", saida: "09:00", intervaloMin: 120 }))).toBe(0);
  });
});

describe("apurarDia — UTIL", () => {
  it("abaixo da jornada: tudo normal, sem extra (07:00–12:00, 0 int = 5h)", () => {
    const d = apurarDia(reg({ saida: "12:00", intervaloMin: 0 }), 8);
    expect(d).toEqual({ horas: 5, normais: 5, extra50: 0, extra100: 0 });
  });

  it("acima da jornada: excedente vira extra 50% (9h com jornada 8 → 1h extra50)", () => {
    const d = apurarDia(reg(), 8);
    expect(d).toEqual({ horas: 9, normais: 8, extra50: 1, extra100: 0 });
  });
});

describe("apurarDia — DOMINGO / FERIADO / FALTA", () => {
  it("DOMINGO trabalhado: todas as horas a 100%", () => {
    const d = apurarDia(reg({ tipoDia: "DOMINGO" }), 8);
    expect(d).toEqual({ horas: 9, normais: 0, extra50: 0, extra100: 9 });
  });

  it("FERIADO trabalhado: todas as horas a 100%", () => {
    const d = apurarDia(reg({ saida: "13:00", tipoDia: "FERIADO" }), 8);
    expect(d).toEqual({ horas: 5, normais: 0, extra50: 0, extra100: 5 });
  });

  it("FALTA: tudo zero", () => {
    expect(apurarDia(reg({ tipoDia: "FALTA" }), 8)).toEqual({
      horas: 0,
      normais: 0,
      extra50: 0,
      extra100: 0,
    });
  });
});

describe("apurarFuncionario", () => {
  it("soma dias, computa valorHora e valorExtra corretos", () => {
    // salário 2200 / carga 220 → valorHora 10.
    // 2 dias úteis de 9h (jornada 8): normais 8+8=16, extra50 1+1=2.
    // 1 domingo de 9h: extra100 9.
    // 1 dia normal de 8h (07:00–16:00 int 60): só normais 8.
    const registros: RegistroInput[] = [
      reg(),
      reg(),
      reg({ tipoDia: "DOMINGO" }),
      reg({ saida: "16:00" }),
    ];
    const l = apurarFuncionario(func(), registros);
    expect(l.valorHora).toBe(10);
    expect(l.diasTrabalhados).toBe(4);
    expect(l.totalHoras).toBe(35); // 9+9+9+8
    expect(l.horasNormais).toBe(24); // 8+8+0+8
    expect(l.extra50).toBe(2);
    expect(l.extra100).toBe(9);
    // valorExtra = 2×10×1.5 + 9×10×2 = 30 + 180 = 210
    expect(l.valorExtra).toBe(210);
    // totalPagar = 2200 + 210
    expect(l.totalPagar).toBe(2410);
  });

  it("sem registros: só o salário, sem extras, 0 dias", () => {
    const l = apurarFuncionario(func(), []);
    expect(l.diasTrabalhados).toBe(0);
    expect(l.totalHoras).toBe(0);
    expect(l.valorExtra).toBe(0);
    expect(l.totalPagar).toBe(2200);
  });

  it("FOLGA/FALTA não contam como dia trabalhado", () => {
    const l = apurarFuncionario(func(), [reg({ tipoDia: "FOLGA" }), reg({ tipoDia: "FALTA" })]);
    expect(l.diasTrabalhados).toBe(0);
    expect(l.totalHoras).toBe(0);
    expect(l.valorExtra).toBe(0);
  });

  it("guard div-por-zero: cargaMensalHoras 0 → valorHora 0, sem NaN", () => {
    const l = apurarFuncionario(func({ cargaMensalHoras: 0 }), [reg()]);
    expect(l.valorHora).toBe(0);
    expect(l.valorExtra).toBe(0);
    expect(l.totalPagar).toBe(2200);
    expect(Number.isNaN(l.valorExtra)).toBe(false);
  });
});
