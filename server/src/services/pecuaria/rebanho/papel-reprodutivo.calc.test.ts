import { describe, expect, it } from "vitest";
import { resolverPapelReprodutivo } from "./papel-reprodutivo.calc.js";
const dia = (d: string) => new Date(`2026-10-${d}`);
const periodo = { id: "importado", tipo: "RECEPTORA", inicio: dia("01"), fim: dia("10") };
describe("papel reprodutivo histórico", () => {
  it("mantém ausência desconhecida e respeita os limites do período", () => {
    expect(resolverPapelReprodutivo([], dia("01"))).toMatchObject({ papel: null, estado: "DESCONHECIDO" });
    expect(resolverPapelReprodutivo([periodo], dia("01"))).toMatchObject({ papel: "RECEPTORA", estado: "CONHECIDO" });
    expect(resolverPapelReprodutivo([periodo], dia("10"))).toMatchObject({ papel: null, estado: "DESCONHECIDO" });
  });
  it("não escolhe uma fonte por prioridade, ordem ou data de importação", () => {
    const outro = { ...periodo, id: "destino", tipo: "NENHUM" };
    const esperado = { papel: null, estado: "CONFLITO", evidencias: ["destino", "importado"] };
    expect(resolverPapelReprodutivo([periodo, outro], dia("05"))).toEqual(esperado);
    expect(resolverPapelReprodutivo([outro, periodo], dia("05"))).toEqual(esperado);
    expect(resolverPapelReprodutivo([periodo, { ...outro, tipo: "DOADORA" }], dia("05")).estado).toBe("CONFLITO");
  });
  it("evidências concordantes não conflitam e desfazer preserva a anterior", () => {
    const outro = { ...periodo, id: "manual", fim: null };
    expect(resolverPapelReprodutivo([periodo, outro], dia("05")).papel).toBe("RECEPTORA");
    expect(resolverPapelReprodutivo([{ ...outro, tipo: "NENHUM", revogadoEm: dia("06") }, periodo], dia("05")).papel).toBe("RECEPTORA");
  });
});
