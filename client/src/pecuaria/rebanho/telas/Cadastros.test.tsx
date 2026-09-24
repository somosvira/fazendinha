// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Cadastros } from "./Cadastros";
import { RebanhoApiError, criarRaca, editarMotivoSaida, editarRaca, listarMotivosSaida, listarRacas } from "../api";
import type { Raca } from "../types";

/* Mantém RebanhoApiError real (os forms usam instanceof) e substitui só as chamadas. */
vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  listarRacas: vi.fn(),
  criarRaca: vi.fn(),
  editarRaca: vi.fn(),
  listarMotivosSaida: vi.fn(),
  criarMotivoSaida: vi.fn(),
  editarMotivoSaida: vi.fn(),
}));

const racasMock: Raca[] = [
  { id: "r1", nome: "Holandesa", sigla: "HOL", base: true, ativo: true },
  { id: "r2", nome: "Gir", sigla: "GIR", base: false, ativo: false },
];

/* A tabela responsiva renderiza tabela E cartões; no jsdom os dois existem,
 * então pegamos sempre a primeira ocorrência (mesma convenção de
 * ConfiguracoesFinanceiras.test.tsx). */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(listarRacas).mockResolvedValue(racasMock);
  vi.mocked(listarMotivosSaida).mockResolvedValue([]);
  vi.mocked(editarRaca).mockImplementation((id, patch) => Promise.resolve({ ...racasMock.find((r) => r.id === id)!, ...patch }));
});
afterEach(cleanup);

async function montar() {
  render(<Cadastros />);
  await screen.findAllByText("Holandesa");
}

describe("Cadastros do rebanho — raças", () => {
  it("lista raças com sigla, tipo e situação", async () => {
    await montar();
    const tabela = screen.getByRole("table", { name: "Raças" });
    const linha1 = within(tabela).getByText("Holandesa").closest("tr")!;
    expect(within(linha1).getByText("HOL")).toBeTruthy();
    expect(within(linha1).getByText("Base")).toBeTruthy();
    const linha2 = within(tabela).getByText("Gir").closest("tr")!;
    expect(within(linha2).getByText("Composta")).toBeTruthy();
    expect(within(linha2).getByText("Inativa")).toBeTruthy();
  });

  it("cria raça com sigla em maiúsculas e base marcada por padrão", async () => {
    vi.mocked(criarRaca).mockResolvedValue(racasMock[0]);
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Nova raça/ }));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText(/Raça base/) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(within(painel).getByLabelText("Nome da raça"), { target: { value: "Girolando" } });
    fireEvent.change(within(painel).getByLabelText("Sigla"), { target: { value: "gir" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar raça" }));
    await waitFor(() => expect(criarRaca).toHaveBeenCalledWith({ nome: "Girolando", sigla: "GIR", base: true }));
  });

  it("editar carrega os valores atuais da raça", async () => {
    await montar();
    fireEvent.click(primeiro("button", "Editar Holandesa"));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Sigla") as HTMLInputElement).value).toBe("HOL");
    fireEvent.click(within(painel).getByLabelText(/Raça base/));
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar raça" }));
    await waitFor(() => expect(editarRaca).toHaveBeenCalledWith("r1", { nome: "Holandesa", sigla: "HOL", base: false }));
  });

  it("desativar pede confirmação e reativar não", async () => {
    await montar();
    fireEvent.click(primeiro("button", "Reativar Gir"));
    await waitFor(() => expect(editarRaca).toHaveBeenCalledWith("r2", { ativo: true }));

    fireEvent.click(primeiro("button", "Desativar Holandesa"));
    expect(await screen.findByRole("heading", { name: "Desativar Holandesa?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(editarRaca).toHaveBeenCalledWith("r1", { ativo: false }));
  });
});
