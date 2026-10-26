import { Prisma } from "@prisma/client";
import { z } from "zod";
import { dataLeiteSchema, propriedadeLeiteSchema } from "./schemas.js";
const uuid = z.string().uuid();
const litros = z.number().finite().positive().max(9999999.999).refine(v => new Prisma.Decimal(v).decimalPlaces() <= 3, "Use até três casas decimais em litros");
const parcela = z.object({ animalId: uuid, quantidadeLitros: litros, criaId: uuid.optional(), fornecimentoColostroId: uuid.optional() }).strict();
export const destinoInternoLeiteSchema = z.object({
  chave: uuid, propriedadeId: propriedadeLeiteSchema, entradaId: uuid, data: dataLeiteSchema,
  natureza: z.enum(["COLOSTRO", "LEITE_COMUM", "LEITE_NAO_COMERCIAL"]),
  declaracaoOrigem: z.string().trim().min(10).max(1000),
  quantidadeDisponivelEsperadaLitros: litros,
  parcelas: z.array(parcela).min(1).max(200),
  responsavel: z.string().trim().max(160).nullish(), observacao: z.string().trim().max(1000).nullish(),
}).strict().superRefine((valor, ctx) => {
  if (new Set(valor.parcelas.map(p => p.animalId)).size !== valor.parcelas.length)
    ctx.addIssue({ code: "custom", path: ["parcelas"], message: "Informe uma parcela explícita por animal" });
  const fornecimentos = valor.parcelas.flatMap(p => p.fornecimentoColostroId ? [p.fornecimentoColostroId] : []);
  if (new Set(fornecimentos).size !== fornecimentos.length)
    ctx.addIssue({ code: "custom", path: ["parcelas"], message: "Um fornecimento de colostro não pode ser vinculado duas vezes" });
  valor.parcelas.forEach((p, indice) => {
    if (valor.natureza === "COLOSTRO" && !p.criaId)
      ctx.addIssue({ code: "custom", path: ["parcelas", indice, "criaId"], message: "Identifique a cria de parto já registrada para o colostro" });
    if (valor.natureza !== "COLOSTRO" && (p.criaId || p.fornecimentoColostroId))
      ctx.addIssue({ code: "custom", path: ["parcelas", indice], message: "Leite comum ou não comercial não é fornecimento de colostro" });
  });
  if (valor.parcelas.reduce((s, p) => s.plus(p.quantidadeLitros), new Prisma.Decimal(0)).gt(valor.quantidadeDisponivelEsperadaLitros))
    ctx.addIssue({ code: "custom", path: ["parcelas"], message: "As parcelas excedem o saldo de origem informado" });
});
export const estornoDestinoLeiteSchema = z.object({ chave: uuid, propriedadeId: propriedadeLeiteSchema, versaoEsperada: z.number().int().positive(), motivo: z.string().trim().min(5).max(1000) }).strict();
export const consultaDestinosLeiteSchema = z.object({ de: dataLeiteSchema.optional(), ate: dataLeiteSchema.optional(), animalId: uuid.optional(), pagina: z.coerce.number().int().min(1).max(100000).default(1), propriedadeId: z.coerce.number().int().min(1).max(2147483647).optional() }).superRefine((v, ctx) => {
  if (v.de && v.ate && v.de > v.ate) ctx.addIssue({ code: "custom", path: ["ate"], message: "O fim deve ser igual ou posterior ao início" });
});
export const consultaOrigensDestinoSchema = z.object({ produtoId: uuid, data: dataLeiteSchema, propriedadeId: z.coerce.number().int().min(1).max(2147483647).optional() });
export const consultaDestinatariosLeiteSchema = z.object({ data: dataLeiteSchema, busca: z.string().trim().max(100).default(""), pagina: z.coerce.number().int().min(1).max(100000).default(1), propriedadeId: z.coerce.number().int().min(1).max(2147483647).optional() });
export type DestinoInternoLeiteInput = z.infer<typeof destinoInternoLeiteSchema>;
export type EstornoDestinoLeiteInput = z.infer<typeof estornoDestinoLeiteSchema>;
export type ConsultaDestinosLeite = z.infer<typeof consultaDestinosLeiteSchema>;
