import { expect, it, vi } from "vitest";
vi.mock("../../env.js", () => ({ env: { JWT_SECRET: "segredo-unitario" } }));
import { emitirLocucao, lerLocucao } from "./locucao.js";
import type { ContextoAssistente } from "./tipos.js";
const ctx: ContextoAssistente = {
  usuario: {
    id: 4,
    dono: false,
    areas: ["pecuaria"],
    flags: ["lancar"],
    abas: [],
    nome: "Teste",
    email: "teste@local.test",
    papel: "gerente",
    status: "ATIVO",
  },
  propriedadeId: 7,
  nomeEscopo: "Sítio",
  agora: new Date(),
};
it("aceita somente resposta assinada para mesmo usuário, sítio e permissões vigentes", () => {
  const token = emitirLocucao("Resposta produzida pelo servidor", ctx)!;
  expect(lerLocucao(token, ctx)).toBe("Resposta produzida pelo servidor");
  expect(() => lerLocucao("texto livre", ctx)).toThrow();
  expect(() => lerLocucao(token, { ...ctx, propriedadeId: 8 })).toThrow();
  expect(() =>
    lerLocucao(token, { ...ctx, usuario: { ...ctx.usuario, id: 5 } }),
  ).toThrow();
  expect(() =>
    lerLocucao(token, { ...ctx, usuario: { ...ctx.usuario, flags: [] } }),
  ).toThrow();
  expect(emitirLocucao("x".repeat(4001), ctx)).toBeUndefined();
});
it("recusa locução vencida", () => {
  vi.useFakeTimers();
  try {
    const token = emitirLocucao("Resposta", ctx)!;
    vi.advanceTimersByTime(900001);
    expect(() => lerLocucao(token, ctx)).toThrow();
  } finally {
    vi.useRealTimers();
  }
});
