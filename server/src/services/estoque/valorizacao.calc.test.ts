import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { descontarItens, repartirValor, valorizarSaida, type BaseValorizacao } from "./valorizacao.calc.js";

const base = (patch: Partial<BaseValorizacao> = {}): BaseValorizacao => ({ id: "a", quantidade: "3", valor: "10", estadoValor: "CONHECIDO", data: "2026-10-01", ordem: 1, ...patch });
const sair = (b: BaseValorizacao, quantidade: string) => valorizarSaida({ bases: [b], quantidade, metodo: "MEDIA_SALDO_V1", dataReferencia: "2026-10-16" });

describe("valorização pelo saldo remanescente", () => {
  it("esgota três unidades de R$ 10 sem perder o centavo residual", () => {
    let b = base();
    const valores = [];
    for (let n = 0; n < 3; n++) {
      const resultado = sair(b, "1");
      valores.push(resultado.valorTotal.toFixed(2));
      b = { ...b, ...resultado.saldos[0], id: b.id };
    }
    expect(valores).toEqual(["3.33", "3.34", "3.33"]);
    expect(new Prisma.Decimal(b.quantidade).isZero()).toBe(true);
    expect(new Prisma.Decimal(b.valor!).isZero()).toBe(true);
  });
  it("conserva o exemplo do grupo e não muda a entrada", () => {
    const b = base({ quantidade: "20", valor: "1050" });
    const r = sair(b, "2");
    expect(r.valorTotal.toFixed(2)).toBe("105.00");
    expect(r.saldos[0].valor?.toFixed(2)).toBe("945.00");
    expect(b.quantidade).toBe("20");
    expect(b.valor).toBe("1050");
  });
  it("unitário arredondado não altera total de produto por grama", () => {
    const r = sair(base({ quantidade: "25000", valor: "11.25" }), "10000");
    expect(r.valorTotal.toFixed(2)).toBe("4.50");
    expect(r.custoUnitarioExibicao.toString()).toBe("0.0005");
  });
  it("aceita zero comprovado e bloqueia desconhecido", () => {
    expect(sair(base({ valor: "0" }), "1").valorTotal.isZero()).toBe(true);
    expect(() => sair(base({ valor: null, estadoValor: "DESCONHECIDO" }), "1")).toThrow(/abertura documentada/);
  });
  it("não usa aquisição futura, base repetida ou saldo inconsistente", () => {
    expect(() => sair(base({ data: "2026-10-17" }), "1")).toThrow(/na data/);
    expect(() => sair(base({ quantidade: "0", valor: "0.01" }), "1")).toThrow(/residual/);
    expect(() => sair(base(), "3.001")).toThrow(/insuficiente/);
  });
  it("FIFO usa origens mais antigas e congela o residual em cada origem", () => {
    const r = valorizarSaida({ quantidade: "4", metodo: "FIFO_AQUISICAO_V1", dataReferencia: "2026-10-16", bases: [
      base({ id: "b", quantidade: "3", valor: "12", ordem: 2 }), base(),
    ] });
    expect(r.parcelas.map(p => [p.baseId, p.quantidade.toString(), p.valorTotal.toString()])).toEqual([["a", "3", "10"], ["b", "1", "4"]]);
    expect(r.valorTotal.toString()).toBe("14");
  });
});

describe("composição comercial exata", () => {
  it("distribui centavos por maiores restos com desempate estável", () => {
    expect(repartirValor("0.05", [1, 1, 1]).map(p => p.toFixed(2))).toEqual(["0.02", "0.02", "0.01"]);
    expect(() => repartirValor("0.01", [0, 0])).toThrow(/explícita/);
    expect(repartirValor("0.01", [0, 0], [0, "0.01"]).map(p => p.toFixed(2))).toEqual(["0.00", "0.01"]);
  });
  it("desconto só atinge elegíveis e nunca deixa item negativo", () => {
    const itens = [{ valor: "100", elegivel: true }, { valor: "200", elegivel: true }, { valor: "30", elegivel: false }];
    expect(descontarItens(itens, "30").map(i => i.valorLiquido.toFixed(2))).toEqual(["90.00", "180.00", "30.00"]);
    expect(() => descontarItens(itens, "301")).toThrow(/negativo/);
  });
});
