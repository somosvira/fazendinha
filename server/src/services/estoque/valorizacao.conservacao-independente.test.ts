import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { descontarItens, repartirValor, valorizarSaida, ValorizacaoError, type BaseValorizacao, type MetodoValorizacao } from "./valorizacao.calc.js";

const referencia = "2026-10-16";
const D = (valor: Prisma.Decimal.Value) => new Prisma.Decimal(valor);
const soma = (valores: Prisma.Decimal.Value[]) => valores.reduce<Prisma.Decimal>((total, valor) => total.plus(valor), D(0));
const base = (id: string, quantidade: string, valor: string, data = "2026-10-01", ordem = 1): BaseValorizacao => ({ id, quantidade, valor, estadoValor: "CONHECIDO", data, ordem });

/** Confere a identidade contábil; não calcula o custo que o motor deveria escolher. */
function conferirConservacao(antes: BaseValorizacao[], depois: ReturnType<typeof valorizarSaida>, quantidade: string) {
  expect(depois.quantidade.equals(quantidade)).toBe(true);
  expect(soma(depois.parcelas.map(p => p.quantidade)).equals(quantidade)).toBe(true);
  expect(soma(depois.parcelas.map(p => p.valorTotal)).equals(depois.valorTotal)).toBe(true);
  expect(soma(antes.map(b => b.quantidade)).minus(soma(depois.saldos.map(b => b.quantidade))).equals(quantidade)).toBe(true);
  expect(soma(antes.map(b => b.valor!)).minus(soma(depois.saldos.map(b => b.valor!))).minus(depois.valorTotal).toFixed(2)).toBe("0.00");
  expect(new Set(depois.saldos.map(b => b.baseId)).size).toBe(antes.length);
  for (const anterior of antes) {
    const residual = depois.saldos.find(b => b.baseId === anterior.id)!;
    expect(residual, `Saldo da origem ${anterior.id}`).toBeDefined();
    const parcelas = depois.parcelas.filter(p => p.baseId === anterior.id);
    expect(D(anterior.quantidade).minus(soma(parcelas.map(p => p.quantidade))).equals(residual.quantidade)).toBe(true);
    expect(D(anterior.valor!).minus(soma(parcelas.map(p => p.valorTotal))).equals(residual.valor!)).toBe(true);
    expect(residual.quantidade.isNegative()).toBe(false);
    expect(residual.valor!.isNegative()).toBe(false);
    if (residual.quantidade.isZero()) expect(residual.valor!.isZero()).toBe(true);
  }
  for (const parcela of depois.parcelas) {
    expect(parcela.quantidade.gt(0)).toBe(true);
    expect(parcela.valorTotal.isNegative()).toBe(false);
    expect(antes.some(b => b.id === parcela.baseId)).toBe(true);
  }
}

function executarSequencia(metodo: MetodoValorizacao, iniciais: BaseValorizacao[], saidas: string[]) {
  let bases = iniciais.map(b => ({ ...b }));
  let consumido = D(0);
  for (const quantidade of saidas) {
    const resultado = valorizarSaida({ metodo, bases, quantidade, dataReferencia: referencia });
    conferirConservacao(bases, resultado, quantidade);
    consumido = consumido.plus(resultado.valorTotal);
    bases = bases.map(b => {
      const residual = resultado.saldos.find(s => s.baseId === b.id)!;
      return { ...b, quantidade: residual.quantidade, valor: residual.valor, estadoValor: residual.estadoValor };
    });
  }
  expect(consumido.plus(soma(bases.map(b => b.valor!))).minus(soma(iniciais.map(b => b.valor!))).toFixed(2)).toBe("0.00");
  return { bases, consumido };
}

