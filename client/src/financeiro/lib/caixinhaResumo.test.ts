import { describe, it, expect } from "vitest";
import { resumirMes } from "./caixinhaResumo";
import type { MovimentoCaixinhaDTO } from "../api";

// Fábrica enxuta de movimento (só o que resumirMes lê).
let seq = 0;
function mov(p: Partial<MovimentoCaixinhaDTO>): MovimentoCaixinhaDTO {
  return {
    id: ++seq,
    caixinhaId: 1,
    data: "2026-07-01",
    tipo: "SAIDA",
    categoria: "OUTROS",
    valor: 0,
    descricao: "",
    observacao: null,
    ...p,
  };
}

describe("resumirMes", () => {
  it("mês vazio → tudo zerado, sem maior gasto nem categorias", () => {
    const r = resumirMes([]);
    expect(r).toEqual({
      qtdGastos: 0,
      totalGasto: 0,
      totalEntradas: 0,
      mediaGasto: 0,
      maiorGasto: null,
      porCategoria: [],
    });
  });

  it("só entradas não contam como gasto", () => {
    const r = resumirMes([
      mov({ tipo: "ENTRADA", categoria: null, valor: 200 }),
      mov({ tipo: "ENTRADA", categoria: null, valor: 50 }),
    ]);
    expect(r.totalEntradas).toBe(250);
    expect(r.qtdGastos).toBe(0);
    expect(r.totalGasto).toBe(0);
    expect(r.mediaGasto).toBe(0);
    expect(r.maiorGasto).toBeNull();
    expect(r.porCategoria).toEqual([]);
  });

  it("agrega e ordena por categoria (desc) e calcula média", () => {
    const r = resumirMes([
      mov({ categoria: "COMBUSTIVEL", valor: 40 }),
      mov({ categoria: "COMBUSTIVEL", valor: 60 }),
      mov({ categoria: "MERCADO", valor: 30 }),
      mov({ categoria: "ALIMENTACAO", valor: 10 }),
      mov({ tipo: "ENTRADA", categoria: null, valor: 500 }),
    ]);
    expect(r.qtdGastos).toBe(4);
    expect(r.totalGasto).toBe(140);
    expect(r.totalEntradas).toBe(500);
    expect(r.mediaGasto).toBe(35); // 140 / 4
    expect(r.maiorGasto).toEqual({ valor: 60, descricao: "" });
    expect(r.porCategoria).toEqual([
      { categoria: "COMBUSTIVEL", total: 100 },
      { categoria: "MERCADO", total: 30 },
      { categoria: "ALIMENTACAO", total: 10 },
    ]);
  });

  it("SAIDA sem categoria (dado antigo) cai em OUTROS", () => {
    const r = resumirMes([
      mov({ categoria: null, valor: 25 }),
      mov({ categoria: "OUTROS", valor: 5 }),
    ]);
    expect(r.porCategoria).toEqual([{ categoria: "OUTROS", total: 30 }]);
  });

  it("média é arredondada a 2 casas", () => {
    const r = resumirMes([
      mov({ valor: 3 }),
      mov({ valor: 3 }),
      mov({ valor: 4 }),
    ]);
    expect(r.totalGasto).toBe(10);
    expect(r.mediaGasto).toBe(3.33); // 10 / 3 = 3.333… → 3.33
  });
});
