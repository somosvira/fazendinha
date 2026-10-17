import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { descontarItens, repartirValor, valorizarSaida, ValorizacaoError, type BaseValorizacao } from "./valorizacao.calc.js";

const referencia = "2026-10-16";
const base = (id: string, quantidade: string, valor: string | null, extra: Partial<BaseValorizacao> = {}): BaseValorizacao => ({
  id, quantidade, valor, estadoValor: valor === null ? "DESCONHECIDO" : "CONHECIDO", data: "2026-10-01", ordem: 1, ...extra,
});
const media = (quantidade: string, grupo: BaseValorizacao) => valorizarSaida({ quantidade, metodo: "MEDIA_SALDO_V1", bases: [grupo], dataReferencia: referencia });
const fifo = (quantidade: string, bases: BaseValorizacao[]) => valorizarSaida({ quantidade, metodo: "FIFO_AQUISICAO_V1", bases, dataReferencia: referencia });
const moeda = (valor: Prisma.Decimal) => valor.toFixed(2);
const saldo = (resultado: ReturnType<typeof valorizarSaida>, id: string) => {
  const encontrado = resultado.saldos.find(s => s.baseId === id);
  expect(encontrado, `Saldo residual da base ${id}`).toBeDefined();
  return encontrado!;
};
const continuar = (anterior: BaseValorizacao, resultado: ReturnType<typeof valorizarSaida>): BaseValorizacao => {
  const residual = saldo(resultado, anterior.id);
  return { ...anterior, quantidade: residual.quantidade, valor: residual.valor, estadoValor: residual.estadoValor };
};

