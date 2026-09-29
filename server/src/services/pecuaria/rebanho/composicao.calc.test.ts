import { describe, expect, it } from "vitest";
import {
  calcularComposicaoFilho,
  composicaoRespeitaHerdanca,
  juntarComposicao,
  normalizarComposicao,
  parseGrauSangue,
  rotuloComposicao,
  validarComposicao,
} from "./composicao.calc.js";

describe("parcela herdada", () => {
  const herdada = [{ sigla: "HO", fracao64: 32 }];
  it("fixa a metade conhecida e admite complemento da mesma raça", () => {
    expect(juntarComposicao(herdada, [{ sigla: "HO", fracao64: 16 }, { sigla: "GO", fracao64: 16 }]))
      .toEqual([{ sigla: "HO", fracao64: 48 }, { sigla: "GO", fracao64: 16 }]);
    expect(composicaoRespeitaHerdanca([{ sigla: "HO", fracao64: 48 }, { sigla: "GO", fracao64: 16 }], herdada)).toBe(true);
  });
  it("não deixa reduzir nem omitir a parcela conhecida", () => {
    expect(composicaoRespeitaHerdanca([{ sigla: "HO", fracao64: 16 }], herdada)).toBe(false);
    expect(composicaoRespeitaHerdanca([{ sigla: "GO", fracao64: 32 }], herdada)).toBe(false);
  });
});

describe("parseGrauSangue", () => {
  it('parseia "3/4 HO, GO" com o restante indo para o último sem fração', () => {
    expect(parseGrauSangue("3/4 HO, GO")).toEqual([
      { sigla: "HO", fracao64: 48 },
      { sigla: "GO", fracao64: 16 },
    ]);
  });

  it('parseia "1/2 GL, 1/4 HO, GO" (múltiplos com fração + 1 restante)', () => {
    expect(parseGrauSangue("1/2 GL, 1/4 HO, GO")).toEqual([
      { sigla: "GL", fracao64: 32 },
      { sigla: "HO", fracao64: 16 },
      { sigla: "GO", fracao64: 16 },
    ]);
  });

  it("resolve nome inteiro por sigla (Nelore, Holandês, Girolando)", () => {
    expect(parseGrauSangue("Nelore")).toEqual([{ sigla: "NE", fracao64: 64 }]);
    expect(parseGrauSangue("Holandês")).toEqual([{ sigla: "HO", fracao64: 64 }]);
    expect(parseGrauSangue("Girolando")).toEqual([{ sigla: "GL", fracao64: 64 }]);
  });

  it("texto vazio retorna lista vazia (mãe desconhecida)", () => {
    expect(parseGrauSangue("")).toEqual([]);
  });
});

describe("normalizarComposicao", () => {
  it("soma siglas repetidas", () => {
    expect(normalizarComposicao([{ sigla: "HO", fracao64: 20 }, { sigla: "HO", fracao64: 10 }])).toEqual([
      { sigla: "HO", fracao64: 30 },
    ]);
  });

  it("reduz o maior quando a soma passa de 64", () => {
    const resultado = normalizarComposicao([{ sigla: "HO", fracao64: 50 }, { sigla: "GO", fracao64: 20 }]);
    const soma = resultado.reduce((t, i) => t + i.fracao64, 0);
    expect(soma).toBe(64);
    expect(resultado[0].sigla).toBe("HO");
    expect(resultado[0].fracao64).toBe(44);
  });

  it("remove frações zero e ordena desc", () => {
    expect(normalizarComposicao([{ sigla: "NE", fracao64: 0 }, { sigla: "HO", fracao64: 10 }, { sigla: "GO", fracao64: 20 }])).toEqual([
      { sigla: "GO", fracao64: 20 },
      { sigla: "HO", fracao64: 10 },
    ]);
  });
});

describe("validarComposicao", () => {
  it("aceita composição válida", () => {
    expect(validarComposicao([{ sigla: "HO", fracao64: 48 }, { sigla: "GO", fracao64: 16 }])).toEqual([]);
  });

  it("bloqueia soma acima de 64", () => {
    const erros = validarComposicao([{ sigla: "HO", fracao64: 50 }, { sigla: "GO", fracao64: 20 }]);
    expect(erros.length).toBeGreaterThan(0);
  });

  it("bloqueia sigla duplicada", () => {
    const erros = validarComposicao([{ sigla: "HO", fracao64: 10 }, { sigla: "HO", fracao64: 10 }]);
    expect(erros.some((e) => e.campo === "racaId")).toBe(true);
  });

  it("bloqueia fração fora de 1..64", () => {
    expect(validarComposicao([{ sigla: "HO", fracao64: 0 }])[0].campo).toBe("fracao64");
  });
});

describe("calcularComposicaoFilho", () => {
  it("filho de 5/8 HO com HO puro = 52/64 (média), sem outras raças", () => {
    const mae = parseGrauSangue("5/8 HO");
    const pai = parseGrauSangue("Holandês");
    expect(calcularComposicaoFilho(mae, pai)).toEqual([{ sigla: "HO", fracao64: 52 }]);
  });

  it("mãe desconhecida (sem itens) com pai puro reduz a composição à metade", () => {
    const filho = calcularComposicaoFilho([], parseGrauSangue("Nelore"));
    expect(filho).toEqual([{ sigla: "NE", fracao64: 32 }]);
  });

  it("combina raças diferentes de mãe e pai preservando a soma", () => {
    const mae = parseGrauSangue("3/4 HO, GO");
    const pai = parseGrauSangue("1/2 GL, 1/4 HO, GO");
    const filho = calcularComposicaoFilho(mae, pai);
    const soma = filho.reduce((t, i) => t + i.fracao64, 0);
    expect(soma).toBe(64);
  });
});

describe("rotuloComposicao", () => {
  it('reduz fração e formata "3/4 HO, 1/4 GO"', () => {
    expect(rotuloComposicao([{ sigla: "HO", fracao64: 48 }, { sigla: "GO", fracao64: 16 }])).toBe("3/4 HO, 1/4 GO");
  });

  it('retorna "Desconhecida" para lista vazia', () => {
    expect(rotuloComposicao([])).toBe("Desconhecida");
  });
});
