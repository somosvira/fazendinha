import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { agregar, compararAgregados, dividirAgregados, type ParamsAgregacao } from "./agregador.js";
import type { DimensaoDef, LinhaBase, MetricaDef } from "./tipos.js";

const D = Prisma.Decimal;

// Defs mínimas de teste (o shape é o mesmo dos registros reais).
const dimCategoria: DimensaoDef = {
  descricao: "",
  tipo: "texto",
  cardinalidade: "baixa",
  operadores: ["contem"],
  agrupavel: true,
  where: () => ({}),
  rotulo: (l) => (l.categoria as { nome: string } | null)?.nome ?? "(sem categoria)",
};
const dimNatureza: DimensaoDef = {
  descricao: "",
  tipo: "enum",
  cardinalidade: "baixa",
  operadores: ["igual"],
  agrupavel: true,
  where: () => ({}),
};
const soma: MetricaDef = {
  descricao: "",
  agregacao: "soma",
  valor: (l) => (l.valor as InstanceType<typeof D> | null) ?? null,
  formato: "reais",
};
const media: MetricaDef = { ...soma, agregacao: "media" };
const contagem: MetricaDef = { descricao: "", agregacao: "contagem", formato: "inteiro" };
const distintos: MetricaDef = {
  descricao: "",
  agregacao: "contagem_distinta",
  valor: (l) => (l.data instanceof Date ? l.data.toISOString().slice(0, 10) : null),
  formato: "inteiro",
};

const linha = (categoria: string | null, valor: string, data = "2026-01-15"): LinhaBase => ({
  categoria: categoria ? { nome: categoria } : null,
  valor: new D(valor),
  data: new Date(`${data}T00:00:00.000Z`),
});

const params = (extra: Partial<ParamsAgregacao> = {}): ParamsAgregacao => ({
  dimensoes: [{ nome: "categoria", def: dimCategoria }],
  metricas: [{ nome: "valorTotal", def: soma }],
  campoData: "data",
  limite: 20,
  ...extra,
});