describe("oráculos independentes da valorização gerencial", () => {
  it("R$ 1.050 em vinte doses geram saída de R$ 105 e saldo de R$ 945", () => {
    const resultado = media("2", base("semen:validade-unica:sitio-1", "20", "1050.00"));
    expect(moeda(resultado.valorTotal)).toBe("105.00");
    expect(resultado.quantidade.toString()).toBe("2");
    expect(moeda(resultado.custoUnitarioExibicao)).toBe("52.50");
    expect(resultado.parcelas.map(p => [p.baseId, p.quantidade.toString(), moeda(p.valorTotal)]))
      .toEqual([["semen:validade-unica:sitio-1", "2", "105.00"]]);
    expect(saldo(resultado, "semen:validade-unica:sitio-1").quantidade.toString()).toBe("18");
    expect(moeda(saldo(resultado, "semen:validade-unica:sitio-1").valor!)).toBe("945.00");
  });

  it("seleção física de outra validade conserva seu próprio valor", () => {
    const validadeA = base("semen:validade-a:sitio-1", "10", "400.00");
    const validadeB = base("semen:validade-b:sitio-1", "10", "650.00");
    const resultado = media("2", validadeB);
    expect(moeda(resultado.valorTotal)).toBe("130.00");
    expect(moeda(saldo(resultado, validadeB.id).valor!)).toBe("520.00");
    expect(validadeA).toMatchObject({ quantidade: "10", valor: "400.00" });
    expect(resultado.parcelas.every(p => p.baseId === validadeB.id)).toBe(true);
  });

  it("compra posterior usa o saldo remanescente e não reescreve a saída anterior", () => {
    const grupo = base("grupo", "20", "1050.00");
    const primeira = media("2", grupo);
    const residual = continuar(grupo, primeira);
    const aposCompra = { ...residual, quantidade: new Prisma.Decimal(residual.quantidade).plus(2), valor: residual.valor!.toString() };
    aposCompra.valor = new Prisma.Decimal(aposCompra.valor).plus("200.00").toString();
    const segunda = media("2", aposCompra);
    expect(moeda(primeira.valorTotal)).toBe("105.00");
    expect(moeda(segunda.valorTotal)).toBe("114.50");
    expect(moeda(saldo(segunda, grupo.id).valor!)).toBe("1030.50");
  });

  it("a média das entradas históricas não substitui a média do saldo disponível", () => {
    const grupo = base("grupo", "10", "400.00");
    const primeira = media("8", grupo);
    expect(moeda(primeira.valorTotal)).toBe("320.00");
    const restante = saldo(primeira, grupo.id);
    const segunda = media("2", { ...grupo, quantidade: restante.quantidade.plus(10), valor: restante.valor!.plus("650.00") });
    expect(moeda(segunda.valorTotal)).toBe("121.67");
    expect(moeda(saldo(segunda, grupo.id).valor!)).toBe("608.33");
  });

  it("R$ 10 em três unidades se esgotam sem deixar o total em R$ 9,99", () => {
    let grupo = base("tercos", "3", "10.00");
    const valores: Prisma.Decimal[] = [];
    for (let i = 0; i < 3; i++) {
      const resultado = media("1", grupo);
      valores.push(resultado.valorTotal);
      grupo = continuar(grupo, resultado);
    }
    expect(moeda(valores.reduce((soma, valor) => soma.plus(valor), new Prisma.Decimal(0)))).toBe("10.00");
    expect(new Prisma.Decimal(grupo.quantidade).isZero()).toBe(true);
    expect(new Prisma.Decimal(grupo.valor!).isZero()).toBe(true);
  });

  it("o custo unitário arredondado é só apresentação: três unidades de R$ 10 saem por R$ 10", () => {
    const resultado = media("3", base("tercos", "3", "10.00"));
    expect(moeda(resultado.valorTotal)).toBe("10.00");
    expect(moeda(resultado.custoUnitarioExibicao)).toBe("3.33");
    expect(resultado.custoUnitarioExibicao.times(resultado.quantidade).equals(resultado.valorTotal)).toBe(false);
  });

  it("FIFO de duas unidades a R$ 10 e três a R$ 20 consome três por R$ 40", () => {
    const resultado = fifo("3", [base("segunda", "3", "60.00", { data: "2026-10-02" }), base("primeira", "2", "20.00")]);
    expect(moeda(resultado.valorTotal)).toBe("40.00");
    expect(resultado.parcelas.map(p => [p.baseId, p.quantidade.toString(), moeda(p.valorTotal)]))
      .toEqual([["primeira", "2", "20.00"], ["segunda", "1", "20.00"]]);
    expect(moeda(saldo(resultado, "segunda").valor!)).toBe("40.00");
  });

  it("FIFO desempata aquisições por data, ordem e identidade, sem depender da ordem recebida", () => {
    const bases = [base("b", "1", "20.00", { ordem: 2 }), base("c", "1", "30.00"), base("a", "1", "10.00")];
    const resultado = fifo("2", bases);
    expect(resultado.parcelas.map(p => p.baseId)).toEqual(["a", "c"]);
    expect(moeda(resultado.valorTotal)).toBe("40.00");
    expect(moeda(saldo(resultado, "b").valor!)).toBe("20.00");
  });

  it("aquisição futura não sustenta uma saída anterior, mesmo quando há quantidade total suficiente", () => {
    expect(() => fifo("2", [base("atual", "1", "10.00"), base("futura", "10", "1.00", { data: "2026-10-17" })]))
      .toThrow(expect.objectContaining({ code: "SALDO_INSUFICIENTE" }));
  });

  it("não pula uma aquisição antiga sem lastro para consumir outra conhecida", () => {
    expect(() => fifo("1", [base("conhecida", "5", "50.00", { data: "2026-10-02" }), base("sem-lastro", "1", null)]))
      .toThrow(expect.objectContaining({ code: "SEM_LASTRO" }));
  });

  it("aquisição posterior sem lastro não impede consumir apenas uma origem anterior conhecida", () => {
    const resultado = fifo("1", [base("conhecida", "2", "20.00"), base("sem-lastro", "5", null, { data: "2026-10-02" })]);
    expect(moeda(resultado.valorTotal)).toBe("10.00");
    expect(saldo(resultado, "sem-lastro")).toMatchObject({ valor: null, estadoValor: "DESCONHECIDO" });
    expect(saldo(resultado, "sem-lastro").quantidade.toString()).toBe("5");
  });

  it("zero documentado vale zero e não se confunde com valor desconhecido", () => {
    const resultado = media("2", base("gratuita-comprovada", "3", "0.00"));
    expect(moeda(resultado.valorTotal)).toBe("0.00");
    expect(saldo(resultado, "gratuita-comprovada").estadoValor).toBe("CONHECIDO");
    expect(() => media("2", base("origem-desconhecida", "3", null)))
      .toThrow(expect.objectContaining({ code: "SEM_LASTRO" }));
  });

  it("valor residual com quantidade esgotada exige revisão, sem esconder a divergência", () => {
    expect(() => fifo("1", [base("divergente", "0", "0.01"), base("disponivel", "1", "10.00")]))
      .toThrow(expect.objectContaining({ code: "CONFLITO" }));
  });

  it("média de um grupo não aceita mesclar bases físicas diferentes implicitamente", () => {
    expect(() => valorizarSaida({ quantidade: "1", metodo: "MEDIA_SALDO_V1", bases: [base("a", "1", "40.00"), base("b", "1", "65.00")], dataReferencia: referencia }))
      .toThrow(ValorizacaoError);
  });

  it("reparte R$ 10 em três pesos iguais e distribui o centavo de forma determinística", () => {
    expect(repartirValor("10.00", [1, 1, 1]).map(moeda)).toEqual(["3.34", "3.33", "3.33"]);
    expect(repartirValor("0.02", [1, 1, 1]).map(moeda)).toEqual(["0.01", "0.01", "0.00"]);
  });

  it("desconto de R$ 10 sobre materiais de R$ 100/R$ 200 não é rateado na logística de R$ 30", () => {
    const resultado = descontarItens([
      { valor: "100.00", elegivel: true }, { valor: "200.00", elegivel: true }, { valor: "30.00", elegivel: false },
    ], "10.00");
    expect(resultado.map(item => [moeda(item.valorBruto), moeda(item.desconto), moeda(item.valorLiquido)]))
      .toEqual([["100.00", "3.33", "96.67"], ["200.00", "6.67", "193.33"], ["30.00", "0.00", "30.00"]]);
    expect(moeda(resultado.reduce((total, item) => total.plus(item.valorLiquido), new Prisma.Decimal(0)))).toBe("320.00");
  });

  it("pesos zerados exigem atribuição explícita e não fabricam proporções", () => {
    expect(() => repartirValor("10.00", [0, 0])).toThrow(ValorizacaoError);
    expect(repartirValor("10.00", [0, 0], ["4.00", "6.00"]).map(moeda)).toEqual(["4.00", "6.00"]);
    expect(() => repartirValor("10.00", [0, 0], ["4.00", "5.99"])).toThrow(ValorizacaoError);
  });

  it("desconto não torna item negativo nem usa item inelegível como base disponível", () => {
    expect(() => descontarItens([{ valor: "1.00", elegivel: true }, { valor: "100.00", elegivel: false }], "1.01"))
      .toThrow(ValorizacaoError);
    expect(() => descontarItens([{ valor: "1.00", elegivel: true }, { valor: "100.00", elegivel: true }], "10.00", ["2.00", "8.00"]))
      .toThrow(ValorizacaoError);
  });
});
