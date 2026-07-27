import { describe, it, expect } from "vitest";
import { planejarBaixaDose, planejarDevolucaoDose } from "./semen-baixa.calc.js";

describe("planejarBaixaDose", () => {
  it("sem lote → não consome nem avisa", () => {
    expect(planejarBaixaDose({ estoqueSemenId: null, dosesDisponiveis: 5 }))
      .toEqual({ consumir: false, novoSaldo: 5, aviso: null });
  });
  it("com lote e saldo ≥ 1 → decrementa 1, sem aviso", () => {
    expect(planejarBaixaDose({ estoqueSemenId: 7, dosesDisponiveis: 3 }))
      .toEqual({ consumir: true, novoSaldo: 2, aviso: null });
  });
  it("com lote e saldo 0 → registra sem consumir e avisa (nunca negativo)", () => {
    const r = planejarBaixaDose({ estoqueSemenId: 7, dosesDisponiveis: 0 });
    expect(r.consumir).toBe(false);
    expect(r.novoSaldo).toBe(0);
    expect(r.aviso).toMatch(/estoque zerado/i);
  });
});

describe("planejarDevolucaoDose", () => {
  it("dose não baixada → não devolve", () => {
    expect(planejarDevolucaoDose({ doseBaixada: false, dosesDisponiveis: 4 }))
      .toEqual({ devolver: false, novoSaldo: 4 });
  });
  it("dose baixada → +1", () => {
    expect(planejarDevolucaoDose({ doseBaixada: true, dosesDisponiveis: 2 }))
      .toEqual({ devolver: true, novoSaldo: 3 });
  });
});
