import { selecionarCampoLeite } from "./select-campo-teste";
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { DescarteLeite } from "./DescarteLeite";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { listarProdutos } from "../../../estoque/api";
vi.mock("./operacoes-api", () => ({
  consultarLeite: vi.fn(),
  registrarLeite: vi.fn(),
}));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn() }));
vi.mock("../../../propriedadeScope", () => ({
  getPropriedadeAtiva: () => null,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("descarta uma quantidade explícita da origem sem atribuir destinatário ou repetir saída", async () => {
  vi.mocked(listarProdutos).mockResolvedValue([
    {
      id: "leite",
      nome: "Leite",
      unidade: "L",
      ativo: true,
      rastrearPartidas: false,
    },
  ]);
  vi.mocked(consultarLeite).mockImplementation(async (p) =>
    p.startsWith("/destinos/origens")
      ? {
          itens: [
            {
              entradaId: "origem",
              data: "2026-10-19",
              nomeOrdenha: "Tarde",
              quantidadeDisponivelLitros: 10,
            },
          ],
        }
      : { propriedadeId: 2, itens: [], total: 0, tamanho: 20 },
  );
  render(<DescarteLeite podeLancar />);
  fireEvent.click(screen.getByRole("button", { name: "Registrar descarte" }));
  await selecionarCampoLeite("Produto para descarte", "leite");
  await selecionarCampoLeite("Origem descartada", "origem");
  fireEvent.change(screen.getByLabelText("Litros descartados"), {
    target: { value: "3,5" },
  });
  fireEvent.change(screen.getByLabelText("Motivo do descarte"), {
    target: { value: "Derramamento conferido no manejo" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar descarte físico" }),
  );
  await waitFor(() =>
    expect(registrarLeite).toHaveBeenCalledWith(
      "/descartes",
      2,
      expect.objectContaining({
        entradaId: "origem",
        quantidadeLitros: 3.5,
        quantidadeDisponivelEsperadaLitros: 10,
      }),
    ),
  );
  expect(vi.mocked(registrarLeite).mock.calls[0][2]).not.toHaveProperty(
    "parcelas",
  );
});
