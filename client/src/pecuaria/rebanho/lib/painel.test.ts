import { describe, expect, it } from "vitest";
import type { AnimalResumo } from "../types";
import { agruparParaPainel } from "./painel";

function animal(overrides: Partial<AnimalResumo>): AnimalResumo {
  return {
    id: "id",
    brinco: "1",
    nome: null,
    sexo: "F",
    categoria: "VACA",
    idadeMeses: 40,
    dataNascimento: "2022-01-01",
    dataEntrada: "2022-01-01",
    origem: "NASCIDO",
    propriedade: { id: 1, nome: "Mexicana" },
    lote: null,
    aptidao: "LEITE",
    papelReprodutivo: "NENHUM",
    composicaoRotulo: "Desconhecida",
    ultimoPeso: null,
    situacao: "ATIVO",
    ...overrides,
  };
}

describe("agruparParaPainel", () => {
  it("conta só ativos, agrupa por categoria e por sítio, e calcula % de receptoras entre fêmeas", () => {
    const animais: AnimalResumo[] = [
      animal({ id: "1", categoria: "VACA", propriedade: { id: 1, nome: "Mexicana" } }),
      animal({ id: "2", categoria: "VACA", propriedade: { id: 1, nome: "Mexicana" }, papelReprodutivo: "RECEPTORA" }),
      animal({ id: "3", categoria: "NOVILHA", propriedade: { id: 2, nome: "Principal" } }),
      animal({ id: "4", categoria: "TOURO", sexo: "M", propriedade: { id: 2, nome: "Principal" }, papelReprodutivo: null, aptidao: "CORTE" }),
      animal({ id: "5", situacao: "SAIU" }),
    ];

    const resumo = agruparParaPainel(animais);

    expect(resumo.totalAtivos).toBe(4);
    expect(resumo.porCategoria).toEqual([
      { categoria: "NOVILHA", rotulo: "Novilha", total: 1 },
      { categoria: "VACA", rotulo: "Vaca", total: 2 },
      { categoria: "TOURO", rotulo: "Touro", total: 1 },
    ]);
    expect(resumo.porSitio).toEqual([
      { propriedadeId: 1, nome: "Mexicana", total: 2 },
      { propriedadeId: 2, nome: "Principal", total: 2 },
    ]);
    // 3 fêmeas ativas, 1 receptora => 33.33%
    expect(resumo.pctReceptoras).toBeCloseTo(33.333, 2);
  });

  it("devolve zeros com lista vazia", () => {
    const resumo = agruparParaPainel([]);
    expect(resumo.totalAtivos).toBe(0);
    expect(resumo.porCategoria).toEqual([]);
    expect(resumo.porSitio).toEqual([]);
    expect(resumo.pctReceptoras).toBe(0);
  });
});

describe("painelDoServidor", () => {
  it("adapta as contagens do servidor com rótulo e % de receptoras", async () => {
    const { painelDoServidor } = await import("./painel");
    const r = painelDoServidor({
      totalAtivos: 522,
      porCategoria: [{ categoria: "VACA", total: 300 }],
      porSitio: [{ propriedadeId: 1, nome: "Principal", total: 522 }],
      femeasAtivas: 400,
      receptorasAtivas: 100,
    });
    expect(r.totalAtivos).toBe(522);
    expect(r.porCategoria[0]).toMatchObject({ categoria: "VACA", total: 300 });
    expect(r.porCategoria[0].rotulo).toBeTruthy();
    expect(r.pctReceptoras).toBe(25);
  });
});
