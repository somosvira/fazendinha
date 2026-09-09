import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../db.js";
import { autenticar, redefinirSenha, solicitarRecuperacaoSenha, validarReset } from "./contas.js";
import { hashSenha } from "./hash.js";
import { criarSessao, resolverSessao } from "./sessao.js";
import { gerarToken } from "./token.js";
import type { EmailRecuperacao } from "./email.js";

const describeComBanco = process.env.AUTH_DB_INTEGRATION === "1" ? describe : describe.skip;
const usuariosCriados: number[] = [];

async function criarUsuarioAtivo() {
  const usuario = await prisma.usuario.create({
    data: {
      nome: "Fixture recuperação",
      email: `recuperacao-${crypto.randomUUID()}@example.test`,
      senhaHash: hashSenha("senha-antiga-segura"),
      papel: "gestor",
      abas: ["dashboard"],
      areas: ["financeiro"],
      flags: ["verValores"],
      status: "ATIVO",
      dono: false,
    },
  });
  usuariosCriados.push(usuario.id);
  return usuario;
}

afterEach(async () => {
  if (!usuariosCriados.length) return;
  await prisma.usuario.deleteMany({ where: { id: { in: usuariosCriados.splice(0) } } });
});

describeComBanco("recuperação de senha com Postgres", () => {
  it("solicita, consome uma única vez e revoga sessões anteriores", async () => {
    const usuario = await criarUsuarioAtivo();
    const sessaoAnterior = await criarSessao(usuario.id, "vitest");
    let mensagem: EmailRecuperacao | undefined;
    const entregar = vi.fn(async (recebida: EmailRecuperacao) => {
      mensagem = recebida;
    });

    await expect(solicitarRecuperacaoSenha(usuario.email, entregar)).resolves.toBe(true);
    const token = mensagem?.link.split("/").at(-1);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    await expect(validarReset(token!)).resolves.toBe(true);

    await expect(redefinirSenha(token!, "senha-nova-segura")).resolves.toMatchObject({ id: usuario.id });
    await expect(autenticar(usuario.email, "senha-nova-segura")).resolves.toMatchObject({ id: usuario.id });
    await expect(autenticar(usuario.email, "senha-antiga-segura")).resolves.toBeNull();
    await expect(resolverSessao(sessaoAnterior)).resolves.toBeNull();
    await expect(redefinirSenha(token!, "terceira-senha-segura")).resolves.toBeNull();
  });

  it("rejeita um token expirado sem alterar a senha", async () => {
    const usuario = await criarUsuarioAtivo();
    const { raw, hash } = gerarToken();
    await prisma.tokenAcesso.create({
      data: {
        usuarioId: usuario.id,
        tipo: "RESET",
        tokenHash: hash,
        expiraEm: new Date(Date.now() - 1_000),
      },
    });

    await expect(redefinirSenha(raw, "senha-nova-segura")).resolves.toBeNull();
    await expect(autenticar(usuario.email, "senha-antiga-segura")).resolves.toMatchObject({ id: usuario.id });
  });
});
