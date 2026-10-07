import { describe, expect, it } from "vitest";
import { linkOperacaoFinanceira, validarRetornoInterno } from "./navegacao";

describe("retorno financeiro", () => {
  it("preserva filtros, sítio e detalhe sanitário", () => {
    const retorno = "/pecuaria/rebanho/sanidade?aba=aplicacoes&buscaAnimal=Mimosa&propriedadeId=2&detalheTipo=aplicacao&detalheId=fato";
    const link = linkOperacaoFinanceira("op", retorno);
    expect(new URL(link, "https://fazendinha.local").searchParams.get("returnTo")).toBe(retorno);
    expect(validarRetornoInterno(retorno)).toBe(retorno);
  });
  it.each(["https://externo.test", "//externo.test", "/\\externo.test", "/login", "/estoque\n"]) ("recusa retorno %s", (valor) => {
    expect(validarRetornoInterno(valor)).toBeNull();
    expect(linkOperacaoFinanceira("op", valor)).toBe("/financeiro/operacoes/op");
  });
});
