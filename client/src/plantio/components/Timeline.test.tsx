// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EventoTimeline } from "../types";

const apiMocks = vi.hoisted(() => ({
  excluirOperacao: vi.fn(),
}));

vi.mock("../api", () => ({
  excluirOperacao: apiMocks.excluirOperacao,
}));

import { Timeline } from "./Timeline";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const eventos: EventoTimeline[] = [
  {
    id: "op-1",
    talhaoId: "t1",
    data: "2026-09-10",
    dominio: "colheita",
    titulo: "Colheita talhão 1",
  },
];

describe("Timeline", () => {
  it("exibe erro no diálogo quando a exclusão falha (ex.: período fechado)", async () => {
    apiMocks.excluirOperacao.mockRejectedValue(new Error("Período fechado para lançamentos."));
    render(<Timeline eventos={eventos} />);

    fireEvent.click(screen.getByRole("button", { name: "excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      expect(screen.getByText("Período fechado para lançamentos.")).toBeTruthy();
    });
  });

  it("chama onExcluido e fecha o diálogo quando a exclusão é bem-sucedida", async () => {
    apiMocks.excluirOperacao.mockResolvedValue(undefined);
    const onExcluido = vi.fn();
    render(<Timeline eventos={eventos} onExcluido={onExcluido} />);

    fireEvent.click(screen.getByRole("button", { name: "excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      expect(onExcluido).toHaveBeenCalled();
    });
  });
});
