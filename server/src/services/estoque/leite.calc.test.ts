import { describe, expect, it } from "vitest";
import { planejarBaixaLeite, repartirCustoProducaoLeite } from "./leite.calc.js";

describe("razão único do leite: quantidade e custo pendente", () => {
  it("retira litros das ordenhas em ordem sem transformar custo desconhecido em zero", () => {
    const plano = planejarBaixaLeite({ quantidade: "15", bases: [
      { entradaId: "noite", data: "2026-10-19", ordem: 2, quantidade: "10", valor: "20.00" },
      { entradaId: "manha", data: "2026-10-19", ordem: 1, quantidade: "12", valor: null },
    ] });
    expect(plano.quantidade.toString()).toBe("15");
    expect(plano.valorTotal).toBeNull();
    expect(plano.parcelas.map(p => [p.entradaId, p.quantidade.toString(), p.valorTotal?.toFixed(2) ?? null]))
      .toEqual([["manha", "12", null], ["noite", "3", "6.00"]]);
  });

  it("apuração posterior conserva custo dos litros vendidos, fornecidos e remanescentes", () => {
    const apuracao = repartirCustoProducaoLeite({ quantidadeProduzida: "1000", valorTotal: "1500.00", consumos: [
      { id: "venda", quantidade: "600" }, { id: "bezerro", quantidade: "100" },
    ] });
    expect(apuracao.parcelas.map(p => [p.id, p.valorTotal.toFixed(2)])).toEqual([["venda", "900.00"], ["bezerro", "150.00"]]);
    expect(apuracao.quantidadeRemanescente.toString()).toBe("300");
    expect(apuracao.valorRemanescente.toFixed(2)).toBe("450.00");
  });

  it("esgotar a produção absorve o resíduo de centavos sem criar valor restante", () => {
    const resultado = repartirCustoProducaoLeite({ quantidadeProduzida: "3", valorTotal: "0.01", consumos: [
      { id: "primeiro", quantidade: "1" }, { id: "segundo", quantidade: "1" }, { id: "ultimo", quantidade: "1" },
    ] });
    expect(resultado.parcelas.map(p => p.valorTotal.toFixed(2))).toEqual(["0.00", "0.01", "0.00"]);
    expect(resultado.quantidadeRemanescente.isZero()).toBe(true);
    expect(resultado.valorRemanescente.isZero()).toBe(true);
  });

  it("zero comprovado difere do custo pendente", () => {
    const resultado = planejarBaixaLeite({ quantidade: "2", bases: [{ entradaId: "gratuito", data: "2026-10-19", ordem: 1, quantidade: "2", valor: "0.00" }] });
    expect(resultado.valorTotal?.toFixed(2)).toBe("0.00");
    expect(resultado.parcelas[0].valorTotal?.toFixed(2)).toBe("0.00");
  });

  it("saldo insuficiente, consumo duplicado e precisão inválida são recusados", () => {
    expect(() => planejarBaixaLeite({ quantidade: "1", bases: [] })).toThrow(/insuficiente/);
    expect(() => planejarBaixaLeite({ quantidade: "0.0001", bases: [] })).toThrow(/três casas/);
    expect(() => repartirCustoProducaoLeite({ quantidadeProduzida: "1", valorTotal: "5.00", consumos: [{ id: "a", quantidade: "2" }] })).toThrow(/superam/);
    expect(() => repartirCustoProducaoLeite({ quantidadeProduzida: "1", valorTotal: "5.00", consumos: [{ id: "a", quantidade: "0.1" }, { id: "a", quantidade: "0.1" }] })).toThrow(/repetido/);
  });
});
