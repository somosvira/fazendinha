import { z } from "zod";
const uuid = z.string().uuid();
export const motivoRodada = z.string().trim().min(5, "Explique o motivo com pelo menos 5 caracteres").max(500);
// Formulários preservam o campo vazio enquanto não há exceção. Vazio significa
// ausência de justificativa; o serviço continua exigindo motivo quando houver data
// diferente ou sobreposição efetiva.
const motivoOpcionalRodada = z.preprocess((valor) => typeof valor === "string" && !valor.trim() ? undefined : valor, motivoRodada.optional());
const participante = z.object({ animalId: uuid, inicio: z.string().date().optional(), justificativaInicio: motivoOpcionalRodada, confirmarSobreposicao: z.boolean().optional(), justificativaSobreposicao: motivoOpcionalRodada, ocorrenciaId: uuid.nullish(), operacaoServicoId: uuid.nullish() }).strict();
export const envelopeRodada = z.object({ chave: uuid, propriedadeId: z.number().int().positive().max(2147483647, "Sítio inválido") });
export const adicionarParticipantesSchema = envelopeRodada.extend({ itens: z.array(participante).min(1).max(100, "Confirme até 100 animais por vez") }).strict();
export const criarRodadaSchema = adicionarParticipantesSchema.extend({ nome: z.string().trim().min(2).max(120), protocoloId: uuid, inicioReferencia: z.string().date() }).strict();
export const associarExecucoesSchema = envelopeRodada.extend({ execucaoIds: z.array(uuid).min(1).max(100) }).strict();
export const retirarParticipanteSchema = envelopeRodada.extend({ motivo: motivoRodada }).strict();
export const renomearRodadaSchema = envelopeRodada.extend({ nome: z.string().trim().min(2).max(120) }).strict();
export type CriarRodadaInput = z.infer<typeof criarRodadaSchema>;
export type ParticipanteInput = z.infer<typeof participante>;
