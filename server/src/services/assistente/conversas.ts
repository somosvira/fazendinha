import { createHmac } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { AssistenteError, type ContextoAssistente } from "./tipos.js";
const resposta = z.object({
  modo: z.enum([
    "dados",
    "ajuda",
    "fora_escopo",
    "esclarecimento",
    "acesso_negado",
    "proposta",
  ]),
  resposta: z.string().max(12000),
  fontes: z
    .array(
      z.object({
        titulo: z.string().max(200),
        url: z
          .string()
          .max(500)
          .regex(/^\/(?!\/)/),
        periodo: z.object({ inicio: z.string(), fim: z.string() }).optional(),
      }),
    )
    .max(20),
  consultadoEm: z.string().datetime(),
  escopo: z.object({
    propriedadeId: z.number().nullable(),
    nome: z.string().max(200),
  }),
});
export const conversaSchema = z
  .object({
    id: z.string().uuid(),
    versaoBase: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER - 1),
    contextoHistorico: z.string().length(64),
    mensagens: z
      .array(
        z.object({
          pergunta: z.string().max(2000),
          resposta: resposta.optional(),
          erro: z.string().max(500).optional(),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict();
export function contextoHistorico(ctx: ContextoAssistente) {
  const u = ctx.usuario;
  return createHmac("sha256", env.JWT_SECRET)
    .update(
      JSON.stringify([
        u.id,
        ctx.propriedadeId,
        u.dono,
        [...u.areas].sort(),
        [...u.flags].sort(),
        [...u.abas].sort(),
      ]),
    )
    .digest("hex");
}
export async function listarConversas(ctx: ContextoAssistente) {
  return prisma.$queryRaw`SELECT "id", "titulo", "atualizadoEm" FROM public."ConversaAssistente" WHERE "usuarioId" = ${ctx.usuario.id} AND "propriedadeId" IS NOT DISTINCT FROM ${ctx.propriedadeId}::integer AND "permissoes" = ${contextoHistorico(ctx)} ORDER BY "atualizadoEm" DESC LIMIT 20`;
}
export async function obterConversa(id: string, ctx: ContextoAssistente) {
  const linhas = await prisma.$queryRaw<
    Array<{ mensagens: unknown; revisao: string }>
  >`SELECT "mensagens", "revisao"::text AS "revisao" FROM public."ConversaAssistente" WHERE "id" = ${id}::uuid AND "usuarioId" = ${ctx.usuario.id} AND "propriedadeId" IS NOT DISTINCT FROM ${ctx.propriedadeId}::integer AND "permissoes" = ${contextoHistorico(ctx)}`;
  return linhas[0]
    ? { ...linhas[0], revisao: Number(linhas[0].revisao) }
    : null;
}
export async function salvarConversa(
  input: z.infer<typeof conversaSchema>,
  ctx: ContextoAssistente,
) {
  // Conteúdo salvo é apresentação privada, nunca entrada confiável de ferramenta.
  // Anexos, áudio e tokens de confirmação não são persistidos.
  if (input.contextoHistorico !== contextoHistorico(ctx))
    throw new AssistenteError(
      "CONFLITO",
      "Seu acesso ou fazenda mudou. Reabra o assistente antes de continuar.",
    );
  const mensagens = input.mensagens.filter(
    (m) => !m.resposta || m.resposta.escopo.propriedadeId === ctx.propriedadeId,
  );
  const titulo = mensagens[0]?.pergunta.slice(0, 100) || "Conversa";
  const linhas = await prisma.$queryRaw<
    Array<{ revisao: string }>
  >`INSERT INTO public."ConversaAssistente" ("id", "usuarioId", "propriedadeId", "permissoes", "titulo", "mensagens", "revisao") SELECT ${input.id}::uuid, ${ctx.usuario.id}, ${ctx.propriedadeId}, ${contextoHistorico(ctx)}, ${titulo}, ${JSON.stringify(mensagens)}::jsonb, 1 WHERE ${input.versaoBase} = 0 OR EXISTS (SELECT 1 FROM public."ConversaAssistente" WHERE "id" = ${input.id}::uuid) ON CONFLICT ("id") DO UPDATE SET "mensagens" = EXCLUDED."mensagens", "atualizadoEm" = now(), "revisao" = "ConversaAssistente"."revisao" + 1 WHERE "ConversaAssistente"."revisao" = ${BigInt(input.versaoBase)} AND "ConversaAssistente"."usuarioId" = EXCLUDED."usuarioId" AND "ConversaAssistente"."propriedadeId" IS NOT DISTINCT FROM EXCLUDED."propriedadeId" AND "ConversaAssistente"."permissoes" = EXCLUDED."permissoes" RETURNING "revisao"::text AS "revisao"`;
  if (!linhas.length)
    throw new AssistenteError(
      "CONFLITO",
      "A conversa foi atualizada em outra aba. Reabra pelo Histórico antes de salvar novamente.",
    );
  return { revisao: Number(linhas[0].revisao) };
}
