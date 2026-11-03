// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { useBuscaUrl } from "./useBuscaUrl";
afterEach(() => { cleanup(); history.replaceState(null, "", "/"); });
describe("busca de consulta por URL", () => {
  it("recebe link e restaura outro alvo enquanto a consulta está montada", () => {
    history.replaceState(null, "", "/financeiro/configuracoes?aba=categorias&busca=Ração");
    const { result } = renderHook(() => useBuscaUrl("busca")); expect(result.current[0]).toBe("Ração");
    act(() => { history.pushState(null, "", "?aba=categorias&busca=Sal"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(result.current[0]).toBe("Sal");
    act(() => result.current[1]("")); expect(location.search).toBe("?aba=categorias");
  });
  it("sem opt-in mantém pesquisa local sem consumir ou alterar a URL", () => {
    history.replaceState(null, "", "/?busca=Outra"); const { result } = renderHook(() => useBuscaUrl());
    expect(result.current[0]).toBe(""); act(() => result.current[1]("Minha")); expect(location.search).toBe("?busca=Outra");
  });
});
