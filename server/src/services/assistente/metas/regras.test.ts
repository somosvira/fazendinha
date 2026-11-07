import { describe, expect, it } from "vitest";
import {
  definicaoSchema,
  avaliarMeta,
  indicadoresPermitidos,
} from "./regras.js";
const usuario = { dono: false, areas: ["pecuaria"], flags: [], abas: [] };
const base = {
  titulo: "Leite",
  indicadorId: "leite_volume",
  indicadorVersao: 1,
  tipo: "minimo",
  minimo: 3600,
  maximo: null,
  periodo: "diario",
  prazo: null,
  fonte: "manual",
  observacao: "",
};
describe("metas — definição e ausência", () => {
  it("valida faixa, prazo de marco e limites sem inferir mortalidade", () => {
    expect(
      definicaoSchema.safeParse({ ...base, tipo: "faixa", maximo: 3000 })
        .success,
    ).toBe(false);
    expect(
      definicaoSchema.safeParse({ ...base, tipo: "marco", minimo: null })
        .success,
    ).toBe(false);
    expect(definicaoSchema.safeParse(base).success).toBe(true);
  });
  it("não inventa evolução ou progresso e aceita zero", () => {
    expect(avaliarMeta(base as never, null)).toBe("sem_medicao");
    expect(avaliarMeta(base as never, { valor: 0, concluido: null })).toBe(
      "fora_do_alvo",
    );
    expect(avaliarMeta(base as never, { valor: 3600, concluido: null })).toBe(
      "no_alvo",
    );
  });
  it("protege catálogo financeiro sem ocultar pecuária sem custos", () => {
    const ids = indicadoresPermitidos(usuario).map((i) => i.id);
    expect(ids).toContain("ccs");
    expect(ids).not.toContain("resultado_financeiro");
    expect(
      indicadoresPermitidos({
        ...usuario,
        areas: ["financeiro"],
        flags: ["verValores", "verInvestimento", "verSalarios"],
        abas: ["dashboard"],
      }),
    ).toHaveLength(1);
  });
  it("catálogo financeiro some quando qualquer flag de valores é revogada", () => {
    const financeiro = {
      dono: false,
      areas: ["financeiro"],
      abas: ["dashboard"],
      flags: ["verValores", "verInvestimento", "verSalarios"],
    };
    for (const flag of financeiro.flags)
      expect(
        indicadoresPermitidos({
          ...financeiro,
          flags: financeiro.flags.filter((f) => f !== flag),
        }),
      ).toEqual([]);
  });
  it("máximo e marco têm semântica própria", () => {
    expect(
      avaliarMeta(
        { ...base, tipo: "maximo", minimo: null, maximo: 300000 } as never,
        { valor: 299000, concluido: null },
      ),
    ).toBe("no_alvo");
    expect(
      avaliarMeta({ ...base, tipo: "marco" } as never, {
        valor: null,
        concluido: false,
      }),
    ).toBe("em_aberto");
  });
});
