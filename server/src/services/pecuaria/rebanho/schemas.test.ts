import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cadastrarAnimalSchema, dataNaoFutura, incluirInativosQuerySchema, listarFiltrosSchema, movimentarSchema,
  pesagemSchema, reordenarCategoriasSchema,
} from "./schemas.js";

describe("incluirInativosQuerySchema", () => {
  it("'false' vira false", () => {
    expect(incluirInativosQuerySchema.parse({ incluirInativos: "false" })).toEqual({ incluirInativos: false });
  });

  it("'true' vira true", () => {
    expect(incluirInativosQuerySchema.parse({ incluirInativos: "true" })).toEqual({ incluirInativos: true });
  });

  it("ausente vira false", () => {
    expect(incluirInativosQuerySchema.parse({})).toEqual({ incluirInativos: false });
  });

  it("qualquer outro valor é rejeitado", () => {
    expect(() => incluirInativosQuerySchema.parse({ incluirInativos: "1" })).toThrow();
  });
});

describe("dataNaoFutura (R3/R6)", () => {
  afterEach(() => vi.useRealTimers());

  it("aceita hoje e o passado, no fuso da fazenda", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T02:30:00Z")); // 2026-09-24 23:30 em SP
    expect(dataNaoFutura.safeParse("2026-09-24").success).toBe(true);
    expect(dataNaoFutura.safeParse("2020-01-01").success).toBe(true);
  });

  it("rejeita o futuro — inclusive 'amanhã' em UTC quando ainda é hoje em SP", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T02:30:00Z")); // ainda 2026-09-24 em SP
    const r = dataNaoFutura.safeParse("2026-09-25");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("A data não pode estar no futuro");
  });
});

describe("R7 — peso: mínimo 0,01 kg e arredondado a 2 casas", () => {
  it("arredonda para 2 casas", () => {
    const r = pesagemSchema.safeParse({ data: "2020-01-01", pesoKg: 120.567, tipo: "ROTINA" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.pesoKg).toBe(120.57);
  });

  it("0,004 não vira 0,00: é rejeitado pelo mínimo", () => {
    const r = pesagemSchema.safeParse({ data: "2020-01-01", pesoKg: 0.004, tipo: "ROTINA" });
    expect(r.success).toBe(false);
  });

  it("aceita o mínimo exato", () => {
    const r = pesagemSchema.safeParse({ data: "2020-01-01", pesoKg: 0.01, tipo: "ROTINA" });
    expect(r.success).toBe(true);
  });
});

describe("S1 — arrays com teto e sem repetição", () => {
  const animalBase = { propriedadeId: 1, data: "2020-01-01" };

  it("movimentarSchema aceita animalIds sem repetição", () => {
    expect(movimentarSchema.safeParse({ ...animalBase, animalIds: ["11111111-1111-1111-1111-111111111111"] }).success).toBe(true);
  });

  it("movimentarSchema rejeita animalIds repetidos", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const r = movimentarSchema.safeParse({ ...animalBase, animalIds: [id, id] });
    expect(r.success).toBe(false);
  });

  it("movimentarSchema rejeita mais de 2000 animalIds", () => {
    const ids = Array.from({ length: 2001 }, (_, i) => `11111111-1111-1111-1111-${String(i).padStart(12, "0")}`);
    expect(movimentarSchema.safeParse({ ...animalBase, animalIds: ids }).success).toBe(false);
  });

  it("reordenarCategoriasSchema rejeita ids repetidos e mais de 500", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    expect(reordenarCategoriasSchema.safeParse({ ids: [id, id] }).success).toBe(false);
    const muitos = Array.from({ length: 501 }, (_, i) => `11111111-1111-1111-1111-${String(i).padStart(12, "0")}`);
    expect(reordenarCategoriasSchema.safeParse({ ids: muitos }).success).toBe(false);
  });
});

describe("S2 — teto INT4 em propriedadeId", () => {
  it("cadastrarAnimalSchema rejeita propriedadeId acima do INT4", () => {
    const base = {
      brinco: "1", sexo: "F" as const, dataNascimento: "2020-01-01", origem: "COMPRADO" as const,
      dataEntrada: "2020-01-01", aptidao: "LEITE" as const, propriedadeId: 99999999999,
    };
    expect(cadastrarAnimalSchema.safeParse(base).success).toBe(false);
  });

  it("listarFiltrosSchema (query coerce) rejeita propriedadeId acima do INT4", () => {
    expect(listarFiltrosSchema.safeParse({ propriedadeId: "99999999999" }).success).toBe(false);
    expect(listarFiltrosSchema.safeParse({ propriedadeId: "1" }).success).toBe(true);
  });
});

