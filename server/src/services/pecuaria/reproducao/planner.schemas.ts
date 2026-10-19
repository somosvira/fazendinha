import { z } from "zod";
import { atividadeSchema } from "./schemas.js";
import { criteriosSelecaoSchema } from "./selecoes.schemas.js";
export const grupoLivreSchema = z.object({ origem: z.literal("LIVRE"), nome: z.string().trim().min(2).max(120), criterios: criteriosSelecaoSchema,
  tipo: z.enum(["AVALIACAO_REPRODUTIVA", "APLICACAO_SANITARIA", "EXAME_SANITARIO", "INICIAR_SANITARIO", "INICIAR_IATF"]).default("AVALIACAO_REPRODUTIVA"),
  contexto: z.object({ protocoloId: z.string().uuid().optional(), tipoExameId: z.string().uuid().optional() }).strict().default({}), incluidosManualmente: z.array(z.string().uuid()).max(10000).default([]),
}).strict();
export const grupoPlannerSchema = z.discriminatedUnion("origem", [
  grupoLivreSchema,
  z.object({ origem: z.literal("PROTOCOLO"), identidade: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ origem: z.literal("RETORNO"), identidade: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ origem: z.literal("SELECAO"), selecaoVersaoId: z.string().uuid() }).strict(),
  z.object({ origem: z.literal("EXTRA"), nome: z.string().trim().min(2).max(120), criterios: criteriosSelecaoSchema,
    tipo: z.enum(["AVALIACAO_REPRODUTIVA", "APLICACAO_SANITARIA", "EXAME_SANITARIO", "INICIAR_SANITARIO", "INICIAR_IATF"]).default("AVALIACAO_REPRODUTIVA"), contexto: atividadeSchema.shape.contexto }).strict(),
]);
export const paginacaoPlanner = { pagina: z.coerce.number().int().min(1).default(1), tamanhoPagina: z.coerce.number().int().min(1).max(200).default(30) };
export const consultaPlannerSchema = z.object({ propriedadeId: z.coerce.number().int().positive(), data: z.string().date(), ...paginacaoPlanner }).strict();
export const previaGrupoPlannerSchema = z.object({ propriedadeId: z.number().int().positive(), data: z.string().date(), grupo: grupoPlannerSchema, ...paginacaoPlanner }).strict();
export const incluirGrupoPlannerSchema = z.object({ chave: z.string().uuid(), propriedadeId: z.number().int().positive(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), grupo: grupoPlannerSchema, excluidos: z.array(z.string().uuid()).max(100000).default([]) }).strict();
export type GrupoPlannerInput = z.infer<typeof grupoPlannerSchema>;

export const previaSelecaoLivreSchema = previaGrupoPlannerSchema.extend({ grupo: grupoLivreSchema }).strict();
