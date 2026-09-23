// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ListaAnimais } from "./ListaAnimais";
import { listarAnimais, obterCatalogos } from "../api";
import type { Catalogos } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  listarAnimais: vi.fn(),
  obterCatalogos: vi.fn(),
}));

const vazio = { itens: [], total: 0, painel: { totalAtivos: 0, porCategoria: [], porSitio: [], femeasAtivas: 0, receptorasAtivas: 0 } };

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarAnimais).mockResolvedValue(vazio as never);
  vi.mocked(obterCatalogos).mockResolvedValue({ racas: [], motivosSaida: [], propriedades: [], lotes: [] } as Catalogos);
});

describe("ListaAnimais", () => {
  it("busca espera 300 ms sem digitar e faz uma única requisição", async () => {
    vi.useFakeTimers();
    render(<ListaAnimais onAbrirAnimal={vi.fn()} onNovoAnimal={vi.fn()} />);
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    const inicial = vi.mocked(listarAnimais).mock.calls.length;
    const campo = screen.getByLabelText("Buscar por brinco ou nome");
    for (const texto of ["1", "10", "100", "1001"]) {
      fireEvent.change(campo, { target: { value: texto } });
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    }
    expect(vi.mocked(listarAnimais).mock.calls.length).toBe(inicial);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    const novas = vi.mocked(listarAnimais).mock.calls.slice(inicial);
    expect(novas).toHaveLength(1);
    expect(novas[0][0]).toMatchObject({ busca: "1001", page: 1 });
  });

  it("trocar um filtro dispara uma única busca, já na página 1", async () => {
    vi.useFakeTimers();
    render(<ListaAnimais onAbrirAnimal={vi.fn()} onNovoAnimal={vi.fn()} />);
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    const inicial = vi.mocked(listarAnimais).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Filtrar por categoria"), { target: { value: "VACA" } });
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    const novas = vi.mocked(listarAnimais).mock.calls.slice(inicial);
    expect(novas).toHaveLength(1);
    expect(novas[0][0]).toMatchObject({ categoria: "VACA", page: 1 });
  });

  it("sem permissão de lançar não oferece Novo animal", async () => {
    render(<ListaAnimais onAbrirAnimal={vi.fn()} onNovoAnimal={vi.fn()} podeLancar={false} />);
    await screen.findByText("Nenhum animal encontrado com os filtros selecionados.");
    expect(screen.queryByRole("button", { name: /Novo animal/ })).toBeNull();
  });
});
