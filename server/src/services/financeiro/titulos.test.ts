import { describe, expect, it } from "vitest";
import { tituloCompromisso } from "./titulos.js";

describe("tituloCompromisso", () => {
  it("prefixa compromissos parcelados", () => {
    expect(tituloCompromisso({ numeroParcela: 1, totalParcelas: 2, operacao: { descricao: "Compra de estoque", tipo: "COMPRA_ESTOQUE" } })).toBe("(1/2) Compra de estoque");
  });

  it("não prefixa compromisso de parcela única", () => {
    expect(tituloCompromisso({ numeroParcela: 1, totalParcelas: 1, operacao: { descricao: "Venda", tipo: "VENDA_PRODUCAO" } })).toBe("Venda");
  });
});