describe("agregar", () => {
  it("soma em Decimal sem drift de float", () => {
    const linhas = [linha("A", "0.1"), linha("A", "0.1"), linha("A", "0.1")];
    const ag = agregar(linhas, params());
    expect(ag.grupos[0].metricas.valorTotal).toBe(0.3); // 0.1+0.1+0.1 ≠ 0.30000000000000004
    expect(ag.totais.valorTotal).toBe(0.3);
  });

  it("agrupa por 2 dimensões × bucket mensal", () => {
    const linhas = [
      { ...linha("A", "10", "2026-01-05"), natureza: "DEBITO" },
      { ...linha("A", "5", "2026-01-20"), natureza: "DEBITO" },
      { ...linha("A", "7", "2026-02-01"), natureza: "DEBITO" },
      { ...linha("B", "3", "2026-01-10"), natureza: "CREDITO" },
    ];
    const ag = agregar(
      linhas,
      params({
        dimensoes: [
          { nome: "categoria", def: dimCategoria },
          { nome: "natureza", def: dimNatureza },
        ],
        granularidadeTempo: "mes",
      }),
    );
    expect(ag.numGrupos).toBe(3);
    const g = ag.grupos.find((x) => x.chaves.categoria === "A" && x.tempo === "2026-01");
    expect(g?.metricas.valorTotal).toBe(15);
    expect(g?.chaves).toEqual({ categoria: "A", natureza: "DEBITO" });
    expect(ag.totais.valorTotal).toBe(25);
  });

  it("top-N marca truncado mas os totais cobrem TODAS as linhas", () => {
    const linhas = [linha("A", "100"), linha("B", "50"), linha("C", "10"), linha("D", "1")];
    const ag = agregar(linhas, params({ limite: 2 }));
    expect(ag.truncado).toBe(true);
    expect(ag.numGrupos).toBe(4);
    expect(ag.grupos.map((g) => g.chaves.categoria)).toEqual(["A", "B"]); // 1ª métrica desc
    expect(ag.totais.valorTotal).toBe(161);
  });

  it("media ignora valores nulos; contagem conta todas as linhas", () => {
    const linhas: LinhaBase[] = [
      { categoria: { nome: "A" }, valor: new D("10") },
      { categoria: { nome: "A" }, valor: null },
      { categoria: { nome: "A" }, valor: new D("20") },
    ];
    const ag = agregar(
      linhas,
      params({
        metricas: [
          { nome: "valorMedio", def: media },
          { nome: "n", def: contagem },
        ],
      }),
    );
    expect(ag.grupos[0].metricas.valorMedio).toBe(15);
    expect(ag.grupos[0].metricas.n).toBe(3);
  });

  it("contagem_distinta conta chaves distintas (dias)", () => {
    const linhas = [linha("A", "1", "2026-01-01"), linha("A", "1", "2026-01-01"), linha("A", "1", "2026-01-02")];
    const ag = agregar(linhas, params({ metricas: [{ nome: "dias", def: distintos }] }));
    expect(ag.grupos[0].metricas.dias).toBe(2);
  });

  it("série temporal sem dimensões ordena por tempo asc", () => {
    const linhas = [linha("A", "1", "2026-03-01"), linha("A", "9", "2026-01-01"), linha("A", "5", "2026-02-01")];
    const ag = agregar(linhas, params({ dimensoes: [], granularidadeTempo: "mes" }));
    expect(ag.grupos.map((g) => g.tempo)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
});

describe("compararAgregados", () => {
  const metricas = [{ nome: "valorTotal", def: soma }];
  it("delta e deltaPct calculados; base 0 → deltaPct null; ausente aditivo = 0", () => {
    const agA = agregar([linha("A", "150"), linha("C", "30")], params());
    const agB = agregar([linha("A", "100"), linha("B", "40")], params());
    const comp = compararAgregados(agA, agB, metricas);

    const a = comp.porGrupo.find((g) => g.chaves.categoria === "A")!.metricas.valorTotal;
    expect(a).toEqual({ valorA: 150, valorB: 100, delta: 50, deltaPct: 50 });

    // C só existe em A: lado B vale 0 (soma é aditiva) e deltaPct é null (base 0)
    const cCel = comp.porGrupo.find((g) => g.chaves.categoria === "C")!.metricas.valorTotal;
    expect(cCel).toEqual({ valorA: 30, valorB: 0, delta: 30, deltaPct: null });

    expect(comp.somenteA).toEqual([{ categoria: "C" }]);
    expect(comp.somenteB).toEqual([{ categoria: "B" }]);
    expect(comp.totais.valorTotal).toMatchObject({ valorA: 180, valorB: 140, delta: 40 });
  });

  it("queda vira delta negativo com percentual sobre a base", () => {
    const agA = agregar([linha("A", "80")], params());
    const agB = agregar([linha("A", "100")], params());
    const comp = compararAgregados(agA, agB, metricas);
    expect(comp.porGrupo[0].metricas.valorTotal).toEqual({
      valorA: 80,
      valorB: 100,
      delta: -20,
      deltaPct: -20,
    });
  });
});

describe("dividirAgregados", () => {
  it("alinha buckets e divide com Decimal; bucket sem denominador → null + buraco", () => {
    const pSerie = (metrica: string, def: MetricaDef) =>
      params({ dimensoes: [], granularidadeTempo: "mes" as const, metricas: [{ nome: metrica, def }] });
    const num = agregar(
      [linha("x", "300", "2026-01-10"), linha("x", "200", "2026-02-10")],
      pSerie("valorTotal", soma),
    );
    const den = agregar([linha("x", "100", "2026-01-05")], pSerie("litros", soma));

    const r = dividirAgregados(num, den, "valorTotal", "litros");
    expect(r.linhas).toEqual([
      { tempo: "2026-01", numerador: 300, denominador: 100, razao: 3 },
      { tempo: "2026-02", numerador: 200, denominador: null, razao: null },
    ]);
    expect(r.buracos).toEqual(["2026-02"]);
    expect(r.total).toEqual({ numerador: 500, denominador: 100, razao: 5 });
  });
});
