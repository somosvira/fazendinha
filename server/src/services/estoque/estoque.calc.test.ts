import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { saldoProduto, custoVacaDia, custoMedioProduto, valorSaidaPreciso, valorSaidaDaBase, entraNoCustoMedio, consolidarSaldo, faltasDeSaldo, saldosAposEstorno, type MovIn, type MovCustoIn } from "./estoque.calc.js";

const HOJE = "2026-06-17";

describe("saldoProduto", () => {
  it("entrada soma e saída subtrai (saldo + valor)", () => {
    const movs: MovIn[] = [
      { tipo: "ENTRADA", quantidade: 100, valorTotal: 200, data: HOJE },
      { tipo: "SAIDA", quantidade: 30, valorTotal: 60, data: HOJE },
    ];
    expect(saldoProduto(movs)).toEqual({ saldo: 70, valor: 140 });
  });

  it("lista vazia → saldo e valor zero", () => {
    expect(saldoProduto([])).toEqual({ saldo: 0, valor: 0 });
  });

  it("AJUSTE com quantidade negativa subtrai (mesmo sinal no valor)", () => {
    const movs: MovIn[] = [
      { tipo: "ENTRADA", quantidade: 100, valorTotal: 200, data: HOJE },
      { tipo: "AJUSTE", quantidade: -10, valorTotal: -20, data: HOJE },
    ];
    expect(saldoProduto(movs)).toEqual({ saldo: 90, valor: 180 });
  });

  it("saldo com 3 casas decimais é preservado (não arredonda para 2)", () => {
    const movs: MovIn[] = [
      { tipo: "ENTRADA", quantidade: 2.505, valorTotal: 10, data: HOJE },
      { tipo: "SAIDA", quantidade: 1.5, valorTotal: 5, data: HOJE },
    ];
    // 2.505 - 1.5 = 1.005 — precisa da 3ª casa para não virar 1 ou 1.01
    expect(saldoProduto(movs)).toEqual({ saldo: 1.005, valor: 5 });
  });

  it("valor (dinheiro) continua arredondado a 2 casas mesmo com quantidade em 3", () => {
    const movs: MovIn[] = [{ tipo: "ENTRADA", quantidade: 1.123, valorTotal: 10.999, data: HOJE }];
    expect(saldoProduto(movs)).toEqual({ saldo: 1.123, valor: 11 });
  });
});

describe("custoVacaDia", () => {
  it("consumo ÷ (vacas × dias)", () => {
    // 2100 / (7 * 30) = 10
    expect(custoVacaDia([{ valorTotal: 2100, data: HOJE }], 7, HOJE, 30)).toBe(10);
  });

  it("vacas em lactação = 0 → null", () => {
    expect(custoVacaDia([{ valorTotal: 2100, data: HOJE }], 0, HOJE, 30)).toBeNull();
  });

  it("saída fora do período (mais de 30 dias atrás) é ignorada", () => {
    const antiga = "2026-04-01"; // > 30 dias antes de 2026-06-17
    expect(custoVacaDia([{ valorTotal: 2100, data: antiga }], 7, HOJE, 30)).toBe(0);
  });
});

describe("custoMedioProduto", () => {
  const D = (v: number | string) => new Prisma.Decimal(v);
  const compra = (q: number, v: number, extra: Partial<MovCustoIn> = {}): MovCustoIn => ({ tipo: "ENTRADA", origem: "COMPRA", status: "CONFIRMADO", reversaoDeId: null, quantidade: D(q), valorTotal: D(v), ...extra });

  it("sem entradas → custo null", () => {
    const r = custoMedioProduto([]);
    expect(r.custoMedio).toBeNull();
    expect(r.quantidade.toNumber()).toBe(0);
    expect(r.valor.toNumber()).toBe(0);
  });

  it("duas compras 10×5 + 10×7 → 6", () => {
    const r = custoMedioProduto([compra(10, 50), compra(10, 70)]);
    expect(r.custoMedio?.toNumber()).toBe(6);
    expect(r.quantidade.toNumber()).toBe(20);
    expect(r.valor.toNumber()).toBe(120);
  });

  it("compra estornada (original REVERTIDO + inverso) é ignorada", () => {
    const r = custoMedioProduto([
      compra(10, 50),
      compra(10, 70, { status: "REVERTIDO" }),
      { tipo: "SAIDA", origem: "AJUSTE_INVENTARIO", status: "CONFIRMADO", reversaoDeId: 2, quantidade: D(10), valorTotal: D(70) },
    ]);
    expect(r.custoMedio?.toNumber()).toBe(5);
  });

  it("inverso de entrada com reversaoDeId nunca entra, mesmo se ENTRADA", () => {
    expect(custoMedioProduto([compra(10, 50), compra(10, 90, { reversaoDeId: 1 })]).custoMedio?.toNumber()).toBe(5);
  });

  it("AJUSTE negativo é ignorado", () => {
    const r = custoMedioProduto([compra(10, 50), { tipo: "AJUSTE", origem: "AJUSTE_INVENTARIO", status: "CONFIRMADO", reversaoDeId: null, quantidade: D(-5), valorTotal: D(-100) }]);
    expect(r.custoMedio?.toNumber()).toBe(5);
    expect(r.quantidade.toNumber()).toBe(10);
  });

  it("AJUSTE positivo com valor entra na média; sem valor, não", () => {
    const ajuste = (q: number, v: number): MovCustoIn => ({ tipo: "AJUSTE", origem: "AJUSTE_INVENTARIO", status: "CONFIRMADO", reversaoDeId: null, quantidade: D(q), valorTotal: D(v) });
    expect(custoMedioProduto([compra(10, 50), ajuste(10, 110)]).custoMedio?.toNumber()).toBe(8);
    expect(custoMedioProduto([compra(10, 50), ajuste(10, 0)]).custoMedio?.toNumber()).toBe(5);
  });

  it("saídas e entradas de outras origens não afetam", () => {
    const r = custoMedioProduto([
      compra(10, 50),
      { tipo: "SAIDA", origem: "NUTRICAO", status: "CONFIRMADO", reversaoDeId: null, quantidade: D(4), valorTotal: D(99) },
      { tipo: "SAIDA", origem: "COMPRA", status: "CONFIRMADO", reversaoDeId: null, quantidade: D(4), valorTotal: D(99) },
      compra(10, 999, { origem: "DEVOLUCAO" }),
    ]);
    expect(r.custoMedio?.toNumber()).toBe(5);
  });

  it("bonificação, produção e inventário inicial entram", () => {
    const r = custoMedioProduto([compra(1, 3, { origem: "BONIFICACAO" }), compra(1, 6, { origem: "PRODUCAO" }), compra(1, 9, { origem: "INVENTARIO_INICIAL" })]);
    expect(r.custoMedio?.toNumber()).toBe(6);
  });
});

