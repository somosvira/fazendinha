import { z } from "zod";
import { UnidadeMedida } from "@prisma/client";
const uuid = z.string().uuid();
const data = z.string().date();
const desvio = z
  .object({ motivo: z.string().trim().min(5).max(500) })
  .strict()
  .optional();
export const aplicacaoSchema = z
  .object({
    desvio,
    chave: uuid.optional(),
    animalId: uuid,
    propriedadeId: z.number().int().positive(),
    data,
    aplicadaEm: z.string().datetime({ offset: true }).optional(),
    finalidade: z.enum(["TRATAMENTO", "VACINA", "VERMIFUGO"]).optional(),
    tipoAplicacaoId: uuid.optional(),
    responsavel: z.string().trim().max(160).nullish(),
    estadoCarenciaLeite: z
      .enum(["INFORMADO", "NAO_INFORMADO", "NAO_APLICAVEL"])
      .optional(),
    estadoCarenciaCarne: z
      .enum(["INFORMADO", "NAO_INFORMADO", "NAO_APLICAVEL"])
      .optional(),
    justificativaCarenciaLeite: z.string().trim().max(500).nullish(),
    justificativaCarenciaCarne: z.string().trim().max(500).nullish(),
    origemInsumo: z.enum(
      [
        "BAIXA_ESTOQUE",
        "COMPRA_CONSUMO_DIRETO",
        "INCLUSO_SERVICO",
        "SEM_ORIGEM_JUSTIFICADA",
      ],
      { errorMap: () => ({ message: "Selecione a origem da dose" }) },
    ),
    nomeProdutoAplicado: z.string().trim().min(1).max(180),
    produtoId: uuid.nullish(),
    dose: z
      .string({
        required_error: "Informe a dose aplicada",
        invalid_type_error: "Informe a dose aplicada como número decimal",
      })
      .regex(/^\d+(\.\d{1,3})?$/, "Informe a dose com até três casas decimais"),
    unidadeDose: z.nativeEnum(UnidadeMedida, {
      errorMap: () => ({ message: "Selecione a unidade da dose" }),
    }),
    carenciaLeiteHoras: z.number().int().min(0).nullish(),
    carenciaCarneHoras: z.number().int().min(0).nullish(),
    referenciaCarencia: z.string().trim().max(300).nullish(),
    via: z.string().trim().max(80).nullish(),
    ocorrenciaId: uuid.nullish(),
    tarefaId: uuid.nullish(),
    operacaoServicoId: uuid.nullish(),
    itemCompraDiretaId: uuid.nullish(),
    partidaId: uuid.nullish(),
    partidaCodigo: z.string().trim().max(100).nullish(),
    cienciaValidadeDesconhecida: z.boolean().optional(),
    partidaValidade: data.nullish(),
    justificativaSemOrigem: z.string().trim().max(500).nullish(),
    documentacaoExcepcional: z.boolean().optional(),
    motivoDocumentacaoExcepcional: z.string().trim().min(5).max(500).nullish(),
  })
  .strict("Confira os campos informados para a aplicação");
