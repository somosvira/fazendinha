import { z } from "zod";
const sitio = z.number().int().positive(),
  id = z.string().uuid();
export const regraImpactoProtocolarSchema = z
  .object({
    versao: z.literal(1),
    gatilho: z.enum(["OCORRENCIA", "PROCEDIMENTO"]),
    efeito: z.enum(["AVISAR", "BLOQUEAR", "RETIRAR"]),
    tipoAplicacaoId: id.optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if ((v.gatilho === "PROCEDIMENTO") !== Boolean(v.tipoAplicacaoId))
      c.addIssue({
        code: "custom",
        path: ["tipoAplicacaoId"],
        message:
          "Procedimento exige tipo de aplicação explícito; ocorrência não usa produto ou procedimento implícito",
      });
  });
export const previaImpactoSchema = z
  .object({
    animalId: id,
    propriedadeId: sitio,
    data: z.string().date(),
    origem: z.enum(["OCORRENCIA", "PROCEDIMENTO"]),
    doencaId: id.optional(),
    tipoAplicacaoId: id.optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      (v.origem === "OCORRENCIA" && (!v.doencaId || v.tipoAplicacaoId)) ||
      (v.origem === "PROCEDIMENTO" && (!v.tipoAplicacaoId || v.doencaId))
    )
      c.addIssue({
        code: "custom",
        message:
          "Identifique exatamente a doença da ocorrência ou o tipo do procedimento",
      });
  });
export const confirmacaoImpactoSchema = z
  .object({
    revisao: z.string().regex(/^[a-f0-9]{64}$/),
    motivo: z.string().trim().min(5).max(1000),
  })
  .strict();
export const revisarImpactoSchema = z
  .object({
    chave: id,
    propriedadeId: sitio,
    bloqueadaEm: z.string().datetime(),
    destino: z.enum(["RETOMAR", "RETIRAR"]),
    motivo: z.string().trim().min(5).max(1000),
  })
  .strict();
