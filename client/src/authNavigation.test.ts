import { describe, expect, it } from "vitest";
import type { UsuarioSessao } from "./lib/auth";
import { destinoDepoisDoLogin, paginaInicialAutorizada, parseAuthRoute, returnToInterna, urlSigninPara } from "./authNavigation";

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
    expect(parseAuthRoute("/signin", "?returnTo=%2Ffinanceiro%2Foperacoes")).toEqual({
      kind: "signin",
      returnTo: "/financeiro/operacoes",
    });
    expect(parseAuthRoute("/forgot-password")).toEqual({ kind: "forgot-password" });
    expect(parseAuthRoute("/invite/abc")).toEqual({ kind: "invite", token: "abc", alias: false });
    expect(parseAuthRoute("/convite/abc")).toEqual({ kind: "invite", token: "abc", alias: true });
    expect(parseAuthRoute("/senha/abc")).toEqual({ kind: "reset-password", token: "abc", alias: true });
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
    expect(destinoDepoisDoLogin("/financeiro/operacoes", usuarioPecuaria)).toBe("/pecuaria/dashboard");
    expect(destinoDepoisDoLogin("/pecuaria/nao-existe", usuarioPecuaria)).toBe("/pecuaria/dashboard");
    expect(paginaInicialAutorizada(usuarioFinanceiro)).toBe("/financeiro/operacoes");
  });
});
