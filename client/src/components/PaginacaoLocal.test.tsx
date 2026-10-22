// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePaginacaoLocal } from "./PaginacaoLocal";

describe("paginação local compartilhada", () => {
  it("recorta 15 sem mutar a fonte e reinicia ao mudar filtro", () => {
    const itens = Array.from({ length: 31 }, (_, i) => i);
    const { result, rerender } = renderHook(({ chave }) => usePaginacaoLocal(itens, chave), { initialProps: { chave: "todos" } });
    expect(result.current.itens).toHaveLength(15);
    act(() => result.current.controles.onPagina(3));
    expect(result.current.itens).toEqual([30]);
    expect(itens).toHaveLength(31);
    rerender({ chave: "busca" });
    expect(result.current.controles.pagina).toBe(1);
  });
  it("ajusta a página após redução e suporta vazio", () => {
    const { result, rerender } = renderHook(({ itens }) => usePaginacaoLocal(itens, "mesmo"), { initialProps: { itens: Array.from({ length: 31 }, (_, i) => i) } });
    act(() => result.current.controles.onPagina(3));
    rerender({ itens: [1, 2] });
    expect(result.current.controles.pagina).toBe(1);
    expect(result.current.itens).toEqual([1, 2]);
    rerender({ itens: [] });
    expect(result.current.controles.totalPaginas).toBe(1);
    expect(result.current.controles.total).toBe(0);
  });
});
