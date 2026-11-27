// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { navegarPara } from "./router";

const raiz = () => document.scrollingElement ?? document.documentElement;
beforeEach(() => { window.history.replaceState(null, "", "/pecuaria/rebanho"); raiz().scrollTop = 257; });

it("outra tela começa no topo em vez de herdar a rolagem da anterior", () => {
  navegarPara("/pecuaria/reproducao");
  expect(window.location.pathname).toBe("/pecuaria/reproducao");
  expect(raiz().scrollTop).toBe(0);
});

it("filtros na mesma tela mantêm a posição", () => {
  navegarPara("/pecuaria/rebanho?busca=vaca");
  expect(raiz().scrollTop).toBe(257);
});

it("âncora mantém a posição para o destino da âncora", () => {
  navegarPara("/pecuaria/reproducao#consulta");
  expect(raiz().scrollTop).toBe(257);
});
