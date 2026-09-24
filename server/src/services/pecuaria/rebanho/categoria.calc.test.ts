import { describe, expect, it } from "vitest";
import {
  avaliarCategoria, calcularCategoriaAutomatica, condicaoDaRegra, descreverRegra, filtroCategoria, idadeEmMeses,
  nascimentoLimiteParaIdade, regraCasa, validarDataCategoriaManual, validarRegra, type RegraCategoria,
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

  describe("nascido em 29/02 (ano bissexto)", () => {
    const NASC = "2024-02-29";

    it("só completa o ano em 01/03 nos anos sem 29/02; em ano bissexto, no próprio 29/02", () => {
      expect(idadeEmMeses(NASC, "2025-02-28")).toBe(11);
      expect(idadeEmMeses(NASC, "2025-03-01")).toBe(12);
      expect(idadeEmMeses(NASC, "2028-02-28")).toBe(47);
      expect(idadeEmMeses(NASC, "2028-02-29")).toBe(48);
    });

    it("nascimentoLimiteParaIdade tem a mesma borda que idadeEmMeses", () => {
      // 2025-02-28: com 12 meses só quem nasceu até 28/02/2024 — o de 29/02 ainda tem 11
      expect(nascimentoLimiteParaIdade("2025-02-28", 12).toISOString().slice(0, 10)).toBe("2024-02-28");
      expect(nascimentoLimiteParaIdade("2025-03-01", 12).toISOString().slice(0, 10)).toBe("2024-03-01");
      expect(nascimentoLimiteParaIdade("2028-02-29", 48).toISOString().slice(0, 10)).toBe(NASC);
    });

    it("para todo nascimento em volta de 29/02: nascimento ≤ limite ⇔ idade ≥ meses", () => {
      const casos: Array<[string, number]> = [["2025-02-28", 12], ["2025-03-01", 12], ["2028-02-29", 48], ["2028-02-28", 48], ["2024-03-29", 1]];
      for (const [hoje, meses] of casos) {
        const limite = nascimentoLimiteParaIdade(hoje, meses).getTime();
        for (let d = Date.UTC(2024, 1, 15); d <= Date.UTC(2024, 2, 15); d += 86_400_000) {
          const nasc = new Date(d);
          expect({ hoje, meses, nasc: nasc.toISOString().slice(0, 10), casa: d <= limite })
            .toEqual({ hoje, meses, nasc: nasc.toISOString().slice(0, 10), casa: idadeEmMeses(nasc, hoje) >= meses });
        }
      }
    });
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

describe("validarDataCategoriaManual (R4)", () => {
  it("bloqueia data anterior à entrada do animal", () => {
    expect(validarDataCategoriaManual({ dataEntrada: "2026-01-01", ultima: null, data: "2025-12-31" }))
      .toBe("A data não pode ser anterior à entrada do animal");
  });

  it("aceita data igual à entrada, sem manual anterior", () => {
    expect(validarDataCategoriaManual({ dataEntrada: "2026-01-01", ultima: null, data: "2026-01-01" })).toBeNull();
  });

  it("bloqueia data anterior ao início da manual aberta", () => {
    const erro = validarDataCategoriaManual({
      dataEntrada: "2026-01-01", ultima: { desde: "2026-03-01", ate: null }, data: "2026-02-15",
    });
    expect(erro).toBe("A data não pode ser anterior à troca manual atual");
  });

  it("aceita data igual ou posterior ao início da manual aberta", () => {
    expect(validarDataCategoriaManual({ dataEntrada: "2026-01-01", ultima: { desde: "2026-03-01", ate: null }, data: "2026-03-01" })).toBeNull();
    expect(validarDataCategoriaManual({ dataEntrada: "2026-01-01", ultima: { desde: "2026-03-01", ate: null }, data: "2026-04-01" })).toBeNull();
  });

  it("bloqueia data anterior ao fim da última manual já fechada (não sobrepõe períodos)", () => {
    const erro = validarDataCategoriaManual({
      dataEntrada: "2026-01-01", ultima: { desde: "2026-02-01", ate: "2026-05-01" }, data: "2026-04-01",
    });
    expect(erro).toBe("A data não pode ser anterior ao fim da última categoria manual");
  });

  it("aceita data igual ou posterior ao fim da última manual fechada", () => {
    expect(validarDataCategoriaManual({ dataEntrada: "2026-01-01", ultima: { desde: "2026-02-01", ate: "2026-05-01" }, data: "2026-05-01" })).toBeNull();
    expect(validarDataCategoriaManual({ dataEntrada: "2026-01-01", ultima: { desde: "2026-02-01", ate: "2026-05-01" }, data: "2026-06-01" })).toBeNull();
  });
});
