import { describe, expect, it } from "vitest";
import { validarFiliacao, validarIntervaloPartos, genitorEhDescendente, composicaoDosGenitores, type GenitorRef } from "./genetica.calc.js";

const filho = { id: "filho", dataNascimento: "2024-01-01" };

function animal(id: string, sexo: "F" | "M", dataNascimento: string): GenitorRef {
  return { tipo: "ANIMAL", id, sexo, dataNascimento };
}

function externo(id: string, sexo: "F" | "M"): GenitorRef {
  return { tipo: "EXTERNO", id, sexo };
}

describe("validarFiliacao", () => {
  it("recusa mãe do sexo errado", () => {
    const { erros } = validarFiliacao(filho, animal("m1", "M", "2020-01-01"), null);
    expect(erros).toEqual([{ campo: "maeId", mensagem: "A mãe precisa ser uma fêmea" }]);
  });

  it("recusa pai do sexo errado", () => {
    const { erros } = validarFiliacao(filho, null, animal("p1", "F", "2020-01-01"));
    expect(erros).toEqual([{ campo: "paiId", mensagem: "O pai precisa ser um macho" }]);
  });

  it("recusa o próprio animal como sua mãe", () => {
    const { erros } = validarFiliacao(filho, animal(filho.id, "F", "2020-01-01"), null);
    expect(erros[0].mensagem).toMatch(/própria mãe/);
  });

  it("recusa o próprio animal como seu pai", () => {
    const { erros } = validarFiliacao(filho, null, animal(filho.id, "M", "2020-01-01"));
    expect(erros[0].mensagem).toMatch(/próprio pai/);
  });

  it("recusa genitor animal nascido depois do filho", () => {
    const { erros } = validarFiliacao(filho, animal("m1", "F", "2024-06-01"), null);
    expect(erros[0].mensagem).toMatch(/nascido antes/);
  });

  it("recusa genitor animal nascido no mesmo dia (não estritamente antes)", () => {
    const { erros } = validarFiliacao(filho, animal("m1", "F", filho.dataNascimento), null);
    expect(erros[0].mensagem).toMatch(/nascido antes/);
  });

  it("aceita genitor externo sem checar data de nascimento", () => {
    const { erros } = validarFiliacao(filho, externo("m1", "F"), externo("p1", "M"));
    expect(erros).toEqual([]);
  });

  it("aceita filiação válida mãe animal + pai externo", () => {
    const { erros } = validarFiliacao(filho, animal("m1", "F", "2020-01-01"), externo("p1", "M"));
    expect(erros).toEqual([]);
  });

  it("sem genitores é válido (nenhum informado)", () => {
    const { erros } = validarFiliacao(filho, null, null);
    expect(erros).toEqual([]);
  });
});

describe("validarIntervaloPartos", () => {
  it("avisa quando a mãe teve outro parto há menos de 15 meses", () => {
    const erros = validarIntervaloPartos("2024-01-01", ["2023-06-01"]);
    expect(erros[0].mensagem).toMatch(/menos de 15 meses/);
  });

  it("não avisa com 15 meses ou mais de intervalo", () => {
    const erros = validarIntervaloPartos("2024-01-01", ["2022-09-01"]);
    expect(erros).toEqual([]);
  });

  it("gêmeos / mesmo parto (até 7 dias) não avisam", () => {
    expect(validarIntervaloPartos("2024-01-01", ["2024-01-01", "2023-12-27"])).toEqual([]);
  });

  it("sem partos anteriores não avisa", () => {
    expect(validarIntervaloPartos("2024-01-01", [])).toEqual([]);
  });
});

describe("genitorEhDescendente (ciclo)", () => {
  it("detecta o filho→avô: o genitor proposto é neto do próprio filho", () => {
    // filho -> pai -> avo (avo é neto do filho na direção da filiação testada)
    const descendentes = new Set(["pai", "avo"]);
    expect(genitorEhDescendente("avo", descendentes)).toBe(true);
  });

  it("não detecta ciclo quando o genitor não é descendente", () => {
    const descendentes = new Set(["pai", "avo"]);
    expect(genitorEhDescendente("estranho", descendentes)).toBe(false);
  });
});

describe("composicaoDosGenitores", () => {
  it("monta natural: mãe e pai animais, cada com sua composição", () => {
    const mae = [{ sigla: "NE", fracao64: 64 }];
    const pai = [{ sigla: "NE", fracao64: 64 }];
    expect(composicaoDosGenitores(mae, pai)).toEqual([{ sigla: "NE", fracao64: 64 }]);
  });

  it("IA: mãe ¾HO ¼GO (HO48 GO16) + pai externo HO64 → 7/8 HO, 1/8 GO", () => {
    const mae = [{ sigla: "HO", fracao64: 48 }, { sigla: "GO", fracao64: 16 }];
    const pai = [{ sigla: "HO", fracao64: 64 }];
    expect(composicaoDosGenitores(mae, pai)).toEqual([{ sigla: "HO", fracao64: 56 }, { sigla: "GO", fracao64: 8 }]);
  });

  it("TE: mãe e pai externos, ambos com composição conhecida", () => {
    const mae = [{ sigla: "GO", fracao64: 64 }];
    const pai = [{ sigla: "NE", fracao64: 64 }];
    expect(composicaoDosGenitores(mae, pai)).toEqual(expect.arrayContaining([{ sigla: "NE", fracao64: 32 }, { sigla: "GO", fracao64: 32 }]));
  });

  it("um lado desconhecido contribui 0 (resultado é metade da composição do lado conhecido)", () => {
    const mae = [{ sigla: "NE", fracao64: 64 }];
    expect(composicaoDosGenitores(mae, [])).toEqual([{ sigla: "NE", fracao64: 32 }]);
    expect(composicaoDosGenitores(mae, null)).toEqual([{ sigla: "NE", fracao64: 32 }]);
  });

  it("os dois lados desconhecidos retornam null (nada para sugerir)", () => {
    expect(composicaoDosGenitores([], [])).toBeNull();
    expect(composicaoDosGenitores(null, null)).toBeNull();
  });
});

describe("validarFiliacao — idade da mãe no parto", () => {
  it("avisa quando a mãe teria menos de 15 meses", () => {
    const r = validarFiliacao(
      { id: "f", dataNascimento: "2026-01-10" },
      { tipo: "ANIMAL", id: "m", sexo: "F", dataNascimento: "2025-03-01" },
      null,
    );
    expect(r.erros).toEqual([]);
    expect(r.avisos.map((a) => a.campo)).toEqual(["maeId"]);
  });
});
