// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CentralAlertas } from "./CentralAlertas";
const m = vi.hoisted(() => ({ consultar: vi.fn(), navegar: vi.fn() }));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  consultarAlertas: m.consultar,
}));
vi.mock("../../../router", () => ({ navegarPara: m.navegar }));
vi.mock("../api", () => ({ listarLotes: vi.fn().mockResolvedValue([]) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});
it("central conserva produtor, tipo e sítio do cuidado ao consultar e abrir o histórico", async () => {
  window.history.replaceState(
    null,
    "",
    "/pecuaria/rebanho/alertas?produtor=reproducao&tipo=DG_VENCIDO&propriedadeId=7",
  );
  m.consultar.mockResolvedValue({
    itens: [],
    total: 0,
    pagina: 1,
    tamanho: 20,
    totaisGerais: { cuidados: 0, animais: 0, necessidades: 0 },
    totaisFiltrados: { cuidados: 0, animais: 0, necessidades: 0 },
    tiposDisponiveis: ["DG_VENCIDO"],
    cobertura: {
      estado: "ATUALIZADA",
      diaCoberto: "2026-11-07",
      ultimaConclusao: null,
      erro: null,
    },
  });
  render(<CentralAlertas />);
  await waitFor(() =>
    expect(m.consultar).toHaveBeenCalledWith(
      expect.objectContaining({
        produtor: "reproducao",
        tipo: "DG_VENCIDO",
        propriedadeId: 7,
      }),
      expect.any(AbortSignal),
    ),
  );
  expect(screen.getAllByText("Reprodução").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Histórico de alertas" }));
  expect(m.navegar).toHaveBeenCalledWith(
    expect.stringContaining("/pecuaria/rebanho/alertas/historico?"),
  );
  const destino = new URL(m.navegar.mock.calls[0][0], "https://local.test");
  expect(destino.searchParams.get("produtor")).toBe("reproducao");
  expect(destino.searchParams.get("tipo")).toBe("DG_VENCIDO");
  expect(destino.searchParams.get("propriedadeId")).toBe("7");
});
