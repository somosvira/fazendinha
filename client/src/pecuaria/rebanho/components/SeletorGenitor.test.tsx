// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CampoGenitor } from "./CampoGenitor";
import { ModalCadastroAnimal } from "../forms/ModalCadastroAnimal";
import { listarAnimais, listarGenitores } from "../api";
vi.mock("../api", async original => ({ ...await original<typeof import("../api")>(), listarAnimais: vi.fn(), listarGenitores: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(listarGenitores).mockResolvedValue([]); vi.mocked(listarAnimais).mockResolvedValue({ itens: [{ id: "a", nome: "Aurora", brinco: "101", propriedade: { id: 1, nome: "Sede" }, situacao: "ATIVO" }], total: 7 } as never); });
afterEach(cleanup);

describe("seletor de genitor do cadastro", () => {
  it("só aplica seleção após confirmação e pagina animais pelo servidor", async () => {
    const alterar = vi.fn();
    render(<CampoGenitor compacto rotulo="Mãe" sexo="F" valor={{ tipo: "NENHUM" }} onChange={alterar} propriedadeId={1} />);
    fireEvent.click(screen.getByRole("button", { name: /Mãe.*Selecionar mãe/ }));
    const modal = await screen.findByRole("dialog", { name: "Selecionar mãe" });
    fireEvent.click(await within(modal).findByRole("radio", { name: /Aurora/ }));
    expect(alterar).not.toHaveBeenCalled();
    fireEvent.click(within(modal).getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(listarAnimais).toHaveBeenCalledWith(expect.objectContaining({ sexo: "F", page: 2 }), 1));
    fireEvent.click(within(modal).getByRole("button", { name: "Cancelar" }));
    expect(alterar).not.toHaveBeenCalled();
  });
  it.each(["Cancelar", "Fechar", "Escape", "confirmar"])("devolve foco ao acionador ao fechar por %s", async acao => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
    render(<ModalCadastroAnimal titulo="Novo animal" onFechar={vi.fn()} rodape={null}><CampoGenitor compacto rotulo="Pai" sexo="M" valor={{ tipo: "NENHUM" }} onChange={vi.fn()} /></ModalCadastroAnimal>);
    const acionador = screen.getByRole("button", { name: /Pai.*Selecionar pai/ }); acionador.focus(); fireEvent.click(acionador);
    const modal = await screen.findByRole("dialog", { name: "Selecionar pai" });
    if (acao === "confirmar") {
      fireEvent.click(await within(modal).findByRole("radio", { name: /Aurora/ }));
      fireEvent.click(within(modal).getByRole("button", { name: "Próxima" }));
      await waitFor(() => expect(listarAnimais).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }), undefined));
      fireEvent.click(within(modal).getByRole("button", { name: "Usar como pai" }));
    } else if (acao === "Escape") fireEvent.keyDown(modal, { key: "Escape" });
    else fireEvent.click(within(modal).getByRole("button", { name: acao }));
    await waitFor(() => expect(document.activeElement).toBe(acionador));
    vi.unstubAllGlobals();
  });

  it("permite selecionar externo ou limpar explicitamente", async () => {
    vi.mocked(listarGenitores).mockResolvedValue([{ id: "x", nome: "Touro", codigo: "123", fornecedor: "Origem", sexo: "M", ativo: true }] as never);
    const alterar = vi.fn(); render(<CampoGenitor compacto rotulo="Pai" sexo="M" valor={{ tipo: "NENHUM" }} onChange={alterar} />);
    fireEvent.click(screen.getByRole("button", { name: /Pai.*Selecionar pai/ }));
    const modal = await screen.findByRole("dialog", { name: "Selecionar pai" });
    fireEvent.click(within(modal).getByRole("button", { name: "Genitores externos" }));
    fireEvent.click(await within(modal).findByRole("radio", { name: /Touro/ }));
    fireEvent.click(within(modal).getByRole("button", { name: "Usar como pai" }));
    expect(alterar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "EXTERNO", id: "x", nome: "Touro" }));
  });
  it("pagina externos localmente e ignora respostas atrasadas", async () => {
    let liberar!: (itens: never[]) => void;
    vi.mocked(listarGenitores).mockImplementation(({ q } = {}) => q === "antigo" ? new Promise(resolve => { liberar = resolve; }) : Promise.resolve(Array.from({ length: 7 }, (_, i) => ({ id: `g${i}`, nome: `Genitor ${i + 1}`, sexo: "M", ativo: true })) as never));
    render(<CampoGenitor compacto rotulo="Pai" sexo="M" valor={{ tipo: "NENHUM" }} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Pai.*Selecionar pai/ }));
    const modal = screen.getByRole("dialog", { name: "Selecionar pai" });
    fireEvent.click(within(modal).getByRole("button", { name: "Genitores externos" }));
    await within(modal).findByText("Genitor 1");
    fireEvent.click(within(modal).getByRole("button", { name: "Próxima" }));
    expect(within(modal).getByText("Genitor 7")).toBeTruthy();
    expect(listarGenitores).toHaveBeenCalledTimes(1);
    const busca = within(modal).getByLabelText("Buscar por nome");
    fireEvent.change(busca, { target: { value: "antigo" } });
    await waitFor(() => expect(listarGenitores).toHaveBeenCalledWith(expect.objectContaining({ q: "antigo" }), undefined));
    fireEvent.change(busca, { target: { value: "novo" } });
    await within(modal).findByText("Genitor 1");
    liberar([{ id: "velho", nome: "Resposta antiga", sexo: "M", ativo: true } as never]);
    await waitFor(() => expect(within(modal).queryByText("Resposta antiga")).toBeNull());
  });

  it("distingue falha de lista vazia e oferece nova tentativa", async () => {
    vi.mocked(listarAnimais).mockRejectedValueOnce(new Error("falha"));
    render(<CampoGenitor compacto rotulo="Pai" sexo="M" valor={{ tipo: "NENHUM" }} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Pai.*Selecionar pai/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível carregar");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Aurora")).toBeTruthy();
  });
});
