// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Acessos } from "./Acessos";
import { ToastProvider } from "./Toast";
const api = vi.hoisted(() => ({ listarUsuarios: vi.fn(), atualizarUsuario: vi.fn(), criarUsuario: vi.fn(), revogarUsuario: vi.fn(), gerarConvite: vi.fn() }));
vi.mock("../api/auth", () => api);
const pessoa = { id: 7, nome: "Pessoa de teste", email: "teste@example.test", papel: "personalizado", areas: [], abas: [], flags: [], status: "ATIVO", dono: false };
beforeEach(() => { vi.clearAllMocks(); api.listarUsuarios.mockResolvedValue([pessoa]); });
afterEach(cleanup);

it("não apresenta permissão como salva quando o servidor recusa a alteração", async () => {
  let rejeitar!: (erro: Error) => void;
  api.atualizarUsuario.mockImplementation(() => new Promise((_resolve, reject) => { rejeitar = reject; }));
  render(<ToastProvider><Acessos /></ToastProvider>);
  const area = await screen.findByRole("button", { name: /^Financeiro/ });
  expect(area.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(area);
  await screen.findByText("Salvando permissões…");
  expect(area.closest("fieldset")?.disabled).toBe(true);
  expect(area.getAttribute("aria-pressed")).toBe("false");
  rejeitar(new Error("Permissão negada"));
  await screen.findByText("Não foi possível salvar");
  await waitFor(() => expect(area.closest("fieldset")?.disabled).toBe(false));
  expect(area.getAttribute("aria-pressed")).toBe("false");
});
