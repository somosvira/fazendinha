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
const camposParcela = z.object({
  id: uuid.optional(),
  tanqueId: uuid.nullish(),
  recipiente: z.string().trim().min(1).max(160).nullish(),
  versaoEsperada: z.number().int().nonnegative(),
  litros: volume,
  reguaMm: volume.nullish(),
  natureza: z.enum(["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO"]),
  animaisOrigem: z.array(uuid).max(2000).default([]),
  responsavel: z.string().trim().min(1).max(160),
  observacao: z.string().trim().max(1000).nullish(),
  motivoCorrecao: z.string().trim().min(5).max(500).nullish(),
  declaracaoDireta: z.object({ justificativa: z.string().trim().min(5).max(500) }).strict().nullish(),
  primeiraOrdenhaColostro: z.boolean().nullish(),
}).strict();
function conferirParcela(v: z.infer<typeof camposParcela>, ctx: z.RefinementCtx) {
  if (Boolean(v.tanqueId) === Boolean(v.recipiente))
    ctx.addIssue({ code: "custom", path: ["recipiente"], message: "Identifique um tanque cadastrado ou outro recipiente segregado" });
  if (new Set(v.animaisOrigem).size !== v.animaisOrigem.length)
    ctx.addIssue({ code: "custom", path: ["animaisOrigem"], message: "Informe cada animal de origem uma única vez" });
  if (v.natureza === "COMERCIAL" && v.declaracaoDireta)
    ctx.addIssue({ code: "custom", path: ["declaracaoDireta"], message: "Declaração direta não libera leite comercial" });
  if (v.natureza !== "COLOSTRO" && v.primeiraOrdenhaColostro != null)
    ctx.addIssue({ code: "custom", path: ["primeiraOrdenhaColostro"], message: "A declaração de primeira ordenha pertence ao colostro" });
}
export const parcelaOrdenhaSchema = camposParcela.superRefine((v, ctx) => {
  conferirParcela(v, ctx);
  if ((v.versaoEsperada > 0) !== Boolean(v.id))
    ctx.addIssue({ code: "custom", path: ["id"], message: "Uma correção exige o identificador e a versão da parcela" });
});
export const salvarParcelasOrdenhaSchema = z.object({
  chave: uuid,
  propriedadeId: propriedadeLeiteSchema,
  dataOperacional: dataLeiteSchema,
  posicaoId: uuid,
  parcelas: z.array(parcelaOrdenhaSchema).min(1).max(100),
}).strict().superRefine((v, ctx) => {
  const ids = v.parcelas.flatMap(p => p.id ? [p.id] : []);
  if (new Set(ids).size !== ids.length)
    ctx.addIssue({ code: "custom", path: ["parcelas"], message: "Informe cada parcela uma única vez" });
});
// Adaptador legado: a identidade por tanque só é inequívoca enquanto houver uma parcela.
export const medicaoGeralLeiteSchema = camposParcela.extend({
  chave: uuid, propriedadeId: propriedadeLeiteSchema, dataOperacional: dataLeiteSchema, posicaoId: uuid,
}).strict().superRefine(conferirParcela);
export const confirmarMedicaoGeralSchema = z
  .object({
    chave: uuid,
    medicaoId: uuid,
    versaoEsperada: z.number().int().positive(),
    produtoId: uuid,
    motivoNatureza: z.string().trim().min(5).max(500),
  })
  .strict();
export const confirmarParcelasOrdenhaSchema = z.object({
  chave: uuid,
  parcelas: z.array(confirmarMedicaoGeralSchema).min(1).max(100),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.parcelas.map(p => p.medicaoId)).size !== v.parcelas.length)
    ctx.addIssue({ code: "custom", path: ["parcelas"], message: "Informe cada parcela uma única vez" });
  if (new Set([v.chave, ...v.parcelas.map(p => p.chave)]).size !== v.parcelas.length + 1)
    ctx.addIssue({ code: "custom", path: ["parcelas"], message: "Use uma chave própria para cada parcela e para o conjunto" });
});
export type SalvarParcelasOrdenhaInput = z.infer<typeof salvarParcelasOrdenhaSchema>;
export type ParcelaOrdenhaInput = z.infer<typeof parcelaOrdenhaSchema>;
export type TanqueLeiteInput = z.infer<typeof tanqueLeiteSchema>;
export type MedicaoGeralLeiteInput = z.infer<typeof medicaoGeralLeiteSchema>;
