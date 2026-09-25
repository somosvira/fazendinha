import { beforeEach, describe, expect, it, vi } from "vitest";

const contas = vi.hoisted(() => ({
  autenticar: vi.fn(),
  validarConvite: vi.fn(),
  validarReset: vi.fn(),
  aceitarConvite: vi.fn(),
  redefinirSenha: vi.fn(),
  solicitarRecuperacaoSenha: vi.fn(),
}));
const sessoes = vi.hoisted(() => ({ criarSessao: vi.fn(), revogarSessao: vi.fn() }));
const email = vi.hoisted(() => ({ canalRecuperacaoConfigurado: vi.fn(() => true) }));

vi.mock("../services/auth/contas.js", () => contas);
vi.mock("../services/auth/sessao.js", () => sessoes);
vi.mock("../services/auth/email.js", () => email);
vi.mock("../middleware/permissao.js", () => ({ getUsuario: vi.fn() }));
vi.mock("../env.js", () => ({
  env: { AUTH_RESET_MAX_PER_EMAIL: 3, AUTH_RESET_MAX_PER_IP: 10, AUTH_RESET_RATE_WINDOW_MINUTES: 15 },
}));

import { authPublicoRouter, MENSAGEM_RECUPERACAO } from "./auth.js";

beforeEach(() => {
  vi.clearAllMocks();
  email.canalRecuperacaoConfigurado.mockReturnValue(true);
});

describe("POST /auth/forgot-password", () => {
  it("responde de forma idêntica sem revelar conta ou token", async () => {
    contas.solicitarRecuperacaoSenha.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const request = (email: string) => authPublicoRouter.request("/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "198.51.100.20" },
      body: JSON.stringify({ email }),
    });

    const existente = await request("existente.fixture@example.test");
    const inexistente = await request("inexistente.fixture@example.test");
    const bodyExistente = await existente.json();
    const bodyInexistente = await inexistente.json();

    expect(existente.status).toBe(202);
    expect(inexistente.status).toBe(202);
    expect(bodyExistente).toEqual({ message: MENSAGEM_RECUPERACAO });
    expect(bodyInexistente).toEqual(bodyExistente);
    expect(JSON.stringify(bodyExistente)).not.toMatch(/token|existente/i);
  });

  it("mantém a resposta neutra e não emite token quando o canal está desligado", async () => {
    email.canalRecuperacaoConfigurado.mockReturnValue(false);

    const response = await authPublicoRouter.request("/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "conta.fixture@example.test" }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ message: MENSAGEM_RECUPERACAO });
    expect(contas.solicitarRecuperacaoSenha).not.toHaveBeenCalled();
  });
});

describe("GET /auth/reset-password/:token", () => {
  it("informa um erro recuperável para token inválido, expirado ou usado", async () => {
    contas.validarReset.mockResolvedValue(false);
    const response = await authPublicoRouter.request("/auth/reset-password/invalido");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "link inválido, expirado ou já utilizado" });
  });

  it("conclui pela rota canônica e mantém o alias antigo da API", async () => {
    const usuario = { id: 8, email: "fixture@example.test" };
    contas.redefinirSenha.mockResolvedValue(usuario);
    sessoes.criarSessao.mockResolvedValue("nova-sessao");

    for (const path of ["/auth/reset-password", "/auth/senha/redefinir"]) {
      const response = await authPublicoRouter.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "token-fixture", senha: "senha-nova-segura" }),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ token: "nova-sessao", usuario });
    }
  });

  it("rejeita payload fora do schema antes de concluir o reset", async () => {
    const response = await authPublicoRouter.request("/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "token-fixture", senha: "curta" }),
    });

    expect(response.status).toBe(400);
    expect(contas.redefinirSenha).not.toHaveBeenCalled();
  });
});
