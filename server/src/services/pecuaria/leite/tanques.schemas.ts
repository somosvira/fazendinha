import { z } from "zod";
import { dataLeiteSchema, propriedadeLeiteSchema } from "./schemas.js";
const uuid = z.string().uuid();
const volume = z.number().finite().min(0).max(9999999.999).multipleOf(0.001);
export const pontoConversaoSchema = z
  .object({ mm: volume, litros: volume })
  .strict();
export const tanqueLeiteSchema = z
  .object({
    chave: uuid,
    propriedadeId: propriedadeLeiteSchema,
    identidadeId: uuid,
    versaoEsperada: z.number().int().nonnegative(),
    nome: z.string().trim().min(1).max(100),
    fabricante: z.string().trim().max(100).nullish(),
    modelo: z.string().trim().max(100).nullish(),
    numeroSerie: z.string().trim().max(100).nullish(),
    capacidadeLitros: volume.refine(
      (v) => v > 0,
      "Informe a capacidade do tanque",
    ),
    vigenteDesde: dataLeiteSchema,
    ativo: z.boolean().default(true),
    tabelaConversao: z.array(pontoConversaoSchema).max(10000),
    referenciaTabela: z.string().trim().max(1000).nullish(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const pontos = [...v.tabelaConversao].sort((a, b) => a.mm - b.mm);
    if (
      pontos.some(
        (p, i) =>
          p.litros > v.capacidadeLitros ||
          (i > 0 &&
            (p.mm === pontos[i - 1].mm || p.litros <= pontos[i - 1].litros)),
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["tabelaConversao"],
        message:
          "A tabela deve ter leituras únicas, volumes crescentes e respeitar a capacidade",
      });
    if (pontos.length && !v.referenciaTabela?.trim())
      ctx.addIssue({
        code: "custom",
        path: ["referenciaTabela"],
        message: "Identifique a tabela utilizada",
      });
  });
export const medicaoGeralLeiteSchema = z
  .object({
    chave: uuid,
    propriedadeId: propriedadeLeiteSchema,
    dataOperacional: dataLeiteSchema,
    posicaoId: uuid,
    tanqueId: uuid,
    versaoEsperada: z.number().int().nonnegative(),
    litros: volume,
    reguaMm: volume.nullish(),
    natureza: z.enum(["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO"]),
    animaisOrigem: z.array(uuid).max(2000).default([]),
    responsavel: z.string().trim().min(1).max(160),
    observacao: z.string().trim().max(1000).nullish(),
    motivoCorrecao: z.string().trim().min(5).max(500).nullish(),
  })
  .strict()
  .refine(
    (v) => new Set(v.animaisOrigem).size === v.animaisOrigem.length,
    "Informe cada animal de origem uma única vez",
  );
export const confirmarMedicaoGeralSchema = z
  .object({
    chave: uuid,
    medicaoId: uuid,
    versaoEsperada: z.number().int().positive(),
    produtoId: uuid,
    motivoNatureza: z.string().trim().min(5).max(500),
  })
  .strict();
export type TanqueLeiteInput = z.infer<typeof tanqueLeiteSchema>;
export type MedicaoGeralLeiteInput = z.infer<typeof medicaoGeralLeiteSchema>;
