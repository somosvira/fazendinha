import { z } from "zod";
const linha = z.record(z.string().nullable());
const fato = z.object({
  origem: z.literal("IDEAGRI"),
  chaveExterna: z.string().min(1),
  tipo: z.enum(["IA", "COBERTURA", "TE", "DIAGNOSTICO", "PARTO"]).nullable(),
  animalIdeagriId: z.number().int().positive(),
  data: z.string().date(),
  hora: z.string().nullable(),
  tentativaChave: z.string().nullable(),
  resultado: z.enum(["POSITIVO", "NEGATIVO", "INCONCLUSIVO"]).nullable(),
  desfecho: z.enum(["ABORTO", "NATIMORTO", "MISTO", "VIVO"]).nullable(),
  desfechoOriginal: z.string().nullable(),
  contaParidade: z.boolean(),
  anteriorEntrada: z.boolean(),
  quantidade: z.string().nullable(),
  criasComReferencia: z.array(z.number().int().positive()),
  snapshot: linha,
});
export const cargaSchema = z.object({
  versao: z.literal(4),
  origem: z.literal("IDEAGRI"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  fatos: z.array(fato),
  lactacoes: z.array(
    z.object({
      origem: z.literal("IDEAGRI"),
      chaveExterna: z.string(),
      animalIdeagriId: z.number().int(),
      inicio: z.string().date(),
      fim: z.string().date().nullable(),
      partoChave: z.string().nullable(),
      snapshot: linha,
    }),
  ),
  periodos: z.array(
    z.object({
      origem: z.literal("IDEAGRI"),
      chaveExterna: z.string(),
      animalIdeagriId: z.number().int(),
      tipo: z.enum(["DOADORA", "RECEPTORA", "DESCARTE", "DESCONHECIDO"]),
      inicio: z.string().date(),
      fim: z.string().date().nullable(),
      snapshot: linha,
    }),
  ),
  animais: z.array(linha),
  programacoes: z.array(linha),
  participacoes: z.array(linha),
  protocolos: z.array(linha),
  etapas: z.array(linha),
  catalogos: z.object({
    tiposParto: z.array(linha),
    motivosSecagem: z.array(linha),
  }),
  relatorio: z.object({
    totais: z.record(z.number()),
    porTipo: z.record(z.number()),
    pendencias: z.array(
      z.object({ chave: z.string(), codigo: z.string(), mensagem: z.string() }),
    ),
  }),
});
export const mapeamentoSchema = z.object({
  bancoOrigem: z.string().min(1),
  autorId: z.number().int().positive(),
  saldoAnteriorPorParto: z.record(z.boolean()).default({}),
  cicloPorTentativa: z.record(z.number().int().nonnegative()).default({}),
  criasPorParto: z
    .record(
      z.array(
        z.object({
          animalIdeagriId: z.number().int().positive(),
          ordem: z.number().int().positive(),
        }),
      ),
    )
    .default({}),
});
export type CargaV4 = z.infer<typeof cargaSchema>;
export type MapeamentoV4 = z.infer<typeof mapeamentoSchema>;
export type FatoV4 = z.infer<typeof fato>;