describe("conservação independente após cada saída", () => {
  it.each([
    { nome: "três doses e R$ 10", quantidade: "3", valor: "10.00", saidas: ["1", "1", "1"] },
    { nome: "um centavo distribuído em três frações", quantidade: "0.003", valor: "0.01", saidas: ["0.001", "0.001", "0.001"] },
    { nome: "quantidade em três casas e saídas desiguais", quantidade: "3.333", valor: "10.00", saidas: ["0.001", "0.332", "1", "2"] },
    { nome: "grande quantidade e valor fracionados", quantidade: "12345.678", valor: "99999999.99", saidas: ["1234.567", "0.001", "11111.11"] },
    { nome: "zero comprovado", quantidade: "1.001", valor: "0.00", saidas: ["0.001", "1"] },
  ])("esgota $nome sem sobra de quantidade ou centavos", ({ quantidade, valor, saidas }) => {
    const resultado = executarSequencia("MEDIA_SALDO_V1", [base("grupo", quantidade, valor)], saidas);
    expect(resultado.consumido.equals(valor)).toBe(true);
    expect(D(resultado.bases[0].quantidade).isZero()).toBe(true);
    expect(D(resultado.bases[0].valor!).isZero()).toBe(true);
  });

  it("FIFO conserva cada aquisição e o total com saídas que atravessam origens", () => {
    const bases = [base("c", "3.333", "1234.56", "2026-10-03"), base("a", "1.111", "0.01"), base("b", "2.222", "10.00", "2026-10-02")];
    const resultado = executarSequencia("FIFO_AQUISICAO_V1", bases, ["0.111", "1", "1.111", "3.333", "1.111"]);
    expect(resultado.consumido.toFixed(2)).toBe("1244.57");
    expect(resultado.bases.every(b => D(b.quantidade).isZero() && D(b.valor!).isZero())).toBe(true);
  });

  it("uma única saída e várias saídas esgotadas conservam o mesmo total", () => {
    for (const metodo of ["MEDIA_SALDO_V1", "FIFO_AQUISICAO_V1"] as const) {
      const bases = [base("grupo", "7.007", "123.45")];
      const integral = executarSequencia(metodo, bases, ["7.007"]);
      const parcial = executarSequencia(metodo, bases, ["0.007", "2", "3", "2"]);
      expect(integral.consumido.equals(parcial.consumido)).toBe(true);
    }
  });

  it("permutações do array não mudam a escolha FIFO ou os valores por origem", () => {
    const a = base("a", "1.123", "8.79", "2026-09-30");
    const b = base("b", "2.321", "17.01", "2026-10-01", 2);
    const c = base("c", "3", "31.99", "2026-10-01", 1);
    const resultados = [[a, b, c], [c, a, b], [b, c, a]].map(bases => {
      const resultado = valorizarSaida({ quantidade: "3.5", metodo: "FIFO_AQUISICAO_V1", bases, dataReferencia: referencia });
      conferirConservacao(bases, resultado, "3.5");
      return {
        total: resultado.valorTotal.toString(),
        parcelas: resultado.parcelas.map(p => [p.baseId, p.quantidade.toString(), p.valorTotal.toString()]),
        saldos: resultado.saldos.map(s => [s.baseId, s.quantidade.toString(), s.valor!.toString()]).sort((x, y) => x[0].localeCompare(y[0])),
      };
    });
    expect(resultados[1]).toEqual(resultados[0]);
    expect(resultados[2]).toEqual(resultados[0]);
  });

  it("conserva a aquisição futura inteira sem usá-la para valorizar o presente", () => {
    const bases = [base("futura", "100", "1.00", "2026-10-17"), base("atual", "2", "20.00")];
    const resultado = valorizarSaida({ quantidade: "1", metodo: "FIFO_AQUISICAO_V1", bases, dataReferencia: referencia });
    conferirConservacao(bases, resultado, "1");
    expect(resultado.parcelas.map(p => p.baseId)).toEqual(["atual"]);
    expect(resultado.saldos.find(s => s.baseId === "futura")?.valor?.toString()).toBe("1");
  });

  it("não altera as bases do chamador quando uma saída é calculada", () => {
    const bases = [base("b", "2", "10.00", "2026-10-02"), base("a", "1", "5.00")];
    const antes = JSON.stringify(bases);
    bases.forEach(b => Object.freeze(b));
    Object.freeze(bases);
    const resultado = valorizarSaida({ quantidade: "2", metodo: "FIFO_AQUISICAO_V1", bases, dataReferencia: referencia });
    conferirConservacao(bases, resultado, "2");
    expect(JSON.stringify(bases)).toBe(antes);
  });

  it("recusa quantidade/valor fora da precisão sem arredondar a solicitação silenciosamente", () => {
    for (const quantidade of ["0", "-1", "0.0001", "NaN", "Infinity"]) {
      expect(() => valorizarSaida({ quantidade, metodo: "MEDIA_SALDO_V1", bases: [base("a", "1", "1.00")], dataReferencia: referencia }))
        .toThrow(ValorizacaoError);
    }
    for (const invalida of [base("a", "1.0001", "1.00"), base("a", "1", "1.001"), base("a", "-1", "1.00"), base("a", "1", "-0.01")]) {
      expect(() => valorizarSaida({ quantidade: "0.1", metodo: "MEDIA_SALDO_V1", bases: [invalida], dataReferencia: referencia }))
        .toThrow(ValorizacaoError);
    }
  });

  it("erro de saldo não modifica quantidades ou valores do chamador", () => {
    const bases = [base("a", "1.001", "10.00")];
    const antes = JSON.stringify(bases);
    expect(() => valorizarSaida({ quantidade: "1.002", metodo: "MEDIA_SALDO_V1", bases, dataReferencia: referencia }))
      .toThrow(expect.objectContaining({ code: "SALDO_INSUFICIENTE" }));
    expect(JSON.stringify(bases)).toBe(antes);
  });

  it("distribuições variadas conservam todos os centavos inclusive com pesos fracionários", () => {
    for (const valor of ["0.01", "0.02", "10.00", "1050.00", "99999999.99"]) {
      for (const pesos of [[1, 1, 1], ["0.001", "0.333", "8.666"], [0, 1, 0, 7], ["99999.999", "0.001"]]) {
        const primeira = repartirValor(valor, pesos);
        expect(soma(primeira).minus(valor).toFixed(2)).toBe("0.00");
        expect(primeira.every(p => !p.isNegative() && p.decimalPlaces() <= 2)).toBe(true);
        expect(primeira.map(p => p.toString())).toEqual(repartirValor(valor, pesos).map(p => p.toString()));
        pesos.forEach((peso, i) => { if (D(peso).isZero()) expect(primeira[i].isZero()).toBe(true); });
      }
    }
  });

  it("valor bruto é sempre igual a desconto mais líquido, sem desconto nos inelegíveis", () => {
    const itens = [{ valor: "0.01", elegivel: true }, { valor: "100.00", elegivel: false }, { valor: "10.00", elegivel: true }];
    for (const desconto of ["0.00", "0.01", "3.33", "10.01"]) {
      const resultado = descontarItens(itens, desconto);
      expect(soma(resultado.map(item => item.desconto)).equals(desconto)).toBe(true);
      expect(soma(resultado.map(item => item.valorLiquido)).plus(desconto).equals("110.01")).toBe(true);
      resultado.forEach((item, i) => {
        expect(item.valorBruto.equals(item.desconto.plus(item.valorLiquido))).toBe(true);
        expect(item.valorLiquido.isNegative()).toBe(false);
        if (!itens[i].elegivel) expect(item.desconto.isZero()).toBe(true);
      });
    }
  });
});
