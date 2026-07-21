import { describe, it, expect } from "vitest";
import { iniciarAnimalAplic, ratearCustoSanidade } from "./custo-sanidade.js";

describe("iniciarAnimalAplic", () => {
  it("mantém nome ausente como null para não repetir o número", () => {
    expect(iniciarAnimalAplic("0942", null)).toEqual({ numero: "0942", nome: null, n: 0 });
  });
});

describe("ratearCustoSanidade", () => {
  it("rateia por volume e ordena por custo desc", () => {
    const r = ratearCustoSanidade(1000, [
      { numero: "1", nome: "A", n: 3 },
      { numero: "2", nome: "B", n: 1 },
    ]);
    expect(r.totalAplicacoes).toBe(4);
    expect(r.custoPorAplicacao).toBe(250);
    expect(r.animais[0]).toEqual({ numero: "1", nome: "A", n: 3, custoEstimado: 750 });
    expect(r.animais[1].custoEstimado).toBe(250);
  });

  it("zero aplicações → custoPorAplicacao 0, sem divisão por zero", () => {
    const r = ratearCustoSanidade(1000, []);
    expect(r.custoPorAplicacao).toBe(0);
    expect(r.animais).toEqual([]);
    expect(r.totalAplicacoes).toBe(0);
  });
});
