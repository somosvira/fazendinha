// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { retornoFichaNutricional, rotaFechamento, rotaOperacaoNutricional, rotaRetornoNutricional } from "./navegacao";
afterEach(() => window.history.replaceState(null, "", "/"));
describe("destinos e retornos nutricionais", () => {
  it("identifica a ficha de origem e conserva o retorno no recarregamento", () => {
    window.history.replaceState(null, "", "/pecuaria/rebanho/animais/animal#nutricao");
    const alvo = rotaFechamento("fechamento");
    const params = new URL(alvo, window.location.origin).searchParams;
    expect(params.get("fechamentoId")).toBe("fechamento");
    expect(params.get("aba")).toBe("fechamentos");
    window.history.replaceState(null, "", alvo);
    expect(rotaRetornoNutricional()).toBe("/pecuaria/rebanho/animais/animal#nutricao");
  });
  it("cancelar operação integrada retorna à aba nutricional do lote", () => {
    window.history.replaceState(null, "", "/pecuaria/rebanho/lotes/lote#lote-nutricao");
    window.history.replaceState(null, "", rotaOperacaoNutricional("consumo", "lote"));
    expect(rotaRetornoNutricional()).toBe("/pecuaria/rebanho/lotes/lote#lote-nutricao");
  });
  it("cancelar estorno restaura o detalhe antes de sair para a ficha", () => {
    window.history.replaceState(null, "", "/pecuaria/nutricao?aba=fechamentos&fechamentoId=f&acao=estorno&retorno=%2Fpecuaria%2Frebanho%2Fanimais%2Fa%23nutricao");
    const alvo = rotaRetornoNutricional();
    expect(new URL(alvo, window.location.origin).searchParams.get("fechamentoId")).toBe("f");
    expect(new URL(alvo, window.location.origin).searchParams.has("acao")).toBe(false);
  });
  it("links antigos sem aba retornam aos fechamentos e mantêm filtros", () => {
    window.history.replaceState(null, "", "/pecuaria/nutricao?fechamentoId=f&statusFechamento=CONFIRMADO&paginaFechamentos=2");
    expect(rotaRetornoNutricional()).toBe("/pecuaria/nutricao?statusFechamento=CONFIRMADO&paginaFechamentos=2&aba=fechamentos");
  });
  it.each(["https://example.com", "//example.com", "javascript:alert(1)", "/financeiro"])("recusa destino de retorno fora das fichas: %s", retorno => {
    window.history.replaceState(null, "", `/pecuaria/nutricao?retorno=${encodeURIComponent(retorno)}&fechamentoId=f`);
    expect(retornoFichaNutricional()).toBeNull();
    expect(rotaRetornoNutricional()).toBe("/pecuaria/nutricao?aba=fechamentos");
  });
});
