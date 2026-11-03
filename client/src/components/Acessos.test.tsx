// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Acessos } from "./Acessos";
import { ToastProvider } from "./Toast";
const api = vi.hoisted(() => ({ listarUsuarios: vi.fn(), atualizarUsuario: vi.fn(), criarUsuario: vi.fn(), revogarUsuario: vi.fn(), gerarConvite: vi.fn() }));
vi.mock("../api/auth", () => api);
const pessoa = { id: 7, nome: "Pessoa de teste", email: "teste@example.test", papel: "personalizado", areas: [], abas: [], flags: [], status: "ATIVO", dono: false };
beforeEach(() => { window.history.replaceState(null, '', '/acessos'); vi.clearAllMocks(); api.listarUsuarios.mockResolvedValue([pessoa]); });
afterEach(cleanup);

it("não apresenta permissão como salva quando o servidor recusa a alteração", async () => {
  let rejeitar!: (erro: Error) => void;
  api.atualizarUsuario.mockImplementation(() => new Promise((_resolve, reject) => { rejeitar = reject; }));
  render(<ToastProvider><Acessos /></ToastProvider>);
  fireEvent.click(await screen.findByRole("button",{name:/Pessoa de teste/}));
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
it("abre permissões em modal só após escolher a pessoa e retorna à consulta", async () => {
  render(<ToastProvider><Acessos /></ToastProvider>);
  const pessoaBotao=await screen.findByRole('button',{name:/Pessoa de teste/});
  expect(screen.queryByRole('dialog')).toBeNull();
  pessoaBotao.focus();fireEvent.click(pessoaBotao);
  expect(await screen.findByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Fechar'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(()=>expect(document.activeElement).toBe(pessoaBotao));
});
it('não abre outra pessoa quando o usuário solicitado no link não existe',async()=>{
 window.history.replaceState(null,'','/acessos?usuario=999');
 render(<ToastProvider><Acessos/></ToastProvider>);
 await screen.findByRole('button',{name:/Pessoa de teste/});
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(screen.getByRole('alert').textContent).toContain('Pessoa não encontrada');
 window.history.replaceState(null,'','/acessos');
});