describe("entraNoCustoMedio", () => {
  const D = (v: number | string) => new Prisma.Decimal(v);
  const mov = (extra: Partial<MovCustoIn>): MovCustoIn => ({ tipo: "ENTRADA", origem: "COMPRA", status: "CONFIRMADO", reversaoDeId: null, quantidade: D(10), valorTotal: D(50), ...extra });

  it("ENTRADA exige quantidade > 0 e valor > 0 em todas as origens (como o AJUSTE)", () => {
    for (const origem of ["COMPRA", "BONIFICACAO", "PRODUCAO", "INVENTARIO_INICIAL"]) {
      expect(entraNoCustoMedio(mov({ origem }))).toBe(true);
      expect(entraNoCustoMedio(mov({ origem, valorTotal: D(0) }))).toBe(false);
      expect(entraNoCustoMedio(mov({ origem, quantidade: D(0) }))).toBe(false);
    }
  });
});

describe("custo médio sem diluição por entrada sem valor", () => {
  const D = (v: number | string) => new Prisma.Decimal(v);
  const entrada = (q: number, v: number, origem = "COMPRA"): MovCustoIn => ({ tipo: "ENTRADA", origem, status: "CONFIRMADO", reversaoDeId: null, quantidade: D(q), valorTotal: D(v) });

  it("inventário inicial com valorTotal 0 não afeta o médio nem a base", () => {
    const r = custoMedioProduto([entrada(10, 50), entrada(90, 0, "INVENTARIO_INICIAL")]);
    expect(r.custoMedio?.toNumber()).toBe(5);
    expect(r.quantidade.toNumber()).toBe(10);
    expect(r.valor.toNumber()).toBe(50);
  });

  it("bonificação sem valor também fica fora da base", () => {
    expect(custoMedioProduto([entrada(10, 50), entrada(10, 0, "BONIFICACAO")]).custoMedio?.toNumber()).toBe(5);
  });
});

