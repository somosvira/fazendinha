import { describe, expect, it } from "vitest";
import { areaDaTab, temAcessoArea, temAcessoEstoque } from "./areas";

describe("áreas de acesso", () => {
  it("mapeia tabs para os domínios compartilhados", () => {
    expect(areaDaTab("pec-rebanho")).toBe("pecuaria");
    expect(areaDaTab("gastos")).toBe("financeiro");
  });

  it("respeita lista, dono e sessão legada", () => {
    expect(temAcessoArea(["pecuaria"], "pecuaria")).toBe(true);
    expect(temAcessoArea(["rebanho"], "pecuaria")).toBe(true);
    expect(temAcessoArea(["gado_corte"], "pecuaria")).toBe(true);
    expect(temAcessoArea(["pecuaria"], "financeiro")).toBe(false);
    expect(temAcessoArea([], "financeiro", true)).toBe(true);
    expect(temAcessoArea(undefined, "financeiro")).toBe(true);
  });

  it("libera Estoque só para pecuária e financeiro, rejeitando permissões retiradas", () => {
    expect(temAcessoEstoque(["pecuaria"])).toBe(true);
    expect(temAcessoEstoque(["agricultura"])).toBe(false);
    expect(temAcessoEstoque(["financeiro"])).toBe(true);
    expect(temAcessoEstoque(["equipe"])).toBe(false);
    expect(temAcessoEstoque([], true)).toBe(true);
    expect(temAcessoEstoque(undefined)).toBe(true);
  });
});
