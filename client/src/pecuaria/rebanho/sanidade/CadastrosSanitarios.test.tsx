// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { CadastrosSanitarios } from "./CadastrosSanitarios";
import { listarTiposAplicacao, reqSanidade } from "./api";

vi.mock("./api", () => ({
  listarTiposAplicacao: vi.fn(),
  reqSanidade: vi.fn(),
  salvarTipoAplicacao: vi.fn(),
}));
vi.mock("./ProtocolosCadastro", () => ({ ProtocolosCadastro: () => null }));

const doencas = [{ id: "d1", nome: "Mastite", ativo: true }];
const exames = [
  {
    id: "e1",
    nome: "CCS",
    ativo: false,
    tipoResultado: "NUMERO",
    unidade: "mil cél/mL",
    opcoes: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarTiposAplicacao).mockResolvedValue([]);
  vi.mocked(reqSanidade).mockImplementation(async (path) => {
    if (path.startsWith("/doencas")) return doencas as never;
    if (path.startsWith("/tipos-exame")) return exames as never;
    return [] as never;
  });
});
afterEach(() => cleanup());

describe("Cadastros sanitários", () => {
  it("edita uma doença existente com PATCH e mantém inativos visíveis", async () => {
    render(<CadastrosSanitarios podeLancar />);
    await screen.findByText("Mastite · Ativa");
    await screen.findByText(/CCS · NUMERO.*Inativo/);
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Mastite clínica" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(reqSanidade).toHaveBeenCalledWith(
        "/doencas/d1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });

  it("altera o estado ativo de um tipo de exame", async () => {
    render(<CadastrosSanitarios podeLancar />);
    await screen.findByText(/CCS · NUMERO.*Inativo/);
    fireEvent.click(screen.getByRole("button", { name: "Ativar" }));
    await waitFor(() =>
      expect(reqSanidade).toHaveBeenCalledWith(
        "/tipos-exame/e1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ ativo: true }),
        }),
      ),
    );
  });
});
