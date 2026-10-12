import { describe, expect, it } from "vitest";
import { normalizarRotaPecuaria, pathToTab, tabToPath, isSubrotaPecuaria } from "./router";
import { destinoDepoisDoLogin, podeAcessarCaminho } from "./navegacaoAuth";
import type { UsuarioSessao } from "./lib/auth";

const leitor: UsuarioSessao = { id: 1, nome: "Leitor", email: "leitor@example.test", papel: "personalizado", abas: ["gastos"], areas: ["pecuaria"], flags: [], status: "ATIVO", dono: false };
describe("navegação operacional da Pecuária", () => {
  it.each([["pec-sanidade", "/pecuaria/sanidade"], ["pec-nutricao", "/pecuaria/nutricao"]] as const)("mantém %s e suas consultas na aba correta", (tab, path) => {
    expect(tabToPath(tab)).toBe(path);
    expect(pathToTab(path)).toBe(tab);
    expect(isSubrotaPecuaria(tab, path)).toBe(true);
    expect(isSubrotaPecuaria("pec-rebanho", path)).toBe(false);
  });
  it("preserva os filtros e o fragmento dos links antigos", () => {
    expect(normalizarRotaPecuaria("/pecuaria/rebanho/sanidade?aba=exames&animalId=123#historico")).toBe("/pecuaria/sanidade?aba=exames&animalId=123#historico");
    expect(normalizarRotaPecuaria("/pecuaria/rebanho/nutricao?loteId=abc&aba=fechamentos")).toBe("/pecuaria/nutricao?loteId=abc&aba=fechamentos");
  });
  it("concentra pesagem na lista de animais preservando filtros", () => {
    expect(normalizarRotaPecuaria("/pecuaria/pesagem-manejo?loteId=abc#selecao")).toBe("/pecuaria/rebanho/animais?loteId=abc#selecao");
    expect(pathToTab("/pecuaria/pesagem-manejo")).toBe("pec-rebanho");
  });
  it("leva cada cadastro antigo à configuração correspondente", () => {
    expect(normalizarRotaPecuaria("/pecuaria/rebanho/cadastros?aba=racas&busca=Hol")).toBe("/configuracoes/pecuaria/genetica/racas?busca=Hol");
    expect(normalizarRotaPecuaria("/pecuaria/rebanho/cadastros?aba=sanidade&cadastroSanitario=exame")).toBe("/configuracoes/pecuaria/sanidade/tipos-exame");
    expect(normalizarRotaPecuaria("/pecuaria/rebanho/cadastros?material=123")).toBe("/configuracoes/pecuaria/genetica/material-genetico?material=123");
  });
  it("exige a área Pecuária também nas configurações e após o login", () => {
    const financeiro = { ...leitor, areas: ["financeiro"] };
    expect(podeAcessarCaminho(leitor, "/configuracoes/pecuaria/genetica/racas")).toBe(true);
    expect(podeAcessarCaminho(financeiro, "/configuracoes/pecuaria/genetica/racas")).toBe(false);
    expect(podeAcessarCaminho(financeiro, "/pecuaria/nutricao")).toBe(false);
    expect(destinoDepoisDoLogin("/pecuaria/rebanho/cadastros?aba=racas", financeiro)).toBe("/financeiro/compromissos");
    expect(destinoDepoisDoLogin("/pecuaria/rebanho/nutricao?loteId=abc", leitor)).toBe("/pecuaria/nutricao?loteId=abc");
  });
  it("preserva os endereços e subpáginas financeiras", () => {
    expect(normalizarRotaPecuaria("/financeiro/operacoes/nova?editar=123")).toBe("/financeiro/operacoes/nova?editar=123");
    expect(tabToPath("cadastros")).toBe("/financeiro/configuracoes");
  });
});
