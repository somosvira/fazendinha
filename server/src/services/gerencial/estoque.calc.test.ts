import { describe, expect, it } from "vitest";
import { consolidarValorEstoque } from "./estoque.calc.js";

describe("valor conhecido do estoque", () => {
  it.each([
    { valores: [], total: "0.00", situacao: "COMPLETO" },
    { valores: ["0.00"], total: "0.00", situacao: "COMPLETO" },
    { valores: [null, null], total: null, situacao: "DESCONHECIDO" },
    { valores: ["0.10", null, "0.20"], total: "0.30", situacao: "PARCIAL" },
    { valores: ["0.00", null], total: "0.00", situacao: "PARCIAL" },
    { valores: ["0.10", "0.20"], total: "0.30", situacao: "COMPLETO" },
  ])("preserva zero, desconhecido e soma decimal: $situacao/$total", ({ valores, total, situacao }) => {
    expect(consolidarValorEstoque(valores.map(valor => ({ valor })))).toEqual({ valorConhecido: total, situacao });
  });
});
