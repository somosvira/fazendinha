// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { ConteudoEstavel } from "./ConteudoEstavel";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("altura transitória de consultas", () => {
  it("atualiza a altura em repouso, não aprende a reserva e desconecta o ResizeObserver", async () => {
    let redimensionar = () => {};
    const desconectar = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { redimensionar = () => callback([], this as unknown as ResizeObserver); }
      observe() {}
      disconnect = desconectar;
    });
    let medida = 400;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ height: medida }) as DOMRect);
    const { container, rerender, unmount } = render(<ConteudoEstavel contexto="a"><div>Lista</div></ConteudoEstavel>);
    medida = 250;
    redimensionar();
    rerender(<ConteudoEstavel contexto="a"><div aria-busy="true">Carregando</div></ConteudoEstavel>);
    await waitFor(() => expect((container.firstElementChild as HTMLElement).style.minHeight).toBe("250px"));
    medida = 600;
    redimensionar();
    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe("250px");
    rerender(<ConteudoEstavel contexto="a"><div>Nova lista</div></ConteudoEstavel>);
    await waitFor(() => expect((container.firstElementChild as HTMLElement).style.minHeight).toBe(""));
    unmount();
    expect(desconectar).toHaveBeenCalledOnce();
  });
  it("reserva espaço ao trocar contexto, sem manter dados antigos, e libera ao concluir", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return { height: Number(this.querySelector("[data-altura]")?.getAttribute("data-altura") ?? 0) } as DOMRect;
    });
    const { container, rerender } = render(<ConteudoEstavel contexto="a"><div data-altura="400">Dados do contexto A</div></ConteudoEstavel>);
    rerender(<ConteudoEstavel contexto="b"><div aria-busy="true" data-altura="80">Carregando B</div></ConteudoEstavel>);
    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe("400px");
    expect(container.textContent).not.toContain("Dados do contexto A");
    rerender(<ConteudoEstavel contexto="b"><div data-altura="200">Dados do contexto B</div></ConteudoEstavel>);
    await waitFor(() => expect((container.firstElementChild as HTMLElement).style.minHeight).toBe(""));
  });
  it("libera a reserva também quando a consulta termina em erro", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 300 } as DOMRect);
    const { container, rerender } = render(<ConteudoEstavel contexto="a"><div>Lista</div></ConteudoEstavel>);
    rerender(<ConteudoEstavel contexto="b"><div aria-busy="true">Carregando</div></ConteudoEstavel>);
    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe("300px");
    rerender(<ConteudoEstavel contexto="b"><div role="alert">Falha: tente novamente</div></ConteudoEstavel>);
    await waitFor(() => expect((container.firstElementChild as HTMLElement).style.minHeight).toBe(""));
  });
});
