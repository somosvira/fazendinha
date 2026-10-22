import { z } from "zod";
import { Prisma } from "@prisma/client";

const uuid = z.string().uuid();
export const propriedadeLeiteSchema = z.number().int().min(1).max(2147483647);
export const dataLeiteSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida").refine(valor => {
  const data = new Date(`${valor}T00:00:00Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}, "Informe uma data válida");
export const posicaoOrdenhaSchema = z.object({
  posicaoId: uuid,
  nome: z.string().trim().min(1).max(60),
  ordem: z.number().int().min(1).max(12),
  horario: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido").nullish(),
}).strict();
export const configuracaoOrdenhaSchema = z.object({
  chave: uuid,
  propriedadeId: propriedadeLeiteSchema,
  vigenteDesde: dataLeiteSchema,
  ordenhas: z.array(posicaoOrdenhaSchema).min(1).max(12),
}).strict().superRefine((valor, ctx) => {
  for (const campo of ["posicaoId", "ordem"] as const) {
    if (new Set(valor.ordenhas.map(o => o[campo])).size !== valor.ordenhas.length)
      ctx.addIssue({ code: "custom", path: ["ordenhas"], message: "As posições e ordens das ordenhas devem ser únicas" });
  }
});
export const medicaoLeiteSchema = z.object({
  animalId: uuid,
  posicaoId: uuid,
  estado: z.enum(["MEDIDO", "NAO_ORDENHADO", "PENDENTE"]),
  litros: z.number().finite().min(0).max(9999999.999).nullish(),
  motivo: z.string().trim().max(500).nullish(),
}).strict().superRefine((valor, ctx) => {
  if (valor.estado === "MEDIDO") {
    if (valor.litros == null || new Prisma.Decimal(valor.litros).decimalPlaces() > 3)
      ctx.addIssue({ code: "custom", path: ["litros"], message: "Informe litros, inclusive zero, com até três casas decimais" });
  } else if (valor.litros != null) {
    ctx.addIssue({ code: "custom", path: ["litros"], message: "Litros só podem ser informados em uma medição realizada" });
  }
  if (valor.estado === "NAO_ORDENHADO" && (!valor.motivo || valor.motivo.length < 5))
    ctx.addIssue({ code: "custom", path: ["motivo"], message: "Explique por que o animal não foi ordenhado" });
});
export const salvarFolhaSchema = z.object({
  chave: uuid,
  propriedadeId: propriedadeLeiteSchema,
  dataOperacional: dataLeiteSchema,
  versaoEsperada: z.number().int().nonnegative(),
  medicoes: z.array(medicaoLeiteSchema).max(10000),
  animaisAdicionar: z.array(uuid).max(2000).default([]),
  animaisExcluir: z.array(uuid).max(2000).default([]),
  motivoCorrecao: z.string().trim().min(5).max(500).nullish(),
}).strict().superRefine((valor, ctx) => {
  const celulas = valor.medicoes.map(m => `${m.animalId}:${m.posicaoId}`);
  if (new Set(celulas).size !== celulas.length)
    ctx.addIssue({ code: "custom", path: ["medicoes"], message: "Há mais de uma medição para o mesmo animal e ordenha" });
  if (new Set(valor.animaisAdicionar).size !== valor.animaisAdicionar.length ||
      new Set(valor.animaisExcluir).size !== valor.animaisExcluir.length ||
      valor.animaisAdicionar.some(id => valor.animaisExcluir.includes(id)))
    ctx.addIssue({ code: "custom", path: ["animaisAdicionar"], message: "Inclusões e exclusões devem identificar animais distintos" });
});
export const consultaFolhaSchema = z.object({ dataOperacional: dataLeiteSchema, propriedadeId: z.coerce.number().int().min(1).max(2147483647).optional() });
export const consultaConfiguracaoSchema = z.object({ data: dataLeiteSchema, propriedadeId: z.coerce.number().int().min(1).max(2147483647).optional() });
export const consultaCandidatosSchema = consultaFolhaSchema.extend({ busca: z.string().trim().max(100).default(""), pagina: z.coerce.number().int().min(1).max(100000).default(1) });
export type ConfiguracaoOrdenhaInput = z.infer<typeof configuracaoOrdenhaSchema>;
export type SalvarFolhaInput = z.infer<typeof salvarFolhaSchema>;
export type MedicaoLeiteInput = z.infer<typeof medicaoLeiteSchema>;
export type PosicaoOrdenhaDTO = z.infer<typeof posicaoOrdenhaSchema>;