describe("valorSaidaPreciso", () => {
  const D = (v: number | string) => new Prisma.Decimal(v);
  const compra = (q: number | string, v: number | string): MovCustoIn => ({ tipo: "ENTRADA", origem: "COMPRA", status: "CONFIRMADO", reversaoDeId: null, quantidade: D(q), valorTotal: D(v) });

  it("25.000 g por R$ 11,25 → saída de 10.000 g vale exatamente R$ 4,50 (não 5,00)", () => {
    const base = custoMedioProduto([compra(25000, "11.25")]);
    // custo exibido arredondado (0,00045 → 0,0005) — não é usado no valor da saída
    expect(base.custoMedio?.toString()).toBe("0.0005");
    const r = valorSaidaPreciso({ quantidadeSaida: 10000, quantidadeBase: base.quantidade, valorBase: base.valor });
    expect(r.valorTotal.toString()).toBe("4.5");
    expect(r.custoUnitario.toString()).toBe("0.0005"); // 4,50 ÷ 10.000 = 0,00045 → 4 casas, só exibição
    expect(valorSaidaDaBase(10000, base).valorTotal.toString()).toBe("4.5");
  });

  it("20 L por R$ 7 → saída de 5 L vale exatamente R$ 1,75", () => {
    const base = custoMedioProduto([compra(20, 7)]);
    const r = valorSaidaDaBase(5, base);
    expect(r.valorTotal.toString()).toBe("1.75");
    expect(r.custoUnitario.toString()).toBe("0.35");
  });

  it("uma única divisão e arredondamento só no fim (1/3 da base)", () => {
    const r = valorSaidaPreciso({ quantidadeSaida: 3, quantidadeBase: 9, valorBase: 10 });
    expect(r.valorTotal.toString()).toBe("3.33");
    expect(r.custoUnitario.toString()).toBe("1.11");
  });

  it("quantidade negativa (ajuste) mantém sinal no valor e custo unitário positivo", () => {
    const r = valorSaidaPreciso({ quantidadeSaida: -4, quantidadeBase: 20, valorBase: 7 });
    expect(r.valorTotal.toString()).toBe("-1.4");
    expect(r.custoUnitario.toString()).toBe("0.35");
  });

  it("produto sem entrada válida → custoMedio null e saída 0/0", () => {
    const base = custoMedioProduto([compra(10, 0), { ...compra(10, 50), status: "REVERTIDO" }]);
    expect(base.custoMedio).toBeNull();
    expect(valorSaidaPreciso({ quantidadeSaida: 3, quantidadeBase: base.quantidade, valorBase: base.valor })).toEqual({ custoUnitario: D(0), valorTotal: D(0) });
    expect(valorSaidaDaBase(3, null)).toEqual({ custoUnitario: D(0), valorTotal: D(0) });
  });
});

describe("consolidarSaldo", () => {
  const base = (quantidade: string, valor: string) => ({ quantidade: new Prisma.Decimal(quantidade), valor: new Prisma.Decimal(valor) });
  it("um sítio: mesmo cálculo de sempre", () => {
    const r = consolidarSaldo([{ saldo: 25995, base: base("25000", "11.25") }]);
    expect(r.saldo).toBe(25995);
    expect(r.valor).toBe(11.7);
    expect(r.custoMedio!.toNumber()).toBe(0.0005);
  });
  it("vários sítios: valor é a soma dos sítios e o custo médio é valor ÷ saldo", () => {
    const r = consolidarSaldo([{ saldo: 911, base: base("1011", "456") }, { saldo: 100, base: base("100", "200") }]);
    expect(r).toMatchObject({ saldo: 1011, valor: 610.9 });
    expect(r.custoMedio!.toNumber()).toBe(0.6043);
  });
  it("sítio sem base entra no saldo com valor 0; nenhum com base → custo null", () => {
    expect(consolidarSaldo([{ saldo: 5, base: null }, { saldo: 10, base: base("10", "30") }])).toMatchObject({ saldo: 15, valor: 30 });
    expect(consolidarSaldo([{ saldo: 5, base: null }])).toEqual({ saldo: 5, valor: 0, custoMedio: null });
  });
  it("saldo total não positivo usa a média das bases somadas para exibir", () => {
    const r = consolidarSaldo([{ saldo: -5, base: base("10", "10") }, { saldo: 0, base: base("10", "30") }]);
    expect(r.valor).toBe(-5);
    expect(r.custoMedio!.toNumber()).toBe(2);
  });
});

describe("faltasDeSaldo", () => {
  const D = (v: string | number) => new Prisma.Decimal(v);
  it("soma a retirada por produto e aponta só quem passa do saldo", () => {
    const saldos = new Map([[1, D(10)], [2, D(5)]]);
    const faltas = faltasDeSaldo([{ produtoId: 1, quantidade: 6 }, { produtoId: 1, quantidade: 5 }, { produtoId: 2, quantidade: 5 }], saldos);
    expect(faltas.map((f) => [f.produtoId, f.saldo.toNumber(), f.retirada.toNumber()])).toEqual([[1, 10, 11]]);
  });
  it("produto sem saldo conhecido conta como 0; retirada igual ao saldo não falta", () => {
    expect(faltasDeSaldo([{ produtoId: 3, quantidade: "0.001" }], new Map())).toHaveLength(1);
    expect(faltasDeSaldo([{ produtoId: 1, quantidade: 10 }], new Map([[1, D(10)]]))).toEqual([]);
  });
});

describe("saldosAposEstorno", () => {
  const D = (v: string | number) => new Prisma.Decimal(v);
  it("estorno de entrada retira, de saída devolve, de ajuste inverte o sinal", () => {
    const apos = saldosAposEstorno([
      { produtoId: 1, tipo: "ENTRADA", quantidade: 10 },
      { produtoId: 2, tipo: "SAIDA", quantidade: 4 },
      { produtoId: 3, tipo: "AJUSTE", quantidade: -2 },
      { produtoId: 1, tipo: "AJUSTE", quantidade: 1 },
    ], new Map([[1, D(3)], [2, D(0)], [3, D(5)]]));
    expect([...apos].map(([id, s]) => [id, s.toNumber()])).toEqual([[1, -8], [2, 4], [3, 7]]);
  });
});
