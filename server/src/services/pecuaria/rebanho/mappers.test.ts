import { describe, expect, it } from "vitest";
import { agregarPainel, mapearAnimalResumo, type AnimalResumo } from "./mappers.js";

const animalBase = {
  id: "a1",
  brinco: "123",
  nome: "Mimosa",
  sexo: "F" as const,
  dataNascimento: new Date("2024-01-15"),
  dataEntrada: new Date("2024-01-15"),
  origem: "NASCIDO" as const,
};

describe("mapearAnimalResumo", () => {
  it("calcula categoria, idade e rótulo de composição a partir dos dados brutos", () => {
    const resumo = mapearAnimalResumo({
      animal: animalBase,
      partos: 0,
      hoje: new Date("2024-11-15"),
      propriedade: { id: 1, nome: "Mexicana" },
      lote: { id: "l1", nome: "Bezerreiro" },
      destino: { aptidao: "LEITE", papelReprodutivo: "NENHUM" },
      composicao: [{ sigla: "HO", fracao64: 48 }, { sigla: "GO", fracao64: 16 }],
      ultimoPeso: { pesoKg: 120.5, data: new Date("2024-11-01") },
      situacao: "ATIVO",
    });

    expect(resumo.categoria).toBe("BEZERRA");
    expect(resumo.idadeMeses).toBe(10);
    expect(resumo.propriedade).toEqual({ id: 1, nome: "Mexicana" });
    expect(resumo.lote).toEqual({ id: "l1", nome: "Bezerreiro" });
    expect(resumo.composicaoRotulo).toBe("3/4 HO, 1/4 GO");
    expect(resumo.ultimoPeso).toEqual({ kg: 120.5, data: "2024-11-01" });
    expect(resumo.situacao).toBe("ATIVO");
  });

  it("vaca com pelo menos um parto, mesmo jovem por idade", () => {
    const resumo = mapearAnimalResumo({
      animal: { ...animalBase, dataNascimento: new Date("2022-01-01") },
      partos: 1,
      hoje: new Date("2024-11-15"),
      propriedade: null,
      lote: null,
      destino: null,
      composicao: [],
      ultimoPeso: null,
      situacao: "SAIU",
    });

    expect(resumo.categoria).toBe("VACA");
    expect(resumo.propriedade).toBeNull();
    expect(resumo.aptidao).toBeNull();
    expect(resumo.composicaoRotulo).toBe("Desconhecida");
    expect(resumo.ultimoPeso).toBeNull();
    expect(resumo.situacao).toBe("SAIU");
  });
});

describe("agregarPainel", () => {
  const base = (over: Partial<AnimalResumo>): AnimalResumo => ({
    id: "x", brinco: "1", nome: null, sexo: "F", categoria: "VACA", idadeMeses: 40, dataNascimento: "2023-01-01",
    dataEntrada: "2023-01-01", origem: "NASCIDO", propriedade: { id: 1, nome: "Principal" }, lote: null,
    aptidao: "LEITE", papelReprodutivo: "NENHUM", composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO", ...over,
  });

  it("conta só ativos, por categoria (ordem fixa) e por sítio, e receptoras entre fêmeas", () => {
    const p = agregarPainel([
      base({ id: "1", papelReprodutivo: "RECEPTORA", propriedade: { id: 2, nome: "Mexicana" } }),
      base({ id: "2", categoria: "BEZERRA" }),
      base({ id: "3", sexo: "M", categoria: "TOURO" }),
      base({ id: "4", situacao: "SAIU" }),
    ]);
    expect(p.totalAtivos).toBe(3);
    expect(p.porCategoria).toEqual([{ categoria: "BEZERRA", total: 1 }, { categoria: "VACA", total: 1 }, { categoria: "TOURO", total: 1 }]);
    expect(p.porSitio).toEqual([{ propriedadeId: 1, nome: "Principal", total: 2 }, { propriedadeId: 2, nome: "Mexicana", total: 1 }]);
    expect(p.femeasAtivas).toBe(2);
    expect(p.receptorasAtivas).toBe(1);
  });
});
