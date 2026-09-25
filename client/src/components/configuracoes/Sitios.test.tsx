// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Sitios } from "./Sitios";
import { criarPropriedade, editarPropriedade, usePropriedades, type PropriedadeDTO } from "../../api/propriedades";

const sitiosMock: PropriedadeDTO[] = [
  { id: 1, nome: "Principal", apelido: "Sede", cidade: "Uberaba", uf: "MG", principal: true, ativo: true, ordem: 0 },
  { id: 2, nome: "Mexicana", apelido: null, cidade: null, uf: null, principal: false, ativo: false, ordem: 1 },
];

vi.mock("../../api/propriedades", () => ({
  usePropriedades: vi.fn(),
  criarPropriedade: vi.fn(),
  editarPropriedade: vi.fn(),
}));

/* A tabela responsiva renderiza tabela E cartões; no jsdom os dois existem,
 * então pegamos sempre a primeira ocorrência. */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(usePropriedades).mockReturnValue({ data: sitiosMock, loading: false, recarregar: vi.fn() });
  vi.mocked(criarPropriedade).mockResolvedValue({ ...sitiosMock[1], id: 3, nome: "Nova" });
  vi.mocked(editarPropriedade).mockImplementation((id, patch) => Promise.resolve({ ...sitiosMock.find((s) => s.id === id)!, ...patch }));
});
afterEach(cleanup);

describe("Configurações > Sítios", () => {
  it("lista sítios com apelido, cidade, principal e situação", () => {
    render(<Sitios />);
    const tabela = screen.getByRole("table", { name: "Sítios" });
    expect(within(tabela).getByText("Principal", { selector: "strong" })).toBeTruthy();
    expect(within(tabela).getByText("Sede")).toBeTruthy();
    expect(within(tabela).getByText("Uberaba — MG")).toBeTruthy();
    expect(within(tabela).getByText("Inativo")).toBeTruthy();
  });

  it("mostrar inativos pede a listagem com incluirInativos", () => {
    render(<Sitios />);
    expect(usePropriedades).toHaveBeenLastCalledWith({ incluirInativos: false });
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar inativos" }));
    expect(usePropriedades).toHaveBeenLastCalledWith({ incluirInativos: true });
  });

  it("cria sítio com cidade e UF em maiúsculas", async () => {
    render(<Sitios />);
    fireEvent.click(screen.getByRole("button", { name: /Novo sítio/ }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText(/Nome do sítio/), { target: { value: "Nova" } });
    fireEvent.change(within(painel).getByLabelText("Cidade"), { target: { value: "Uberaba" } });
    fireEvent.change(within(painel).getByLabelText("UF"), { target: { value: "mg" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar sítio" }));
    await waitFor(() => expect(criarPropriedade).toHaveBeenCalledWith({
      nome: "Nova", apelido: undefined, cidade: "Uberaba", uf: "MG", principal: false, ativo: true,
    }));
  });

  it("UF com uma letra só mostra o erro e não salva", async () => {
    render(<Sitios />);
    fireEvent.click(screen.getByRole("button", { name: /Novo sítio/ }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText(/Nome do sítio/), { target: { value: "Nova" } });
    fireEvent.change(within(painel).getByLabelText("UF"), { target: { value: "M" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar sítio" }));
    expect(await within(painel).findByText("Use a sigla do estado, com 2 letras")).toBeTruthy();
    expect(criarPropriedade).not.toHaveBeenCalled();
  });

  it("desativar pede confirmação; reativar não pede", async () => {
    render(<Sitios />);
    fireEvent.click(primeiro("button", "Reativar Mexicana"));
    await waitFor(() => expect(editarPropriedade).toHaveBeenCalledWith(2, { nome: "Mexicana", ativo: true }));
    expect(screen.queryByRole("heading", { name: /Desativar/ })).toBeNull();

    fireEvent.click(primeiro("button", "Desativar Principal"));
    expect(await screen.findByRole("heading", { name: "Desativar Principal?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(editarPropriedade).toHaveBeenCalledWith(1, { nome: "Principal", ativo: false }));
  });
});
