// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { abrirNovoAnimal, fecharNovoAnimal, linkFichaAnimal, linkFichaLote, linkNovoAnimal, retornoRebanhoDaUrl, rotuloRetornoRebanho, validarRetornoRebanho } from "./navegacao";

const id = "06abc05c-9906-4c48-8f15-95f82beec207";

describe("contexto de retorno do Rebanho", () => {
  it.each([
    "/pecuaria/rebanho?periodoBaixas=365",
    "/pecuaria/rebanho/animais?sexos=F&sexos=M&categoriaId=vaca&page=3#lista",
    `/pecuaria/rebanho/lotes/${id}?retorno=%2Fpecuaria%2Frebanho%2Flotes#lote-baixas`,
    "/pecuaria/sanidade?aba=carencias&animalId=femea&propriedadeId=1",
    "/pecuaria/rebanho/sanidade?aba=carencias&animalId=femea",
    "/pecuaria/rebanho/nutricao?aba=historico&loteId=lote",
  ])("preserva o contexto local %s", retorno => {
    expect(validarRetornoRebanho(retorno)).toBe(retorno);
    expect(new URL(linkFichaAnimal(id, retorno), "https://terrano.internal").searchParams.get("retorno")).toBe(retorno);
    expect(new URL(linkNovoAnimal(retorno), "https://terrano.internal").searchParams.get("retorno")).toBe(retorno);
  });

  it.each(["https://externo.test", "//externo.test", "/\\externo.test", "/login", "/pecuaria/rebanho/animais\n", "/pecuaria/rebanho/animais/novo", "/pecuaria/rebanho/lotes/inexistente"]) ("recusa retorno externo ou fora dos caminhos aceitos: %s", retorno => {
    expect(validarRetornoRebanho(retorno)).toBeNull();
    expect(linkFichaLote(id, retorno)).toBe(`/pecuaria/rebanho/lotes/${id}`);
  });

  it("restaura o retorno em reload e usa fallback sem depender do histórico externo", () => {
    const retorno = "/pecuaria/rebanho/animais?sexo=F&papelReprodutivo=RECEPTORA";
    window.history.replaceState({}, "", linkFichaAnimal(id, retorno));
    expect(retornoRebanhoDaUrl()).toBe(retorno);
    window.history.replaceState({}, "", `/pecuaria/rebanho/animais/${id}?retorno=https://externo.test`);
    expect(retornoRebanhoDaUrl()).toBe("/pecuaria/rebanho/animais");
    expect(retornoRebanhoDaUrl("/pecuaria/rebanho/lotes")).toBe("/pecuaria/rebanho/lotes");
  });

  it("fecha acesso direto substituindo a entrada, inclusive após voltar a ela", () => {
    const url = linkNovoAnimal("/pecuaria/rebanho/animais?sexo=F");
    window.history.replaceState(null, "", url);
    const voltar = vi.spyOn(window.history, "back").mockImplementation(() => {});
    fecharNovoAnimal();
    expect(voltar).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search).toBe("/pecuaria/rebanho/animais?sexo=F");
    window.history.replaceState(null, "", url);
    fecharNovoAnimal();
    expect(voltar).not.toHaveBeenCalled();
    voltar.mockRestore();
  });

  it("volta pelo histórico apenas para entrada marcada com retorno correspondente", () => {
    window.history.replaceState(null, "", "/pecuaria/rebanho/animais?sexo=F");
    abrirNovoAnimal();
    const voltar = vi.spyOn(window.history, "back").mockImplementation(() => {});
    fecharNovoAnimal();
    expect(voltar).toHaveBeenCalledOnce();
    voltar.mockRestore();
  });

  it("identifica o destino para o rótulo da navegação", () => {
    expect(rotuloRetornoRebanho(`/pecuaria/rebanho/lotes/${id}#lote-animais`)).toBe("Lote");
    expect(rotuloRetornoRebanho(`/pecuaria/rebanho/animais/${id}`)).toBe("Animal");
    expect(rotuloRetornoRebanho("/pecuaria/rebanho/animais?sexo=F")).toBe("Animais");
    expect(rotuloRetornoRebanho("/pecuaria/rebanho/lotes/?buscaLote=Cria")).toBe("Lotes");
    expect(rotuloRetornoRebanho("/pecuaria/rebanho?periodoBaixas=365")).toBe("Rebanho");
  });
});
