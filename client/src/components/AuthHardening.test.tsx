// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Login } from "./Login";
import { RecuperarSenha } from "./RecuperarSenha";
import { DefinirSenha } from "./DefinirSenha";
import * as api from "../api/auth";
vi.mock("../api/auth", () => ({ login: vi.fn(), solicitarRecuperacao: vi.fn(), validarConvite: vi.fn(), validarReset: vi.fn(), aceitarConvite: vi.fn(), redefinirSenha: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.validarReset).mockResolvedValue({ valido: true }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function preencherSenha() {
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "senha-fixture" } });
  fireEvent.change(screen.getByLabelText("Repita a senha"), { target: { value: "senha-fixture" } });
}
describe("autenticação resiliente", () => {
  it("API mantém status404 e503 para não classificar indisponibilidade como token inválido", async () => {
    const real = await vi.importActual<typeof api>("../api/auth");
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: "Link expirado" }) }).mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: "Indisponível" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(real.validarReset("fixture")).rejects.toMatchObject({ status: 404 });
    await expect(real.validarConvite("fixture")).rejects.toMatchObject({ status: 503 });
  });
  it("convite válido permite entrada uma vez e ignora validação antiga após trocar link", async () => {
    let validarAntigo!: (dados: { nome: string; email: string }) => void;
    vi.mocked(api.validarConvite).mockImplementationOnce(() => new Promise((resolve) => { validarAntigo = resolve; })).mockResolvedValueOnce({ nome: "Pessoa Fixture", email: "fixture@example.test" });
    vi.mocked(api.aceitarConvite).mockResolvedValue({ token: "sessao-fixture", usuario: {} as never });
    const onPronto = vi.fn();
    const { rerender } = render(<DefinirSenha modo="convite" token="antigo" onPronto={onPronto} />);
    rerender(<DefinirSenha modo="convite" token="novo" onPronto={onPronto} />);
    await screen.findByLabelText("Nova senha");
    await act(async () => { validarAntigo({ nome: "Nome Antigo", email: "antigo@example.test" }); });
    expect(screen.queryByText("Bem-vindo, Nome.")).toBeNull();
    expect(screen.getByText("Bem-vindo, Pessoa.")).toBeTruthy();
    preencherSenha();
    const form = screen.getByLabelText("Nova senha").closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    await waitFor(() => expect(onPronto).toHaveBeenCalledTimes(1));
    expect(api.aceitarConvite).toHaveBeenCalledTimes(1);
    expect(api.aceitarConvite).toHaveBeenCalledWith("novo", "senha-fixture");
  });
  it("login não duplica, preserva credenciais recusadas e foca o alerta", async () => {
    let recusar!: (e: Error) => void;
    vi.mocked(api.login).mockImplementationOnce(() => new Promise((_, reject) => { recusar = reject; }));
    render(<Login onEntrar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "fixture@example.test" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-fixture" } });
    const form = screen.getByLabelText("Senha").closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(api.login).toHaveBeenCalledTimes(1);
    await act(async () => { recusar(new Error("Credenciais recusadas")); });
    expect(screen.getByRole("alert")).toBe(document.activeElement);
    expect(screen.getByLabelText("E-mail")).toHaveProperty("value", "fixture@example.test");
    expect(screen.getByLabelText("Senha")).toHaveProperty("value", "senha-fixture");
    fireEvent.submit(form);
    await waitFor(() => expect(api.login).toHaveBeenCalledTimes(2));
  });
  it("recuperação bloqueia envio duplo e conserva email na falha sem afirmar conta existente", async () => {
    let recusar!: (e: Error) => void;
    vi.mocked(api.solicitarRecuperacao).mockImplementationOnce(() => new Promise((_, reject) => { recusar = reject; }));
    render(<RecuperarSenha />);
    const email = screen.getByLabelText("E-mail");
    fireEvent.change(email, { target: { value: "fixture@example.test" } });
    const form = email.closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(api.solicitarRecuperacao).toHaveBeenCalledTimes(1);
    await act(async () => { recusar(new Error("Falha de rede")); });
    expect(screen.getByRole("alert")).toBe(document.activeElement);
    expect(email).toHaveProperty("value", "fixture@example.test");
    vi.mocked(api.solicitarRecuperacao).mockResolvedValueOnce("Se a conta existir, enviaremos um link.");
    fireEvent.submit(form);
    await screen.findByText(/Verifique também a caixa de spam/);
    expect(api.solicitarRecuperacao).toHaveBeenCalledTimes(2);
  });
  it("validação lenta impede escrita; rede permite retry e 404 distingue link inválido", async () => {
    let recusar!: (e: Error) => void;
    vi.mocked(api.validarReset).mockImplementationOnce(() => new Promise((_, reject) => { recusar = reject; }));
    render(<DefinirSenha modo="senha" token="fixture" onPronto={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("Verificando");
    expect(screen.queryByLabelText("Nova senha")).toBeNull();
    expect(api.redefinirSenha).not.toHaveBeenCalled();
    await act(async () => { recusar(new TypeError("Failed to fetch")); });
    expect(screen.getByRole("alert").textContent).toContain("conexão");
    expect(screen.queryByText(/Este link é inválido/)).toBeNull();
    vi.mocked(api.validarReset).mockRejectedValueOnce(Object.assign(new Error("Expirado"), { status: 404 }));
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText(/Este link é inválido/);
    expect(api.validarReset).toHaveBeenCalledTimes(2);
  });
  it("reset preserva senhas na falha e não duplica submissão", async () => {
    let recusar!: (e: Error) => void;
    vi.mocked(api.redefinirSenha).mockImplementationOnce(() => new Promise((_, reject) => { recusar = reject; }));
    render(<DefinirSenha modo="senha" token="fixture" onPronto={vi.fn()} />);
    await screen.findByLabelText("Nova senha"); preencherSenha();
    expect(screen.getAllByRole("button", { name: "Mostrar senha" })).toHaveLength(2);
    const form = screen.getByLabelText("Nova senha").closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(api.redefinirSenha).toHaveBeenCalledTimes(1);
    await act(async () => { recusar(new Error("Sessão alterada; tente novamente")); });
    expect(screen.getByRole("alert")).toBe(document.activeElement);
    expect(screen.getByLabelText("Nova senha")).toHaveProperty("value", "senha-fixture");
    expect(screen.getByLabelText("Repita a senha")).toHaveProperty("value", "senha-fixture");
  });
  it("trocar token ignora validação e sessão atrasadas do token anterior", async () => {
    let concluir!: (r: Awaited<ReturnType<typeof api.redefinirSenha>>) => void;
    const onPronto = vi.fn();
    vi.mocked(api.redefinirSenha).mockImplementationOnce(() => new Promise((resolve) => { concluir = resolve; }));
    const { rerender } = render(<DefinirSenha modo="senha" token="antigo" onPronto={onPronto} />);
    await screen.findByLabelText("Nova senha"); preencherSenha();
    fireEvent.submit(screen.getByLabelText("Nova senha").closest("form")!);
    vi.mocked(api.validarReset).mockImplementationOnce(() => new Promise(() => {}));
    rerender(<DefinirSenha modo="senha" token="novo" onPronto={onPronto} />);
    await act(async () => { concluir({ token: "sessao-antiga", usuario: {} as never }); });
    expect(onPronto).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Nova senha")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
