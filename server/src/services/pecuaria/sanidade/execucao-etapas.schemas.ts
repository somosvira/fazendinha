import { z } from "zod";
import { UnidadeMedida } from "@prisma/client";

const uuid = z.string().uuid();
const desvio = z.object({ motivo: z.string().trim().min(5).max(500) }).strict().optional();
const base = { animalId: uuid, propriedadeId: z.number().int().positive(), tarefaId: uuid, data: z.string().date(),
  responsavel: z.string().trim().max(160).nullish(), ocorrenciaId: uuid.nullish(), operacaoServicoId: uuid.nullish(), desvio };
export const executarAplicacaoEtapaSchema = z.object({ ...base, tipo: z.literal("APLICACAO"),
  aplicadaEm: z.string().datetime({ offset: true }), finalidade: z.enum(["TRATAMENTO", "VACINA", "VERMIFUGO"]).optional(), tipoAplicacaoId: uuid.optional(),
  nomeProdutoAplicado: z.string().trim().min(1).max(180), produtoId: uuid.nullish(), dose: z.string().regex(/^\d+(\.\d{1,3})?$/), unidadeDose: z.nativeEnum(UnidadeMedida), via: z.string().trim().max(80).nullish(),
  origemInsumo: z.enum(["BAIXA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "INCLUSO_SERVICO", "SEM_ORIGEM_JUSTIFICADA"]),
  estadoCarenciaLeite: z.enum(["INFORMADO", "NAO_INFORMADO", "NAO_APLICAVEL"]).optional(), estadoCarenciaCarne: z.enum(["INFORMADO", "NAO_INFORMADO", "NAO_APLICAVEL"]).optional(),
  carenciaLeiteHoras: z.number().int().nonnegative().nullish(), carenciaCarneHoras: z.number().int().nonnegative().nullish(),
  justificativaCarenciaLeite: z.string().trim().max(500).nullish(), justificativaCarenciaCarne: z.string().trim().max(500).nullish(), referenciaCarencia: z.string().trim().max(300).nullish(),
  itemCompraDiretaId: uuid.nullish(), partidaId: uuid.nullish(), partidaCodigo: z.string().trim().max(100).nullish(), partidaValidade: z.string().date().nullish(),
  cienciaValidadeDesconhecida: z.boolean().optional(), justificativaSemOrigem: z.string().trim().max(500).nullish(), documentacaoExcepcional: z.boolean().optional(), motivoDocumentacaoExcepcional: z.string().trim().min(5).max(500).nullish(),
}).strict();
export const executarExameEtapaSchema = z.object({ ...base, tipo: z.literal("EXAME"), tipoExameId: uuid,
  resultadoTexto: z.string().trim().max(1000).nullish(), resultadoNumero: z.number().finite().nullish(), resultadoOpcao: z.string().trim().max(100).nullish(),
}).strict();
export const previaExecucaoEtapasSchema = z.object({ propriedadeId: z.number().int().positive(), itens: z.array(z.discriminatedUnion("tipo", [executarAplicacaoEtapaSchema, executarExameEtapaSchema])).min(1).max(100) }).strict();
export const confirmarExecucaoEtapasSchema = previaExecucaoEtapasSchema.extend({ chave: uuid, fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type ExecucaoEtapasInput = z.infer<typeof previaExecucaoEtapasSchema>;
