import { describe, it, expect } from "vitest";
import { agregarCustoMOPorSetor, type FuncionarioCustoMO } from "./custoMOSetor.js";

const f = (over: Partial<FuncionarioCustoMO> = {}): FuncionarioCustoMO => ({
  setor: "Curral",
  salarioMensal: 2000,
  ativo: true,
  ...over,
});

describe("agregarCustoMOPorSetor", () => {
  it("agrupa por setor, soma salários, conta qtd e ordena por total desc", () => {
    const out = agregarCustoMOPorSetor([
      f({ setor: "Curral", salarioMensal: 2000 }),
      f({ setor: "Curral", salarioMensal: 2500 }),
      f({ setor: "Ordenha", salarioMensal: 3000 }),
    ]);
    // Curral 4500 (2) vem antes de Ordenha 3000 (1)
    expect(out).toEqual([
      { setor: "Curral", totalMensal: 4500, qtd: 2 },
      { setor: "Ordenha", totalMensal: 3000, qtd: 1 },
    ]);
  });

  it("funcionário sem setor (null/undefined/vazio) cai em 'Geral'", () => {
    const out = agregarCustoMOPorSetor([
      f({ setor: null, salarioMensal: 1000 }),
      f({ setor: undefined, salarioMensal: 1500 }),
      f({ setor: "   ", salarioMensal: 500 }),
    ]);
    expect(out).toEqual([{ setor: "Geral", totalMensal: 3000, qtd: 3 }]);
  });

  it("ignora funcionários inativos", () => {
    const out = agregarCustoMOPorSetor([
      f({ setor: "Curral", salarioMensal: 2000, ativo: true }),
      f({ setor: "Curral", salarioMensal: 9999, ativo: false }),
      f({ setor: "Café", salarioMensal: 1000, ativo: false }),
    ]);
    expect(out).toEqual([{ setor: "Curral", totalMensal: 2000, qtd: 1 }]);
  });

  it("lista vazia → []", () => {
    expect(agregarCustoMOPorSetor([])).toEqual([]);
  });

  it("normaliza o setor (trim) ao agrupar", () => {
    const out = agregarCustoMOPorSetor([
      f({ setor: "Recria", salarioMensal: 1200 }),
      f({ setor: " Recria ", salarioMensal: 800 }),
    ]);
    expect(out).toEqual([{ setor: "Recria", totalMensal: 2000, qtd: 2 }]);
  });
});
