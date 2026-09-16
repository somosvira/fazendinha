// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const apiMocks = vi.hoisted(() => ({ criarFuncionario: vi.fn(), editarFuncionario: vi.fn(), baixarFuncionario: vi.fn() }));
vi.mock("../api", () => apiMocks);

import { FuncionarioForm } from "./FuncionarioForm";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const hoje = new Date();
const pad = (n: number) => String(n).padStart(2, "0");

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  apiMocks.criarFuncionario.mockReset().mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("FuncionarioForm", () => {
  it("escolhe a data de admissão no calendário", async () => {
    render(<FuncionarioForm modo="novo" onFechar={vi.fn()} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Admissão" }));
    fireEvent.click(await screen.findByRole("button", { name: `1 de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}` }));
    expect(screen.getByRole("button", { name: "Admissão" }).textContent).toBe(`01/${pad(hoje.getMonth() + 1)}/${hoje.getFullYear()}`);
    fireEvent.change(screen.getByPlaceholderText("Ex.: José da Silva"), { target: { value: "José" } });
    fireEvent.change(screen.getByPlaceholderText("Ex.: 2200.00"), { target: { value: "2000" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(apiMocks.criarFuncionario).toHaveBeenCalledWith(expect.objectContaining({
      dataAdmissao: `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`,
    }));
  });
});
