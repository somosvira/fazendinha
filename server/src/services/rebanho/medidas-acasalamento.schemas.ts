import { z } from "zod";

export const TIPOS_MEDIDA_ACASALAMENTO = [
  "MERITO",
  "RESTRICAO_INDICADOR",
  "CONSANGUINIDADE",
  "PEDIGREE",
  "SEMEN",
] as const;
export type TipoMedidaAcasalamento = typeof TIPOS_MEDIDA_ACASALAMENTO[number];

const itemMedidaSchema = z.object({
  indicadorId: z.number().int().positive(),
  peso: z.number().finite().positive().default(1),
  minimo: z.number().finite().nullable().default(null),
  maximo: z.number().finite().nullable().default(null),
}).superRefine((item, ctx) => {
  if (item.minimo != null && item.maximo != null && item.minimo > item.maximo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["minimo"],
      message: "mínimo não pode ser maior que o máximo",
    });
  }
});

const medidaBaseSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  tipo: z.enum(TIPOS_MEDIDA_ACASALAMENTO),
  consanguinidadeMax: z.number().finite().min(0).max(1).nullable().default(null),
  exigePedigree: z.boolean().default(false),
  ativo: z.boolean().default(true),
  itens: z.array(itemMedidaSchema).default([]),
});

type MedidaRefinavel = {
  tipo?: TipoMedidaAcasalamento;
  consanguinidadeMax?: number | null;
  exigePedigree?: boolean;
  itens?: z.infer<typeof itemMedidaSchema>[];
};

function refinarMedida(valor: MedidaRefinavel, ctx: z.RefinementCtx): void {
  const itens = valor.itens;
  if (itens != null && new Set(itens.map((item) => item.indicadorId)).size !== itens.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["itens"],
      message: "indicador não pode se repetir",
    });
  }

  if ((valor.tipo === "MERITO" || valor.tipo === "RESTRICAO_INDICADOR") && itens != null && itens.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["itens"],
      message: "a medida precisa ter ao menos um indicador",
    });
  }

  if (valor.tipo === "CONSANGUINIDADE") {
    if (valor.consanguinidadeMax === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consanguinidadeMax"],
        message: "limite de consanguinidade é obrigatório",
      });
    }
    if (itens != null && itens.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["itens"],
        message: "medida de consanguinidade não aceita indicadores",
      });
    }
  }

  if (valor.tipo === "PEDIGREE") {
    if (valor.exigePedigree === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exigePedigree"],
        message: "medida de pedigree precisa exigir pedigree",
      });
    }
    if (itens != null && itens.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["itens"],
        message: "medida de pedigree não aceita indicadores",
      });
    }
  }

  if (valor.tipo === "SEMEN" && itens != null && itens.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["itens"],
      message: "medida de sêmen não aceita indicadores",
    });
  }
}

export const criarMedidaAcasalamentoSchema = medidaBaseSchema.superRefine(refinarMedida);
export type CriarMedidaAcasalamentoInput = z.infer<typeof criarMedidaAcasalamentoSchema>;

export const atualizarMedidaAcasalamentoSchema = medidaBaseSchema.partial().superRefine(refinarMedida);
export type AtualizarMedidaAcasalamentoInput = z.infer<typeof atualizarMedidaAcasalamentoSchema>;

const itemCombinacaoSchema = z.object({
  medidaId: z.number().int().positive(),
  peso: z.number().finite().positive().default(1),
  obrigatoria: z.boolean().default(false),
  ordem: z.number().int().min(0).default(0),
});

const combinacaoBaseSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  ativo: z.boolean().default(true),
  itens: z.array(itemCombinacaoSchema).min(1),
});

function refinarCombinacao(
  valor: { itens?: z.infer<typeof itemCombinacaoSchema>[] },
  ctx: z.RefinementCtx,
): void {
  if (valor.itens != null && new Set(valor.itens.map((item) => item.medidaId)).size !== valor.itens.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["itens"],
      message: "medida não pode se repetir",
    });
  }
}

export const criarCombinacaoMedidaSchema = combinacaoBaseSchema.superRefine(refinarCombinacao);
export type CriarCombinacaoMedidaInput = z.infer<typeof criarCombinacaoMedidaSchema>;

export const atualizarCombinacaoMedidaSchema = combinacaoBaseSchema.partial().superRefine(refinarCombinacao);
export type AtualizarCombinacaoMedidaInput = z.infer<typeof atualizarCombinacaoMedidaSchema>;
