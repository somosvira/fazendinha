import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../db.js";
import { aceitarConvite, autenticar, gerarLinkConvite, redefinirSenha, solicitarRecuperacaoSenha, validarConvite, validarReset } from "./contas.js";
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

describeComBanco("convite de acesso com Postgres", () => {
  async function pendente() {
    const usuario = await criarUsuarioAtivo();
    return prisma.usuario.update({ where: { id: usuario.id }, data: { status: "PENDENTE", senhaHash: null } });
  }
  it("substitui convite anterior, ativa uma única vez e preserva permissões", async () => {
    const usuario = await pendente();
    const anterior = (await gerarLinkConvite(usuario.id)).split("/").at(-1)!;
    const token = (await gerarLinkConvite(usuario.id)).split("/").at(-1)!;
    expect(token).not.toBe(anterior);
    await expect(validarConvite(anterior)).resolves.toBeNull();
    await expect(aceitarConvite(anterior, "senha-invalida-anterior")).resolves.toBeNull();
    await expect(validarConvite(token)).resolves.toEqual({ nome: usuario.nome, email: usuario.email });
    await expect(aceitarConvite(token, "senha-convite-segura")).resolves.toMatchObject({ id: usuario.id });
    const salvo = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(salvo).toMatchObject({ status: "ATIVO", papel: usuario.papel, abas: usuario.abas, areas: usuario.areas, flags: usuario.flags, dono: false });
    await expect(autenticar(usuario.email, "senha-convite-segura")).resolves.toMatchObject({ id: usuario.id });
    await expect(validarConvite(token)).resolves.toBeNull();
    await expect(aceitarConvite(token, "senha-segundo-uso")).resolves.toBeNull();
    await expect(autenticar(usuario.email, "senha-segundo-uso")).resolves.toBeNull();
    expect(await prisma.tokenAcesso.count({ where: { usuarioId: usuario.id, tipo: "CONVITE", usadoEm: { not: null } } })).toBe(1);
  });
  it("recusa convite expirado sem ativar nem cadastrar senha", async () => {
    const usuario = await pendente();
    const { raw, hash } = gerarToken();
    await prisma.tokenAcesso.create({ data: { usuarioId: usuario.id, tipo: "CONVITE", tokenHash: hash, expiraEm: new Date(Date.now() - 1000) } });
    await expect(validarConvite(raw)).resolves.toBeNull();
    await expect(aceitarConvite(raw, "senha-expirada-segura")).resolves.toBeNull();
    expect(await prisma.usuario.findUnique({ where: { id: usuario.id } })).toMatchObject({ status: "PENDENTE", senhaHash: null });
    expect(await prisma.tokenAcesso.findUnique({ where: { tokenHash: hash } })).toMatchObject({ usadoEm: null });
  });
  it("aceita somente um vencedor em duas tentativas simultâneas", async () => {
    const usuario = await pendente();
    const token = (await gerarLinkConvite(usuario.id)).split("/").at(-1)!;
    const senhas = ["senha-concorrente-um", "senha-concorrente-dois"];
    const resultados = await Promise.all(senhas.map(senha => aceitarConvite(token, senha)));
    expect(resultados.filter(Boolean)).toHaveLength(1);
    const vencedor = resultados.findIndex(Boolean);
    await expect(autenticar(usuario.email, senhas[vencedor])).resolves.toMatchObject({ id: usuario.id });
    await expect(autenticar(usuario.email, senhas[1 - vencedor])).resolves.toBeNull();
    expect(await prisma.tokenAcesso.count({ where: { usuarioId: usuario.id, usadoEm: { not: null } } })).toBe(1);
  });
});
