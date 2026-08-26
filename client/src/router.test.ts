import { describe, expect, it } from "vitest";
import {
  buildRotaWorklistRebanho,
  parseRotaWorklistRebanho,
  pathToTab,
  tabToPath,
} from "./router";

describe("roteamento da pecuária", () => {
  it("usa /relatorios como rota canônica e mantém o endereço antigo compatível", () => {
    expect(tabToPath("relatorio")).toBe("/relatorios");
    expect(pathToTab("/relatorios")).toBe("relatorio");
    expect(pathToTab("/relatorio")).toBe("relatorio");
  });
  it.each([
    ["reb-dashboard", "/pecuaria/dashboard"],
    ["reb-reproducao", "/pecuaria/reproducao"],
    ["reb-acasalamento", "/pecuaria/acasalamento"],
    ["reb-sanidade", "/pecuaria/sanidade"],
    ["cor-lote", "/pecuaria/lotes"],
    ["cor-pesagem", "/pecuaria/lotes/pesagens"],
  ] as const)("converte %s para o pathname canônico", (tab, path) => {
    expect(tabToPath(tab)).toBe(path);
    expect(pathToTab(path)).toBe(tab);
  });

  it.each([
    ["secagem-atrasada", "/pecuaria/reproducao?worklist=secagem-atrasada"],
    ["vazia-pos-pev", "/pecuaria/reproducao?worklist=vazia-pos-pev"],
    ["dg-pendente", "/pecuaria/reproducao?worklist=dg-pendente"],
    ["parto-proximo", "/pecuaria/reproducao?worklist=parto-proximo"],
    ["ccs-alta", "/pecuaria/sanidade?worklist=ccs-alta"],
  ] as const)("monta e interpreta a worklist %s", (chave, url) => {
    expect(buildRotaWorklistRebanho(chave)).toBe(url);
    const parsed = new URL(url, "https://rio-novo.test");
    expect(parseRotaWorklistRebanho(parsed.pathname, parsed.search)).toEqual({
      chave,
      tab: chave === "ccs-alta" ? "sanidade" : "reproducao",
    });
  });

  it("rejeita chave inválida e chave válida na aba errada", () => {
    expect(parseRotaWorklistRebanho("/rebanho/reproducao", "?worklist=desconhecida")).toBeNull();
    expect(parseRotaWorklistRebanho("/rebanho/sanidade", "?worklist=dg-pendente")).toBeNull();
    expect(parseRotaWorklistRebanho("/rebanho/reproducao", "?worklist=ccs-alta")).toBeNull();
    expect(buildRotaWorklistRebanho("ccs-alta", "reproducao")).toBeNull();
  });

  it("mantém os endereços antigos de rebanho e corte como aliases", () => {
    expect(pathToTab("/rebanho/reproducao")).toBe("reb-reproducao");
    expect(pathToTab("/corte/lote")).toBe("cor-lote");
  });

  it("não confunde filtros financeiros com worklists do rebanho", () => {
    expect(parseRotaWorklistRebanho("/gastos", "?status=vencidas")).toBeNull();
    expect(pathToTab("/gastos")).toBe("gastos");
  });
});
