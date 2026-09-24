import { describe, expect, it } from "vitest";
import {
  avaliarCategoria, calcularCategoriaAutomatica, condicaoDaRegra, descreverRegra, filtroCategoria, idadeEmMeses,
  nascimentoLimiteParaIdade, regraCasa, validarRegra, type RegraCategoria,
} from "./categoria.calc.js";

// os padrões de fábrica (categorias do IDEAGRI), como na migration pecuaria_categorias
const r = (id: string, nome: string, sexo: "F" | "M", ordem: number, extra: Partial<RegraCategoria> = {}): RegraCategoria => ({
  id, nome, sexo, ordem, automatica: true, ativo: true, idadeMinMeses: null, idadeMaxMeses: null, partos: "QUALQUER", ...extra,
});
const PADROES: RegraCategoria[] = [
  r("vaca", "Vaca", "F", 10, { partos: "COM" }),
  r("ecf", "Em crescimento", "F", 20, { idadeMaxMeses: 12, partos: "SEM" }),
  r("nov", "Novilha", "F", 30, { idadeMinMeses: 12, partos: "SEM" }),
  r("ecm", "Em crescimento", "M", 40),
  r("rep", "Reprodutor", "M", 50, { automatica: false }),
];
const HOJE = "2026-09-24";
const animal = (sexo: "F" | "M", dataNascimento: string, partos = 0) => ({ sexo, dataNascimento, partos });

describe("idadeEmMeses", () => {
  it("conta meses de calendário completos", () => {
    expect(idadeEmMeses("2025-09-24", HOJE)).toBe(12);
    expect(idadeEmMeses("2025-09-25", HOJE)).toBe(11);
    expect(idadeEmMeses("2027-01-01", HOJE)).toBe(0);
  });
});

describe("calcularCategoriaAutomatica (padrões do IDEAGRI)", () => {
  it("fêmea: em crescimento até 11 meses, novilha a partir de 12, vaca com parto", () => {
    expect(calcularCategoriaAutomatica(animal("F", "2025-10-01"), PADROES, HOJE)?.nome).toBe("Em crescimento");
    expect(calcularCategoriaAutomatica(animal("F", "2025-09-24"), PADROES, HOJE)?.nome).toBe("Novilha");
    expect(calcularCategoriaAutomatica(animal("F", "2025-10-01", 1), PADROES, HOJE)?.nome).toBe("Vaca");
  });

  it("macho: sempre em crescimento pelo cálculo (reprodutor é só manual)", () => {
    expect(calcularCategoriaAutomatica(animal("M", "2020-01-01"), PADROES, HOJE)?.id).toBe("ecm");
  });

  it("a primeira regra que casa vence, pela ordem", () => {
    const regras = [...PADROES, r("vaca-velha", "Vaca velha", "F", 5, { idadeMinMeses: 96, partos: "COM" })];
    expect(calcularCategoriaAutomatica(animal("F", "2016-01-01", 3), regras, HOJE)?.id).toBe("vaca-velha");
    expect(calcularCategoriaAutomatica(animal("F", "2022-01-01", 3), regras, HOJE)?.id).toBe("vaca");
  });

  it("ignora inativas e sem regra; sem regra que case, sem categoria", () => {
    const regras = PADROES.map((x) => (x.id === "nov" ? { ...x, ativo: false } : x));
    expect(calcularCategoriaAutomatica(animal("F", "2024-01-01"), regras, HOJE)).toBeNull();
  });
});

describe("avaliarCategoria", () => {
  it("manual vale sobre o cálculo e o cálculo é devolvido ao lado", () => {
    const av = avaliarCategoria(animal("F", "2024-01-01"), PADROES, { id: "vaca", nome: "Vaca" }, HOJE);
    expect(av).toEqual({ categoria: { id: "vaca", nome: "Vaca" }, origem: "MANUAL", calculada: { id: "nov", nome: "Novilha" } });
  });

  it("sem manual e sem regra: SEM_CATEGORIA", () => {
    const av = avaliarCategoria(animal("F", "2024-01-01"), PADROES.filter((x) => x.id !== "nov"), null, HOJE);
    expect(av.origem).toBe("SEM_CATEGORIA");
    expect(av.categoria).toBeNull();
  });
});

describe("validarRegra e descreverRegra", () => {
  it("barra idade máxima menor ou igual à mínima", () => {
    expect(validarRegra({ nome: "X", automatica: true, idadeMinMeses: 12, idadeMaxMeses: 12 })[0].campo).toBe("idadeMaxMeses");
    expect(validarRegra({ nome: "X", automatica: false, idadeMinMeses: 12, idadeMaxMeses: 1 })).toEqual([]);
  });

  it("descreve a regra em PT-BR", () => {
    expect(descreverRegra(PADROES[1])).toBe("menos de 12 meses · sem parto");
    expect(descreverRegra(PADROES[2])).toBe("12 meses ou mais · sem parto");
    expect(descreverRegra({ automatica: true, idadeMinMeses: 12, idadeMaxMeses: 24, partos: "QUALQUER" })).toBe("12 a 23 meses");
    expect(descreverRegra(PADROES[4])).toBe("só manual");
  });
});

describe("filtroCategoria (espelho do cálculo para o banco)", () => {
  it("inclui a regra-alvo e exclui as anteriores do mesmo sexo", () => {
    const f = filtroCategoria("nov", PADROES, HOJE);
    expect(f.automatica?.incluir).toEqual(condicaoDaRegra(PADROES[2], HOJE));
    expect(f.automatica?.excluir).toEqual([condicaoDaRegra(PADROES[0], HOJE), condicaoDaRegra(PADROES[1], HOJE)]);
  });

  it("categoria só manual ou inativa não tem parte automática", () => {
    expect(filtroCategoria("rep", PADROES, HOJE).automatica).toBeNull();
  });

  it("regra anterior sem critério captura o sexo inteiro", () => {
    const regras = [...PADROES, r("boi", "Boi", "M", 45, { idadeMinMeses: 24 })];
    expect(filtroCategoria("boi", regras, HOJE).automatica).toBeNull();
  });

  it("as bordas de data batem com o cálculo de idade", () => {
    const limite = nascimentoLimiteParaIdade(HOJE, 12);
    expect(idadeEmMeses(limite, HOJE)).toBe(12);
    expect(idadeEmMeses(new Date(limite.getTime() + 86_400_000), HOJE)).toBe(11);
    // coerência regra × condição num caso de borda
    const f = animal("F", limite.toISOString().slice(0, 10));
    expect(regraCasa(PADROES[2], f, HOJE)).toBe(true);
  });
});
