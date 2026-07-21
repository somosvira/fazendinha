import { describe, expect, it } from "vitest";
import {
  buildRotaWorklistRebanho,
  parseRotaWorklistRebanho,
  pathToTab,
  tabToPath,
} from "./router";

describe("roteamento do rebanho", () => {
  it("mapeia inicio ⇄ /inicio", () => {
    expect(tabToPath("inicio")).toBe("/inicio");
    expect(pathToTab("/inicio")).toBe("inicio");
  });

  it.each([
    ["reb-dashboard", "/rebanho/dashboard"],
    ["reb-reproducao", "/rebanho/reproducao"],
    ["reb-sanidade", "/rebanho/sanidade"],
  ] as const)("converte %s para o pathname canônico", (tab, path) => {
    expect(tabToPath(tab)).toBe(path);
    expect(pathToTab(path)).toBe(tab);
  });

  it.each([
    ["secagem-atrasada", "/rebanho/reproducao?worklist=secagem-atrasada"],
    ["vazia-pos-pev", "/rebanho/reproducao?worklist=vazia-pos-pev"],
    ["dg-pendente", "/rebanho/reproducao?worklist=dg-pendente"],
    ["parto-proximo", "/rebanho/reproducao?worklist=parto-proximo"],
    ["ccs-alta", "/rebanho/sanidade?worklist=ccs-alta"],
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

  it("não confunde filtros financeiros com worklists do rebanho", () => {
    expect(parseRotaWorklistRebanho("/gastos", "?status=vencidas")).toBeNull();
    expect(pathToTab("/gastos")).toBe("gastos");
  });
});
