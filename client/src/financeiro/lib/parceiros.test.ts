import { describe, expect, it } from "vitest";
import { parceiroCompativel, papeisDoParceiro, parcelasSugeridas } from "./parceiros";

describe("papéis e sugestões de parceiros", () => {
  it("mantém compatibilidade com AMBOS e recusa inativos", () => {
    expect(papeisDoParceiro({ tipo: "AMBOS" })).toEqual(["CLIENTE", "FORNECEDOR"]);
    expect(parceiroCompativel({ tipo: "AMBOS", ativo: false }, "VENDA")).toBe(false);
  });
  it("prestador não vira fornecedor de produtos", () => {
    const parceiro = { tipo: "FORNECEDOR" as const, ativo: true, papeis: ["PRESTADOR_SERVICO" as const] };
    expect(parceiroCompativel(parceiro, "SERVICO")).toBe(true);
    expect(parceiroCompativel(parceiro, "COMPRA_ESTOQUE")).toBe(false);
    expect(parceiroCompativel(parceiro, "VENDA")).toBe(false);
  });
  it("divide centavos sem perda e calcula prazos pela data da operação", () => {
    expect(parcelasSugeridas(100, "2026-09-11", [30, 60, 90])).toEqual([
      { valor: "33.34", vencimento: "2026-10-11" },
      { valor: "33.33", vencimento: "2026-11-10" },
      { valor: "33.33", vencimento: "2026-12-10" },
    ]);
    expect(parcelasSugeridas(0, "2026-09-11", [30])).toEqual([]);
    expect(parcelasSugeridas(100, "", [30])).toEqual([]);
  });
});
