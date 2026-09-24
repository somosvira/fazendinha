// Peças puras dos filtros de Animais (`where`/`orderBy` do Prisma). A paridade com o cálculo em
// memória contra o Postgres de verdade fica em rebanho.integration.test.ts.

import { describe, expect, it, vi } from "vitest";

vi.mock("../../../db.js", () => ({ prisma: {} }));

import { ordemListagem, whereAtributos, whereIdadeHoje } from "./animais.js";
import { whereCategoria, whereSemCategoria } from "./categorias.js";
import { nascimentoLimiteParaIdade, type RegraCategoria } from "./categoria.calc.js";

const HOJE = new Date("2026-09-24");
const UUID = "0b8f5b8e-6f0c-4f6a-9d7e-2f1b1d3c4e5a";
const r = (id: string, sexo: "F" | "M", ordem: number, extra: Partial<RegraCategoria> = {}): RegraCategoria => ({
  id, nome: id, sexo, ordem, automatica: true, ativo: true, idadeMinMeses: null, idadeMaxMeses: null, partos: "QUALQUER", ...extra,
});

describe("whereAtributos", () => {
  it("sem filtros não restringe nada", () => {
    expect(whereAtributos({ situacao: "ATIVO" })).toEqual([]);
  });

  it("sexo, origem, raça na composição e categoria forçada", () => {
    expect(whereAtributos({ situacao: "ATIVO", sexo: "F", origem: "COMPRADO", racaId: UUID, categoriaOrigem: "MANUAL" })).toEqual([
      { sexo: "F" },
      { origem: "COMPRADO" },
      { composicao: { some: { racaId: UUID } } },
      { categoriasManuais: { some: { ate: null } } },
    ]);
  });

  it("filtros da baixa valem só para a baixa em vigor e são ignorados com situacao=ATIVO", () => {
    const f = { tipoBaixa: "MORTE" as const, baixaDe: "2026-01-01", baixaAte: "2026-01-31" };
    const esperado = [{ baixas: { some: { estornadaEm: null, tipo: "MORTE", data: { gte: new Date("2026-01-01"), lte: new Date("2026-01-31") } } } }];
    expect(whereAtributos({ situacao: "BAIXADO", ...f })).toEqual(esperado);
    expect(whereAtributos({ situacao: "TODOS", ...f })).toEqual(esperado);
    expect(whereAtributos({ situacao: "ATIVO", ...f })).toEqual([]);
    expect(whereAtributos({ situacao: "BAIXADO", baixaAte: "2026-01-31" })).toEqual([
      { baixas: { some: { estornadaEm: null, data: { lte: new Date("2026-01-31") } } } },
    ]);
  });
});

describe("whereIdadeHoje", () => {
  it("vira limites de nascimento com a mesma borda do cálculo", () => {
    expect(whereIdadeHoje(HOJE, undefined, undefined)).toEqual({});
    expect(whereIdadeHoje(HOJE, 0, undefined)).toEqual({});
    expect(whereIdadeHoje(HOJE, 11, 13)).toEqual({
      dataNascimento: { lte: nascimentoLimiteParaIdade(HOJE, 11), gt: nascimentoLimiteParaIdade(HOJE, 14) },
    });
    expect(whereIdadeHoje(HOJE, undefined, 5)).toEqual({ dataNascimento: { gt: nascimentoLimiteParaIdade(HOJE, 6) } });
  });
});

describe("whereSemCategoria", () => {
  it("sem manual aberta e NOT de cada regra automática ativa (ordem não importa)", () => {
    const regras = [
      r("vaca", "F", 10, { partos: "COM" }),
      r("bez", "F", 20, { idadeMaxMeses: 12, partos: "SEM" }),
      r("m", "M", 30, { idadeMinMeses: 6 }),
      r("off", "M", 1, { ativo: false }),
      r("man", "M", 2, { automatica: false }),
    ];
    expect(whereSemCategoria(regras, HOJE)).toEqual({
      AND: [
        { categoriasManuais: { none: { ate: null } } },
        { NOT: { sexo: "F", partosAntesDaEntrada: { gt: 0 } } },
        { NOT: { sexo: "F", partosAntesDaEntrada: 0, dataNascimento: { gt: nascimentoLimiteParaIdade(HOJE, 12) } } },
        { NOT: { sexo: "M", dataNascimento: { lte: nascimentoLimiteParaIdade(HOJE, 6) } } },
      ],
    });
  });

  it("regra sem critério tira o sexo inteiro (a mesma condição que o filtro da categoria inclui)", () => {
    const regras = [r("m", "M", 1)];
    expect(whereSemCategoria(regras, HOJE)).toEqual({ AND: [{ categoriasManuais: { none: { ate: null } } }, { NOT: { sexo: "M" } }] });
    expect(whereCategoria("m", regras, HOJE)).toEqual({
      OR: [{ categoriasManuais: { some: { ate: null, categoriaId: "m" } } }, { AND: [{ categoriasManuais: { none: { ate: null } } }, { sexo: "M" }] }],
    });
  });
});

describe("ordemListagem", () => {
  it("brinco: brinco e id", () => {
    expect(ordemListagem("brinco", "asc")).toEqual([{ brinco: "asc" }, { id: "asc" }]);
    expect(ordemListagem("brinco", "desc")).toEqual([{ brinco: "desc" }, { id: "asc" }]);
  });

  it("nascimento/entrada: o campo, depois brinco e id (desempate estável entre páginas)", () => {
    expect(ordemListagem("nascimento", "desc")).toEqual([{ dataNascimento: "desc" }, { brinco: "asc" }, { id: "asc" }]);
    expect(ordemListagem("entrada", "asc")).toEqual([{ dataEntrada: "asc" }, { brinco: "asc" }, { id: "asc" }]);
  });
});
