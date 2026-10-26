import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getUser: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  env: {
    CLERK_SECRET_KEY: "sk_test_fixture",
    CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
    CLERK_JWT_KEY: "-----BEGIN PUBLIC KEY-----\nfixture\n-----END PUBLIC KEY-----",
    CLERK_AUTHORIZED_PARTIES: ["http://localhost:41875"],
  },
}));

vi.mock("@clerk/backend", () => ({
  createClerkClient: vi.fn(() => ({
    authenticateRequest: mocks.authenticateRequest,
    users: { getUser: mocks.getUser },
  })),
}));
vi.mock("../../db.js", () => ({
  prisma: {
    usuario: { findUnique: mocks.findUnique, updateMany: mocks.updateMany, update: mocks.update },
    $transaction: mocks.transaction,
  },
}));
vi.mock("../../env.js", () => ({ env: mocks.env }));

import { autenticarRequestClerk } from "./clerk.js";

const usuarioAtivo = {
  id: 7,
  nome: "Ana Silva",
  email: "ana@example.com",
  papel: "gestor",
  abas: ["dashboard"],
  areas: ["financeiro"],
  flags: ["verValores"],
  status: "ATIVO",
  dono: false,
  clerkUserId: "user_fixture",
};

function sessaoValida(subject = "user_fixture") {
  mocks.authenticateRequest.mockResolvedValue({
    isAuthenticated: true,
    toAuth: () => ({ userId: subject }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    usuario: { findUnique: mocks.findUnique, updateMany: mocks.updateMany, update: mocks.update },
  }));
  mocks.update.mockResolvedValue(usuarioAtivo);
});

describe("autenticarRequestClerk", () => {
  it("aceita sessão Clerk de origem autorizada já vinculada a usuário ativo", async () => {
    sessaoValida();
    mocks.findUnique.mockResolvedValue(usuarioAtivo);

    await expect(autenticarRequestClerk(new Request("http://localhost:41875/api/auth/me"))).resolves.toMatchObject({
      id: 7,
      email: "ana@example.com",
      status: "ATIVO",
    });
    expect(mocks.authenticateRequest).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining({
      acceptsToken: "session_token",
      authorizedParties: ["http://localhost:41875"],
      jwtKey: mocks.env.CLERK_JWT_KEY,
    }));
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("rejeita token Clerk inválido", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isAuthenticated: false });

    await expect(autenticarRequestClerk(new Request("http://localhost:41875/api/x"))).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("vincula na primeira entrada somente o e-mail primário verificado, Google e usuário interno ativo", async () => {
    sessaoValida("user_google");
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...usuarioAtivo, clerkUserId: null })
      .mockResolvedValueOnce({ ...usuarioAtivo, clerkUserId: "user_google" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.getUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "ANA@EXAMPLE.COM", verification: { status: "verified" } },
      externalAccounts: [{ provider: "google", verification: { status: "verified" } }],
    });

    await expect(autenticarRequestClerk(new Request("http://localhost:41875/api/x"))).resolves.toMatchObject({ id: 7 });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7, clerkUserId: null },
      data: expect.objectContaining({ clerkUserId: "user_google" }),
    }));
  });

  it("nega primeiro acesso quando o e-mail não possui usuário interno ativo", async () => {
    sessaoValida("user_unknown");
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.getUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "nao-autorizado@example.com", verification: { status: "verified" } },
      externalAccounts: [{ provider: "google", verification: { status: "verified" } }],
    });

    await expect(autenticarRequestClerk(new Request("http://localhost:41875/api/x"))).resolves.toBeNull();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("nega e não altera vínculo quando não existe Google ou o e-mail não foi verificado", async () => {
    sessaoValida("user_not_google");
    mocks.findUnique.mockResolvedValueOnce(null);
    mocks.getUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "ana@example.com", verification: { status: "unverified" } },
      externalAccounts: [{ provider: "github", verification: { status: "verified" } }],
    });

    await expect(autenticarRequestClerk(new Request("http://localhost:41875/api/x"))).resolves.toBeNull();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
