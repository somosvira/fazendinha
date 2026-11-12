import { expect, it, vi } from "vitest";
vi.mock("../../env.js", () => ({ env: { JWT_SECRET: "segredo-unitario" } }));
const m = vi.hoisted(() => ({ query: vi.fn(), exec: vi.fn() }));
vi.mock("../../db.js", () => ({
  prisma: { $queryRaw: m.query, $executeRaw: m.exec },
}));
import {
  conversaSchema,
  contextoHistorico,
  obterConversa,
  salvarConversa,
} from "./conversas.js";
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
it("conversa inexistente ou de outro acesso não retorna conteúdo e consulta é parametrizada por proprietário e sítio", async () => {
  m.query.mockResolvedValue([]);
  expect(await obterConversa("a", ctx)).toBeNull();
  const args = m.query.mock.calls.at(-1)!;
  expect(args.slice(1, 4)).toEqual(["a", 4, 7]);
  expect(args[0].join("")).toContain('"permissoes"');
});
it("não aceita identidade no payload e não conserva tokens nem anexos", async () => {
  const input = {
    id: "14f53533-e912-4fd3-8b08-d09024af5cde",
    versaoBase: 0,
    contextoHistorico: contextoHistorico(ctx),
    mensagens: [
      {
        pergunta: "Pese 1058",
        anexo: { segredo: true },
        resposta: {
          proposta: { token: "TOKEN" },
          locucao: "LOCUCAO",
          modo: "proposta",
          resposta: "Confira",
          fontes: [],
          consultadoEm: new Date().toISOString(),
          escopo: { propriedadeId: 7, nome: "Sítio" },
        },
      },
    ],
  };
  expect(conversaSchema.safeParse({ ...input, usuarioId: 999 }).success).toBe(
    false,
  );
  const validado = conversaSchema.parse(input);
  expect(JSON.stringify(validado)).not.toMatch(/TOKEN|LOCUCAO|segredo/);
  m.query.mockResolvedValue([{ revisao: "1" }]);
  await salvarConversa(validado, ctx);
  const sql = m.query.mock.calls.at(-1)![0].join("");
  expect(sql).toContain('"revisao" = ');
  expect(sql).toContain('"usuarioId" = EXCLUDED."usuarioId"');
});
it("recusa versão-base desatualizada e contexto de permissão revogada", async () => {
  const input = conversaSchema.parse({
    id: "14f53533-e912-4fd3-8b08-d09024af5cde",
    versaoBase: 0,
    contextoHistorico: contextoHistorico(ctx),
    mensagens: [{ pergunta: "Teste" }],
  });
  m.query.mockResolvedValue([]);
  await expect(salvarConversa(input, ctx)).rejects.toMatchObject({
    code: "CONFLITO",
  });
  m.query.mockClear();
  await expect(
    salvarConversa(input, { ...ctx, usuario: { ...ctx.usuario, flags: [] } }),
  ).rejects.toMatchObject({ code: "CONFLITO" });
  expect(m.query).not.toHaveBeenCalled();
});
