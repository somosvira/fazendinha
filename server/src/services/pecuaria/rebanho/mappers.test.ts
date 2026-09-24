import { describe, expect, it } from "vitest";
import { agregarPainel, mapearAnimalResumo, resumoAuditoria, type AnimalResumo } from "./mappers.js";

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
      categoria: { categoria: { id: "c-ec", nome: "Em crescimento" }, origem: "AUTOMATICA", calculada: { id: "c-ec", nome: "Em crescimento" } },
      hoje: new Date("2024-11-15"),
      propriedade: { id: 1, nome: "Mexicana" },
      lote: { id: "l1", nome: "Bezerreiro" },
      destino: { aptidao: "LEITE", papelReprodutivo: "NENHUM" },
      composicao: [{ sigla: "HO", fracao64: 48 }, { sigla: "GO", fracao64: 16 }],
      ultimoPeso: { pesoKg: 120.5, data: new Date("2024-11-01") },
      situacao: "ATIVO",
    });

    expect(resumo.categoria).toEqual({ id: "c-ec", nome: "Em crescimento" });
    expect(resumo.categoriaOrigem).toBe("AUTOMATICA");
    expect(resumo.idadeMeses).toBe(10);
    expect(resumo.propriedade).toEqual({ id: 1, nome: "Mexicana" });
    expect(resumo.lote).toEqual({ id: "l1", nome: "Bezerreiro" });
    expect(resumo.composicaoRotulo).toBe("3/4 HO, 1/4 GO");
    expect(resumo.ultimoPeso).toEqual({ kg: 120.5, data: "2024-11-01" });
    expect(resumo.situacao).toBe("ATIVO");
    expect(resumo.idadeNaBaixa).toBe(false);
  });

  it("K5: idadeNaBaixa é repassado quando informado (animal baixado, idade calculada na data da baixa)", () => {
    const resumo = mapearAnimalResumo({
      animal: animalBase,
      categoria: { categoria: { id: "c-ec", nome: "Em crescimento" }, origem: "AUTOMATICA", calculada: { id: "c-ec", nome: "Em crescimento" } },
      hoje: new Date("2024-06-01"),
      propriedade: null,
      lote: null,
      destino: null,
      composicao: [],
      ultimoPeso: null,
      situacao: "BAIXADO",
      idadeNaBaixa: true,
    });
    expect(resumo.idadeNaBaixa).toBe(true);
    expect(resumo.idadeMeses).toBe(4); // 2024-01-15 → 2024-06-01
  });

  it("mantém a situação BAIXADO repassada", () => {
    const resumo = mapearAnimalResumo({
      animal: { ...animalBase, dataNascimento: new Date("2022-01-01") },
      categoria: { categoria: { id: "c-vaca", nome: "Vaca" }, origem: "AUTOMATICA", calculada: { id: "c-vaca", nome: "Vaca" } },
      hoje: new Date("2024-11-15"),
      propriedade: null,
      lote: null,
      destino: null,
      composicao: [],
      ultimoPeso: null,
      situacao: "BAIXADO",
    });
    expect(resumo.situacao).toBe("BAIXADO");
  });

  it("repassa categoria manual e a calculada lado a lado", () => {
    const resumo = mapearAnimalResumo({
      animal: { ...animalBase, dataNascimento: new Date("2022-01-01") },
      categoria: { categoria: { id: "c-vaca", nome: "Vaca" }, origem: "MANUAL", calculada: { id: "c-nov", nome: "Novilha" } },
      hoje: new Date("2024-11-15"),
      propriedade: null,
      lote: null,
      destino: null,
      composicao: [],
      ultimoPeso: null,
      situacao: "BAIXADO",
    });

    expect(resumo.categoria).toEqual({ id: "c-vaca", nome: "Vaca" });
    expect(resumo.categoriaOrigem).toBe("MANUAL");
    expect(resumo.categoriaCalculada).toEqual({ id: "c-nov", nome: "Novilha" });
    expect(resumo.propriedade).toBeNull();
    expect(resumo.aptidao).toBeNull();
    expect(resumo.composicaoRotulo).toBe("Desconhecida");
    expect(resumo.ultimoPeso).toBeNull();
    expect(resumo.situacao).toBe("BAIXADO");
  });
});

describe("agregarPainel", () => {
  const VACA = { id: "c-vaca", nome: "Vaca" };
  const EC_F = { id: "c-ecf", nome: "Em crescimento" };
  const REPRODUTOR = { id: "c-rep", nome: "Reprodutor" };
  const base = (over: Partial<AnimalResumo>): AnimalResumo => ({
    id: "x", brinco: "1", nome: null, sexo: "F", categoria: VACA, categoriaOrigem: "AUTOMATICA", categoriaCalculada: VACA, idadeMeses: 40, idadeNaBaixa: false, dataNascimento: "2023-01-01",
    dataEntrada: "2023-01-01", origem: "NASCIDO", propriedade: { id: 1, nome: "Principal" }, lote: null,
    aptidao: "LEITE", papelReprodutivo: "NENHUM", composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO", ...over,
  });

  it("conta só ativos, por categoria (na ordem da configuração, sem categoria por último) e por sítio, e receptoras entre fêmeas", () => {
    const p = agregarPainel([
      base({ id: "1", papelReprodutivo: "RECEPTORA", propriedade: { id: 2, nome: "Mexicana" } }),
      base({ id: "2", categoria: EC_F }),
      base({ id: "3", sexo: "M", categoria: REPRODUTOR }),
      base({ id: "4", situacao: "BAIXADO" }),
      base({ id: "5", sexo: "M", categoria: null, categoriaOrigem: "SEM_CATEGORIA" }),
    ], new Map([["c-vaca", 10], ["c-ecf", 20], ["c-rep", 50]]));
    expect(p.totalAtivos).toBe(4);
    expect(p.porCategoria).toEqual([{ categoria: VACA, total: 1 }, { categoria: EC_F, total: 1 }, { categoria: REPRODUTOR, total: 1 }, { categoria: null, total: 1 }]);
    expect(p.porSitio).toEqual([{ propriedadeId: 1, nome: "Principal", total: 3 }, { propriedadeId: 2, nome: "Mexicana", total: 1 }]);
    expect(p.femeasAtivas).toBe(2);
    expect(p.receptorasAtivas).toBe(1);
  });
});

describe("resumoAuditoria", () => {
  it("traduz combinações conhecidas de entidade + ação", () => {
    expect(resumoAuditoria("Animal", "CADASTRO")).toBe("Cadastro do animal");
    expect(resumoAuditoria("BaixaAnimal", "BAIXA")).toBe("Baixa registrada");
    expect(resumoAuditoria("BaixaAnimal", "ESTORNO")).toBe("Baixa estornada");
    expect(resumoAuditoria("MotivoBaixa", "CADASTRO")).toBe("Motivo de baixa cadastrado");
    expect(resumoAuditoria("MotivoBaixa", "EDICAO")).toBe("Motivo de baixa editado");
    expect(resumoAuditoria("Pesagem", "EXCLUSAO")).toBe("Pesagem excluída");
  });

  it("cai num rótulo genérico para combinações não mapeadas", () => {
    expect(resumoAuditoria("Raca", "CADASTRO")).toBe("Raca — CADASTRO");
  });
});
