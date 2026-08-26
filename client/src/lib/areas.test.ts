import { describe, expect, it } from "vitest";
import { areaDaTab, temAcessoArea } from "./areas";

describe("áreas de acesso", () => {
  it("mapeia tabs para os domínios compartilhados", () => {
    expect(areaDaTab("reb-reproducao")).toBe("pecuaria");
    expect(areaDaTab("pla-talhao")).toBe("agricultura");
    expect(areaDaTab("mil-safras")).toBe("agricultura");
    expect(areaDaTab("cor-lote")).toBe("pecuaria");
    expect(areaDaTab("eqp-ponto")).toBe("equipe");
    expect(areaDaTab("gastos")).toBe("financeiro");
  });

  it("respeita lista, dono e sessão legada", () => {
    expect(temAcessoArea(["pecuaria"], "pecuaria")).toBe(true);
    expect(temAcessoArea(["rebanho"], "pecuaria")).toBe(true);
    expect(temAcessoArea(["gado_corte"], "pecuaria")).toBe(true);
    expect(temAcessoArea(["pecuaria"], "agricultura")).toBe(false);
    expect(temAcessoArea([], "agricultura", true)).toBe(true);
    expect(temAcessoArea(undefined, "agricultura")).toBe(true);
  });
});
