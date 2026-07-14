import { describe, it, expect } from "vitest";
import { validarConsulta, gerarParametrosTool, ConsultaInvalidaError } from "./validacao.js";
import { financeiro } from "./registro/financeiro.js";
import { rebanho } from "./registro/rebanho.js";
import { obterDominio } from "./registro/index.js";

const valida = (input: unknown) => validarConsulta(financeiro, input, obterDominio);

describe("validarConsulta — entidade", () => {
  it("aplica defaults: regime realizado e limite 20", () => {
    const c = valida({ entidade: "lancamento", metricas: ["valorTotal"] });
    expect(c).toMatchObject({ tipo: "entidade", regime: "realizado", limite: 20 });
  });

  it("métrica inexistente → erro listando as válidas", () => {
    expect(() => valida({ entidade: "lancamento", metricas: ["total"] })).toThrowError(/'valorTotal'/);
  });

  it("entidade inexistente → erro listando as válidas", () => {
    expect(() => valida({ entidade: "nota", metricas: ["valorTotal"] })).toThrowError(/'lancamento'/);
  });

  it("dimensão inexistente no filtro → erro listando as válidas", () => {
    expect(() =>
      valida({
        entidade: "lancamento",
        metricas: ["valorTotal"],
        filtros: [{ dimensao: "fornecedor", operador: "contem", valor: "x" }],
      }),
    ).toThrowError(/'clienteFornecedor'/);
  });

  it("operador não permitido na dimensão → erro", () => {
    expect(() =>
      valida({
        entidade: "lancamento",
        metricas: ["valorTotal"],
        filtros: [{ dimensao: "natureza", operador: "contem", valor: "DEB" }],
      }),
    ).toThrowError(/não é permitido/);
  });

  it("valor fora do enum → erro listando os válidos", () => {
    expect(() =>
      valida({
        entidade: "lancamento",
        metricas: ["valorTotal"],
        filtros: [{ dimensao: "natureza", operador: "igual", valor: "SAIDA" }],
      }),
    ).toThrowError(/'CREDITO', 'DEBITO'/);
  });

  it("operador 'em' exige lista; os demais exigem string", () => {
    expect(() =>
      valida({
        entidade: "lancamento",
        metricas: ["valorTotal"],
        filtros: [{ dimensao: "categoria", operador: "em", valor: "x" }],
      }),
    ).toThrowError(/LISTA/);
    expect(() =>
      valida({
        entidade: "lancamento",
        metricas: ["valorTotal"],
        filtros: [{ dimensao: "categoria", operador: "igual", valor: ["x"] }],
      }),
    ).toThrowError(/ÚNICO/);
  });

  it("dimensão só-filtro (busca) não pode ir em agruparPor", () => {
    expect(() =>
      valida({ entidade: "lancamento", metricas: ["valorTotal"], agruparPor: ["busca"] }),
    ).toThrowError(/não é agrupável/);
  });

  it("datas malformadas e período invertido → erro", () => {
    expect(() => valida({ entidade: "lancamento", metricas: ["valorTotal"], de: "01/01/2026" })).toThrow(
      ConsultaInvalidaError,
    );
    expect(() =>
      valida({ entidade: "lancamento", metricas: ["valorTotal"], de: "2026-02-01", ate: "2026-01-01" }),
    ).toThrowError(/depois de/);
  });

  it("ordenarPor.alvo deve ser métrica pedida", () => {
    expect(() =>
      valida({
        entidade: "lancamento",
        metricas: ["valorTotal"],
        ordenarPor: { alvo: "valorMedio", direcao: "desc" },
      }),
    ).toThrowError(/ordenarPor/);
  });

  it("comparação de períodos exige o período A completo", () => {
    expect(() =>
      valida({
        entidade: "lancamento",
        metricas: ["valorTotal"],
        comparar: { tipo: "periodos", deB: "2025-01-01", ateB: "2025-12-31" },
      }),
    ).toThrowError(/período A/);
  });

  it("snapshot (animal) não aceita período nem comparação temporal", () => {
    const validaReb = (input: unknown) => validarConsulta(rebanho, input, obterDominio);
    expect(() => validaReb({ entidade: "animal", metricas: ["numAnimais"], de: "2026-01-01" })).toThrowError(
      /snapshot/,
    );
    expect(() =>
      validaReb({ entidade: "animal", metricas: ["numAnimais"], granularidadeTempo: "mes" }),
    ).toThrowError(/snapshot/);
    // comparar por fatias segue permitido num snapshot
    const c = validaReb({
      entidade: "animal",
      metricas: ["numAnimais"],
      comparar: { tipo: "fatias", dimensao: "raca", valorA: "Girolando", valorB: "Holandês" },
    });
    expect(c.tipo).toBe("entidade");
  });
});

describe("validarConsulta — razão", () => {
  it("razão desconhecida → erro listando as válidas", () => {
    expect(() => valida({ razao: "custoPorArroba" })).toThrowError(/'custoPorLitro'/);
  });

  it("filtro fora de aceitaFiltros → erro", () => {
    expect(() =>
      valida({ razao: "custoPorLitro", filtros: [{ dimensao: "pessoa", operador: "contem", valor: "Marcos" }] }),
    ).toThrowError(/não aceita filtro/);
  });

  it("granularidade não instrumentada → erro", () => {
    expect(() => valida({ razao: "custoPorLitro", granularidadeTempo: "ano" })).toThrowError(/granularidades/);
  });

  it("razão não combina com entidade/metricas", () => {
    expect(() => valida({ razao: "custoPorLitro", entidade: "lancamento", metricas: ["valorTotal"] })).toThrowError(
      /não passe/,
    );
  });

  it("razão válida com filtro aceito passa", () => {
    const c = valida({
      razao: "custoPorLitro",
      granularidadeTempo: "mes",
      de: "2026-01-01",
      ate: "2026-06-30",
      filtros: [{ dimensao: "centroCusto", operador: "contem", valor: "Leiteira" }],
    });
    expect(c).toMatchObject({ tipo: "razao", razao: "custoPorLitro" });
  });
});

describe("gerarParametrosTool", () => {
  it("expõe enums do registro (entidades, métricas, dimensões agrupáveis)", () => {
    const p = gerarParametrosTool(financeiro) as Record<string, Record<string, unknown>>;
    const props = p.properties as Record<string, { enum?: string[]; items?: { enum?: string[] } }>;
    expect(props.entidade.enum).toEqual(["lancamento"]);
    expect(props.metricas.items!.enum).toContain("valorTotal");
    expect(props.agruparPor.items!.enum).toContain("categoria");
    expect(props.agruparPor.items!.enum).not.toContain("busca"); // só-filtro
    expect(props.razao.enum).toEqual(["custoPorLitro", "receitaPorLitro"]);
  });

  it("domínio sem razões não expõe o parâmetro razao", () => {
    const p = gerarParametrosTool(rebanho) as Record<string, Record<string, unknown>>;
    expect((p.properties as Record<string, unknown>).razao).toBeUndefined();
  });
});
