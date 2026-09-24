import { describe, expect, it } from "vitest";
import type { UsuarioSessao } from "./lib/auth";
import { destinoDepoisDoLogin, interpretarRotaAuth, paginaInicialAutorizada, podeAcessarTab, returnToInterna, urlSigninPara } from "./navegacaoAuth";

const usuarioPecuaria: UsuarioSessao = {
  id: 20,
  nome: "Usuário Teste",
  email: "usuario.fixture@example.test",
  papel: "personalizado",
  abas: [],
  areas: ["pecuaria"],
  flags: [],
  status: "ATIVO",
  dono: false,
};

const usuarioFinanceiro: UsuarioSessao = {
  ...usuarioPecuaria,
  abas: ["gastos", "lancar"],
  areas: ["financeiro"],
};

describe("rotas públicas de autenticação", () => {
  it("reconhece rotas canônicas e aliases temporários", () => {
    expect(interpretarRotaAuth("/signin", "?returnTo=%2Ffinanceiro%2Foperacoes")).toEqual({
      kind: "signin",
      returnTo: "/financeiro/operacoes",
    });
    expect(interpretarRotaAuth("/forgot-password")).toEqual({ kind: "forgot-password" });
    expect(interpretarRotaAuth("/invite/abc")).toEqual({ kind: "invite", token: "abc", alias: false });
    expect(interpretarRotaAuth("/convite/abc")).toEqual({ kind: "invite", token: "abc", alias: true });
    expect(interpretarRotaAuth("/senha/abc")).toEqual({ kind: "reset-password", token: "abc", alias: true });
  });

  it("preserva caminho e query ao montar o redirecionamento anônimo", () => {
    expect(urlSigninPara("/financeiro/operacoes", "?status=aberta")).toBe(
      "/signin?returnTo=%2Ffinanceiro%2Foperacoes%3Fstatus%3Daberta",
    );
  });
});

describe("returnTo", () => {
  it.each(["https://site-externo.example", "//site-externo.example/x", "/%2Fsite-externo.example", "\\site-externo.example", "/signin", "/forgot-password"])(
    "rejeita destino inseguro ou público: %s",
    (destino) => expect(returnToInterna(destino)).toBeNull(),
  );

  it("retorna à rota interna quando o usuário tem permissão", () => {
    expect(destinoDepoisDoLogin("/financeiro/operacoes?origem=teste", usuarioFinanceiro)).toBe(
      "/financeiro/operacoes?origem=teste",
    );
  });

  it("substitui rota inexistente ou não autorizada pela home permitida", () => {
    expect(destinoDepoisDoLogin("/financeiro/operacoes", usuarioPecuaria)).toBe("/pecuaria/rebanho");
    expect(destinoDepoisDoLogin("/milho/nao-existe", usuarioPecuaria)).toBe("/pecuaria/rebanho");
    expect(paginaInicialAutorizada(usuarioFinanceiro)).toBe("/financeiro/operacoes");
  });

  it("mantém compatibilidade de acesso para sessões antigas sem áreas", () => {
    const usuarioLegado = { ...usuarioPecuaria, areas: undefined } as unknown as UsuarioSessao;
    expect(podeAcessarTab(usuarioLegado, "pec-rebanho")).toBe(true);
  });

  it("Configurações > Sítios é só de quem administra a fazenda", () => {
    expect(podeAcessarTab(usuarioPecuaria, "sitios")).toBe(false);
    expect(podeAcessarTab({ ...usuarioPecuaria, flags: ["gerenciarAcessos"] }, "sitios")).toBe(true);
    expect(podeAcessarTab({ ...usuarioPecuaria, dono: true }, "sitios")).toBe(true);
    expect(destinoDepoisDoLogin("/configuracoes/sitios", usuarioPecuaria)).toBe("/pecuaria/rebanho");
  });
});
