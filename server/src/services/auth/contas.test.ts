import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    tokenAcesso: { findUnique: vi.fn(), updateMany: vi.fn() },
    usuario: { update: vi.fn() },
    sessao: { deleteMany: vi.fn() },
  };
  return {
    tx,
    prisma: {
      usuario: { findUnique: vi.fn() },
      tokenAcesso: { findUnique: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
});

vi.mock("../../db.js", () => ({ prisma: mocks.prisma }));
vi.mock("../../env.js", () => ({ env: { APP_BASE_URL: "https://terrano.example" } }));
vi.mock("./hash.js", () => ({
  hashSenha: (senha: string) => `hash:${senha}`,
  verificarSenha: vi.fn(),
}));
vi.mock("./email.js", () => ({ enviarLinkRecuperacao: vi.fn() }));

import { aceitarConvite, gerarLinkConvite, gerarLinkReset, LinkAcessoError, redefinirSenha, solicitarRecuperacaoSenha } from "./contas.js";

const usuarioAtivo = {
  id: 41,
  nome: "Conta Fixture",
  email: "conta.fixture@example.test",
  papel: "gestor",
  abas: ["dashboard"],
  areas: ["pecuaria"],
  flags: ["verValores"],
  status: "ATIVO",
  dono: false,
  ultimoAcesso: null,
  senhaHash: "hash:anterior",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx));
  mocks.prisma.tokenAcesso.create.mockResolvedValue({});
  mocks.prisma.tokenAcesso.deleteMany.mockResolvedValue({ count: 0 });
});

describe("solicitarRecuperacaoSenha", () => {
  it("emite e entrega um link canônico somente para uma conta ativa", async () => {
    mocks.prisma.usuario.findUnique.mockResolvedValue(usuarioAtivo);
    const entregar = vi.fn().mockResolvedValue(undefined);

    await expect(solicitarRecuperacaoSenha(" CONTA.FIXTURE@example.test ", entregar)).resolves.toBe(true);

    expect(mocks.prisma.usuario.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: "conta.fixture@example.test" },
    }));
    expect(entregar).toHaveBeenCalledWith(expect.objectContaining({
      destinatario: usuarioAtivo.email,
      link: expect.stringMatching(/^https:\/\/terrano\.example\/reset-password\/[0-9a-f]{64}$/),
    }));
    expect(mocks.prisma.tokenAcesso.create).toHaveBeenCalledOnce();
  });

  it("não cria token nem chama o canal para e-mail inexistente", async () => {
    mocks.prisma.usuario.findUnique.mockResolvedValue(null);
    const entregar = vi.fn();

    await expect(solicitarRecuperacaoSenha("ausente@example.test", entregar)).resolves.toBe(false);
    expect(entregar).not.toHaveBeenCalled();
    expect(mocks.prisma.tokenAcesso.create).not.toHaveBeenCalled();
  });
});

describe("links administrativos", () => {
  it("explica por que convite ou redefinição não podem ser emitidos", async () => {
    mocks.prisma.usuario.findUnique
      .mockResolvedValueOnce({ status: "ATIVO" })
      .mockResolvedValueOnce({ status: "PENDENTE", senhaHash: null });

    await expect(gerarLinkConvite(usuarioAtivo.id)).rejects.toEqual(
      new LinkAcessoError("convite disponível somente para usuário pendente"),
    );
    await expect(gerarLinkReset(usuarioAtivo.id)).rejects.toEqual(
      new LinkAcessoError("redefinição disponível somente para usuário ativo com senha cadastrada"),
    );
    expect(mocks.prisma.tokenAcesso.create).not.toHaveBeenCalled();
  });
});

describe("consumo de tokens", () => {
  it("redefine somente o hash, consome o token e revoga as sessões anteriores", async () => {
    mocks.tx.tokenAcesso.findUnique.mockResolvedValue({
      id: "reset-1",
      usuarioId: usuarioAtivo.id,
      tipo: "RESET",
      usadoEm: null,
      expiraEm: new Date(Date.now() + 60_000),
      usuario: usuarioAtivo,
    });
    mocks.tx.tokenAcesso.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.usuario.update.mockResolvedValue({ ...usuarioAtivo, senhaHash: "hash:nova-senha" });
    mocks.tx.sessao.deleteMany.mockResolvedValue({ count: 2 });

    const resultado = await redefinirSenha("token-reset", "nova-senha");

    expect(resultado?.id).toBe(usuarioAtivo.id);
    expect(mocks.tx.usuario.update).toHaveBeenCalledWith({
      where: { id: usuarioAtivo.id },
      data: { senhaHash: "hash:nova-senha" },
    });
    expect(mocks.tx.sessao.deleteMany).toHaveBeenCalledWith({ where: { usuarioId: usuarioAtivo.id } });
  });

  it("rejeita uma segunda tentativa quando o consumo atômico perde a corrida", async () => {
    mocks.tx.tokenAcesso.findUnique.mockResolvedValue({
      id: "reset-1",
      usuarioId: usuarioAtivo.id,
      tipo: "RESET",
      usadoEm: null,
      expiraEm: new Date(Date.now() + 60_000),
      usuario: usuarioAtivo,
    });
    mocks.tx.tokenAcesso.updateMany.mockResolvedValue({ count: 0 });

    await expect(redefinirSenha("token-reset", "outra-senha")).resolves.toBeNull();
    expect(mocks.tx.usuario.update).not.toHaveBeenCalled();
    expect(mocks.tx.sessao.deleteMany).not.toHaveBeenCalled();
  });

  it("rejeita token de reset expirado sem tentar consumi-lo", async () => {
    mocks.tx.tokenAcesso.findUnique.mockResolvedValue({
      id: "reset-expirado",
      usuarioId: usuarioAtivo.id,
      tipo: "RESET",
      usadoEm: null,
      expiraEm: new Date(Date.now() - 1),
      usuario: usuarioAtivo,
    });

    await expect(redefinirSenha("token-expirado", "outra-senha")).resolves.toBeNull();
    expect(mocks.tx.tokenAcesso.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.usuario.update).not.toHaveBeenCalled();
  });

  it("aceita apenas o convidado pendente e preserva papel e acessos", async () => {
    const convidado = { ...usuarioAtivo, status: "PENDENTE", senhaHash: null };
    mocks.tx.tokenAcesso.findUnique.mockResolvedValue({
      id: "convite-1",
      usuarioId: convidado.id,
      tipo: "CONVITE",
      usadoEm: null,
      expiraEm: new Date(Date.now() + 60_000),
      usuario: convidado,
    });
    mocks.tx.tokenAcesso.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.usuario.update.mockResolvedValue({ ...convidado, status: "ATIVO", senhaHash: "hash:primeira-senha" });

    const resultado = await aceitarConvite("token-convite", "primeira-senha");

    expect(mocks.tx.usuario.update).toHaveBeenCalledWith({
      where: { id: convidado.id },
      data: { senhaHash: "hash:primeira-senha", status: "ATIVO" },
    });
    expect(resultado).toMatchObject({ papel: convidado.papel, abas: convidado.abas, areas: convidado.areas, flags: convidado.flags });
  });
});