describe("listarFiltrosSchema (filtros novos de Animais)", () => {
  const UUID = "0b8f5b8e-6f0c-4f6a-9d7e-2f1b1d3c4e5a";

  it("defaults: ordem por brinco asc, sem 'sem categoria'", () => {
    const f = listarFiltrosSchema.parse({});
    expect(f).toMatchObject({ ordenar: "brinco", direcao: "asc", semCategoria: false, situacao: "ATIVO", page: 1, pageSize: 20 });
  });

  it("converte a query string: idades viram número, 'true' vira booleano", () => {
    const f = listarFiltrosSchema.parse({
      sexo: "F", origem: "NASCIDO", racaId: UUID, idadeMinMeses: "11", idadeMaxMeses: "13",
      semCategoria: "true", tipoBaixa: "MORTE", baixaDe: "2026-01-01", baixaAte: "2026-01-31",
      ordenar: "nascimento", direcao: "desc", situacao: "BAIXADO",
    });
    expect(f).toMatchObject({
      sexo: "F", origem: "NASCIDO", racaId: UUID, idadeMinMeses: 11, idadeMaxMeses: 13, semCategoria: true,
      tipoBaixa: "MORTE", baixaDe: "2026-01-01", baixaAte: "2026-01-31", ordenar: "nascimento", direcao: "desc",
    });
    expect(listarFiltrosSchema.parse({ semCategoria: "false" }).semCategoria).toBe(false);
    expect(listarFiltrosSchema.parse({ categoriaOrigem: "MANUAL" }).categoriaOrigem).toBe("MANUAL");
  });

  it("recusa valores fora do contrato", () => {
    for (const q of [
      { sexo: "X" }, { origem: "HERDADO" }, { racaId: "abc" }, { idadeMinMeses: "-1" }, { idadeMaxMeses: "1.5" },
      { idadeMinMeses: "abc" }, { categoriaOrigem: "AUTOMATICA" }, { semCategoria: "1" }, { tipoBaixa: "SAIDA" },
      { baixaDe: "2026-13-01" }, { ordenar: "peso" }, { direcao: "up" },
    ]) {
      expect({ q, ok: listarFiltrosSchema.safeParse(q).success }).toEqual({ q, ok: false });
    }
  });

  it("'sem categoria' não combina com categoria escolhida nem com categoria forçada", () => {
    const r1 = listarFiltrosSchema.safeParse({ semCategoria: "true", categoriaId: UUID });
    expect(r1.success).toBe(false);
    expect(r1.error?.issues[0].path).toEqual(["semCategoria"]);
    expect(listarFiltrosSchema.safeParse({ semCategoria: "true", categoriaOrigem: "MANUAL" }).success).toBe(false);
    // categoria escolhida + forçada é válido (os forçados para ela)
    expect(listarFiltrosSchema.safeParse({ categoriaId: UUID, categoriaOrigem: "MANUAL" }).success).toBe(true);
    expect(listarFiltrosSchema.safeParse({ semCategoria: "false", categoriaId: UUID }).success).toBe(true);
  });

  it("faixas invertidas são recusadas; extremos iguais valem", () => {
    const idade = listarFiltrosSchema.safeParse({ idadeMinMeses: "13", idadeMaxMeses: "12" });
    expect(idade.success).toBe(false);
    expect(idade.error?.issues[0].path).toEqual(["idadeMaxMeses"]);
    expect(listarFiltrosSchema.safeParse({ idadeMinMeses: "12", idadeMaxMeses: "12" }).success).toBe(true);
    const baixa = listarFiltrosSchema.safeParse({ baixaDe: "2026-02-01", baixaAte: "2026-01-31" });
    expect(baixa.success).toBe(false);
    expect(baixa.error?.issues[0].path).toEqual(["baixaAte"]);
    expect(listarFiltrosSchema.safeParse({ baixaDe: "2026-02-01", baixaAte: "2026-02-01" }).success).toBe(true);
  });
});
