import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
  gerarLinkConvite: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: { usuario: { count: mocks.count, create: mocks.create } },
}));
vi.mock("../../env.js", () => ({
  env: { AUTH_BOOTSTRAP_EMAIL: "owner.fixture@example.test", AUTH_BOOTSTRAP_NOME: "Owner Fixture" },
}));
vi.mock("./contas.js", () => ({ gerarLinkConvite: mocks.gerarLinkConvite }));
vi.mock("./sessao.js", () => ({ revogarSessoesDoUsuario: vi.fn() }));

import { garantirDonoBootstrap } from "./usuarios.js";

beforeEach(() => vi.clearAllMocks());

describe("garantirDonoBootstrap", () => {
  it("não cria, altera ou emite token quando já existe qualquer usuário", async () => {
    mocks.count.mockResolvedValue(1);

    await garantirDonoBootstrap();

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.gerarLinkConvite).not.toHaveBeenCalled();
  });
});
